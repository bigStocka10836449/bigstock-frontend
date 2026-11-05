import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  compareStreamIds,
  getInitialNewsRecords,
  getNewsSince,
  parseNewsRecords,
  type NewsItem,
  type NewsStreamRecord,
} from '@/api/newsApi'

const POLL_INTERVAL_MS = 20_000
const MAX_RECORDS = 31
const PAGE_SIZE = 31 // 後端 newsSince 的單批最大筆數
const MAX_PAGES_PER_POLL = 20 // 防止持續新增資料導致單次同步無限執行
const RESUME_DEBOUNCE_MS = 1_000

export const useNewsStore = defineStore('news', () => {
  const news = ref<NewsItem[]>([])
  const loading = ref(false)
  const initialized = ref(false)
  const errorMessage = ref('')
  const latestRecordId = ref<string | null>(null)
  const lastSyncedAt = ref<number | null>(null)
  const latestNews = computed<NewsItem | null>(() => news.value[0] ?? null)
  const sources = computed(() => ['ALL', ...new Set(news.value.map(item => item.source).filter(Boolean))])

  let records: NewsStreamRecord[] = []
  let timer: ReturnType<typeof setTimeout> | null = null
  let running = false
  let inFlight: Promise<void> | null = null
  let generation = 0
  let pendingResume = false
  let nextDueAt = 0
  let lastResumeAt = 0

  function sameItems(a: NewsItem[], b: NewsItem[]): boolean {
    return a.length === b.length && a.every((item, index) => {
      const other = b[index]
      return other !== undefined && item.id === other.id && item.time === other.time &&
        item.title === other.title && item.content === other.content &&
        item.source === other.source && item.url === other.url &&
        item.important === other.important
    })
  }

  function commit(nextRecords: NewsStreamRecord[]): void {
    const unique = new Map<string, NewsStreamRecord>()
    for (const record of nextRecords) unique.set(record.id, record)
    const retained = [...unique.values()]
      .sort((a, b) => compareStreamIds(b.id, a.id))
      .slice(0, MAX_RECORDS)
    const nextItems = parseNewsRecords(retained)
    records = retained
    if (!sameItems(news.value, nextItems)) news.value = nextItems
    latestRecordId.value = retained[0]?.id ?? null
    initialized.value = true
    lastSyncedAt.value = Date.now()
    errorMessage.value = ''
  }

  async function fetchInitial(expectedGeneration: number): Promise<void> {
    loading.value = true
    try {
      const result = await getInitialNewsRecords()
      if (generation === expectedGeneration) commit(result)
    } finally {
      loading.value = false
    }
  }

  async function fetchIncremental(expectedGeneration: number): Promise<void> {
    const initialCursor = latestRecordId.value
    if (!initialized.value || !initialCursor) {
      await fetchInitial(expectedGeneration)
      return
    }

    let cursor = initialCursor
    const additions: NewsStreamRecord[] = []
    for (let page = 0; page < MAX_PAGES_PER_POLL; page++) {
      const batch = await getNewsSince(cursor)
      if (generation !== expectedGeneration) return
      if (batch.length === 0) break

      const next = batch
        .filter(record => compareStreamIds(record.id, cursor) > 0)
        .sort((a, b) => compareStreamIds(a.id, b.id))
      if (next.length === 0) throw new Error('newsSince cursor did not advance')
      additions.push(...next)
      cursor = next[next.length - 1]!.id
      if (batch.length < PAGE_SIZE) break
      // 如果剛好 31 筆，繼續抓下一批；沒有資料就會回傳 []。
    }

    // 一次收到超過 20 批時，下次繼續接續 cursor；避免單次長時間佔用。
    // 本次取得的資料可安全提交，因為後端回傳順序為 Stream ID 由舊到新。
    if (additions.length > 0 && generation === expectedGeneration) {
      commit([...records, ...additions])
    } else if (generation === expectedGeneration) {
      lastSyncedAt.value = Date.now()
      errorMessage.value = ''
    }
  }

  function clearTimer(): void {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  function scheduleNext(): void {
    clearTimer()
    if (!running || document.hidden || !navigator.onLine) return
    // 以前一次完成的時間為基準；阻塞或休眠恢復後由事件立即補抓。
    nextDueAt = Date.now() + POLL_INTERVAL_MS
    timer = setTimeout(() => { void pollOnce() }, POLL_INTERVAL_MS)
  }

  async function pollOnce(forceFull = false): Promise<void> {
    if (!running || document.hidden || !navigator.onLine) return
    if (inFlight) {
      if (forceFull) pendingResume = true
      return inFlight
    }
    clearTimer()
    const expectedGeneration = generation
    const task = (async () => {
      try {
        if (forceFull || !initialized.value || !latestRecordId.value) {
          await fetchInitial(expectedGeneration)
        } else {
          await fetchIncremental(expectedGeneration)
        }
      } catch (error) {
        if (generation !== expectedGeneration) return
        console.error('[NewsPolling] 同步失敗', error)
        errorMessage.value = '新聞更新失敗，稍後會自動重試'
      }
    })()
    inFlight = task
    try {
      await task
    } finally {
      if (inFlight === task) inFlight = null
      if (running && generation === expectedGeneration) {
        if (pendingResume && !document.hidden && navigator.onLine) {
          pendingResume = false
          void pollOnce() // 前一個請求完成後，立即補做一次增量查詢
        } else {
          scheduleNext()
        }
      }
    }
  }

  function resumeIfNeeded(): void {
    if (!running || document.hidden || !navigator.onLine) return
    const now = Date.now()
    if (now - lastResumeAt < RESUME_DEBOUNCE_MS) return
    lastResumeAt = now
    if (inFlight) {
      pendingResume = true
      return
    }
    // 從背景/休眠返回，直接同步，不必再等下一次 20 秒。
    void pollOnce()
  }

  function onVisibilityChange(): void {
    if (document.hidden) {
      clearTimer()
      return
    }
    resumeIfNeeded()
  }

  function onFocus(): void {
    // 避免每次視窗切換都呼叫 API；逾期才補同步。
    if (Date.now() >= nextDueAt) resumeIfNeeded()
  }

  function onOnline(): void { resumeIfNeeded() }
  function onPageShow(event: PageTransitionEvent): void {
    if (event.persisted) resumeIfNeeded()
  }

  function startPolling(): void {
    if (running) return
    running = true
    generation += 1
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', onFocus)
    window.addEventListener('online', onOnline)
    window.addEventListener('pageshow', onPageShow)
    if (!document.hidden && navigator.onLine) void pollOnce()
  }

  function stopPolling(): void {
    if (!running) return
    running = false
    generation += 1
    pendingResume = false
    clearTimer()
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('focus', onFocus)
    window.removeEventListener('online', onOnline)
    window.removeEventListener('pageshow', onPageShow)
  }

  /** 手動重新整理：與輪詢共用單一請求鎖。 */
  async function loadNews(_limit = 31, force = false): Promise<void> {
    if (!running) {
      // App 尚未啟動 Polling 時，由頁面觸發一次讀取。
      const expectedGeneration = generation
      try { await fetchInitial(expectedGeneration) }
      catch (error) {
        console.error('[NewsStore] 首次載入失敗', error)
        errorMessage.value = '新聞載入失敗，請稍後重試'
      }
      return
    }
    if (!initialized.value || force) await pollOnce(true)
  }

  return {
    news, loading, initialized, errorMessage, latestRecordId, lastSyncedAt,
    latestNews, sources, loadNews, pollOnce, startPolling, stopPolling,
  }
})
