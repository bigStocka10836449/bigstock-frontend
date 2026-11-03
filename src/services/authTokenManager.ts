import axios from 'axios'

import { ensureFcmVerified } from '@/firebase/fcmStartup'

/**
 * ============================================================
 * BigStock Web Guest Session Manager
 * ============================================================
 *
 * Web JWT is stored in HttpOnly Cookie.
 *
 * No JWT is accessible to frontend JavaScript.
 *
 * Original FCM flow remains unchanged.
 */

interface WebTokenResponse {
  authenticated: boolean
  exp: number | string
}

const REFRESH_BUFFER_SECONDS = 60

/**
 * Bootstrap API must use a separate Axios instance.
 *
 * Avoid circular dependencies:
 *
 * authTokenManager
 *    -> bstockAxios
 *    -> authTokenManager
 */
const bootstrapClient = axios.create({
  baseURL: '/api',

  timeout: 30000,

  withCredentials: true,

  headers: {
    'Content-Type': 'application/json',
  },

  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',
  withXSRFToken: true,
})

/**
 * Session expiration in Unix seconds.
 *
 * null means unknown.
 *
 * After browser refresh, HttpOnly Cookie may
 * still be valid, so unknown does not mean expired.
 */
let sessionExpiresAt: number | null = null

/**
 * Concurrent requests share one refresh operation.
 */
let refreshPromise: Promise<void> | null = null

/**
 * Used to prevent repeated 401 requests from
 * triggering sequential refresh operations.
 */
let sessionVersion = 0

/**
 * Converts Date / Unix seconds / Unix milliseconds
 * to Unix seconds.
 */
function normalizeExpiry(value: unknown): number {

  if (typeof value === 'number') {

    if (!Number.isFinite(value) || value <= 0) {
      throw new Error('Invalid session expiration')
    }

    return value > 1e12
      ? Math.floor(value / 1000)
      : Math.floor(value)
  }

  if (typeof value === 'string') {

    const trimmed = value.trim()

    if (!trimmed) {
      throw new Error('Empty session expiration')
    }

    const numeric = Number(trimmed)

    if (Number.isFinite(numeric) && numeric > 0) {

      return numeric > 1e12
        ? Math.floor(numeric / 1000)
        : Math.floor(numeric)
    }

    const timestamp = Date.parse(trimmed)

    if (Number.isFinite(timestamp)) {
      return Math.floor(timestamp / 1000)
    }
  }

  throw new Error('Unsupported session expiration format')
}

/**
 * Return current expiration.
 */
function getExpirationTime(): number | null {
  return sessionExpiresAt
}

/**
 * Return current session generation.
 *
 * Used to coordinate concurrent 401 responses.
 */
function getSessionVersion(): number {
  return sessionVersion
}

/**
 * Whether known session expiration is approaching.
 *
 * Unknown expiration:
 * We first try the existing browser Cookie.
 */
function isExpiring(
  bufferSeconds = REFRESH_BUFFER_SECONDS,
): boolean {

  if (sessionExpiresAt === null) {
    return false
  }

  const now = Math.floor(Date.now() / 1000)

  return sessionExpiresAt <= now + bufferSeconds
}

/**
 * Existing FCM verification process:
 *
 * Turnstile
 *     ↓
 * Device Registration
 *     ↓
 * FCM Challenge
 *     ↓
 * Device Verification
 *     ↓
 * Verified FCM Token
 *     ↓
 * POST /auth/wToken
 */
async function requestWebToken(): Promise<number> {

  const verifiedFcmToken =
    await ensureFcmVerified()

  const response =
    await bootstrapClient.post<WebTokenResponse>(
      '/auth/wToken',
      {
        token: verifiedFcmToken,
      },
    )

  if (response.data?.authenticated !== true) {

    throw new Error(
      '/auth/wToken authentication failed',
    )
  }

  const expiration =
    normalizeExpiry(response.data.exp)

  const now = Math.floor(Date.now() / 1000)

  if (expiration <= now) {

    throw new Error(
      '/auth/wToken returned expired session',
    )
  }

  return expiration
}

/**
 * Request and establish a fresh Cookie session.
 *
 * Only one request is executed concurrently
 * within the current browser page.
 */
async function refreshToken(): Promise<void> {

  if (refreshPromise) {
    return refreshPromise
  }

  const task = (async () => {

    const expiration = await requestWebToken()

    sessionExpiresAt = expiration

    sessionVersion++

  })()

  refreshPromise = task

  try {
    await task
  } finally {

    if (refreshPromise === task) {
      refreshPromise = null
    }
  }
}

/**
 * Ensure Cookie session is ready.
 *
 * Fresh page:
 * Do not immediately force FCM verification.
 *
 * Let the browser send its existing Cookie.
 */
async function ensureSession(): Promise<void> {

  if (refreshPromise) {
    return refreshPromise
  }

  if (isExpiring()) {
    await refreshToken()
  }
}

/**
 * Called after receiving an HTTP 401.
 *
 * If another API already refreshed the session
 * after this request started, do not refresh again.
 */
async function recoverUnauthorized(
  rejectedSessionVersion?: number,
): Promise<void> {

  if (refreshPromise) {
    return refreshPromise
  }

  if (
    rejectedSessionVersion !== undefined &&
    rejectedSessionVersion < sessionVersion
  ) {
    return
  }

  sessionExpiresAt = null

  await refreshToken()
}

/**
 * Local metadata only.
 *
 * Cannot delete the HttpOnly Cookie.
 */
function clearSessionMetadata(): void {

  sessionExpiresAt = null

  sessionVersion++
}

export const authTokenManager = {
  ensureSession,
  refreshToken,
  recoverUnauthorized,
  getExpirationTime,
  getSessionVersion,
  isExpiring,
  clearSessionMetadata,
}
