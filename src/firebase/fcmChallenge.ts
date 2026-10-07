import {
  getFcmToken,
  listenForForegroundMessages,
} from './fcm'

import bstockAxios from '@/router/bstockAxios'


interface DeviceVerifyMessage {

  type?: string

  challengeId?: string
}


/**
 * Register the current browser with FCM
 * and verify the challenge sent by backend.
 */
export async function registerAndVerifyFcmDevice():
  Promise<string> {

  const fcmToken =
    await getFcmToken()


  console.log(
    '[FCM] Starting device verification'
  )


  /*
   * IMPORTANT:
   *
   * Install foreground listener BEFORE calling
   * /device/register.
   *
   * Backend may immediately send the challenge.
   */
  const challengePromise =
    waitForDeviceChallenge()


  /*
   * Tell backend which FCM token belongs
   * to this browser.
   */
  await bstockAxios.post(
    '/device/register',
    {
      fcmToken,
      deviceType: 'WEB',
    },
    {
      /*
       * Prevent auth interceptor from trying
       * to refresh the guest token while we
       * are currently creating it.
       */
      skipAuthRefresh: true,
    } as any
  )


  console.log(
    '[FCM] Device registered, waiting for challenge...'
  )


  const challengeId =
    await challengePromise


  console.log(
    '[FCM] Challenge received'
  )


  /*
   * Prove that this browser actually received
   * the FCM challenge.
   */
  await bstockAxios.post(
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
    '[FCM] Device verification completed'
  )


  return fcmToken
}


/**
 * Wait for DEVICE_VERIFY challenge from FCM.
 */
async function waitForDeviceChallenge():
  Promise<string> {

  return new Promise(
    async (
      resolve,
      reject
    ) => {

      let unsubscribe:
        (() => void) | undefined


      const timeout =
        window.setTimeout(
          () => {

            if (unsubscribe) {
              unsubscribe()
            }

            reject(
              new Error(
                'Timed out waiting for FCM device challenge.'
              )
            )

          },
          15000
        )


      try {

        unsubscribe =
          await listenForForegroundMessages(
            (payload) => {

              const data =
                payload?.data as DeviceVerifyMessage | undefined


              if (
                data?.type !== 'DEVICE_VERIFY'
              ) {
                return
              }


              if (!data.challengeId) {
                return
              }


              window.clearTimeout(
                timeout
              )


              if (unsubscribe) {
                unsubscribe()
              }


              resolve(
                data.challengeId
              )
            }
          )

      } catch (error) {

        window.clearTimeout(
          timeout
        )

        reject(error)
      }
    }
  )
}
