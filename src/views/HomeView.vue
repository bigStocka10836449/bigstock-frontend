<template>
  <main class="home-page">
    <!-- ======================================================
         1. 首頁介紹
         ====================================================== -->
    <section class="intro">
      <h1>BigStock 股票資訊平台</h1>
      <p>掌握股市資訊、技術走勢、產業分類與最新財經快訊。</p>
    </section>

    <!-- ======================================================
         2. 最新財經快訊
         保留原本 newsStore，不新增 FCM Listener
         ====================================================== -->
    <section class="section">
      <div class="section-heading">
        <h2>最新財經快訊</h2>
        <RouterLink to="/news">查看更多 →</RouterLink>
      </div>

      <RouterLink to="/news" class="latest-news">
        <template v-if="newsStore.latestNews">
          <time>{{ newsStore.latestNews.time }}</time>

          <p>
            {{ newsStore.latestNews.title || newsStore.latestNews.content }}
          </p>
        </template>

        <span v-else>
          {{ newsStore.loading ? '新聞載入中...' : '目前沒有新聞資料' }}
        </span>
      </RouterLink>
    </section>

    <!-- ======================================================
         3. 個股漲跌幅排行榜
         新增功能
         ====================================================== -->
    <section class="section ranking-section">
      <div class="section-heading">
        <h2>個股漲跌幅排行</h2>

        <RouterLink to="/ranking"> 查看完整排行榜 → </RouterLink>
      </div>

      <StockChangeRanking />
    </section>

    <!-- ======================================================
         4. 功能入口
         保留原本功能，額外新增排行榜入口
         ====================================================== -->
    <section class="section">
      <h2>功能入口</h2>

      <div class="feature-grid">
        <!-- 日 K／週 K／月 K -->
        <RouterLink to="/candlestick" class="feature-card">
          <h3>日 K／週 K／月 K</h3>
          <p>保留既有股價圖表、技術篩選與資券資訊。</p>
        </RouterLink>

        <!-- 即時市場行情 -->
        <RouterLink to="/market-live" class="feature-card">
          <h3>即時市場行情</h3>
          <p>進入現有 WebSocket 行情頁面。</p>
        </RouterLink>

        <!-- 新增個股漲跌幅排行 -->
        <RouterLink to="/ranking" class="feature-card">
          <h3>個股漲跌幅排行</h3>
          <p>查看上市、上櫃股票漲跌幅排名， 點擊股票即可進入個股股價查詢。</p>
        </RouterLink>

        <!-- 產業分類 -->
        <RouterLink to="/industries" class="feature-card">
          <h3>產業分類</h3>
          <p>查看產業分類和成分股。</p>
        </RouterLink>

        <!-- 財經行事曆 -->
        <RouterLink to="/calendar" class="feature-card">
          <h3>財經行事曆</h3>
          <p>掌握市場與經濟事件。</p>
        </RouterLink>

        <!-- 新聞快訊 -->
        <RouterLink to="/news" class="feature-card">
          <h3>新聞快訊</h3>
          <p>檢視完整歷史新聞與最新 FCM 推播。</p>
        </RouterLink>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
  import { onMounted } from 'vue'

  import { useNewsStore } from '@/stores/newsStore'

  // 新增漲跌幅排行元件
  import StockChangeRanking from '@/components/bstock/StockChangeRanking.vue'

  // ============================================================
  // News Store
  // ============================================================

  const newsStore = useNewsStore()

  // ============================================================
  // Lifecycle
  // ============================================================

  onMounted(() => {
    // 保留既有新聞初始化流程。
    // newsStore 已有單例與請求去重機制。
    void newsStore.loadNews(100)

    // 保留既有 FCM Listener。
    // StockChangeRanking 不會另外註冊 FCM Listener。
    void newsStore.startFcmListener()
  })
</script>

<style scoped>
  /* ============================================================
   Home Page
   ============================================================ */

  .home-page {
    min-height: 100vh;
    padding: 32px 24px;
    box-sizing: border-box;
    background: #101418;
    color: #f1f5f9;
  }

  /* ============================================================
   Sections
   ============================================================ */

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

  /* ============================================================
   Section Heading
   ============================================================ */

  .section-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
  }

  .section-heading a {
    color: #91bfff;
    text-decoration: none;
    font-size: 13px;
    white-space: nowrap;
  }

  .section-heading a:hover {
    text-decoration: underline;
  }

  /* ============================================================
   Latest News
   ============================================================ */

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

  .latest-news:hover {
    border-color: #65c995;
  }

  .latest-news time {
    font-size: 12px;
    color: #9ca3af;
  }

  .latest-news p {
    line-height: 1.7;
    margin-bottom: 0;
  }

  /* ============================================================
   Ranking Section
   ============================================================ */

  .ranking-section {
    margin-top: 28px;
  }

  /*
 * 排行榜本身已具有：
 * background、border、border-radius。
 *
 * 不額外增加外層卡片，避免雙重邊框。
 */
  .ranking-section :deep(.ranking-panel) {
    width: 100%;
  }

  /* ============================================================
   Feature Grid
   ============================================================ */

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
    transition:
      border-color 0.2s ease,
      background-color 0.2s ease;
  }

  .feature-card:hover {
    border-color: #65c995;
    background: #212b33;
  }

  .feature-card h3 {
    margin: 0 0 10px;
  }

  .feature-card p {
    margin: 0;
    color: #9ca3af;
    line-height: 1.6;
  }

  /* ============================================================
   Responsive
   ============================================================ */

  @media (max-width: 768px) {
    .home-page {
      padding: 24px 16px;
    }

    .intro h1 {
      font-size: 27px;
    }

    .section-heading {
      align-items: flex-start;
    }
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

    .feature-card {
      padding: 18px;
    }

    .section-heading h2 {
      font-size: 18px;
    }

    .section-heading a {
      font-size: 12px;
    }
  }
</style>
