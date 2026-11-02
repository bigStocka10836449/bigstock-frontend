/// <reference lib="webworker" />

import { initializeApp } from 'firebase/app'

import {
  getMessaging,
  onBackgroundMessage,
} from 'firebase/messaging/sw'


declare const self: ServiceWorkerGlobalScope


// The service worker cannot access window.__APP_CONFIG__.
// Load the same public settings from a runtime-generated JSON resource.
interface WorkerRuntimeConfig {
  FIREBASE_API_KEY: string
  FIREBASE_AUTH_DOMAIN: string
  FIREBASE_PROJECT_ID: string
  FIREBASE_STORAGE_BUCKET: string
  FIREBASE_MESSAGING_SENDER_ID: string
  FIREBASE_APP_ID: string
}

async function initializeBackgroundMessaging(): Promise<void> {
  const response = await fetch('/runtime-config.json', { cache: 'no-store' })
  if (!response.ok) throw new Error(`FCM runtime config HTTP ${response.status}`)
  const runtime = await response.json() as WorkerRuntimeConfig
  const app = initializeApp({
    apiKey: runtime.FIREBASE_API_KEY,
    authDomain: runtime.FIREBASE_AUTH_DOMAIN,
    projectId: runtime.FIREBASE_PROJECT_ID,
    storageBucket: runtime.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: runtime.FIREBASE_MESSAGING_SENDER_ID,
    appId: runtime.FIREBASE_APP_ID,
  })
  const messaging = getMessaging(app)
  onBackgroundMessage(messaging, (payload) => {
    if (payload.data?.type === 'DEVICE_VERIFY') return

    const title = payload.notification?.title ?? payload.data?.title ?? 'BigStock'
    const options: NotificationOptions = {
      body: payload.notification?.body ?? payload.data?.body ?? '',
      icon: '/favicon.ico',
      data: { url: payload.data?.url ?? '/' },
    }
    void self.registration.showNotification(title, options)
  })
}

const messagingReady = initializeBackgroundMessaging()
messagingReady.catch(error => console.error('[FCM SW] initialization failed', error))
self.addEventListener('install', event => { event.waitUntil(messagingReady) })

self.addEventListener(
  'notificationclick',
  (event: NotificationEvent) => {

    event.notification.close()


    const targetUrl =
      event.notification.data?.url
      ??
      '/'


    event.waitUntil(

      self.clients
        .matchAll({

          type: 'window',

          includeUncontrolled: true,

        })
        .then(async (clientList) => {

          for (const client of clientList) {

            if (
              client instanceof WindowClient
            ) {

              await client.navigate(
                targetUrl,
              )

              return client.focus()
            }
          }


          return self.clients.openWindow(
            targetUrl,
          )
        }),
    )
  },
)
