import axios, { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'
import { authTokenManager } from '@/services/authTokenManager'
import { httpClientConfig } from '@/services/httpClientConfig'

declare module 'axios' {
  export interface AxiosRequestConfig {
    skipAuthRefresh?: boolean
  }
}

interface InternalBigStockConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
  _sessionGeneration?: number
}

const apiClient = axios.create(httpClientConfig)
const bootstrapPaths = new Set([
  '/auth/csrf', '/auth/wToken', '/auth/tempToken',
  '/device/register', '/device/verify',
])
function isBootstrap(url?: string): boolean {
  if (!url) return false
  const path = url.split('?')[0].replace(/^\/api(?=\/)/, '')
  return bootstrapPaths.has(path)
}

apiClient.interceptors.request.use(async (request) => {
  const config = request as InternalBigStockConfig
  const headers = AxiosHeaders.from(config.headers)
  headers.delete('Authorization')
  config.headers = headers
  if (config.skipAuthRefresh || isBootstrap(config.url)) return config
  await authTokenManager.ensureSession()
  config._sessionGeneration = authTokenManager.getSessionVersion()
  return config
})

apiClient.interceptors.response.use(
  response => response,
  async error => {
    if (!axios.isAxiosError(error)) return Promise.reject(error)
    const config = error.config as InternalBigStockConfig | undefined
    if (!config || config.skipAuthRefresh || isBootstrap(config.url) ||
      error.response?.status !== 401 || config._retry) {
      return Promise.reject(error)
    }
    config._retry = true
    try {
      await authTokenManager.recoverUnauthorized(config._sessionGeneration)
      // Axios sends refreshed HttpOnly Cookie automatically.
      return apiClient(config)
    } catch (recoveryError) {
      return Promise.reject(recoveryError)
    }
  },
)
export default apiClient
