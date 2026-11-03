import axios, {
  AxiosHeaders,
  type InternalAxiosRequestConfig,
} from 'axios'

import { authTokenManager } from '@/services/authTokenManager'

/**
 * ============================================================
 * BigStock Axios Client
 * ============================================================
 *
 * Authentication:
 * HttpOnly Cookie
 *
 * Backend:
 * /auth/wToken
 */

interface BigStockRequestConfig
  extends InternalAxiosRequestConfig {

  _retry?: boolean

  _sessionVersion?: number

  skipAuthRefresh?: boolean
}

/**
 * Main API Client.
 */
const apiClient = axios.create({

  baseURL: '/api',

  timeout: 30000,

  withCredentials: true,

  xsrfCookieName: 'XSRF-TOKEN',

  xsrfHeaderName: 'X-XSRF-TOKEN',

  withXSRFToken: true,

  headers: {
    'Content-Type': 'application/json',
  },
})

/**
 * Bootstrap endpoints must not trigger
 * authentication recursively.
 */
function isAuthBootstrapRequest(
  url?: string,
): boolean {

  if (!url) return false

  const path = url.split('?')[0]

  const bootstrapPaths = [
    '/auth/wToken',
    '/auth/tempToken',
    '/device/register',
    '/device/web/register',
    '/device/verify',
  ]

  return bootstrapPaths.some(
    endpoint =>
      path === endpoint ||
      path === `/api${endpoint}`,
  )
}

/**
 * ============================================================
 * Request Interceptor
 * ============================================================
 */
apiClient.interceptors.request.use(

  async (
    config: InternalAxiosRequestConfig,
  ): Promise<InternalAxiosRequestConfig> => {

    const request =
      config as BigStockRequestConfig

    /**
     * Remove any legacy JWT Authorization header.
     *
     * Web must use Cookie authentication.
     */
    const headers = AxiosHeaders.from(request.headers)

    headers.delete('Authorization')

    request.headers = headers

    /**
     * Authentication bootstrap endpoints.
     */
    if (
      request.skipAuthRefresh ||
      isAuthBootstrapRequest(request.url)
    ) {
      return request
    }

    /**
     * Ensure current Cookie session is ready.
     */
    await authTokenManager.ensureSession()

    /**
     * Remember the session version associated
     * with this particular request.
     */
    request._sessionVersion =
      authTokenManager.getSessionVersion()

    return request
  },

  error => Promise.reject(error),
)

/**
 * ============================================================
 * Response Interceptor
 * ============================================================
 */
apiClient.interceptors.response.use(

  response => response,

  async error => {

    if (!axios.isAxiosError(error)) {
      return Promise.reject(error)
    }

    const originalRequest =
      error.config as BigStockRequestConfig | undefined

    if (!originalRequest) {
      return Promise.reject(error)
    }

    /**
     * Do not refresh on bootstrap endpoints.
     */
    if (
      originalRequest.skipAuthRefresh ||
      isAuthBootstrapRequest(originalRequest.url)
    ) {
      return Promise.reject(error)
    }

    /**
     * Only retry once after HTTP 401.
     */
    if (
      error.response?.status !== 401 ||
      originalRequest._retry
    ) {
      return Promise.reject(error)
    }

    originalRequest._retry = true

    try {

      await authTokenManager.recoverUnauthorized(
        originalRequest._sessionVersion,
      )

      /**
       * Cookie was refreshed by /auth/wToken.
       *
       * Axios automatically sends the new Cookie.
       */
      return apiClient(originalRequest)

    } catch (refreshError: unknown) {

      console.error(
        '[AUTH] Cookie session recovery failed',
        refreshError,
      )

      return Promise.reject(refreshError)
    }
  },
)

export default apiClient
