export interface TurnstileRenderOptions {
  sitekey: string
  action?: string
  theme?: 'auto' | 'light' | 'dark'
  size?: 'normal' | 'compact' | 'flexible'
  execution?: 'render' | 'execute'
  'response-field'?: boolean
  callback?: (token: string) => void
  'expired-callback'?: () => void
  'error-callback'?: (code?: string) => void
  'timeout-callback'?: () => void
}

export interface TurnstileAPI {
  render(container: HTMLElement, options: TurnstileRenderOptions): string

  reset(widgetId?: string): void

  remove(widgetId: string): void

  getResponse(widgetId?: string): string | undefined
}

declare global {
  interface Window {
    turnstile?: TurnstileAPI
  }
}

export {}
