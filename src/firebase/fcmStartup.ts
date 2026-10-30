import { ref } from 'vue'

import { getNotificationPermission } from './fcm'

import { registerAndVerifyFcmDevice } from '@/security/services/fcmDeviceVerification'

/**
 * Events used by the existing UI.
 */
export const FCM_PERMISSION_REQUIRED_EVENT = 'fcm-permission-required'

export const FCM_PERMISSION_DENIED_EVENT = 'fcm-permission-denied'

/**
 * Reactive state shared with App.vue.
 *
 * When true, display the Turnstile verification UI.
 */
export const turnstileRequired = ref(false)

/**
 * Prevent multiple callers from starting
 * multiple verification flows.
 */
let verificationPromise: Promise<string> | null = null

/**
 * The pending Turnstile challenge.
 */
let turnstilePromise: Promise<string> | null = null

let resolveTurnstile: ((token: string) => void) | null = null

let rejectTurnstile: ((error: Error) => void) | null = null

/**
 * Dispatch existing FCM permission UI events.
 */
function dispatchPermissionEvent(eventName: string): void {
  window.dispatchEvent(new CustomEvent(eventName))
}

/**
 * Request a Turnstile token from the Vue UI.
 *
 * Multiple requests reuse the same pending Promise.
 */
function requestTurnstileToken(): Promise<string> {
  if (turnstilePromise) {
    return turnstilePromise
  }

  turnstilePromise = new Promise<string>((resolve, reject) => {
    resolveTurnstile = resolve
    rejectTurnstile = reject
  })

  turnstileRequired.value = true

  return turnstilePromise
}

/**
 * Called by WebDeviceVerificationView.vue
 * when Cloudflare Turnstile succeeds.
 *
 * This only means the browser has a Turnstile
 * token. Spring Boot must still verify it.
 */
export function submitTurnstileToken(token: string): void {
  if (!token?.trim()) {
    return
  }

  if (!resolveTurnstile) {
    return
  }

  const resolve = resolveTurnstile

  resolveTurnstile = null
  rejectTurnstile = null
  turnstilePromise = null

  // Keep the verification UI mounted until
  // the complete FCM process finishes.
  resolve(token)
}

/**
 * Cancel the pending Turnstile request.
 *
 * Use this when a user explicitly cancels
 * the verification UI.
 */
export function cancelTurnstileVerification(): void {
  if (rejectTurnstile) {
    const reject = rejectTurnstile

    rejectTurnstile = null
    resolveTurnstile = null
    turnstilePromise = null

    reject(new Error('TURNSTILE_VERIFICATION_CANCELLED'))
  }

  turnstileRequired.value = false
}

/**
 * Check FCM state when BigStock starts.
 */
export async function initializeFcmOnStartup(): Promise<void> {
  if (!('Notification' in window)) {
    console.warn('[FCM] Notification API is not supported')

    return
  }

  const permission = getNotificationPermission()

  console.log('[FCM] Current notification permission:', permission)

  if (permission === 'granted') {
    try {
      await ensureFcmVerified()
    } catch (error) {
      console.error('[FCM] Startup verification failed:', error)
    }

    return
  }

  if (permission === 'default') {
    dispatchPermissionEvent(FCM_PERMISSION_REQUIRED_EVENT)

    return
  }

  if (permission === 'denied') {
    dispatchPermissionEvent(FCM_PERMISSION_DENIED_EVENT)
  }
}

/**
 * Ensure the current browser has completed
 * Web device verification.
 *
 * Multiple callers share one Promise.
 */
export async function ensureFcmVerified(): Promise<string> {
  if (!('Notification' in window)) {
    throw new Error('Notification API is not supported.')
  }

  const permission = Notification.permission

  if (permission === 'default') {
    dispatchPermissionEvent(FCM_PERMISSION_REQUIRED_EVENT)

    throw new Error('Notification permission has not been granted.')
  }

  if (permission === 'denied') {
    dispatchPermissionEvent(FCM_PERMISSION_DENIED_EVENT)

    throw new Error('Notification permission has been denied.')
  }

  /**
   * Single-flight:
   * Reuse verification already in progress.
   */
  if (verificationPromise) {
    return verificationPromise
  }

  verificationPromise = performFcmVerification()

  try {
    return await verificationPromise
  } finally {
    verificationPromise = null
  }
}

/**
 * Execute Turnstile + FCM verification.
 */
async function performFcmVerification(): Promise<string> {
  try {
    console.log('[SECURITY] Waiting for Turnstile verification')

    /**
     * Wait for the Vue component to provide
     * a fresh Turnstile token.
     */
    const turnstileToken = await requestTurnstileToken()

    console.log('[SECURITY] Turnstile token received')

    /**
     * Register and verify the WEB device.
     *
     * This function calls:
     *
     * POST /device/web/register
     * POST /device/verify
     */
    const fcmToken = await registerAndVerifyFcmDevice(turnstileToken)

    console.log('[SECURITY] FCM device verification completed')

    return fcmToken
  } finally {
    /**
     * Always clean up Turnstile UI state.
     */
    turnstileRequired.value = false

    resolveTurnstile = null
    rejectTurnstile = null
    turnstilePromise = null
  }
}
