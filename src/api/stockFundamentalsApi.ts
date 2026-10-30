import apiClient from '@/router/bstockAxios'

import type {
  ShareholderStructure,
} from '@/types/shareholderStructure'

import type {
  MonthlyRevenueVo,
  QuarterlyFinancialVo,
  StockBasicInfoResponse,
} from '@/types/stockFundamentals'


// ============================================================
// Types
// ============================================================

export type ExchangeMarket = 'TWSE' | 'TPEX'

/**
 * 個股最近 24 個月營收。
 *
 * Example:
 *
 * {
 *   "2026-09": MonthlyRevenueVo,
 *   "2026-08": MonthlyRevenueVo,
 *   "2026-07": null
 * }
 */
export type RecentStockRevenueResponse =
  Record<string, MonthlyRevenueVo | null>


// ============================================================
// Market Normalization
// ============================================================

/**
 * StockInfo.stockType:
 *
 * 0 = TPEX
 * 1 = TWSE
 * 2 = Emerging Stock
 */
export function normalizeMarket(
  raw: unknown,
): ExchangeMarket | null {

  const value = String(raw ?? '')
    .trim()
    .toUpperCase()

  if (
    ['0', 'TPEX', 'OTC', '上櫃'].includes(value)
  ) {
    return 'TPEX'
  }

  if (
    ['1', 'TWSE', 'TSE', '上市'].includes(value)
  ) {
    return 'TWSE'
  }


  return null
}


// ============================================================
// Stock Basic Info
// ============================================================

export async function getStockBasicInfo(
  stockCode: string,
  market: ExchangeMarket | null,
): Promise<StockBasicInfoResponse> {

  const { data } =
    await apiClient.get<StockBasicInfoResponse>(
      '/api/stock/basic-info',
      {
        params: {
          stockId: stockCode,
          ...(market ? { market } : {}),
          cacheOnly: false,
        },
      },
    )

  return data
}


// ============================================================
// Quarterly Financial - Market Cache
// ============================================================

/**
 * 每季全市場財報索引。
 *
 * year-quarter-market
 *
 * Example:
 * 2026-3-TWSE
 */
const quarterlyByStockCache =
  new Map<string, Map<string, QuarterlyFinancialVo>>()

const quarterlyIndexPending =
  new Map<string, Promise<Map<string, QuarterlyFinancialVo>>>()


/**
 * 查詢指定季度的全市場財報。
 */
export async function readQuarterlyIndexed(
  year: number,
  quarter: number,
  market: ExchangeMarket,
): Promise<Map<string, QuarterlyFinancialVo>> {

  if (quarter < 1 || quarter > 4) {
    throw new Error('quarter 必須介於 1～4')
  }

  const key = `${year}-${quarter}-${market}`

  const cached = quarterlyByStockCache.get(key)

  if (cached) {
    return cached
  }

  const pending = quarterlyIndexPending.get(key)

  if (pending) {
    return pending
  }

  const request = (async () => {

    const { data } =
      await apiClient.get<QuarterlyFinancialVo[]>(
        '/api/financial/quarterly',
        {
          params: {
            year,
            quarter,
            market,
          },
        },
      )

    if (!Array.isArray(data)) {
      throw new Error('季度財報 API 未回傳陣列')
    }

    const index =
      new Map<string, QuarterlyFinancialVo>()

    for (const row of data) {

      if (!row || row.stockId == null) {
        continue
      }

      const stockId = String(row.stockId).trim()

      if (stockId) {
        index.set(stockId, row)
      }
    }

    if (index.size > 0) {
      quarterlyByStockCache.set(key, index)
    }

    return index
  })()

  quarterlyIndexPending.set(key, request)

  try {
    return await request
  } finally {

    if (quarterlyIndexPending.get(key) === request) {
      quarterlyIndexPending.delete(key)
    }
  }
}


// ============================================================
// Quarterly Financial - Individual Stock
// ============================================================

const quarterlyStockPending =
  new Map<string, Promise<QuarterlyFinancialVo | null>>()


/**
 * 查詢指定股票的單季財報。
 *
 * Backend:
 * GET /api/financial/quarterly/{stockId}
 *
 * Spring Boot JVM Memory O(1) lookup.
 */
