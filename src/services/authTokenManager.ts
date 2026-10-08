
import axios from 'axios'
import { ensureFcmVerified } from '@/firebase/fcmStartup'

/**
 * ============================================================
 * BigStock - Auth Token Manager
 * ============================================================
 *
 * 全站 JWT 唯一管理入口。
 *
 * 提供：
 * - getToken()
 * - setToken()
 * - getExpirationTime()
 * - isExpiring()
 * - getValidToken()
 * - refreshToken()
 * - clearToken()
 *
 * REST API / WebSocket 共用這份管理器。
 *
 * JWT 由後端 /auth/tempToken 核發，
 * 不是 Firebase FCM Token。
 */

interface TempTokenResponse {
  token: string
  exp?: number | string
}

interface JwtPayload {
  exp?: number
  role?: string | number
  roles?: Array<string | number>
}

/**
 * Token 提前更新時間：60 秒。
 *
 * 不沿用原本 15 分鐘，
 * 避免短效 JWT 被過度頻繁刷新。
 */
const REFRESH_BUFFER_SECONDS = 60

/**
 * 單獨建立 Bootstrap Axios。
 *
 * 不使用 bstockAxios.ts 的 apiClient，
 * 避免：
 *
 * authTokenManager
 *   -> apiClient interceptor
 *   -> authTokenManager
 *
 * 的循環相依。
 */
const bootstrapClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
})

/**
 * 多個 REST API / WebSocket 同時發現 JWT
 * 即將過期時，只允許執行一次更新。
 */
let refreshPromise: Promise<string> | null = null

/**
 * 本次頁面執行期間的 Token 版本。
 *
 * 防止使用者登出或切換帳號後，
 * 舊的非同步更新結果覆寫新狀態。
 */
let tokenGeneration = 0

function normalizeToken(token: string): string {
  return token.replace(/^Bearer\s+/i, '').trim()
}

function readJwtPayload(
  token: string,
): JwtPayload | null {
  try {
    const jwt = normalizeToken(token)
    const encoded = jwt.split('.')[1]

    if (!encoded) return null

    const base64 = encoded
      .replace(/-/g, '+')
      .replace(/_/g, '/')

    const padded = base64.padEnd(
      Math.ceil(base64.length / 4) * 4,
      '=',
    )

    const decoded = JSON.parse(
      atob(padded),
    ) as JwtPayload

    return decoded
  } catch {
    return null
  }
}

/**
 * 將後端 exp 正規化成 Unix seconds。
 *
 * JWT 標準 exp 使用秒。
 * 若後端另外回傳毫秒值也一併支援。
 */
function normalizeExpiry(
  value: unknown,
): number | null {
  if (
    typeof value !== 'number' &&
    typeof value !== 'string'
  ) {
    return null
  }

  const parsed = Number(value)

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }

  return parsed > 1e12
    ? Math.floor(parsed / 1000)
    : Math.floor(parsed)
}

/**
 * 讀取本地儲存的 JWT。
 *
 * 回傳完整 Bearer 格式，
 * 供 Axios Authorization Header 使用。
 */
function getToken(): string | null {
  const raw = localStorage.getItem('authToken')

  if (!raw) return null

  const jwt = normalizeToken(raw)

  return jwt ? `Bearer ${jwt}` : null
}

/**
 * JWT 寫入單一入口。
 *
 * 必須同步更新 tokenExp，
 * 避免儲存新的 JWT 卻保留舊到期時間。
 */
function setToken(
  token: string,
  serverExp?: number | string | null,
): void {
  const jwt = normalizeToken(token)

  if (!jwt) {
    throw new Error('JWT 不可為空')
  }

  const exp =
    normalizeExpiry(readJwtPayload(jwt)?.exp) ??
    normalizeExpiry(serverExp)

  localStorage.setItem(
    'authToken',
    `Bearer ${jwt}`,
  )

  if (exp !== null) {
    localStorage.setItem(
      'tokenExp',
      String(exp),
    )
  } else {
    localStorage.removeItem('tokenExp')
  }

  tokenGeneration++
}

/**
 * 優先讀取 JWT Payload 裡的 exp。
 *
 * 舊版儲存的 tokenExp 僅作為備援。
 */
function getExpirationTime(
  token?: string | null,
): number | null {
  const target = token ?? getToken()

  if (!target) return null

  const jwtExp = normalizeExpiry(
    readJwtPayload(target)?.exp,
  )

  if (jwtExp !== null) {
    return jwtExp
  }

  /*
   * 只有確認目標是目前儲存的 JWT，
   * 才允許使用 localStorage.tokenExp。
   */
  const stored = getToken()

  if (
    stored &&
    normalizeToken(stored) === normalizeToken(target)
  ) {
    return normalizeExpiry(
      localStorage.getItem('tokenExp'),
    )
  }

  return null
}

/**
 * 判斷 JWT 是否即將到期。
 *
 * 無法確認期限時採保守策略：
 * 要求重新取得 JWT。
 */
