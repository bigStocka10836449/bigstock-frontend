import { getFcmToken, listenForForegroundMessages } from '@/firebase/fcm'
import bstockAxios from '@/router/bstockAxios'
import { ensureCsrfToken } from '@/services/csrfService'

interface DeviceVerifyMessage {
  type?: string
  challengeId?: string
}
interface ChallengeWaiter {
  promise: Promise<string>
  cancel: () => void
}

/** Web-only: Turnstile -> FCM registration -> push challenge -> verification. */
export async function registerAndVerifyFcmDevice(turnstileToken: string): Promise<string> {
  if (!turnstileToken?.trim()) throw new Error('TURNSTILE_TOKEN_REQUIRED')
  await ensureCsrfToken()
  const fcmToken = await getFcmToken()
  if (!fcmToken) throw new Error('FCM_TOKEN_NOT_AVAILABLE')

  // Subscribe BEFORE register; otherwise early challenges can be missed.
  const waiter = await createChallengeWaiter()
  try {
    await bstockAxios.post('/device/web/register', {
      fcmToken,
      deviceType: 'WEB',
      turnstileToken,
    }, { skipAuthRefresh: true })
    const challenge = await waiter.promise
    await bstockAxios.post('/device/verify', {
      fcmToken,
      challenge,
    }, { skipAuthRefresh: true })
    return fcmToken
  } finally {
    waiter.cancel()
  }
}

function createChallengeWaiter(): Promise<ChallengeWaiter> {
  let unsubscribe: (() => void) | undefined
  let timeout: ReturnType<typeof setTimeout> | undefined
  let settled = false
  let resolvePromise!: (challenge: string) => void
  let rejectPromise!: (error: Error) => void
  const promise = new Promise<string>((resolve, reject) => {
    resolvePromise = resolve
    rejectPromise = reject
  })
  // Observe early rejection before a caller awaits waiter.promise.
  void promise.catch(() => undefined)
  function cleanup(): void {
    if (timeout !== undefined) { clearTimeout(timeout); timeout = undefined }
    if (unsubscribe) {
      const stop = unsubscribe
      unsubscribe = undefined
      stop()
    }
  }
  function succeed(challengeId: string): void {
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
  const registration = listenForForegroundMessages(payload => {
    const data = payload?.data as DeviceVerifyMessage | undefined
    if (data?.type === 'DEVICE_VERIFY' && data.challengeId) succeed(data.challengeId)
  })
  return registration.then(stop => {
    if (settled) stop()
    else {
      unsubscribe = stop
      timeout = setTimeout(() => {
        fail(new Error('Timed out waiting for FCM device challenge'))
      }, 15_000)
    }
    return { promise, cancel: () => fail(new Error('FCM_CHALLENGE_CANCELLED')) }
  }).catch(error => {
    fail(error instanceof Error ? error : new Error(String(error)))
    throw error
  })
}
