import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { connectMarketWorker, type MarketWorkerHandle } from '@/services/marketWorkerClient'
import type { SharedMarketStatus } from '@/services/marketWorkerProtocol'
import { getUSMarketHistory } from '@/api/marketHistoryApi'
import { parseAllMarketHistories, type MarketHistory } from '@/utils/marketHistoryParser'
import {
  adaptMarketEvent,
  extractIntradayPoints,
  type IntradayHistoryData,
  type LiveQuote,
} from '@/utils/marketEventAdapter'
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

/** Yahoo 當日分鐘價格或 WebSocket 實際收到的變價點；不填造價格。 */
export interface LivePricePoint {
  /** 行情來源時間（Unix 毫秒），備援才使用接收時間。 */
  time: number
  price: number
}

/** 無分鐘歷史資料時，備援即時點數上限。 */
const MAX_FALLBACK_POINTS = 240

function marketTimeZone(symbol: string): string {
  return symbol === 'WTX00' || symbol === 'WTX&'
    ? 'Asia/Taipei'
    : 'America/New_York'
}

function dateInZone(timestamp: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(timestamp))
  const part = (type: string) => parts.find(p => p.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

export const useMarketStore = defineStore('market', () => {
  const histories = ref<Record<string, MarketHistory>>({})
  const live = ref<Record<string, LiveQuote>>({})
  const liveSeries = ref<Record<string, LivePricePoint[]>>({})
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

  /** 一個商品目前已接受的交易時段；歷史優先使用上游 regular.start。 */
  const sessionBySymbol = new Map<string, string>()
  /** 只有同一個交易時段內才保留曾收到的分鐘歷史。 */
  const timeZoneBySymbol = new Map<string, string>()
  /** 避免行情來源偶爾缺歷史價格時，以接收時刻偽造當日分鐘線。 */
  const hasHistoricalPoints = new Set<string>()

  function sessionKey(history: IntradayHistoryData): string {
    if (history.sessionStart !== null) return `session:${history.sessionStart}`
    const last = history.points[history.points.length - 1]
    return `day:${dateInZone(last.time, history.timeZone)}`
  }

  /** 將 Yahoo timestamp[i] + close[i] 合併為當日線；短回應不清掉既有歷史。 */
  function mergeIntradayHistory(history: IntradayHistoryData): void {
    if (history.points.length === 0) return

    const symbol = history.symbol
    const nextSession = sessionKey(history)
    const oldSession = sessionBySymbol.get(symbol)

    // timestamp 型的 session key 可比較；舊推播不應清除較新的交易時段。
    if (oldSession?.startsWith('session:') && nextSession.startsWith('session:')) {
      const oldStart = Number(oldSession.slice(8))
      const nextStart = Number(nextSession.slice(8))
      if (nextStart < oldStart) return
    }

    const sameSession = oldSession === nextSession
    const existing = sameSession ? (liveSeries.value[symbol] ?? []) : []
    const points = new Map<number, LivePricePoint>()
    for (const point of existing) points.set(point.time, point)
    for (const point of history.points) points.set(point.time, point)

    liveSeries.value[symbol] = [...points.values()].sort((a, b) => a.time - b.time)
    sessionBySymbol.set(symbol, nextSession)
    timeZoneBySymbol.set(symbol, history.timeZone)
    hasHistoricalPoints.add(symbol)
  }

  /** 保存最新報價；僅當 Yahoo 沒提供分鐘價格時以真實推播價格作為備援。 */
  function appendLiveQuote(quote: LiveQuote, receivedAt = Date.now()): void {
    if (quote.price === null || !Number.isFinite(quote.price) || quote.price <= 0) return

    live.value[quote.symbol] = quote
    liveReceivedAt.value[quote.symbol] = receivedAt

    const time = typeof quote.updatedAt === 'number' && Number.isFinite(quote.updatedAt) && quote.updatedAt > 0
      ? quote.updatedAt
      : receivedAt
    const zone = timeZoneBySymbol.get(quote.symbol) ?? marketTimeZone(quote.symbol)
    const session = `day:${dateInZone(time, zone)}`
    const oldSession = sessionBySymbol.get(quote.symbol)
    if (oldSession && oldSession.startsWith('day:') && session < oldSession) return

    // 跨日後必須退出上一交易日的歷史模式，才能在 Yahoo 缺 close[] 時記錄新報價。
    if (hasHistoricalPoints.has(quote.symbol)) {
      const existingHistory = liveSeries.value[quote.symbol] ?? []
      const historyEnd = existingHistory[existingHistory.length - 1]?.time
      if (historyEnd !== undefined && dateInZone(time, zone) > dateInZone(historyEnd, zone)) {
        hasHistoricalPoints.delete(quote.symbol)
      } else {
        return
      }
    }

    const existing = oldSession === session ? (liveSeries.value[quote.symbol] ?? []) : []
    const last = existing[existing.length - 1]
    if (last && (time <= last.time || last.price === quote.price)) return

    liveSeries.value[quote.symbol] = [
      ...existing,
      { time, price: quote.price },
    ].slice(-MAX_FALLBACK_POINTS)
    sessionBySymbol.set(quote.symbol, session)
  }

  /** 歷史日 K 仍只走 REST API，不與 STOMP 當日線混用。 */
  async function loadHistories(force = false): Promise<void> {
    if (loadPromise) return loadPromise
    if (historyLoaded.value && !force) return
    historyLoading.value = true
    historyError.value = ''
    const task = (async (): Promise<void> => {
      try {
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

  /** App.vue 統一啟動；同源分頁共用 SharedWorker STOMP。 */
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
            const intraday = extractIntradayPoints(event)

            if (intraday) mergeIntradayHistory(intraday)
            if (quote) {
              // 報價更新仍維持 LiveQuote；有歷史序列時不額外插入假時間點。
              appendLiveQuote(quote, event.receivedAt)
            }
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

  /** 僅關閉本分頁 MessagePort。 */
  async function unmountSocket(): Promise<void> {
    if (!socket) return
    const current = socket
    socket = null
    ++socketGeneration
    current.disconnect()
    socketStatus.value = 'disconnected'
  }

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
