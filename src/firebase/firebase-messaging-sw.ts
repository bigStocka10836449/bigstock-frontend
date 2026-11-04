/// <reference lib="webworker" />

import { initializeApp } from 'firebase/app'

import {
  getMessaging,
  onBackgroundMessage,
} from 'firebase/messaging/sw'


declare const self: ServiceWorkerGlobalScope


const firebaseConfig = {

  apiKey:
    import.meta.env.VITE_FIREBASE_API_KEY,

  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,

  projectId:
    import.meta.env.VITE_FIREBASE_PROJECT_ID,

  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,

  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,

  appId:
    import.meta.env.VITE_FIREBASE_APP_ID,
}


const firebaseApp =
  initializeApp(firebaseConfig)


const messaging =
  getMessaging(firebaseApp)


onBackgroundMessage(
  messaging,
  (payload) => {

    console.log(
      '[FCM SW] Background message:',
      payload,
    )


    /*
     * Don't display DEVICE_VERIFY
     * as a notification.
     */
    if (
      payload.data?.type ===
      'DEVICE_VERIFY'
    ) {

      console.log(
        '[FCM SW] DEVICE_VERIFY received.',
      )

      return
    }


    const title =
      payload.notification?.title
      ??
      payload.data?.title
      ??
      'BigStock'


    const options: NotificationOptions = {

      body:
        payload.notification?.body
        ??
        payload.data?.body
        ??
        '',

      icon:
        '/favicon.ico',

      data: {

        url:
          payload.data?.url
          ??
          '/',
      },
    }


    void self.registration.showNotification(
      title,
      options,
    )
  },
)


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
