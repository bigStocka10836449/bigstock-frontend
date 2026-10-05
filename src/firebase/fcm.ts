import {
  getMessaging,
  getToken,
  isSupported,
  onMessage,
  type MessagePayload,
  type Messaging,
} from 'firebase/messaging'

import firebaseApp from './firebase'


let messaging: Messaging | null = null


/**
 * Get Firebase Messaging instance.
 *
 * Returns null when the current browser
 * does not support Firebase Messaging.
 */
export async function getFirebaseMessaging():
  Promise<Messaging | null> {

  const supported = await isSupported()

  if (!supported) {

    console.warn(
      '[FCM] Firebase Messaging is not supported.',
    )

    return null
  }


  if (!messaging) {
    messaging = getMessaging(firebaseApp)
  }


  return messaging
}


/**
 * Get the FCM registration token for this browser.
 *
 * IMPORTANT:
 * This method DOES NOT request notification permission.
 *
 * Permission handling belongs to fcmStartup.ts.
 */
export async function getFcmToken():
  Promise<string> {

  const firebaseMessaging =
    await getFirebaseMessaging()


  if (!firebaseMessaging) {

    throw new Error(
      'Firebase Messaging is not supported.',
    )
  }


  if (Notification.permission !== 'granted') {

    throw new Error(
      'Notification permission has not been granted.',
    )
  }


  /*
   * Register our Firebase Service Worker.
   */
  const serviceWorkerRegistration =
    await navigator.serviceWorker.register(
      '/firebase-messaging-sw.js',
    )


  /*
   * Wait until the Service Worker becomes active.
   */
  await navigator.serviceWorker.ready


  /*
   * Obtain FCM registration token.
   */
  const token =
    await getToken(
      firebaseMessaging,
      {

        vapidKey:
          import.meta.env
            .VITE_FIREBASE_VAPID_KEY,

        serviceWorkerRegistration,
      },
    )


  if (!token) {

    throw new Error(
      'Firebase did not return an FCM token.',
    )
  }


  console.log(
    '[FCM] Registration token obtained.',
  )


  return token
}


/**
 * Listen for messages while BigStock is
 * currently open in the foreground.
 *
 * Returns an unsubscribe function.
 */
export async function listenForForegroundMessages(
  callback: (payload: MessagePayload) => void,
): Promise<() => void> {

  const firebaseMessaging =
    await getFirebaseMessaging()


  if (!firebaseMessaging) {

    throw new Error(
      'Firebase Messaging is not supported.',
    )
  }


  return onMessage(
    firebaseMessaging,
    callback,
  )
}
