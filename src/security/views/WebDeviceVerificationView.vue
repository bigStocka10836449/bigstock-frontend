<template>
  <div class="verification-overlay" role="dialog" aria-modal="true" aria-label="BigStock 安全驗證">
    <div class="verification-card">
      <h3>BigStock 安全驗證</h3>
      <p class="description">請完成驗證，以繼續使用股票資訊服務。</p>
      <TurnstileChallenge
        ref="turnstileRef"
        action="fcm_challenge"
        @verified="handleVerified"
        @expired="handleExpired"
        @error="handleError"
      />
      <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
      <button v-if="errorMessage" type="button" @click="retry">重新驗證</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import TurnstileChallenge from '../components/TurnstileChallenge.vue'
import { submitTurnstileToken } from '@/security/services/turnstileTokenService'

const errorMessage = ref('')
const turnstileRef = ref<{ reset: () => void } | null>(null)
function handleVerified(token: string): void {
  errorMessage.value = ''
  submitTurnstileToken(token)
}
function handleExpired(): void {
  errorMessage.value = '驗證已過期，請重新嘗試。'
}
function handleError(message: string): void {
  errorMessage.value = message
}
function retry(): void {
  errorMessage.value = ''
  turnstileRef.value?.reset()
}
</script>

<style scoped>
.verification-overlay { position: fixed; inset: 0; z-index: 9999; display: flex; align-items: center; justify-content: center; background: rgba(0, 0, 0, .55); }
.verification-card { width: min(420px, 92vw); padding: 28px; border-radius: 12px; background: white; display: flex; flex-direction: column; align-items: center; gap: 16px; text-align: center; }
.description { font-size: 14px; color: #64748b; }
.error { color: #dc2626; font-size: 13px; }
button { padding: 10px 18px; border: none; border-radius: 8px; background: #2563eb; color: white; cursor: pointer; }
</style>