function isExpiring(
  token?: string | null,
  bufferSeconds = REFRESH_BUFFER_SECONDS,
): boolean {
  const target = token ?? getToken()

  if (!target) return true

  const exp = getExpirationTime(target)

  if (exp === null) return true

  const now = Math.floor(Date.now() / 1000)

  return exp <= now + bufferSeconds
}

/**
 * 辨識目前 JWT 是否為 Guest。
 *
 * 延續原本 role=4 的定義。
 */
function isGuestToken(
  token?: string | null,
): boolean {
  const target = token ?? getToken()

  if (!target) return false

  const payload = readJwtPayload(target)

  const role =
    payload?.role ??
    payload?.roles?.[0]

  return String(role) === '4'
}

/**
 * Guest JWT 實際核發流程：
 *
 * ensureFcmVerified()
 *       ↓
 * /device/register
 *       ↓
 * DEVICE_VERIFY
 *       ↓
 * /device/verify
 *       ↓
 * 已驗證的 FCM Token
 *       ↓
 * POST /auth/tempToken
 *       ↓
 * 新 Guest JWT
 *
 * FCM 驗證流程沿用現有實作。
 */
async function requestGuestToken():
  Promise<{
    token: string
    exp?: number | string
  }> {

  const verifiedFcmToken =
    await ensureFcmVerified()

  const response =
    await bootstrapClient.post<TempTokenResponse>(
      '/auth/tempToken',
      {
        token: verifiedFcmToken,
      },
    )

  if (!response.data?.token) {
    throw new Error(
      '/auth/tempToken 未回傳 JWT',
    )
  }

  return {
    token: response.data.token,
    exp: response.data.exp,
  }
}

/**
 * 強制重新取得 Guest JWT。
 *
 * 無論本地 Token 是否過期，
 * 都會重新執行核發流程。
 *
 * 並發呼叫共用同一個 Promise。
 */
async function refreshToken(): Promise<string> {
  if (refreshPromise) {
    return refreshPromise
  }

  const generation = tokenGeneration

  const task = (async (): Promise<string> => {
    const result = await requestGuestToken()

    /*
     * 更新期間若有其他登入／登出動作，
     * 不允許舊結果覆寫目前 Token。
     */
    if (generation !== tokenGeneration) {
      const current = getToken()

      if (current && !isExpiring(current)) {
        return current
      }

      throw new Error(
        'JWT 狀態已改變，取消舊的更新結果',
      )
    }

    /*
     * 確認核發的新 Token 有效，
     * 才寫入 localStorage。
     */
    const normalized = normalizeToken(result.token)

    const exp =
      normalizeExpiry(
        readJwtPayload(normalized)?.exp,
      ) ?? normalizeExpiry(result.exp)

    if (
      exp === null ||
      exp <= Math.floor(Date.now() / 1000) +
        REFRESH_BUFFER_SECONDS
    ) {
      throw new Error(
        '新核發的 Guest JWT 缺少有效期限或即將過期',
      )
    }

    setToken(normalized, result.exp)

    const stored = getToken()

    if (!stored) {
      throw new Error(
        'Guest JWT 儲存失敗',
      )
    }

    return stored
  })()

  refreshPromise = task

  try {
    return await task
  } finally {
    if (refreshPromise === task) {
      refreshPromise = null
    }
  }
}

/**
 * 取得目前可用的 JWT。
 *
 * Guest：
 * - 有效：直接使用
 * - 快到期：自動更新
 *
 * 會員：
 * - 有效：直接使用
 * - 快到期：目前不擅自替換成 Guest
 *
 * 會員 Refresh Token 流程日後再整合。
 */
async function getValidToken(): Promise<string> {
  /*
   * 若更新已經開始，
   * 所有請求應等待同一個更新結果。
   */
  if (refreshPromise) {
    return refreshPromise
  }

  const current = getToken()

  if (current && !isExpiring(current)) {
    return current
  }

  if (current && !isGuestToken(current)) {
    throw new Error(
      '會員 JWT 已到期，目前尚未整合會員 Refresh Token',
    )
  }

  return refreshToken()
}

/**
 * 清除目前 JWT 及有效期限。
 */
function clearToken(): void {
  tokenGeneration++

  localStorage.removeItem('authToken')
  localStorage.removeItem('tokenExp')
}

/**
 * 當後端明確拒絕某個 JWT 時，
 * 先檢查是否已有其他請求更新 Token。
 *
 * 如果 Token 已改變：
 * 直接重用最新 Token，不需要再更新一次。
 */
async function recoverRejectedToken(
  rejectedToken?: string | null,
): Promise<string> {
  if (refreshPromise) {
    return refreshPromise
  }

  const current = getToken()

  if (
    rejectedToken &&
    current &&
    normalizeToken(current) !==
      normalizeToken(rejectedToken) &&
    !isExpiring(current)
  ) {
    return current
  }

  if (current && !isGuestToken(current)) {
    throw new Error(
      '會員 JWT 被拒絕，目前尚未整合會員重新登入流程',
    )
  }

  return refreshToken()
}

/**
 * 統一對外介面。
 */
export const authTokenManager = {
  getToken,
  setToken,
  getExpirationTime,
  isExpiring,
  isGuestToken,
  getValidToken,
  refreshToken,
  recoverRejectedToken,
  clearToken,
}
