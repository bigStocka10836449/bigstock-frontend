import apiClient from '@/router/bstockAxios'


/**
 * SingleStockPrice 日／週／月 K 共用記憶體快取。
 *
 * 個股主圖與相似度搜尋候選圖均呼叫 getSingleStockPrice，
 * 因此自然共享同一份行情及同一筆尚未完成的 HTTP 請求。
 *
 * TTL: 10 分鐘；LRU 容量: 30 檔。
 * 只快取成功的非空資料，失敗的請求不會快取。
 */
export interface SingleStockPriceData {
  singleStockDayPriceVos?: unknown[]
  singleStockWeekPriceVos?: unknown[]
  singleStockMonthPriceVos?: unknown[]
  [key: string]: unknown
}

interface DayPriceCacheEntry {
  data: SingleStockPriceData
  expiresAt: number
}

const STOCK_PRICE_CACHE_TTL_MS = 10 * 60 * 1000
const STOCK_PRICE_CACHE_MAX_ENTRIES = 30
const stockPriceCache = new Map<string, DayPriceCacheEntry>()
const stockPricePending = new Map<string, Promise<SingleStockPriceData>>()
// 清除快取時，阻止清除前尚未結束的 request 回寫快取。
let stockPriceCacheGeneration = 0

function normalizeStockCode(stockCode: string): string {
  return String(stockCode ?? '').trim().toUpperCase()
}

function readStockPriceCache(key: string): SingleStockPriceData | undefined {
  const item = stockPriceCache.get(key)
  if (!item) return undefined
  if (Date.now() >= item.expiresAt) {
    stockPriceCache.delete(key)
    return undefined
  }
  // Map 的插入順序代表最近使用順序。
  stockPriceCache.delete(key)
  stockPriceCache.set(key, item)
  return item.data
}

function storeStockPriceCache(key: string, data: SingleStockPriceData): void {
  stockPriceCache.delete(key)
  stockPriceCache.set(key, {
    data,
    expiresAt: Date.now() + STOCK_PRICE_CACHE_TTL_MS,
  })
  while (stockPriceCache.size > STOCK_PRICE_CACHE_MAX_ENTRIES) {
    const oldest = stockPriceCache.keys().next().value
    if (oldest === undefined) break
    stockPriceCache.delete(oldest)
  }
}

/**
 * 共用 K 線行情 API：供個股主畫面及相似走勢候選圖共同使用。
 * forceRefresh 可在需要強制取得最新報價時跳過快取。
 */
export async function getSingleStockPrice(
  stockCode: string,
  options: { forceRefresh?: boolean } = {},
): Promise<SingleStockPriceData> {
  const code = normalizeStockCode(stockCode)
  if (!code) throw new Error('stockCode 不可為空')
  const key = `SingleStockPrice:${code}`

  if (!options.forceRefresh) {
    const cached = readStockPriceCache(key)
    if (cached !== undefined) return cached
  }

  // 同一檔股票同時查詢時，所有呼叫端共用同一筆 Promise。
  const pending = stockPricePending.get(key)
  if (pending) return pending

  const generation = stockPriceCacheGeneration
  const request = apiClient.post<SingleStockPriceData>(
    '/gateway/SingleStockPrice',
    { stockCode: code },
  ).then(({ data }) => {
    if (!data || typeof data !== 'object' || Array.isArray(data) ||
      !Object.keys(data).some(k => k === 'singleStockDayPriceVos' ||
        k === 'singleStockWeekPriceVos' || k === 'singleStockMonthPriceVos')) {
      throw new Error('SingleStockPrice 回傳格式不正確')
    }
    if (generation === stockPriceCacheGeneration) storeStockPriceCache(key, data)
    return data
  })

  stockPricePending.set(key, request)
  try {
    return await request
  } finally {
    if (stockPricePending.get(key) === request) stockPricePending.delete(key)
  }
}

/** 需要登出、切換帳號或行情資料更新時，可主動清除共用快取。 */
export function clearSingleStockPriceCache(stockCode?: string): void {
  stockPriceCacheGeneration++
  if (stockCode) {
    stockPriceCache.delete(`SingleStockPrice:${normalizeStockCode(stockCode)}`)
  } else {
    stockPriceCache.clear()
  }
  // 清除已發出的請求追蹤，讓後續查詢取得新的請求。
  stockPricePending.clear()
}

/**
 * 取得股票資券資料。
 */
export async function getStockMarginShortInfo(
  stockCode: string,
) {

  const response =
    await apiClient.get(
      `/biz/stockCodeMarginShortInfo/${stockCode}`,
    )

  return response.data
}


/**
 * 依篩選條件取得股票。
 */
export async function getStockCodeByFilter(
  conditions: unknown,
) {

  const response =
    await apiClient.post(
      '/gateway/StockCodeByFilter',
      conditions,
    )

  return response.data
}

/** 取得個股 5 分 K / 60 分 K；沿用既有 Axios 認證與 Gateway。 */
export type IntradayPeriod = '5m' | '60m'

export async function getSingleStockIntradayPrice(
  stockCode: string,
  period: IntradayPeriod,
): Promise<import('@/types/stockPrice').StockIntradayPrice[]> {
  const response = await apiClient.post<import('@/types/stockPrice').StockIntradayPrice[]>(
    '/gateway/SingleStockIntradayPrice',
    { stockCode, period },
  )
  return response.data
}


/** 相似走勢搜尋。由 Java Biz 原樣代理至 Python FastAPI。 */
export type HigherTimeframeMode = 'off' | 'boost' | 'filter'
export interface SimilaritySearchRequest {
  stock_code: string
  window_size: number
  top_n: number
  anchor_date: string
  higher_timeframe_mode: HigherTimeframeMode
}
export interface SimilarityMatch {
  stock_code: string
  start_date: string
  end_date: string
  score: number
  shape_score: number
  soft_dtw_score: number
  cosine_score: number
  shifted_cosine_score: number
  best_shift: number
  multi_scale_score: number
  turning_point_score: number
  soft_dtw_distance: number
  ranking_distance: number
  candidate_sources: string[]
  higher_timeframe?: { available?: boolean; passed?: boolean; reason?: string } | null
}
export interface SimilaritySearchResponse {
  stock_code: string
  window_size: number
  top_n: number
  anchor_date: string | null
  higher_timeframe_mode: HigherTimeframeMode
  results: SimilarityMatch[]
  skipped_count: number
  candidate_pool_count: number
  higher_timeframe_filtered_count: number
  higher_timeframe_unavailable_count: number
  message: string
}

// 若 Java Controller 的 @RequestMapping prefix 不同，僅需修改此路徑。
const similaritySearchPath = '/biz/similarity/search'
export async function searchSimilarStocks(payload: SimilaritySearchRequest): Promise<SimilaritySearchResponse> {
  const response = await apiClient.post<SimilaritySearchResponse>(similaritySearchPath, payload, {
    timeout: 330000, // Python 最長計算 5 分鐘；避免 Axios 過早中止
  })
  return response.data
}
