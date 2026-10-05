import type {
  MessagePayload,
} from 'firebase/messaging'

import bstockAxios from '../router/bstockAxios'

import {
  getFcmToken,
  listenForForegroundMessages,
} from './fcm'


interface FcmRegisterRequest {
  fcmToken: string
}


interface FcmVerifyRequest {
  fcmToken: string
  challenge: string
}


const VERIFY_TIMEOUT_MS = 30_000


/**
 * Register this browser's FCM token with BigStock
 * and complete the DEVICE_VERIFY challenge.
 */
export async function registerAndVerifyFcmDevice():
  Promise<string> {

  /*
   * STEP 1
   *
   * Get browser's FCM registration token.
   */
  const fcmToken =
    await getFcmToken()


  console.log(
    '[FCM] Starting device verification.',
  )


  /*
   * STEP 2
   *
   * Prepare the FCM listener BEFORE calling
   * Spring Boot /register.
   *
   * This prevents a race condition.
   */
  let unsubscribe:
    (() => void) | null = null


  let timeoutId:
    number | null = null


  const verificationPromise =
    new Promise<void>(
      async (resolve, reject) => {

        try {

          unsubscribe =
            await listenForForegroundMessages(
              async (
                payload: MessagePayload,
              ) => {

                /*
                 * Ignore unrelated FCM messages.
                 */
                if (
                  payload.data?.type
                    !== 'DEVICE_VERIFY'
                ) {

                  return
                }


                const challengeId =
                  payload.data?.challengeId


                if (!challengeId) {

                  console.error(
                    '[FCM] DEVICE_VERIFY does not contain challengeId.',
                  )

                  return
                }


                console.log(
                  '[FCM] DEVICE_VERIFY received.',
                )


                try {

                  /*
                   * Your backend calls this field:
                   *
                   *     challenge
                   *
                   * while FCM sends:
                   *
                   *     challengeId
                   *
                   * So map it here.
                   */
                  const verifyRequest:
                    FcmVerifyRequest = {

                    fcmToken,

                    challenge:
                      challengeId,
                  }


                  await bstockAxios.post(
                    '/fcm/verify',
                    verifyRequest,
                  )


                  if (timeoutId !== null) {

                    window.clearTimeout(
                      timeoutId,
                    )
                  }


                  unsubscribe?.()


                  console.log(
                    '[FCM] Device verified successfully.',
                  )


                  resolve()

                } catch (error) {

                  if (timeoutId !== null) {

                    window.clearTimeout(
                      timeoutId,
                    )
                  }


                  unsubscribe?.()

                  reject(error)
                }
              },
            )


          /*
           * Stop waiting after 30 seconds.
           */
          timeoutId =
            window.setTimeout(
              () => {

                unsubscribe?.()


                reject(
                  new Error(
                    'FCM verification timed out.',
                  ),
                )

              },
              VERIFY_TIMEOUT_MS,
            )

        } catch (error) {

          reject(error)
        }
      },
    )


  /*
   * STEP 3
   *
   * Listener is now ready.
   *
   * Tell Spring Boot to register this token.
   */
  const registerRequest:
    FcmRegisterRequest = {

    fcmToken,
  }


  try {

    await bstockAxios.post(
      '/fcm/register',
      registerRequest,
    )

  } catch (error) {

    if (timeoutId !== null) {

      window.clearTimeout(
        timeoutId,
      )
    }


    unsubscribe?.()

    throw error
  }


  /*
   * STEP 4
   *
   * Wait until:
   *
   * Spring
   *   ↓
   * FCM
   *   ↓
   * DEVICE_VERIFY
   *   ↓
   * /verify
   */
  await verificationPromise


  /*
   * Browser has now successfully proven
   * that it owns this FCM token.
   */
  return fcmToken
}
