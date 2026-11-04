import { getNotificationPermission } from './fcm'
export const FCM_PERMISSION_REQUIRED_EVENT = 'fcm-permission-required'
export const FCM_PERMISSION_DENIED_EVENT = 'fcm-permission-denied'
/** Notification permission is separate from Web authentication. */
export async function initializeFcmOnStartup(): Promise<void> {
  if (!('Notification' in window)) return
  const permission = getNotificationPermission()
  if (permission === 'default') window.dispatchEvent(new CustomEvent(FCM_PERMISSION_REQUIRED_EVENT))
  else if (permission === 'denied') window.dispatchEvent(new CustomEvent(FCM_PERMISSION_DENIED_EVENT))
  // Granted: do not initiate FCM Challenge or request Web JWT.
}
