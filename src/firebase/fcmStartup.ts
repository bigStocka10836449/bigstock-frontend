import {
  registerAndVerifyFcmDevice,
} from './fcmChallenge'


let startupPromise:
  Promise<void> | null = null


/**
 * Called automatically when BigStock launches.
 *
 * This method does NOT display a permission popup.
 */
export function initializeFcmOnStartup():
  Promise<void> {

  /*
   * Prevent duplicate initialization.
   *
   * For example, if multiple Vue components
   * accidentally call this method.
   */
  if (startupPromise) {
    return startupPromise
  }


  startupPromise =
    doInitializeFcmOnStartup()


  return startupPromise
}


async function doInitializeFcmOnStartup():
  Promise<void> {

  try {

    /*
     * Browser doesn't support notifications.
     */
    if (!('Notification' in window)) {

      console.warn(
        '[FCM] Notification API is not supported.',
      )

      return
    }


    const permission =
      Notification.permission


    console.log(
      '[FCM] Current notification permission:',
      permission,
    )


    /*
     * CASE 1
     *
     * User previously allowed notifications.
     *
     * Everything can happen automatically.
     */
    if (permission === 'granted') {

      await registerAndVerifyFcmDevice()


      console.log(
        '[FCM] Startup initialization completed.',
      )


      return
    }


    /*
     * CASE 2
     *
     * User has never answered the permission
     * request.
     *
     * We know this immediately, but DON'T
     * automatically show the browser popup.
     */
    if (permission === 'default') {

      console.log(
        '[FCM] Notification permission has not been decided.',
      )


      return
    }


    /*
     * CASE 3
     *
     * User explicitly blocked notifications.
     */
    if (permission === 'denied') {

      console.log(
        '[FCM] Notification permission has been denied.',
      )


      return
    }

  } catch (error) {

    console.error(
      '[FCM] Startup initialization failed:',
      error,
    )
  }
}

/**
 * Ask the user for notification permission.
 *
 * Call this from a meaningful user interaction,
 * such as login or enabling stock alerts.
 */
export async function requestFcmPermission():
  Promise<boolean> {

  if (!('Notification' in window)) {

    return false
  }


  /*
   * Already allowed.
   */
  if (
    Notification.permission
      === 'granted'
  ) {

    await registerAndVerifyFcmDevice()

    return true
  }


  /*
   * Already explicitly blocked.
   */
  if (
    Notification.permission
      === 'denied'
  ) {

    return false
  }


  /*
   * First-time browser permission request.
   */
  const permission =
    await Notification.requestPermission()


  if (permission !== 'granted') {

    return false
  }


  /*
   * User just clicked Allow.
   *
   * Immediately finish FCM registration.
   */
  await registerAndVerifyFcmDevice()


  return true
}
