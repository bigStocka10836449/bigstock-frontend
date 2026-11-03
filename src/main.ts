import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

import {
  initializeFcmOnStartup,
} from './firebase/fcmStartup'

/**
 * Remove legacy browser JWT storage.
 *
 * Keep stockInfo cache (k0).
 */
function migrateLegacyAuthStorage(): void {

  localStorage.removeItem('k1')
  localStorage.removeItem('k2')

  localStorage.removeItem('authToken')
  localStorage.removeItem('tokenExp')
}

/**
 * Authentication migration.
 */
migrateLegacyAuthStorage()

/**
 * Vue initialization.
 */
const app = createApp(App)

app.use(createPinia())

app.use(router)

app.mount('#app')

/**
 * Initialize FCM after Vue has mounted.
 */
void initializeFcmOnStartup()
