import axios, { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'

import { authTokenManager } from '@/services/authTokenManager'

/**
 * ============================================================
 * BigStock - Axios Client
 * ============================================================
 *
 * JWT 由 authTokenManager 統一管理。
 *
 * 本檔案只負責：
 *
 * 1. REST API Request
 * 2. 自動帶入 Authorization
 * 3. Bootstrap API 白名單
 * 4. 後端 JWT 更新 Header
 * 5. 401 自動恢復與單次重試
 * 6. 會員 Login Token 儲存
 */

/**
 * 401 重試旗標。
 *
 * 避免：
 *
 * API 401
 *   -> 更新 JWT
 *   -> 重送 API
 *   -> 再次 401
 *   -> 無限循環
 */
interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
}

/**
 * BigStock API Client。
 *
 * 維持既有的 /api Proxy 路徑。
 */
const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
})

/**
 * Bootstrap API 不要求現有 JWT。
 *
 * 這些請求是用來建立認證狀態，
 * 不能在 Request Interceptor 裡
 * 再呼叫 getValidToken()。
 */
function isAuthBootstrapRequest(url?: string): boolean {
  if (!url) return false

  return ['/auth/login', '/auth/tempToken', '/device/register', '/device/verify'].some((path) =>
    url.includes(path),
  )
}

/**
 * 統一設定 Authorization Header。
 */
function setAuthorization(config: InternalAxiosRequestConfig, token: string): void {
  const headers = AxiosHeaders.from(config.headers)

  headers.set('Authorization', token)

  config.headers = headers
}

/**
 * ============================================================
 * Request Interceptor
 * ============================================================
 *
 * 一般 API：
 * 向 authTokenManager 取得有效 JWT。
 *
 * Bootstrap API：
 * 不執行 JWT 驗證。
 */
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> => {
    if (isAuthBootstrapRequest(config.url)) {
      return config
    }

    /*
     * 不再自行：
     *
     * localStorage.getItem('authToken')
     * isTokenExpiringSoon()
     * fetchGuestToken()
     *
     * 全部改由 Token Manager 負責。
     */
    const token = await authTokenManager.getValidToken()

    setAuthorization(config, token)

    return config
  },

  (error: unknown) => Promise.reject(error),
)

/**
 * ============================================================
 * Response Interceptor
 * ============================================================
 */
apiClient.interceptors.response.use(
  (response) => {
    /**
     * 後端可能主動透過 Header
     * 回傳更新後的 JWT。
     */
    const refreshedToken = response.headers['x-refreshed-token']

    if (typeof refreshedToken === 'string' && refreshedToken.trim()) {
      const exp = response.data?.exp

      authTokenManager.setToken(refreshedToken, exp)
    }

    /**
     * 會員登入成功後：
     * 儲存 Access Token。
     *
     * 注意：
     * 不讓一般 Guest Token Refresh
     * 覆蓋尚未過期的會員 JWT。
     */
    if (response.config.url?.includes('/auth/login') && response.data?.accessToken) {
      authTokenManager.setToken(response.data.accessToken, response.data.exp)
    }

    return response
  },

  /**
   * ----------------------------------------------------------
   * 401 錯誤處理
   * ----------------------------------------------------------
   */
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) {
      return Promise.reject(error)
    }

    const originalRequest = error.config as RetryableRequestConfig | undefined

    /**
     * Bootstrap API 發生 401：
     *
     * 不可以再次要求 Guest JWT。
     *
     * 否則 /auth/tempToken 失敗後，
     * 會不斷呼叫自己。
     */
    if (isAuthBootstrapRequest(originalRequest?.url)) {
      return Promise.reject(error)
    }

    /**
     * 非 401、缺少 Request Config、
     * 或已經重試過：
     *
     * 直接回傳錯誤。
     */
    if (error.response?.status !== 401 || !originalRequest || originalRequest._retry) {
      return Promise.reject(error)
    }

    originalRequest._retry = true

    try {
      /**
       * 取得此次遭拒的 JWT。
       *
       * 若其他 API 已經先更新成功，
       * Token Manager 會直接重用新 JWT。
       */
      const rejectedToken = AxiosHeaders.from(originalRequest.headers).get('Authorization')

      const newToken = await authTokenManager.recoverRejectedToken(
        typeof rejectedToken === 'string' ? rejectedToken : null,
      )

      /**
       * 使用新 JWT 重送原始 API。
       */
      setAuthorization(originalRequest, newToken)

      return apiClient(originalRequest)
    } catch (refreshError: unknown) {
      console.error('[AUTH] JWT 恢復失敗', refreshError)

      return Promise.reject(refreshError)
    }
  },
)

export default apiClient
