import { ref } from 'vue'
import type { MessagePayload } from 'firebase/messaging'

import {
  listenForForegroundMessages,
  requestFcmToken,
} from '../firebase/fcm'


const fcmToken = ref<string | null>(null)

const initialized = ref(false)

const initializing = ref(false)

const lastMessage = ref<MessagePayload | null>(null)


export function useFcm() {

  /**
   * Ask for notification permission and initialize
   * this browser as an FCM client.
   */
  async function initializeFcm(): Promise<string | null> {

    if (initialized.value) {
      return fcmToken.value
    }

    if (initializing.value) {
      return null
    }

    initializing.value = true

    try {

      const token = await requestFcmToken()

      if (!token) {
        return null
      }

      fcmToken.value = token
      initialized.value = true

      return token

    } catch (error) {

      console.error(
        '[FCM] Initialization failed:',
        error
      )

      throw error

    } finally {

      initializing.value = false
    }
  }


  /**
   * Start listening for foreground FCM messages.
   */
  async function startForegroundListener(
    callback?: (payload: MessagePayload) => void,
  ) {

    return listenForForegroundMessages(
      (payload) => {

        lastMessage.value = payload

        if (callback) {
          callback(payload)
        }
      },
    )
  }


  return {

    fcmToken,
    initialized,
    initializing,
    lastMessage,

    initializeFcm,
    startForegroundListener,
  }
}
