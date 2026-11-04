import axios from 'axios'
import { ensureCsrfToken } from '@/services/csrfService'
import { httpClientConfig } from '@/services/httpClientConfig'
import { requestTurnstileToken } from '@/security/services/turnstileTokenService'

interface WebSessionResponse {
  authenticated: boolean
  exp: number | string
}

const bootstrapClient = axios.create(httpClientConfig)
const BUFFER_SECONDS = 60
let expiresAt: number | null = null
let generation = 0
let pending: Promise<void> | null = null

function normalizeExpiry(value: number | string): number {
  const numeric = Number(value)
  if (Number.isFinite(numeric) && numeric > 0) {
    return Math.floor(numeric > 1e12 ? numeric / 1000 : numeric)
  }
  const date = Date.parse(String(value))
  if (Number.isFinite(date)) return Math.floor(date / 1000)
  throw new Error('INVALID_SESSION_EXPIRATION')
}

function setSession(response: WebSessionResponse): void {
  if (response?.authenticated !== true) throw new Error('INVALID_WEB_SESSION_RESPONSE')
  const exp = normalizeExpiry(response.exp)
  if (exp <= Math.floor(Date.now() / 1000) + BUFFER_SECONDS) {
    throw new Error('WEB_SESSION_EXPIRED')
  }
  expiresAt = exp
  generation++
}

function isExpiring(): boolean {
  return expiresAt === null || expiresAt <= Math.floor(Date.now() / 1000) + BUFFER_SECONDS
}

/** GET checks server-side Redis binding, not merely browser cookie existence. */
async function checkExistingSession(): Promise<boolean> {
  try {
    const response = await bootstrapClient.get<WebSessionResponse>('/auth/session', {
      headers: { 'Cache-Control': 'no-cache' },
    })
    setSession(response.data)
    return true
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) return false
    throw error // 403, 5xx, network errors: do not silently mint a new JWT
  }
}

async function issueWebSession(): Promise<void> {
  await ensureCsrfToken()
  const turnstileToken = await requestTurnstileToken()
  // Do not log, store or reuse Turnstile token; one token = one Siteverify.
  const response = await bootstrapClient.post<WebSessionResponse>('/auth/wToken', {
    turnstileToken,
  })
  setSession(response.data)
}

function singleFlight(work: () => Promise<void>): Promise<void> {
  if (pending) return pending
  const task = work()
  pending = task
  void task.finally(() => { if (pending === task) pending = null }).catch(() => undefined)
  return task
}

/** Check Cookie/Redis first on reload. Show Turnstile only on HTTP 401. */
function ensureSession(): Promise<void> {
  if (pending) return pending
  if (!isExpiring()) return Promise.resolve()
  return singleFlight(async () => {
    if (!(await checkExistingSession())) await issueWebSession()
  })
}

/** Explicit auth rejection -> recheck server; avoid repeated challenges. */
function recoverUnauthorized(rejectedGeneration?: number): Promise<void> {
  if (pending) return pending
  if (rejectedGeneration !== undefined && rejectedGeneration < generation && !isExpiring()) {
    return Promise.resolve()
  }
  expiresAt = null
  return ensureSession()
}

/** Called only when the WebSocket reports an authentication error. */
function refreshToken(): Promise<void> {
  expiresAt = null
  return ensureSession()
}

function clearSessionMetadata(): void {
  expiresAt = null
  generation++
  // Cookie deletion must be implemented by a backend logout endpoint.
}

export const authTokenManager = {
  ensureSession,
  recoverUnauthorized,
  refreshToken,
  clearSessionMetadata,
  getSessionVersion: () => generation,
  getExpirationTime: () => expiresAt,
  isExpiring,
}
