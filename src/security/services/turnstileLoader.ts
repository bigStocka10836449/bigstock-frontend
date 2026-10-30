import type { TurnstileAPI } from '../types/turnstile'

const SCRIPT_ID = 'bigstock-turnstile-sdk'

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

let loading: Promise<TurnstileAPI> | null = null

export function loadTurnstile(): Promise<TurnstileAPI> {
  if (window.turnstile) {
    return Promise.resolve(window.turnstile)
  }

  if (loading) {
    return loading
  }

  loading = new Promise<TurnstileAPI>((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID)

    // 若曾經載入失敗，清除殘留節點
    if (existing) {
      existing.remove()
    }

    const script = document.createElement('script')

    script.id = SCRIPT_ID
    script.src = SCRIPT_URL
    script.async = true

    script.onload = () => {
      if (window.turnstile) {
        resolve(window.turnstile)
      } else {
        script.remove()
        reject(new Error('TURNSTILE_SDK_UNAVAILABLE'))
      }
    }

    script.onerror = () => {
      script.remove()
      reject(new Error('TURNSTILE_SDK_LOAD_FAILED'))
    }

    document.head.appendChild(script)
  }).catch((error) => {
    loading = null
    throw error
  })

  return loading
}
