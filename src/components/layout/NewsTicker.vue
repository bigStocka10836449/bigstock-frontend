<template>
  <div class="news-ticker">
    <!-- 左側為即時狀態標籤；只代表新聞推播功能，不代表 FCM 一定已連線。 -->
    <div class="ticker-label"><span class="live-dot" />即時快訊</div>

    <!-- 新聞內容區固定高度，避免新聞切換時推動整個頁面。 -->
    <div class="ticker-viewport">
      <!-- 只有最新新聞 ID 變更才執行向下滑動動畫；不做定時輪播。 -->
      <Transition :name="ready ? 'news-slide' : ''">
        <RouterLink
          :key="currentNews?.id ?? 'empty'"
          to="/news"
          class="ticker-item"
          :aria-label="
            currentNews
              ? '查看最新新聞：' + (currentNews.title || currentNews.content)
              : '查看新聞快訊'
          "
        >
          <template v-if="currentNews">
            <time class="ticker-time">{{ formatTime(currentNews.time) }}</time>
            <span class="ticker-text">{{ currentNews.title || currentNews.content }}</span>
          </template>
          <span v-else class="ticker-empty">
            {{ newsStore.loading ? '正在載入新聞...' : '目前沒有新聞快訊' }}
          </span>
        </RouterLink>
      </Transition>
    </div>

    <!-- 完整新聞清單顯示更多歷史新聞。 -->
    <RouterLink class="more-news" to="/news">查看更多 →</RouterLink>
  </div>
</template>

<script setup lang="ts">
  import { computed, nextTick, onMounted, ref } from 'vue'
  import { useNewsStore } from '@/stores/newsStore'

  const newsStore = useNewsStore()
  const currentNews = computed(() => newsStore.latestNews)

  // 首次讀取歷史資料時不播放動畫，避免空狀態滑動。
  const ready = ref(false)

  function formatTime(time: string): string {
    // 後端新聞格式：yyyy-MM-dd HH:mm:ss；沒有資料就顯示空字串。
    return time.length >= 16 ? time.slice(11, 16) : time
  }

  onMounted(async () => {
    // 優先註冊 FCM 監聽；若初始化失敗仍可顯示 REST 歷史新聞。
    void newsStore.startFcmListener()
    await newsStore.loadNews(100)
    await nextTick()
    ready.value = true
  })
</script>

<style scoped>
  .news-ticker {
    display: flex;
    align-items: center;
    gap: 16px;
    width: 100%;
    height: 46px;
    padding: 0 24px;
    box-sizing: border-box;
    background: #141a20;
    color: #fff;
    border-top: 1px solid #343d47;
    border-bottom: 1px solid #343d47;
  }
  .ticker-label {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
    color: #ff7777;
    font-size: 13px;
    font-weight: 700;
    white-space: nowrap;
  }
  .live-dot {
    width: 7px;
    height: 7px;
    background: #ff5252;
    border-radius: 50%;
    animation: pulse 1.6s infinite;
  }
  .ticker-viewport {
    position: relative;
    flex: 1;
    min-width: 0;
    height: 100%;
    overflow: hidden;
  }
  .ticker-item {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
    text-decoration: none;
    color: inherit;
  }
  .ticker-time {
    flex-shrink: 0;
    color: #9ca3af;
    font-size: 12px;
    white-space: nowrap;
  }
  .ticker-text {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: 13px;
  }
  .ticker-item:hover .ticker-text {
    color: #91c5ff;
  }
  .ticker-empty {
    color: #8b949e;
    font-size: 13px;
  }
  .more-news {
    flex-shrink: 0;
    text-decoration: none;
    color: #91bfff;
    font-size: 12px;
    white-space: nowrap;
  }
  .more-news:hover {
    color: white;
  }
  /* 新新聞從上方進入，舊新聞向下滑出；只在新聞變動時觸發。 */
  .news-slide-enter-active,
  .news-slide-leave-active {
    transition:
      transform 650ms cubic-bezier(0.22, 1, 0.36, 1),
      opacity 650ms ease;
  }
  .news-slide-enter-from {
    transform: translateY(-100%);
    opacity: 0;
  }
  .news-slide-enter-to {
    transform: translateY(0);
    opacity: 1;
  }
  .news-slide-leave-from {
    transform: translateY(0);
    opacity: 1;
  }
  .news-slide-leave-to {
    transform: translateY(100%);
    opacity: 0;
  }
  @keyframes pulse {
    50% {
      opacity: 0.3;
    }
  }
  @media (max-width: 640px) {
    .news-ticker {
      padding: 0 12px;
      gap: 10px;
    }
    .ticker-label,
    .ticker-time,
    .more-news {
      font-size: 11px;
    }
    .ticker-text {
      font-size: 12px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .news-slide-enter-active,
    .news-slide-leave-active {
      transition: none;
    }
    .live-dot {
      animation: none;
    }
  }
</style>
