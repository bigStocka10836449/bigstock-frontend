import './assets/main.css'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { ensureCsrfToken } from '@/services/csrfService'

function clearLegacyWebJwt(): void {
  for (const key of ['k1', 'k2', 'authToken', 'tokenExp']) {
    localStorage.removeItem(key)
  }
}
clearLegacyWebJwt()

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')

// 保留 Turnstile Cookie JWT 所需的 CSRF 初始化；移除 FCM 啟動。
void ensureCsrfToken().catch(error => console.error('[Security] CSRF bootstrap failed', error))
