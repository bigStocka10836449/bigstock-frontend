import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

import {
  initializeFcmOnStartup,
} from './firebase/fcmStartup'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')

/*
 * Initialize FCM after Vue has mounted.
 *
 * Do NOT await this.
 *
 * We don't want FCM initialization to block
 * BigStock from rendering.
 */
void initializeFcmOnStartup()
