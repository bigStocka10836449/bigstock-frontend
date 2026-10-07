import {
  getMessaging,
  getToken,
  isSupported,
  onMessage,
  type Messaging,
} from 'firebase/messaging'

import firebaseApp from './firebase'


let messagingInstance: Messaging | null = null


/**
 * Get Firebase Messaging instance.
 */
export async function getFirebaseMessaging(): Promise<Messaging> {

  const supported = await isSupported()

  if (!supported) {
    throw new Error(
      'Firebase Messaging is not supported by this browser.'
    )
  }

  if (!messagingInstance) {
    messagingInstance = getMessaging(firebaseApp)
  }

  return messagingInstance
}


/**
 * Get current notification permission.
 */
export function getNotificationPermission(): NotificationPermission {

  if (!('Notification' in window)) {
    throw new Error(
      'Notification API is not supported by this browser.'
    )
  }

  return Notification.permission
}


/**
 * Ask the user for notification permission.
 *
 * IMPORTANT:
 * Call this from a real user interaction,
 * such as a button click.
 */
export async function requestNotificationPermission():
  Promise<NotificationPermission> {

  if (!('Notification' in window)) {
    throw new Error(
      'Notification API is not supported by this browser.'
    )
  }

  return await Notification.requestPermission()
}


/**
 * Obtain the FCM registration token.
 *
 * This method DOES NOT request notification permission.
 * Permission must already be granted.
 */
/**
 * Obtain the FCM registration token.
 *
 * This method DOES NOT request notification permission.
 * Permission must already be granted.
 */
export async function getFcmToken(): Promise<string> {

  if (!('Notification' in window)) {
    throw new Error(
      'Notification API is not supported by this browser.'
    )
  }


  if (Notification.permission !== 'granted') {

    throw new Error(
      'Notification permission has not been granted.'
    )
  }


  const messaging =
    await getFirebaseMessaging()


  /*
   * 從 Vite 環境變數取得 Firebase Web Push VAPID Public Key。
   *
   * 注意：
   * 這裡必須使用 Firebase Console：
   *
   * Project Settings
   * → Cloud Messaging
   * → Web Push certificates
   *
   * 裡面的 Public Key。
   *
   * 不能使用 Firebase API Key、Server Key
   * 或 Firebase Admin Private Key。
   */
  const vapidKey =
    import.meta.env.VITE_FIREBASE_VAPID_KEY


  /*
   * 開發階段只檢查 VAPID Key 是否成功載入，
   * 不直接輸出完整 Key。
   */
  console.log(
    '[FCM] VAPID key exists:',
    Boolean(vapidKey)
  )

  console.log(
    '[FCM] VAPID key length:',
    vapidKey?.length
  )


  if (!vapidKey) {

    throw new Error(
      'VITE_FIREBASE_VAPID_KEY is missing.'
    )
  }


  console.log(
    '[FCM] Requesting FCM token...'
  )


  const token =
    await getToken(
      messaging,
      {
        vapidKey,
      }
    )


  if (!token) {

    throw new Error(
      'Firebase did not return an FCM token.'
    )
  }


  console.log(
    '[FCM] FCM token obtained'
  )


  return token
}


/**
 * Listen for foreground FCM messages.
 */
export async function listenForForegroundMessages(
  callback: (payload: any) => void
): Promise<() => void> {

  const messaging =
    await getFirebaseMessaging()


  return onMessage(
    messaging,
    (payload) => {

      console.log(
        '[FCM] Foreground message:',
        payload
      )

      callback(payload)
    }
  )
}
