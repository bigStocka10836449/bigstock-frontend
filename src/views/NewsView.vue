<template>
  <main class="news-page">
    <div class="page-header">
      <div><h1>新聞快訊</h1><p>即時掌握最新股市與財經消息</p></div>
      <button type="button" class="refresh-btn" :disabled="newsStore.loading" @click="refreshNews">
        {{ newsStore.loading ? '更新中...' : '重新整理' }}
      </button>
    </div>

    <!-- 全部來源來自共用 Store；沒有額外的新聞資料副本。 -->
    <div class="source-filters" aria-label="新聞來源篩選">
      <button
        v-for="source in newsStore.sources"
        :key="source"
        type="button"
        :class="{ active: selectedSource === source }"
        @click="selectedSource = source"
      >{{ source === 'ALL' ? '全部來源' : source }}</button>
    </div>

    <p v-if="newsStore.loading && newsStore.news.length === 0" class="status">正在載入新聞...</p>
    <p v-else-if="newsStore.errorMessage && newsStore.news.length === 0" class="status">{{ newsStore.errorMessage }}</p>
    <p v-else-if="filteredNews.length === 0" class="status">目前沒有符合條件的新聞</p>

    <div v-else class="news-list">
      <article v-for="item in filteredNews" :key="item.id" class="news-card">
        <div class="news-meta">
          <time>{{ item.time }}</time>
          <span class="source">{{ item.source }}</span>
          <span v-if="item.important" class="important">重要</span>
        </div>
        <h2 v-if="item.title">{{ item.title }}</h2>
        <p>{{ item.content }}</p>
        <a v-if="isSafeUrl(item.url)" :href="item.url" target="_blank" rel="noopener noreferrer">閱讀原文 →</a>
      </article>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useNewsStore } from '@/stores/newsStore'

const newsStore = useNewsStore()
const selectedSource = ref('ALL')

/** 由 Store 提供的資料已經完成新聞 ID 去重及新到舊排序。 */
const filteredNews = computed(() => selectedSource.value === 'ALL'
  ? newsStore.news
  : newsStore.news.filter(item => item.source === selectedSource.value))

/** 「重新整理」只觸發 REST；不會重新訂閱或建立 FCM listener。 */
function refreshNews(): void { void newsStore.loadNews(100, true) }

/** 僅允許安全的 HTTP(S) 外部連結。 */
function isSafeUrl(url: string): boolean {
  try { const parsed = new URL(url); return parsed.protocol === 'https:' || parsed.protocol === 'http:' }
  catch { return false }
}

onMounted(() => {
  void newsStore.startFcmListener()
  void newsStore.loadNews(100)
})
</script>

<style scoped>
.news-page { min-height: 100vh; padding: 30px 24px; box-sizing: border-box; background: #101418; color: #f1f5f9; }
.page-header { display: flex; justify-content: space-between; align-items: center; gap: 20px; max-width: 1100px; margin: 0 auto 26px; }
.page-header h1 { margin: 0 0 8px; font-size: 26px; }
.page-header p { margin: 0; color: #9ca3af; font-size: 14px; }
.refresh-btn, .source-filters button { padding: 9px 14px; border: 1px solid #414b55; border-radius: 6px; background: #242b32; color: white; cursor: pointer; }
.refresh-btn:disabled { opacity: .5; cursor: not-allowed; }
.source-filters { display: flex; gap: 10px; max-width: 1100px; margin: 0 auto 24px; overflow-x: auto; }
.source-filters button.active { background: #245c42; border-color: #4caf79; }
.news-list { display: flex; flex-direction: column; gap: 12px; max-width: 1100px; margin: auto; }
.news-card { padding: 20px; border: 1px solid #303942; border-radius: 10px; background: #1b2229; }
.news-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 12px; color: #9ca3af; font-size: 12px; }
.source { color: #86b8fb; }
.important { color: #ff8c8c; }
.news-card h2 { margin: 0 0 10px; font-size: 17px; }
.news-card p { margin: 0; font-size: 14px; line-height: 1.8; white-space: pre-wrap; }
.news-card a { display: inline-block; margin-top: 12px; font-size: 13px; color: #8ab4ff; text-decoration: none; }
.status { padding: 40px 0; text-align: center; color: #9ca3af; }
@media (max-width: 640px) { .news-page { padding: 18px 12px; } .page-header h1 { font-size: 22px; } .news-card { padding: 15px; } }
</style>
