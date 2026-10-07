<template>

  <div
    v-if="visible"
    class="notification-overlay"
  >

    <div class="notification-modal">

      <!-- =============================================== -->
      <!-- Permission has never been requested             -->
      <!-- =============================================== -->

      <template v-if="mode === 'required'">

        <h2>
          啟用裝置驗證
        </h2>

        <p>
          BigStock 需要瀏覽器通知權限來完成此裝置的安全驗證。
          啟用後即可繼續使用 BigStock 服務。
        </p>


        <div class="button-group">

          <button
            class="primary-button"
            :disabled="loading"
            @click="enableNotification"
          >

            {{
              loading
                ? '啟用中...'
                : '啟用裝置驗證'
            }}

          </button>


          <button
            class="secondary-button"
            :disabled="loading"
            @click="close"
          >
            稍後處理
          </button>

        </div>

      </template>


      <!-- =============================================== -->
      <!-- Permission was blocked                          -->
      <!-- =============================================== -->

      <template v-else-if="mode === 'denied'">

        <h2>
          需要開啟通知權限
        </h2>

        <p>
          您目前已封鎖 BigStock 的通知權限，
          因此無法完成裝置驗證。
        </p>

        <p>
          請點擊瀏覽器網址列左側的網站設定，
          將「通知」改為「允許」，
          然後重新整理此頁面。
        </p>


        <div class="steps">

          <div>
            1. 點擊網址列左側的網站設定
          </div>

          <div>
            2. 找到「通知」
          </div>

          <div>
            3. 設定為「允許」
          </div>

          <div>
            4. 回到 BigStock 並重新整理
          </div>

        </div>


        <div class="button-group">

          <button
            class="primary-button"
            @click="reloadPage"
          >
            我已開啟，重新整理
          </button>


          <button
            class="secondary-button"
            @click="close"
          >
            關閉
          </button>

        </div>

      </template>


      <!-- =============================================== -->
      <!-- Error                                           -->
      <!-- =============================================== -->

      <p
        v-if="errorMessage"
        class="error-message"
      >
        {{ errorMessage }}
      </p>

    </div>

  </div>

</template>


<script setup lang="ts">

import {
  onBeforeUnmount,
  onMounted,
  ref,
} from 'vue'

import {
  requestNotificationPermission,
} from '@/firebase/fcm'

import {
  ensureFcmVerified,
  FCM_PERMISSION_DENIED_EVENT,
  FCM_PERMISSION_REQUIRED_EVENT,
} from '@/firebase/fcmStartup'


type ModalMode =
  | 'required'
  | 'denied'


const visible =
  ref(false)

const mode =
  ref<ModalMode>('required')

const loading =
  ref(false)

const errorMessage =
  ref('')


/**
 * Show permission request dialog.
 */
function showRequired(): void {

  mode.value =
    'required'

  errorMessage.value =
    ''

  visible.value =
    true
}


/**
 * Show browser-settings instructions.
 */
function showDenied(): void {

  mode.value =
    'denied'

  errorMessage.value =
    ''

  visible.value =
    true
}


/**
 * Ask browser for notification permission.
 *
 * This runs from a real button click.
 */
async function enableNotification(): Promise<void> {

  if (loading.value) {
    return
  }


  loading.value =
    true

  errorMessage.value =
    ''


  try {

    const permission =
      await requestNotificationPermission()


    console.log(
      '[FCM] User permission result:',
      permission
    )


    if (permission === 'granted') {

      /*
       * Permission is now available.
       * Start device verification immediately.
       */
      await ensureFcmVerified()


      visible.value =
        false


      /*
       * Reload so APIs that previously failed
       * with 401 can start from a clean state.
       */
      window.location.reload()

      return
    }


    if (permission === 'denied') {

      mode.value =
        'denied'

      return
    }


    errorMessage.value =
      '尚未取得通知權限，請啟用後再繼續。'


  } catch (error) {

    console.error(
      '[FCM] Failed to enable notification:',
      error
    )


    errorMessage.value =
      '裝置驗證失敗，請稍後再試。'

  } finally {

    loading.value =
      false
  }
}


function reloadPage(): void {

  window.location.reload()
}


function close(): void {

  visible.value =
    false
}


onMounted(() => {

  window.addEventListener(
    FCM_PERMISSION_REQUIRED_EVENT,
    showRequired
  )


  window.addEventListener(
    FCM_PERMISSION_DENIED_EVENT,
    showDenied
  )


  /*
   * Important:
   *
   * initializeFcmOnStartup() may run before this
   * component has mounted.
   *
   * Therefore also inspect current permission here.
   */
  if ('Notification' in window) {

    if (
      Notification.permission === 'default'
    ) {

      showRequired()

    } else if (
      Notification.permission === 'denied'
    ) {

      showDenied()
    }
  }
})


onBeforeUnmount(() => {

  window.removeEventListener(
    FCM_PERMISSION_REQUIRED_EVENT,
    showRequired
  )


  window.removeEventListener(
    FCM_PERMISSION_DENIED_EVENT,
    showDenied
  )
})

</script>


<style scoped>

.notification-overlay {

  position: fixed;

  inset: 0;

  z-index: 99999;

  display: flex;

  align-items: center;

  justify-content: center;

  padding: 20px;

  background:
    rgba(0, 0, 0, 0.5);
}


.notification-modal {

  width: 100%;

  max-width: 460px;

  padding: 28px;

  border-radius: 14px;

  background: white;

  box-shadow:
    0 12px 40px
    rgba(0, 0, 0, 0.2);
}


.notification-modal h2 {

  margin-top: 0;

  margin-bottom: 16px;

  font-size: 22px;
}


.notification-modal p {

  line-height: 1.7;

  margin-bottom: 16px;
}


.steps {

  margin: 20px 0;

  padding: 16px;

  border-radius: 8px;

  background: #f5f5f5;

  line-height: 1.9;
}


.button-group {

  display: flex;

  gap: 12px;

  margin-top: 24px;
}


.primary-button,
.secondary-button {

  padding: 10px 18px;

  border-radius: 7px;

  cursor: pointer;

  font-size: 14px;
}


.primary-button {

  border: none;

  background: #222;

  color: white;
}


.secondary-button {

  border: 1px solid #ccc;

  background: white;

  color: #333;
}


button:disabled {

  cursor: not-allowed;

  opacity: 0.6;
}


.error-message {

  margin-top: 16px;

  color: #c62828;
}

</style>
