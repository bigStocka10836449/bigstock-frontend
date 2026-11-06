export interface RuntimeConfig {
  APP_BASE_URL: string
  WEB_API_BASE_URL: string
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
