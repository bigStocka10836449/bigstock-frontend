import { getFcmToken, listenForForegroundMessages } from '@/firebase/fcm'

import bstockAxios from '@/router/bstockAxios'

interface DeviceVerifyMessage {
  type?: string
  challengeId?: string
}

interface ChallengeWaiter {
  promise: Promise<string>
  cancel: () => void
}

/**
 * Register and verify the current WEB device.
 *
 * Prerequisite:
 * Cloudflare Turnstile has already returned
 * a valid challenge token.
 */

export async function registerAndVerifyFcmDevice(
  turnstileToken: string
): Promise<string> {

  if (!turnstileToken?.trim()) {
    throw new Error('TURNSTILE_TOKEN_REQUIRED')
  }

  console.log('[FCM] STEP 1 - Starting WEB verification')

  // ============================================================
  // 1. Get FCM token
  // ============================================================

  const fcmToken = await getFcmToken()

  if (!fcmToken) {
    throw new Error('FCM_TOKEN_NOT_AVAILABLE')
  }

  console.log('[FCM] STEP 2 - FCM token obtained')

  // ============================================================
  // 2. Prepare listener BEFORE requesting challenge
  // ============================================================

  console.log('[FCM] STEP 3 - Creating challenge waiter')

  const waiter = await createChallengeWaiter()

  console.log('[FCM] STEP 4 - Challenge waiter ready')

  try {

    // ==========================================================
    // 3. Register WEB device with Turnstile
    // ==========================================================

    console.log('[FCM] STEP 5 - Calling /device/web/register')

    const registerResponse = await bstockAxios.post(
      '/device/web/register',
      {
        fcmToken,
        deviceType: 'WEB',
        turnstileToken,
      },
      {
        skipAuthRefresh: true,
      } as any
    )

    console.log(
      '[FCM] STEP 6 - WEB registration accepted:',
      registerResponse.status
    )

    // ==========================================================
    // 4. Wait for DEVICE_VERIFY challenge
    // ==========================================================

    console.log('[FCM] STEP 7 - Waiting for FCM challenge')

    const challengeId = await waiter.promise

    console.log('[FCM] STEP 8 - FCM challenge received')

    // ==========================================================
    // 5. Verify challenge
    // ==========================================================

    console.log('[FCM] STEP 9 - Calling /device/verify')

    const verifyResponse = await bstockAxios.post(
      '/device/verify',
      {
        fcmToken,
        challenge: challengeId,
      },
      {
        skipAuthRefresh: true,
      } as any
    )

    console.log(
      '[FCM] STEP 10 - Device verified:',
      verifyResponse.status
    )

    return fcmToken

  } catch (error) {

    console.error(
      '[FCM] WEB device verification failed:',
      error
    )

    throw error

  } finally {

    waiter.cancel()

    console.log('[FCM] Challenge listener cleaned up')
  }
}


/**
 * Create a cancelable FCM challenge waiter.
 *
 * The rejection is observed immediately so that
 * early API failures cannot cause an unhandled
 * Promise rejection.
 */
async function createChallengeWaiter(): Promise<ChallengeWaiter> {
  let unsubscribe: (() => void) | undefined

  let timeout: ReturnType<typeof setTimeout> | undefined

  let settled = false

  let resolvePromise!: (challenge: string) => void
  let rejectPromise!: (error: Error) => void

  const promise = new Promise<string>((resolve, reject) => {
    resolvePromise = resolve
    rejectPromise = reject
  })

  // Handle early rejection without consuming it.
  void promise.catch(() => { })

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

  function complete(challengeId: string): void {
    if (settled) return

    settled = true
    cleanup()

    resolvePromise(challengeId)
  }

  function fail(error: Error): void {
    if (settled) return

    settled = true
    cleanup()

    rejectPromise(error)
  }

  try {
    /*
     * The callback might fire before the
     * listener registration Promise resolves.
     */
    const stopListener = await listenForForegroundMessages((payload) => {
      const data = payload?.data as DeviceVerifyMessage | undefined

      console.log('[FCM DEBUG] Foreground message received', {
        messageId: payload?.messageId,
        type: data?.type,
        hasChallengeId: Boolean(data?.challengeId),
        visibilityState: document.visibilityState,
      })

      if (data?.type !== 'DEVICE_VERIFY') {
        console.warn('[FCM DEBUG] Unexpected message type:', data?.type)
        return
      }

      if (!data.challengeId) {
        console.warn('[FCM DEBUG] DEVICE_VERIFY missing challengeId')
        return
      }

      console.log('[FCM] DEVICE_VERIFY message received')

      complete(data.challengeId)
    })

    /*
     * If a challenge arrived during registration,
     * immediately release the newly returned listener.
     */
    if (settled) {
      stopListener()
    } else {
      unsubscribe = stopListener

      timeout = setTimeout(() => {
        fail(new Error('Timed out waiting for FCM device challenge.'))
      }, 15000)
    }
  } catch (error) {
    fail(error instanceof Error ? error : new Error('FCM_LISTENER_REGISTRATION_FAILED'))

    // The waiter could not be installed.
    throw error
  }

  return {
    promise,

    cancel() {
      fail(new Error('FCM_CHALLENGE_CANCELLED'))
    },
  }
}
