import { ref } from 'vue'

/** The widget only produces one-time credentials; Siteverify runs on backend. */
export const turnstileRequired = ref(false)
let inFlight: Promise<string> | null = null
let resolveToken: ((value: string) => void) | null = null
let rejectToken: ((reason: Error) => void) | null = null

export function requestTurnstileToken(): Promise<string> {
  if (inFlight) return inFlight
  inFlight = new Promise<string>((resolve, reject) => {
    resolveToken = resolve
    rejectToken = reject
  })
  turnstileRequired.value = true
  return inFlight
}

export function submitTurnstileToken(token: string): void {
  if (!token?.trim() || !resolveToken) return
  const resolve = resolveToken
  resolveToken = null
  rejectToken = null
  inFlight = null
  turnstileRequired.value = false
  resolve(token)
}

export function cancelTurnstileVerification(message = 'TURNSTILE_CANCELLED'): void {
  const reject = rejectToken
  inFlight = null
  resolveToken = null
  rejectToken = null
  turnstileRequired.value = false
  reject?.(new Error(message))
}
