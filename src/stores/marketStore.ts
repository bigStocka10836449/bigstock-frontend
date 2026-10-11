import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { connectMarketWorker, type MarketWorkerHandle } from '@/services/marketWorkerClient'
import type { SharedMarketStatus } from '@/services/marketWorkerProtocol'
import { getUSMarketHistory } from '@/api/marketHistoryApi'
import { parseAllMarketHistories, type MarketHistory } from '@/utils/marketHistoryParser'
import { adaptMarketEvent, type LiveQuote } from '@/utils/marketEventAdapter'
import type { MarketEvent } from '@/types/market'

/** 六個市場維持既有商品代碼與顯示順序。 */
export const MARKETS = [
  { symbol: 'WTX00', label: '台指期現貨', region: '台灣' },
  { symbol: 'WTX&', label: '台指期', region: '台灣' },
  { symbol: '^SOX', label: '費城半導體', region: '美國' },
  { symbol: 'MES=F', label: '微型標普 500 期貨', region: '美國' },
  { symbol: 'MYM=F', label: '微型道瓊期貨', region: '美國' },
  { symbol: 'MNQ=F', label: '微型那斯達克 100 期貨', region: '美國' },
] as const
export type MarketSymbol = (typeof MARKETS)[number]['symbol']
export type MarketSocketStatus = SharedMarketStatus

/** 即時圖的每個點都是 WebSocket 實際收到的有效價格，並非定時補造的資料。 */
export interface LivePricePoint {
  /** 前端收到推播的時間（毫秒），用於圖表時間軸。 */
  time: number
  price: number
}

const MAX_LIVE_POINTS = 240

export const useMarketStore = defineStore('market', () => {
  const histories = ref<Record<string, MarketHistory>>({})
  const live = ref<Record<string, LiveQuote>>({})
  const liveSeries = ref<Record<string, LivePricePoint[]>>({})
  /** 記錄這個商品最後收到有效價格推播的時間（包含同價推播）。 */
  const liveReceivedAt = ref<Record<string, number>>({})
  const historyLoading = ref(false)
  const historyLoaded = ref(false)
  const historyError = ref('')
  const socketStatus = ref<MarketSocketStatus>('disconnected')
  const selected = ref<MarketSymbol>('WTX00')

  const currentHistory = computed(() => histories.value[selected.value] ?? null)
  const currentLive = computed(() => live.value[selected.value] ?? null)
  const currentLiveSeries = computed(() => liveSeries.value[selected.value] ?? [])
  const currentLiveReceivedAt = computed(() => liveReceivedAt.value[selected.value] ?? null)

  let loadPromise: Promise<void> | null = null
  let socket: MarketWorkerHandle | null = null
  let socketGeneration = 0

  /**
   * 儲存 WebSocket 報價。價格沒變時更新最新報價，但不新增重複的走勢點。
   * 因為上游可能定期重播 Redis 快取，不能把每次收到訊息都當成新交易。
   * 注意：同價交易無法單憑價格辨識；若後端提供 tradeId/可靠成交時間，可改為以該欄位去重。
   */
  function appendLiveQuote(quote: LiveQuote, receivedAt = Date.now()): void {
    if (quote.price === null || !Number.isFinite(quote.price) || quote.price <= 0) return

    live.value[quote.symbol] = quote
    liveReceivedAt.value[quote.symbol] = receivedAt

    const existing = liveSeries.value[quote.symbol] ?? []
    const last = existing[existing.length - 1]
    // 不將未發生變動的快取價格畫成新走勢。
    if (last?.price === quote.price) return

    const next: LivePricePoint = { time: receivedAt, price: quote.price }
    liveSeries.value[quote.symbol] = [...existing, next].slice(-MAX_LIVE_POINTS)
  }

  /** 歷史資料只走 REST API；強制刷新失敗時保留已載入的舊 K 棒。 */
  async function loadHistories(force = false): Promise<void> {
    if (loadPromise) return loadPromise
    if (historyLoaded.value && !force) return
    historyLoading.value = true
    historyError.value = ''
    const task = (async (): Promise<void> => {
      try {
        // JWT 已由 bstockAxios Request Interceptor 統一處理。
        const response = await getUSMarketHistory()
        histories.value = parseAllMarketHistories(response.usHistory ?? {})
        historyLoaded.value = true
      } catch (error: unknown) {
        console.error('[Market] 歷史行情載入失敗', error)
        historyError.value = '歷史日 K 資料讀取失敗，請檢查網路、JWT 與 API 路徑。'
      } finally {
        historyLoading.value = false
      }
    })()
    loadPromise = task
    try {
      await task
    } finally {
      if (loadPromise === task) loadPromise = null
    }
  }

  /**
   * 由 App.vue 統一啟動；每個頁面只連上 SharedWorker 的 MessagePort。
   * 同一瀏覽器同源分頁共用 Worker 內的一條 STOMP WebSocket。
   */
  function mountSocket(): void {
    if (socket) return
    socketStatus.value = 'connecting'
    const generation = ++socketGeneration
    try {
      socket = connectMarketWorker(
        (event: MarketEvent): void => {
          if (generation !== socketGeneration) return
          try {
            const quote = adaptMarketEvent(event)
            if (quote) appendLiveQuote(quote, event.receivedAt)
          } catch (error) {
            console.error('[Market] 即時行情解析失敗', error)
          }
        },
        (status: SharedMarketStatus): void => {
          if (generation === socketGeneration) socketStatus.value = status
        },
      )
    } catch (error) {
      console.error('[Market] SharedWorker 初始化失敗', error)
      socketStatus.value = 'error'
    }
  }

  /** 僅關閉本分頁 MessagePort；還有其他分頁時不會關閉共用 WebSocket。 */
  async function unmountSocket(): Promise<void> {
    if (!socket) return
    const current = socket
    socket = null
    ++socketGeneration
    current.disconnect()
    socketStatus.value = 'disconnected'
  }

  /** 明確遭後端取代（4001）時不會自動重連，僅供使用者手動要求。 */
  function retryMarketSocket(): void {
    socket?.retry()
  }

  return {
    histories,
    live,
    liveSeries,
    liveReceivedAt,
    selected,
    currentHistory,
    currentLive,
    currentLiveSeries,
    currentLiveReceivedAt,
    historyLoading,
    historyLoaded,
    historyError,
    socketStatus,
    loadHistories,
    mountSocket,
    unmountSocket,
    retryMarketSocket,
  }
})
