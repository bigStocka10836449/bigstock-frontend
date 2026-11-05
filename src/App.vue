<template>
  <div id="app" class="app-container">
    <Header />
    <main class="app-content"><RouterView /></main>
    <WebDeviceVerificationView v-if="turnstileRequired" />
  </div>
</template>

<script setup lang="ts">
  import { onMounted, onBeforeUnmount } from 'vue'
  import { RouterView } from 'vue-router'
  import Header from '@/views/Header.vue'
  import WebDeviceVerificationView from '@/security/views/WebDeviceVerificationView.vue'
  import { turnstileRequired } from '@/security/services/turnstileTokenService'
  import { useMarketStore } from '@/stores/marketStore'
  import { useNewsStore } from '@/stores/newsStore'

  const marketStore = useMarketStore()
  const newsStore = useNewsStore()

  onMounted(() => {
    marketStore.mountSocket()
    newsStore.startPolling()
  })
  onBeforeUnmount(() => {
    void marketStore.unmountSocket()
    newsStore.stopPolling()
  })
</script>

<style>
  :root {
    --bigstock-header-height: 110px;
  }
  html,
  body {
    margin: 0;
    padding: 0;
    width: 100%;
    min-height: 100%;
    overflow-x: clip;
  }
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }
  #app {
    display: flex;
    flex-direction: column;
    width: 100%;
    min-height: 100dvh;
  }
  .app-content {
    flex: 1;
    width: 100%;
    min-width: 0;
  }
</style>