export async function readQuarterlyStock(
  year: number,
  quarter: number,
  market: ExchangeMarket,
  stockCode: string,
): Promise<QuarterlyFinancialVo | null> {

  if (
    !Number.isInteger(quarter) ||
    quarter < 1 ||
    quarter > 4
  ) {
    throw new Error('quarter 必須介於 1～4')
  }

  const stockId = stockCode.trim()

  if (!stockId) {
    return null
  }

  const requestKey =
    `${year}-${quarter}-${market}-${stockId}`

  const pending =
    quarterlyStockPending.get(requestKey)

  if (pending) {
    return pending
  }

  const request = (async (): Promise<QuarterlyFinancialVo | null> => {

    try {

      const { data } =
        await apiClient.get<QuarterlyFinancialVo>(
          `/api/financial/quarterly/${encodeURIComponent(stockId)}`,
          {
            params: {
              year,
              quarter,
              market,
            },
          },
        )

      return data ?? null

    } catch (error: unknown) {

      const status = (
        error as {
          response?: {
            status?: number
          }
        }
      )?.response?.status

      if (status === 404) {
        return null
      }

      throw error
    }
  })()

  quarterlyStockPending.set(requestKey, request)

  try {
    return await request
  } finally {

    if (quarterlyStockPending.get(requestKey) === request) {
      quarterlyStockPending.delete(requestKey)
    }
  }
}


/**
 * 相容原本的 readQuarterly()。
 */
export async function readQuarterly(
  year: number,
  quarter: number,
  market: ExchangeMarket,
): Promise<QuarterlyFinancialVo[]> {

  const index = await readQuarterlyIndexed(
    year,
    quarter,
    market,
  )

  return [...index.values()]
}


// ============================================================
// Shared Request
// ============================================================

/**
 * 同一分頁相同 Key 共用 Promise。
 */
function sharedRequest<T>(
  map: Map<string, Promise<T>>,
  key: string,
  fetcher: () => Promise<T>,
): Promise<T> {

  const existing = map.get(key)

  if (existing) {
    return existing
  }

  const promise = fetcher()
    .then((value) => {

      if (
        Array.isArray(value) &&
        value.length === 0
      ) {
        map.delete(key)
      }

      return value
    })
    .catch((error) => {

      map.delete(key)

      throw error
    })

  map.set(key, promise)

  return promise
}


// ============================================================
// Monthly Revenue - Individual Stock Cache
// ============================================================

/**
 * stockId → 最近 24 個月營收。
 *
 * 不使用 localStorage。
 *
 * 使用者切換股票時，
 * 已查詢過的股票直接從記憶體取得。
 */
const recentStockRevenueCache =
  new Map<string, RecentStockRevenueResponse>()

/**
 * 防止相同股票同時重複發送 API。
 */
const recentStockRevenuePending =
  new Map<string, Promise<RecentStockRevenueResponse>>()

/**
 * 快取版本。
 *
 * 依照台灣時間的年月管理，
 * 進入新月份後自動清除舊快取。
 */
let revenueCacheVersion = ''

/**
 * 防止清除快取後，舊 Request 又寫回資料。
 */
let revenueCacheGeneration = 0


// ============================================================
// Taiwan Year-Month
// ============================================================

function getTaipeiYearMonth(): string {

  const parts = new Intl.DateTimeFormat(
    'en-US',
    {
      timeZone: 'Asia/Taipei',
      year: 'numeric',
      month: '2-digit',
    },
  ).formatToParts(new Date())

  const year = parts.find(
    (part) => part.type === 'year',
  )?.value

  const month = parts.find(
    (part) => part.type === 'month',
  )?.value

  if (!year || !month) {
    throw new Error('無法取得台灣年月')
  }

  return `${year}-${month}`
}


// ============================================================
// Revenue Cache Version Check
// ============================================================

function ensureRevenueCacheVersion(): void {

  const version = getTaipeiYearMonth()

  if (revenueCacheVersion === version) {
    return
  }

  recentStockRevenueCache.clear()

  recentStockRevenuePending.clear()

  revenueCacheVersion = version

  revenueCacheGeneration++
}


// ============================================================
// Clear Individual Stock Revenue Cache
// ============================================================

/**
 * 清除全部個股營收快取。
 */
export function clearRecentStockRevenueCache(): void {

  recentStockRevenueCache.clear()

  recentStockRevenuePending.clear()

  revenueCacheGeneration++
}


/**
 * 清除指定股票的營收快取。
 */
