<template>
  <div id="app" class="app-container">
    <!-- ==================================================
         Global Header
         ================================================== -->
    <Header />

    <!-- ==================================================
         Main Content
         ================================================== -->
    <main class="app-content">
      <RouterView />
    </main>

    <!-- ==================================================
         Firebase Notification Permission
         ================================================== -->
    <NotificationPermissionModal />

    <!-- ==================================================
         Cloudflare Turnstile Verification

         Controlled by fcmStartup.ts.

         Only displayed when the current browser
         needs Web device verification.
         ================================================== -->
    <WebDeviceVerificationView v-if="turnstileRequired" />
  </div>
</template>

<script setup lang="ts">
  import { onMounted, onBeforeUnmount } from 'vue'

  import { RouterView } from 'vue-router'

  import Header from '@/views/Header.vue'

  import NotificationPermissionModal from '@/components/notification/NotificationPermissionModal.vue'

  import WebDeviceVerificationView from '@/security/views/WebDeviceVerificationView.vue'

  import { turnstileRequired } from '@/firebase/fcmStartup'

  import { useMarketStore } from '@/stores/marketStore'

  // ============================================================
  // Market Store
  // ============================================================

  const marketStore = useMarketStore()

  // ============================================================
  // Lifecycle
  // ============================================================

  onMounted(() => {
    /*
     * Keep your existing socket initialization.
     *
     * JWT / FCM verification should still be
     * enforced inside your existing socket
     * authorization flow.
     */
    marketStore.mountSocket()
  })

  onBeforeUnmount(() => {
    void marketStore.unmountSocket()
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
