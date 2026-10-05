/* global firebase */

importScripts(
  'https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js'
)

importScripts(
  'https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js'
)


firebase.initializeApp({
  apiKey: 'YOUR_FIREBASE_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_STORAGE_BUCKET',
  messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
  appId: 'YOUR_APP_ID',
})


const messaging = firebase.messaging()


messaging.onBackgroundMessage((payload) => {

  console.log(
    '[firebase-messaging-sw.js] Background message received:',
    payload
  )


  /*
   * IMPORTANT:
   *
   * Your FCM authentication challenge should normally NOT
   * generate a visible browser notification.
   */
  if (payload.data?.type === 'FCM_CHALLENGE') {

    console.log(
      '[firebase-messaging-sw.js] FCM challenge received.'
    )

    return
  }


  /*
   * Normal BigStock notification
   */
  const title =
    payload.notification?.title ||
    payload.data?.title ||
    'BigStock'

  const options = {

    body:
      payload.notification?.body ||
      payload.data?.body ||
      '',

    icon: '/favicon.ico',

    data: {
      url:
        payload.data?.url ||
        '/',
    },
  }


  self.registration.showNotification(
    title,
    options
  )
})


/*
 * User clicked the browser notification.
 */
self.addEventListener(
  'notificationclick',
  (event) => {

    event.notification.close()

    const targetUrl =
      event.notification.data?.url || '/'

    event.waitUntil(

      clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      .then((clientList) => {

        /*
         * If BigStock is already open,
         * focus the existing window.
         */
        for (const client of clientList) {

          if ('focus' in client) {

            client.navigate(targetUrl)

            return client.focus()
          }
        }


        /*
         * Otherwise open BigStock.
         */
        if (clients.openWindow) {
          return clients.openWindow(targetUrl)
        }

        return undefined
      })
    )
  }
)
