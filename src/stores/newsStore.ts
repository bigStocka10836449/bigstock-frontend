import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getLatestNews, sortAndDeduplicateNews, type NewsItem } from '@/api/newsApi'
import { listenForNewsNotifications } from '@/firebase/newsNotificationService'

/**
 * BigStock 全站新聞 Store。
 * Header、首頁與完整新聞列表共用相同資料與單一 FCM NEWS listener。
 *
 * 注意：Store 只管理前景訊息；背景推播仍由既有 Service Worker 處理。
 */
export const useNewsStore = defineStore('news', () => {
  const news = ref<NewsItem[]>([])
  const loading = ref(false)
  const initialized = ref(false)
  const errorMessage = ref('')
  const fcmListening = ref(false)

  let loadPromise: Promise<void> | null = null
  let listenerPromise: Promise<void> | null = null
  let unsubscribeFcm: (() => void) | null = null

  const latestNews = computed<NewsItem | null>(() => news.value[0] ?? null)
  const sources = computed(() => ['ALL', ...new Set(news.value.map(item => item.source).filter(Boolean))])

  /** 合併後由前端依時間排序、以 ID 去重，最多保留 500 則。 */
  function mergeNews(items: NewsItem[]): void {
    news.value = sortAndDeduplicateNews([...news.value, ...items]).slice(0, 500)
  }

  /** FCM 新聞抵達時只增量加入資料，不重複寫入相同 ID。 */
  function receiveNews(item: NewsItem): void {
    if (news.value.some(existing => existing.id === item.id)) return
    mergeNews([item])
  }

  /**
   * 取得歷史資料：只載入一次，force=true 則重新請求。
   * 使用合併而非覆蓋，避免請求過程中到達的 FCM 新聞遺失。
   */
  async function loadNews(limit = 100, force = false): Promise<void> {
    if (loadPromise) return loadPromise
    if (initialized.value && !force) return

    loadPromise = (async () => {
      loading.value = true
      errorMessage.value = ''
      try {
        mergeNews(await getLatestNews(limit))
        initialized.value = true
      } catch (error) {
        console.error('[NewsStore] 歷史新聞載入失敗', error)
        errorMessage.value = '新聞載入失敗，請稍後重試'
      } finally {
        loading.value = false
      }
    })()

    try { await loadPromise } finally { loadPromise = null }
  }

  /** 只建立一次前景 NEWS Listener；不會取代 DEVICE_VERIFY Listener。 */
  async function startFcmListener(): Promise<void> {
    if (unsubscribeFcm) return
    if (listenerPromise) return listenerPromise

    listenerPromise = (async () => {
      try {
        unsubscribeFcm = await listenForNewsNotifications(receiveNews)
        fcmListening.value = true
      } catch (error) {
        fcmListening.value = false
        console.error('[NewsStore] FCM NEWS 監聽初始化失敗', error)
      }
    })()

    try { await listenerPromise } finally { listenerPromise = null }
  }

  /** 僅供全站結束或刻意停用 NEWS 使用；一般切換頁面不需要呼叫。 */
  async function stopFcmListener(): Promise<void> {
    if (listenerPromise) await listenerPromise
    unsubscribeFcm?.()
    unsubscribeFcm = null
    fcmListening.value = false
  }

  return {
    news, loading, initialized, errorMessage, fcmListening,
    latestNews, sources, mergeNews, receiveNews,
    loadNews, startFcmListener, stopFcmListener,
  }
})
