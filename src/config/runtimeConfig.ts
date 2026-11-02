export interface RuntimeConfig {
  APP_BASE_URL: string
  WEB_API_BASE_URL: string
  FIREBASE_API_KEY: string
  FIREBASE_AUTH_DOMAIN: string
  FIREBASE_PROJECT_ID: string
  FIREBASE_STORAGE_BUCKET: string
  FIREBASE_MESSAGING_SENDER_ID: string
  FIREBASE_APP_ID: string
  FIREBASE_VAPID_KEY: string
  TURNSTILE_SITE_KEY: string
}

declare global {
  interface Window {
    __APP_CONFIG__?: RuntimeConfig
  }
}

export function getRuntimeConfig(): RuntimeConfig {
  const config = window.__APP_CONFIG__
  if (!config) throw new Error('Missing /config.js runtime configuration')
  return config
}
