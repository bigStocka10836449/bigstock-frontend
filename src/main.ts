import './assets/main.css'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { initializeFcmOnStartup } from './firebase/fcmStartup'
import { ensureCsrfToken } from '@/services/csrfService'

// JWTs once stored by old Web builds. Preserve stockInfo (k0).
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

// App/REST/SharedWorker use authTokenManager.ensureSession() on demand.
// Initialize CSRF and notification UX independently of Guest Session.
void ensureCsrfToken()
  .then(() => initializeFcmOnStartup())
  .catch(error => console.error('[Security] bootstrap failed', error))
