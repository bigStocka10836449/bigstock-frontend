import axios from 'axios'

import {
  ensureFcmVerified,
} from '@/firebase/fcmStartup'


const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
})


// 判斷 token 是否即將過期（預設 15 分鐘內）
function isTokenExpiringSoon(bufferSeconds = 900): boolean {
  const expStr = localStorage.getItem('tokenExp')
  if (!expStr) return true

  const exp = parseInt(expStr, 10)
  if (isNaN(exp)) return true

  const now = Math.floor(Date.now() / 1000)

  return exp - now < bufferSeconds
}


// 判斷是否為 GUEST
function isGuest(token: string): boolean {
  try {
    // localStorage 儲存格式為 "Bearer xxx"
    // JWT decode 前需要先移除 Bearer
    const jwt = token.replace(/^Bearer\s+/i, '')

    const payload =
      JSON.parse(
        atob(jwt.split('.')[1]),
      )

    const role =
      payload?.role ??
      payload?.roles?.[0]

    return String(role) === '4'

  } catch {
    return false
  }
}


// 判斷是否為建立驗證狀態時使用的 API
// 這些 API 本身不能要求既有的 authToken，否則會造成循環呼叫
function isAuthBootstrapRequest(url?: string): boolean {
  if (!url) {
    return false
  }

  return (
    url.includes('/auth/login')
    ||
    url.includes('/auth/tempToken')
    ||
    url.includes('/device/register')
    ||
    url.includes('/device/verify')
  )
}


// 避免多個 API 同時觸發取得 GUEST token
let guestTokenPromise: Promise<string | null> | null = null


// 取得新的 GUEST token
async function fetchGuestToken(): Promise<string | null> {

  // 已經有其他 request 正在取得 token
  // 直接共用同一個 Promise
  if (guestTokenPromise) {
    return guestTokenPromise
  }

  guestTokenPromise = doFetchGuestToken()

  try {
    return await guestTokenPromise

  } finally {
    guestTokenPromise = null
  }
}


// 實際執行取得 GUEST token
async function doFetchGuestToken(): Promise<string | null> {

  try {

    /*
     * 先確保 FCM token 已完成：
     *
     * /device/register
     *       ↓
     * DEVICE_VERIFY
     *       ↓
     * /device/verify
     *
     * 成功後會回傳 verified FCM token
     */
    const fcmToken =
      await ensureFcmVerified()


    /*
     * 將 verified FCM token 傳給後端。
     *
     * Backend:
     *
     * TempTokenVo {
     *     private String token;
     * }
     */
    const resp =
      await apiClient.post(
        '/auth/tempToken',
        {
          token: fcmToken,
        },
      )


    const token =
      `Bearer ${resp.data.token}`


    // 如果 tempToken API 有回傳 exp，一併更新
    if (resp.data?.exp) {
      localStorage.setItem(
        'tokenExp',
        resp.data.exp.toString(),
      )
    }


    return token

  } catch (error) {

    console.error(
      '[AUTH] Failed to obtain guest token:',
      error,
    )

    return null
  }
}


// Request Interceptor：自動掛上 token，並檢查是否需要 refresh
apiClient.interceptors.request.use(

  async (config) => {

    /*
     * Authentication bootstrap API 不需要既有 JWT。
     *
     * 特別是：
     *
     * /device/register
     * /device/verify
     * /auth/tempToken
     *
     * 否則會發生：
     *
     * fetchGuestToken()
     *   ↓
     * device/register
     *   ↓
     * interceptor
     *   ↓
     * fetchGuestToken()
     *   ↓
     * ...
     */
    if (
      isAuthBootstrapRequest(
        config.url,
      )
    ) {
      return config
    }


    let token =
      localStorage.getItem(
        'authToken',
      )


    if (
      !token
      ||
      isTokenExpiringSoon(900)
    ) {

      // 需要刷新
      if (
        !token
        ||
        isGuest(token)
      ) {

        token =
          await fetchGuestToken()

      } else {

        /*
         * 目前沿用你原本的邏輯：
         *
         * 非 Guest token 過期時，
         * 也是取得新的 temp token。
         *
         * 未來如果會員要使用 refresh token，
         * 可以在這裡改成不同流程。
         */
        token =
          await fetchGuestToken()
      }


      if (token) {
        localStorage.setItem(
          'authToken',
          token,
        )
      }
    }


    if (token) {

      config.headers =
        config.headers || {}


      config.headers[
        'Authorization'
      ] = token
    }


    return config
  },


  (error) =>
    Promise.reject(
      error instanceof Error
        ? error
        : new Error(
            error?.message ??
            'Request error',
          ),
    ),
)


// Response Interceptor：後端主動送 x-refreshed-token 時更新
apiClient.interceptors.response.use(

  (response) => {

    const refreshedToken =
      response.headers[
        'x-refreshed-token'
      ]


    const exp =
      response.data?.exp


    if (refreshedToken) {

      localStorage.setItem(
        'authToken',
        refreshedToken,
      )


      if (exp) {
        localStorage.setItem(
          'tokenExp',
          exp.toString(),
        )
      }
    }


    // Login 成功後儲存 accessToken
    if (
      response.config.url?.includes(
        '/auth/login',
      )
      &&
      response.data?.accessToken
    ) {

      const loginToken =
        `Bearer ${response.data.accessToken}`


      localStorage.setItem(
        'authToken',
        loginToken,
      )


      if (exp) {
        localStorage.setItem(
          'tokenExp',
          exp.toString(),
        )
      }
    }


    return response
  },


  async (error) => {

    const originalRequest =
      error.config


    /*
     * Bootstrap API 如果自己回傳 401，
     * 不可以再次執行 fetchGuestToken()。
     *
     * 例如：
     *
     * /auth/tempToken → 401
     *      ↓
     * fetchGuestToken()
     *      ↓
     * /auth/tempToken
     *      ↓
     * 401
     *      ↓
     * ...
     */
    if (
      isAuthBootstrapRequest(
        originalRequest?.url,
      )
    ) {
      return Promise.reject(error)
    }


    if (
      error.response?.status !== 401
      ||
      originalRequest?._retry
    ) {

      return Promise.reject(
        error instanceof Error
          ? error
          : new Error(
              error?.message ??
              'Unhandled request error',
            ),
      )
    }


    originalRequest._retry = true


    let token =
      localStorage.getItem(
        'authToken',
      )


    if (
      !token
      ||
      isGuest(token)
    ) {

      token =
        await fetchGuestToken()

    } else {

      /*
       * 目前沿用原本邏輯。
       *
       * 未來會員 token 如果有獨立的
       * refresh API，可以在這裡更換。
       */
      token =
        await fetchGuestToken()
    }


    if (token) {

      localStorage.setItem(
        'authToken',
        token,
      )


      originalRequest.headers =
        originalRequest.headers || {}


      originalRequest.headers[
        'Authorization'
      ] = token


      // 使用新的 token 重送原本的 request
      return apiClient(
        originalRequest,
      )
    }


    return Promise.reject(
      new Error(
        'Token refresh failed',
      ),
    )
  },
)


export default apiClient