export function clearStockRevenueCache(
  stockCode: string,
): void {

  const stockId = stockCode.trim()

  if (!stockId) {
    return
  }

  recentStockRevenueCache.delete(stockId)

  recentStockRevenuePending.delete(stockId)

  revenueCacheGeneration++
}


// ============================================================
// Monthly Revenue - Recent 24 Months By Stock
// ============================================================

/**
 * ============================================================
 * READ RECENT STOCK REVENUE
 *
 * 一次取得指定股票最近 24 個月營收。
 *
 * Browser:
 * GET /api/api/revenue/recent/2330
 *
 * Spring Boot:
 * GET /api/revenue/recent/2330
 *
 * Backend:
 * Redis → PostgreSQL → Redis Backfill
 *
 * Frontend:
 * Memory Cache → API
 * ============================================================
 */
export async function readRecentStockRevenue(
  stockCode: string,
): Promise<RecentStockRevenueResponse> {

  const stockId = stockCode.trim()

  if (!stockId) {
    throw new Error('stockId is required')
  }

  /*
   * 確認是否跨月。
   */
  ensureRevenueCacheVersion()

  // ============================================================
  // 1. Cache Hit
  // ============================================================

  const cached =
    recentStockRevenueCache.get(stockId)

  if (cached) {
    return cached
  }

  // ============================================================
  // 2. Pending Request
  // ============================================================

  const pending =
    recentStockRevenuePending.get(stockId)

  if (pending) {
    return pending
  }

  // ============================================================
  // 3. API Request
  // ============================================================

  const generation = revenueCacheGeneration

  const request = (async (): Promise<RecentStockRevenueResponse> => {

    const { data } =
      await apiClient.get<RecentStockRevenueResponse>(
        `/api/revenue/recent/${encodeURIComponent(stockId)}`,
      )

    if (
      !data ||
      typeof data !== 'object' ||
      Array.isArray(data)
    ) {
      throw new Error(
        '最近 24 個月個股營收 API 回傳格式錯誤',
      )
    }

    /*
     * 防止舊 Request 覆蓋新快取。
     */
    if (
      generation === revenueCacheGeneration &&
      getTaipeiYearMonth() === revenueCacheVersion
    ) {
      recentStockRevenueCache.set(stockId, data)
    }

    return data
  })()

  recentStockRevenuePending.set(
    stockId,
    request,
  )

  try {
    return await request
  } finally {

    if (
      recentStockRevenuePending.get(stockId) === request
    ) {
      recentStockRevenuePending.delete(stockId)
    }
  }
}


// ============================================================
// Monthly Revenue - Individual Month By Stock
// ============================================================

/**
 * 查詢指定股票、指定月份的月營收。
 *
 * 保留既有方法簽章。
 *
 * 第一次：
 * GET /api/revenue/recent/{stockId}
 *
 * 後續：
 * Vue Memory Cache
 */
export async function readMonthlyStock(
  yearMonth: string,
  stockCode: string,
): Promise<MonthlyRevenueVo | null> {

  const normalizedMonth = yearMonth.trim()

  const stockId = stockCode.trim()

  if (!stockId) {
    return null
  }

  const revenueByMonth =
    await readRecentStockRevenue(stockId)

  return revenueByMonth[normalizedMonth] ?? null
}


// ============================================================
// Monthly Revenue - Full Market
//
// 保留既有 API，供其他功能使用。
// ============================================================

type RecentRevenueResponse =
  Record<string, MonthlyRevenueVo[]>


/**
 * yyyy-MM -> stockId -> MonthlyRevenueVo
 */
const monthlyByStockCache =
  new Map<string, Map<string, MonthlyRevenueVo>>()

/**
 * 全市場最近 24 個月 API Pending。
 */
let recentRevenuePending: Promise<void> | null = null

/**
 * 已載入月份。
 */
const loadedRevenueMonths =
  new Set<string>()


/**
 * 一次取得最近 24 個月全市場資料。
 *
 * 注意：
 * 這個方法只提供需要全市場資料的功能使用。
 *
 * 個股查詢應使用 readRecentStockRevenue()。
 */
