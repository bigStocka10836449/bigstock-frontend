<template>
  <div id="app" class="app-container">
    <!--
      ======================================================
      全站共用 Header
      ======================================================

      Header 現在負責：
      1. 網站 Logo
      2. Vue Router 導覽選單
      3. FCM 即時新聞跑馬燈

      目前尚未正式啟用會員系統，
      因此不再傳入登入相關 Props 與 Emits。
    -->
    <Header />

    <!--
      ======================================================
      主內容區域
      ======================================================

      改用 Vue Router 控制頁面。

      /              -> HomeView.vue
      /candlestick   -> BstockCandlestick.vue
      /news          -> NewsView.vue
      /calendar      -> CalendarView.vue
      /industries    -> IndustryView.vue
      /market-live   -> MarketLiveView.vue

      不再使用：
      <Content :currentComponent="currentComponent" />

      避免 Header 切換網址後，
      畫面仍停留在舊的 Candlestick。
    -->
    <main class="app-content">
      <RouterView />
    </main>

    <!--
      ======================================================
      Firebase FCM 通知權限視窗
      ======================================================

      保留原本的通知權限 Modal。

      DEVICE_VERIFY、FCM Token、Guest JWT 等，
      繼續由你原本的 Firebase 模組處理。

      App.vue 不重新建立 FCM 驗證流程。
    -->
    <NotificationPermissionModal />

    <!--
      ======================================================
      會員登入／註冊功能（暫時停用）
      ======================================================

      目前不顯示會員介面。

      未來正式開發會員系統時，
      可以將登入視窗另外拆成 LoginModal.vue。

      注意：
      會員登入與 FCM Guest JWT 是不同機制，
      即使隱藏登入功能，也不影響 FCM 裝置驗證。
    -->
  </div>
</template>

<script setup lang="ts">
  /**
   * ============================================================
   * Vue Router
   * ============================================================
   *
   * RouterView 已在 Template 使用，
   * 會依據目前網址顯示對應的 View。
   */
  import { RouterView } from 'vue-router'

  /**
   * ============================================================
   * 共用 Header
   * ============================================================
   *
   * 保留你原本的檔案位置：
   * src/views/Header.vue
   */
  import Header from '@/views/Header.vue'

  /**
   * ============================================================
   * Firebase 通知權限 Modal
   * ============================================================
   *
   * 保留原本的通知權限介面。
   *
   * 不修改：
   * - firebase.ts
   * - fcm.ts
   * - fcmChallenge.ts
   * - fcmStartup.ts
   */
  import NotificationPermissionModal from '@/components/notification/NotificationPermissionModal.vue'
</script>

<style>
  :root {
    /* Header 加上新聞跑馬燈的預估高度 */
    --bigstock-header-height: 110px;
  }

  html,
  body {
    margin: 0;
    padding: 0;
    width: 100%;
    min-height: 100%;

    /* 不禁止整頁垂直捲動 */
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
