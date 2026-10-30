<template>
  <div class="turnstile-wrapper">
    <div ref="container"></div>

    <p v-if="errorMessage" class="error-message">
      {{ errorMessage }}
    </p>
  </div>
</template>

<script setup lang="ts">
  import { ref, onMounted, onUnmounted } from 'vue'
  import { loadTurnstile } from '../services/turnstileLoader'

  const props = withDefaults(
    defineProps<{
      action?: string
      theme?: 'auto' | 'light' | 'dark'
    }>(),
    {
      action: 'fcm_challenge',
      theme: 'auto',
    },
  )

  const emit = defineEmits<{
    verified: [token: string]
    expired: []
    error: [message: string]
  }>()

  const container = ref<HTMLElement | null>(null)
  const errorMessage = ref('')

  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY

  let widgetId: string | null = null
  let destroyed = false

  async function initialize(): Promise<void> {
    if (!siteKey) {
      reportError('TURNSTILE_SITE_KEY_MISSING')
      return
    }

    try {
      const sdk = await loadTurnstile()

      if (destroyed || !container.value) {
        return
      }

      widgetId = sdk.render(container.value, {
        sitekey: siteKey,
        action: props.action,
        theme: props.theme,
        'response-field': false,

        callback(token: string) {
          if (destroyed) return

          errorMessage.value = ''
          emit('verified', token)
        },

        'expired-callback'() {
          if (destroyed) return
          emit('expired')
        },

        'error-callback'(code?: string) {
          if (destroyed) return

          reportError(`TURNSTILE_ERROR${code ? `_${code}` : ''}`)
        },

        'timeout-callback'() {
          if (destroyed) return
          reportError('TURNSTILE_TIMEOUT')
        },
      })
    } catch {
      if (!destroyed) {
        reportError('TURNSTILE_LOAD_FAILED')
      }
    }
  }

  function reportError(message: string): void {
    errorMessage.value = message
    emit('error', message)
  }

  function reset(): void {
    if (widgetId === null || !window.turnstile) {
      return
    }

    errorMessage.value = ''
    window.turnstile.reset(widgetId)
  }

  onMounted(() => {
    void initialize()
  })

  onUnmounted(() => {
    destroyed = true

    if (widgetId !== null) {
      window.turnstile?.remove(widgetId)
      widgetId = null
    }
  })

  defineExpose({ reset })
</script>

<style scoped>
  .turnstile-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .error-message {
    color: #dc2626;
    font-size: 13px;
    text-align: center;
  }
</style>