async function loadRecentRevenue(): Promise<void> {

  if (recentRevenuePending) {
    return recentRevenuePending
  }

  const request = (async () => {

    const { data } =
      await apiClient.get<RecentRevenueResponse>(
        '/api/revenue/recent',
      )

    if (
      !data ||
      typeof data !== 'object' ||
      Array.isArray(data)
    ) {
      throw new Error(
        '最近 24 個月全市場營收 API 回傳格式錯誤',
      )
    }

    /*
     * 先完整驗證並建立所有月份索引，
     * 避免部分資料已寫入快取才發現格式錯誤。
     */
    const indexes =
      new Map<string, Map<string, MonthlyRevenueVo>>()

    for (const [yearMonth, rows] of Object.entries(data)) {

      if (!Array.isArray(rows)) {
        throw new Error(
          `月營收資料格式錯誤: ${yearMonth}`,
        )
      }

      const index =
        new Map<string, MonthlyRevenueVo>()

      for (const row of rows) {

        if (!row || row.stockId == null) {
          continue
        }

        const stockId =
          String(row.stockId).trim()

        if (stockId) {
          index.set(stockId, row)
        }
      }

      indexes.set(yearMonth, index)
    }

    /*
     * 完整建立後，再更新快取。
     */
    for (const [yearMonth, index] of indexes) {

      monthlyByStockCache.set(yearMonth, index)

      loadedRevenueMonths.add(yearMonth)
    }

  })()

  recentRevenuePending = request

  try {
    await request
  } finally {

    if (recentRevenuePending === request) {
      recentRevenuePending = null
    }
  }
}


/**
 * 查詢指定月份的全市場索引。
 *
 * 保留既有 readMonthlyIndexed()。
 *
 * 注意：
 * 只支援 /recent 回傳的最近 24 個月。
 */
export async function readMonthlyIndexed(
  yearMonth: string,
): Promise<Map<string, MonthlyRevenueVo>> {

  const normalizedMonth = yearMonth.trim()

  /*
   * Memory Cache Hit
   */
  if (loadedRevenueMonths.has(normalizedMonth)) {

    return monthlyByStockCache.get(normalizedMonth)
      ?? new Map<string, MonthlyRevenueVo>()
  }

  /*
   * Memory Cache Miss
   */
  await loadRecentRevenue()

  return monthlyByStockCache.get(normalizedMonth)
    ?? new Map<string, MonthlyRevenueVo>()
}


/**
 * 相容既有 readMonthly()。
 */
export async function readMonthly(
  yearMonth: string,
): Promise<MonthlyRevenueVo[]> {

  const index =
    await readMonthlyIndexed(yearMonth)

  return [...index.values()]
}


// ============================================================
// Shareholder Structure
// ============================================================

/**
 * 持股分布：
 *
 * 每檔股票最多 200 筆週資料。
 *
 * 僅暫存於目前分頁。
 */
const shareholderPending =
  new Map<string, Promise<ShareholderStructure[]>>()


export function readShareholderStructure(
  stockCode: string,
  force = false,
): Promise<ShareholderStructure[]> {

  const code = stockCode.trim()

  if (!code) {
    return Promise.reject(
      new Error('缺少股票代號'),
    )
  }

  if (force) {
    shareholderPending.delete(code)
  }

  return sharedRequest(
    shareholderPending,
    code,
    async () => {

      const { data } =
        await apiClient.get<ShareholderStructure[]>(
          `/biz/stockShareholderStructure/${encodeURIComponent(code)}`,
        )

      if (!Array.isArray(data)) {
        throw new Error(
          '持股分布 API 未回傳陣列',
        )
      }

      return data
    },
  )
}

export interface StockQuarterFinancial {
  stockId: string
  stockName: string
  market: string

  year: number
  quarter: number

  periodStartMonth: number | null
  periodEndMonth: number | null

  unit: string | null

  operatingRevenue: number | null
  operatingProfit: number | null
  nonOperatingIncomeExpense: number | null
  netProfitAfterTax: number | null
  capitalStockEndPeriod: number | null

  earningsPerShare: number | null
  netAssetValuePerShare: number | null

  quickRatio: number | null
  currentRatio: number | null
  depn: number | null
}

/**
 * 一次取得個股最近最多 13 季的財報。
 *
 * 12 季顯示 + 1 季計算依據。
 */
export async function readStockFinancialHistory(
  market: ExchangeMarket,
  stockId: string,
): Promise<StockQuarterFinancial[]> {

  const response = await apiClient.get<StockQuarterFinancial[]>(
     `/api/financial/quarterly/stock/${encodeURIComponent(market)}/${encodeURIComponent(stockId)}`,
  )

  return response.data
}
