import { getFcmToken, listenForForegroundMessages } from './fcm'

import bstockAxios from '@/router/bstockAxios'

interface DeviceVerifyMessage {
  type?: string
  challengeId?: string
}

/**
 * FCM challenge waiter.
 *
 * Allows the caller to explicitly release the
 * foreground listener and timeout.
 */
interface ChallengeWaiter {
  promise: Promise<string>
  cancel: () => void
}

/**
 * Prevent multiple device verification flows
 * from running simultaneously.
 *
 * fcmStartup.ts already has Single-flight protection,
 * but this also protects direct callers.
 */
let activeVerification: Promise<string> | null = null

/**
 * Register the current WEB browser with FCM
 * and verify the challenge sent by backend.
 *
 * Security flow:
 *
 * 1. Receive Turnstile token from Vue UI.
 * 2. Get FCM registration token.
 * 3. Install FCM challenge listener.
 * 4. POST /device/web/register.
 * 5. Receive DEVICE_VERIFY challenge.
 * 6. POST /device/verify.
 * 7. Return FCM token.
 *
 * Note:
 * Spring Boot must verify Turnstile via Siteverify.
 */
export function registerAndVerifyFcmDevice(turnstileToken: string): Promise<string> {
  if (activeVerification) {
    return activeVerification
  }

  if (!turnstileToken?.trim()) {
    return Promise.reject(new Error('TURNSTILE_TOKEN_REQUIRED'))
  }

  const verification = performDeviceVerification(turnstileToken)

  activeVerification = verification

  // Release Single-flight state after completion.
  // Do not replace the caller's original Promise.
  void verification.then(
    () => {
      if (activeVerification === verification) {
        activeVerification = null
      }
    },
    () => {
      if (activeVerification === verification) {
        activeVerification = null
      }
    },
  )

  return verification
}

/**
 * Perform the actual FCM verification.
 */
async function performDeviceVerification(turnstileToken: string): Promise<string> {
  const fcmToken = await getFcmToken()

  if (!fcmToken) {
    throw new Error('FCM_TOKEN_NOT_AVAILABLE')
  }

  console.log('[FCM] Starting WEB device verification')

  /*
   * IMPORTANT:
   *
   * Install the foreground listener BEFORE
   * asking the backend to send a challenge.
   *
   * This avoids missing an immediately
   * delivered FCM message.
   */
  const waiter = await createChallengeWaiter()

  try {
    /*
     * WEB registration.
     *
     * The backend must verify the Turnstile token
     * before calling sendDeviceChallenge().
     *
     * APP still uses /device/register.
     */
    await bstockAxios.post(
      '/device/web/register',
      {
        fcmToken,
        deviceType: 'WEB',
        turnstileToken,
      },
      {
        /*
         * Prevent JWT interceptor from attempting
         * guest token refresh while the device
         * verification flow is running.
         */
        skipAuthRefresh: true,
      } as any,
    )

    console.log('[FCM] Web device registered, waiting for challenge...')

    /*
     * Wait for the FCM challenge.
     */
    const challengeId = await waiter.promise

    console.log('[FCM] Device challenge received')

    /*
     * Prove the browser actually received
     * the FCM challenge.
     *
     * Keep the existing verification API.
     */
    await bstockAxios.post(
      '/device/verify',
      {
        fcmToken,
        challenge: challengeId,
      },
      {
        skipAuthRefresh: true,
      } as any,
    )

    console.log('[FCM] Device verification completed')

    return fcmToken
  } catch (error) {
    console.error('[FCM] Device verification failed:', error)

    throw error
  } finally {
    /*
     * Always clean up:
     *
     * - successful verification
     * - register API failure
     * - FCM timeout
     * - verify API failure
     */
    waiter.cancel()
  }
}

/**
 * Create a cancelable FCM challenge listener.
 *
 * The returned Promise may receive a challenge
 * while the register API is still in progress.
 */
async function createChallengeWaiter(): Promise<ChallengeWaiter> {
  let unsubscribe: (() => void) | undefined

  let timeout: ReturnType<typeof setTimeout> | undefined

  let settled = false

  let resolvePromise!: (challengeId: string) => void

  let rejectPromise!: (reason: Error) => void

  const promise = new Promise<string>((resolve, reject) => {
    resolvePromise = resolve
    rejectPromise = reject
  })

  /*
   * Attach a rejection handler immediately.
   *
   * This avoids unhandled Promise rejections
   * when the register API fails before the
   * caller starts awaiting the challenge.
   */
  void promise.catch(() => {})

  /**
   * Release resources.
   */
  function cleanup(): void {
    if (timeout !== undefined) {
      clearTimeout(timeout)
      timeout = undefined
    }

    if (unsubscribe) {
      const stop = unsubscribe
      unsubscribe = undefined

      stop()
    }
  }

  /**
   * Resolve a valid challenge.
   */
  function complete(challengeId: string): void {
    if (settled) {
      return
    }

    settled = true

    cleanup()

    resolvePromise(challengeId)
  }

  /**
   * Reject and release resources.
   */
  function fail(error: Error): void {
    if (settled) {
      return
    }

    settled = true

    cleanup()

    rejectPromise(error)
  }

  /*
   * Register the FCM foreground listener.
   */
  try {
    const stopListener = await listenForForegroundMessages((payload) => {
      const data = payload?.data as DeviceVerifyMessage | undefined

      if (data?.type !== 'DEVICE_VERIFY') {
        return
      }

      if (!data.challengeId) {
        return
      }

      console.log('[FCM] DEVICE_VERIFY message received')

      complete(data.challengeId)
    })

    /*
     * It is possible for the FCM callback
     * to run before listener registration
     * finishes.
     */
    if (settled) {
      stopListener()
    } else {
      unsubscribe = stopListener

      /*
       * Wait for at most 15 seconds
       * after the listener is installed.
       */
      timeout = setTimeout(() => {
        fail(new Error('Timed out waiting for FCM device challenge.'))
      }, 30000)
    }
  } catch (error) {
    const normalizedError =
      error instanceof Error ? error : new Error('FCM_LISTENER_REGISTRATION_FAILED')

    fail(normalizedError)

    throw normalizedError
  }

  return {
    promise,

    cancel(): void {
      /*
       * If already resolved or rejected,
       * this is a no-op.
       */
      fail(new Error('FCM_CHALLENGE_CANCELLED'))
    },
  }
}
