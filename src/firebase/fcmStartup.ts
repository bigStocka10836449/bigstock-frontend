import {
  getNotificationPermission,
} from './fcm'

import {
  registerAndVerifyFcmDevice,
} from './fcmChallenge'


/**
 * Event names used by the UI.
 */
export const FCM_PERMISSION_REQUIRED_EVENT =
  'fcm-permission-required'

export const FCM_PERMISSION_DENIED_EVENT =
  'fcm-permission-denied'


/*
 * Prevent multiple API requests from starting
 * multiple FCM verification flows simultaneously.
 */
let verificationPromise:
  Promise<string> | null = null


/**
 * Dispatch UI event.
 */
function dispatchPermissionEvent(
  eventName: string
): void {

  window.dispatchEvent(
    new CustomEvent(eventName)
  )
}


/**
 * Check FCM state when BigStock starts.
 *
 * granted:
 *     automatically verify device
 *
 * default:
 *     show permission dialog
 *
 * denied:
 *     show instructions dialog
 */
export async function initializeFcmOnStartup():
  Promise<void> {

  if (!('Notification' in window)) {

    console.warn(
      '[FCM] Notification API is not supported'
    )

    return
  }


  const permission =
    getNotificationPermission()


  console.log(
    '[FCM] Current notification permission:',
    permission
  )


  if (permission === 'granted') {

    try {

      await ensureFcmVerified()

    } catch (error) {

      console.error(
        '[FCM] Startup verification failed:',
        error
      )
    }

    return
  }


  if (permission === 'default') {

    dispatchPermissionEvent(
      FCM_PERMISSION_REQUIRED_EVENT
    )

    return
  }


  if (permission === 'denied') {

    dispatchPermissionEvent(
      FCM_PERMISSION_DENIED_EVENT
    )
  }
}


/**
 * Ensure the current browser has completed
 * FCM verification.
 *
 * Multiple callers share the same Promise.
 */
export async function ensureFcmVerified():
  Promise<string> {

  if (!('Notification' in window)) {

    throw new Error(
      'Notification API is not supported.'
    )
  }


  const permission =
    Notification.permission


  if (permission === 'default') {

    dispatchPermissionEvent(
      FCM_PERMISSION_REQUIRED_EVENT
    )

    throw new Error(
      'Notification permission has not been granted.'
    )
  }


  if (permission === 'denied') {

    dispatchPermissionEvent(
      FCM_PERMISSION_DENIED_EVENT
    )

    throw new Error(
      'Notification permission has been denied.'
    )
  }


  /*
   * If verification is already running,
   * reuse the same Promise.
   */
  if (verificationPromise) {

    return verificationPromise
  }


  verificationPromise =
    registerAndVerifyFcmDevice()


  try {

    return await verificationPromise

  } finally {

    verificationPromise = null
  }
}
