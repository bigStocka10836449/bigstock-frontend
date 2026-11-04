import type { CreateAxiosDefaults } from 'axios'

/** Same-origin /api proxy is required for Axios to read XSRF-TOKEN. */
export const httpClientConfig: CreateAxiosDefaults = {
  baseURL: '/api',
  timeout: 30_000,
  withCredentials: true,
  withXSRFToken: true,
  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',
  headers: { 'Content-Type': 'application/json' },
}
