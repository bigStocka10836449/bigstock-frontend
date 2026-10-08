<template>
  <main class="home-page">
    <!-- 首頁暫不加入 MarketOverview；即時市場由既有 MarketLiveView.vue 負責。 -->
    <section class="intro">
      <h1>BigStock 股票資訊平台</h1>
      <p>掌握股市資訊、技術走勢、產業分類與最新財經快訊。</p>
    </section>

    <!-- 首頁使用同一份新聞 Store，不再註冊第二個 FCM listener。 -->
    <section class="section">
      <div class="section-heading">
        <h2>最新財經快訊</h2>
        <RouterLink to="/news">查看更多 →</RouterLink>
      </div>
      <RouterLink to="/news" class="latest-news">
        <template v-if="newsStore.latestNews">
          <time>{{ newsStore.latestNews.time }}</time>
          <p>{{ newsStore.latestNews.title || newsStore.latestNews.content }}</p>
        </template>
        <span v-else>{{ newsStore.loading ? '新聞載入中...' : '目前沒有新聞資料' }}</span>
      </RouterLink>
    </section>

    <!-- 既有功能入口：不重做日 K、週 K、月 K，也不新增行情 WebSocket。 -->
    <section class="section">
      <h2>功能入口</h2>
      <div class="feature-grid">
        <RouterLink to="/candlestick" class="feature-card"
          ><h3>日 K／週 K／月 K</h3>
          <p>保留既有股價圖表、技術篩選與資券資訊。</p></RouterLink
        >
        <RouterLink to="/market-live" class="feature-card"
          ><h3>即時市場行情</h3>
          <p>進入現有 WebSocket 行情頁面。</p></RouterLink
        >
        <RouterLink to="/industries" class="feature-card"
          ><h3>產業分類</h3>
          <p>查看產業分類和成分股。</p></RouterLink
        >
        <RouterLink to="/calendar" class="feature-card"
          ><h3>財經行事曆</h3>
          <p>掌握市場與經濟事件。</p></RouterLink
        >
        <RouterLink to="/news" class="feature-card"
          ><h3>新聞快訊</h3>
          <p>檢視完整歷史新聞與最新 FCM 推播。</p></RouterLink
        >
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
  import { onMounted } from 'vue'
  import { useNewsStore } from '@/stores/newsStore'

  const newsStore = useNewsStore()
  onMounted(() => {
    // Store 具備單例與請求去重；Header 已載入時不會重複初始化。
    void newsStore.loadNews(100)
    void newsStore.startFcmListener()
  })
</script>

<style scoped>
  .home-page {
    min-height: 100vh;
    padding: 32px 24px;
    box-sizing: border-box;
    background: #101418;
    color: #f1f5f9;
  }
  .intro,
  .section {
    max-width: 1200px;
    margin: 0 auto 32px;
  }
  .intro h1 {
    margin: 0 0 12px;
    font-size: 30px;
  }
  .intro p {
    color: #9ca3af;
  }
  .section h2 {
    font-size: 20px;
  }
  .section-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .section-heading a {
    color: #91bfff;
    text-decoration: none;
  }
  .latest-news {
    display: block;
    margin-top: 14px;
    padding: 20px;
    background: #1b2229;
    border: 1px solid #303942;
    border-radius: 10px;
    color: #f1f5f9;
    text-decoration: none;
  }
  .latest-news time {
    font-size: 12px;
    color: #9ca3af;
  }
  .latest-news p {
    line-height: 1.7;
    margin-bottom: 0;
  }
  .feature-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
    margin-top: 18px;
  }
  .feature-card {
    padding: 22px;
    background: #1b2229;
    border: 1px solid #303942;
    border-radius: 10px;
    color: #f1f5f9;
    text-decoration: none;
  }
  .feature-card:hover {
    border-color: #65c995;
  }
  .feature-card h3 {
    margin: 0 0 10px;
  }
  .feature-card p {
    margin: 0;
    color: #9ca3af;
    line-height: 1.6;
  }
  @media (max-width: 640px) {
    .home-page {
      padding: 20px 12px;
    }
    .intro h1 {
      font-size: 25px;
    }
    .feature-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
