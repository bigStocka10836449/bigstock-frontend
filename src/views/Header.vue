<template>
  <header class="site-header">
    <div class="header-main">
      <!-- 首頁入口；移除畫面上的會員登入／登出，但不修改 FCM Guest JWT 驗證。 -->
      <RouterLink to="/" class="brand">BigStock</RouterLink>

      <!-- 全站路由選單，手機可左右捲動。 -->
      <nav class="nav-menu" aria-label="網站主要導覽">
        <RouterLink to="/">首頁</RouterLink>
        <RouterLink to="/ranking"> 漲跌幅排行 </RouterLink>
        <RouterLink to="/candlestick">個股查詢</RouterLink>
        <RouterLink to="/industries">產業分類</RouterLink>
        <RouterLink to="/calendar">財經行事曆</RouterLink>
        <RouterLink to="/market-live">即時市場</RouterLink>
        <RouterLink to="/news">新聞快訊</RouterLink>
      </nav>
    </div>

    <!-- Header 始終掛載同一個跑馬燈元件。 -->
    <NewsTicker />
  </header>
</template>

<script setup lang="ts">
  import NewsTicker from '@/components/layout/NewsTicker.vue'
</script>

<style scoped>
  .ranking-nav-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 10px 18px;
    border-radius: 6px;
    background: #24313b;
    border: 1px solid #40515c;
    color: #e5edf4;
    text-decoration: none;
    font-size: 13px;
  }

  .ranking-nav-link:hover,
  .ranking-nav-link.router-link-active {
    background: #4caf50;
    border-color: #4caf50;
    color: #ffffff;
  }
  .site-header {
    display: flex;
    flex-direction: column;
    width: 100%;
    background: #24292f;
    color: #fff;
  }
  .header-main {
    display: flex;
    align-items: center;
    gap: 40px;
    min-height: 58px;
    padding: 0 24px;
    box-sizing: border-box;
  }
  .brand {
    color: #65c995;
    text-decoration: none;
    font-size: 23px;
    font-weight: 700;
    white-space: nowrap;
  }
  .nav-menu {
    display: flex;
    align-items: center;
    gap: 24px;
    flex: 1;
    min-width: 0;
  }
  .nav-menu a {
    color: #c5cbd3;
    text-decoration: none;
    font-size: 14px;
    white-space: nowrap;
  }
  .nav-menu a:hover {
    color: #fff;
  }
  .nav-menu a.router-link-exact-active {
    color: #65c995;
    font-weight: 700;
  }
  @media (max-width: 850px) {
    .header-main {
      flex-wrap: wrap;
      gap: 12px;
      padding: 12px 16px;
    }
    .nav-menu {
      width: 100%;
      flex-basis: 100%;
      gap: 20px;
      overflow-x: auto;
      padding-bottom: 4px;
    }
    .nav-menu a {
      font-size: 13px;
    }
  }
</style>
