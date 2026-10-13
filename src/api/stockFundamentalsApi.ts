import apiClient from '@/router/bstockAxios'
import type { ShareholderStructure } from '@/types/shareholderStructure'
import type { MonthlyRevenueVo, QuarterlyFinancialVo, StockBasicInfoResponse } from '@/types/stockFundamentals'

export type ExchangeMarket = 'TWSE' | 'TPEX'
/**
 * StockInfo.stockType 由 /biz/stockInfo 提供：
 * 0 = 上櫃 TPEX, 1 = 上市 TWSE, 2 = 興櫃（季度 API 不支援）
 */
export function normalizeMarket(raw: unknown): ExchangeMarket | null {
  const value = String(raw ?? '').trim().toUpperCase()
  if (['0', 'TPEX', 'OTC', '上櫃'].includes(value)) return 'TPEX'
  if (['1', 'TWSE', 'TSE', '上市'].includes(value)) return 'TWSE'
  return null
}

export async function getStockBasicInfo(stockCode: string, market: ExchangeMarket | null): Promise<StockBasicInfoResponse> {
  const { data } = await apiClient.get<StockBasicInfoResponse>('/api/stock/basic-info', {
    params: { stockId: stockCode, ...(market ? { market } : {}), cacheOnly: false },
  })
  return data
}

// 注意：目前開發代理會移除外部 /api 前綴，Spring Controller 自身又以 /api 開頭。
// 因此這些 API 用 /api/... 相對於 axios baseURL=/api，瀏覽器實際會送出 /api/api/...。
// 若未來修正代理不再移除 /api，請將本檔財務/基本資訊路徑改回不含第二層 /api。
// 月營收 POST 會觸發後端抓取與寫 Redis；這不是唯讀 API，請注意負載與權限。
// 每季全市場財報只讀一次，並建立 stockId -> QuarterlyFinancialVo 索引。
// key = year-quarter-market，例如 2026-3-TWSE。
// 空資料不快取，讓 Redis 後續發布資料後能重新查詢。
const quarterlyByStockCache = new Map<string, Map<string, QuarterlyFinancialVo>>()
const quarterlyIndexPending = new Map<string, Promise<Map<string, QuarterlyFinancialVo>>>()

export async function readQuarterlyIndexed(
  year: number,
  quarter: number,
  market: ExchangeMarket,
): Promise<Map<string, QuarterlyFinancialVo>> {
  if (quarter < 1 || quarter > 4) throw new Error('quarter 必須介於 1～4')
  const key = `${year}-${quarter}-${market}`
  const cached = quarterlyByStockCache.get(key)
  if (cached) return cached

  const pending = quarterlyIndexPending.get(key)
  if (pending) return pending

  const request = (async () => {
    // 依照目前的 Vite proxy：外部 /api/api/... → Spring /api/...
    const { data } = await apiClient.get<QuarterlyFinancialVo[]>(
      '/api/financial/quarterly',
      { params: { year, quarter, market } },
    )
    if (!Array.isArray(data)) throw new Error('季度財報 API 未回傳陣列')

    const index = new Map<string, QuarterlyFinancialVo>()
    for (const row of data) {
      if (!row || row.stockId == null) continue
      const stockId = String(row.stockId).trim()
      if (stockId) index.set(stockId, row)
    }
    if (index.size > 0) quarterlyByStockCache.set(key, index)
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

/** 查單一股票的該季財報，不必每次掃描全市場陣列。 */
export async function readQuarterlyStock(
  year: number,
  quarter: number,
  market: ExchangeMarket,
  stockCode: string,
): Promise<QuarterlyFinancialVo | null> {
  const index = await readQuarterlyIndexed(year, quarter, market)
  return index.get(stockCode.trim()) ?? null
}

/** 相容既有使用 readQuarterly() 的地方。 */
export async function readQuarterly(
  year: number,
  quarter: number,
  market: ExchangeMarket,
): Promise<QuarterlyFinancialVo[]> {
  return [...(await readQuarterlyIndexed(year, quarter, market)).values()]
}

// 通用：同一分頁相同 key 共用 Promise；空陣列不長期快取。
function sharedRequest<T>(map: Map<string, Promise<T>>, key: string, fetcher: () => Promise<T>): Promise<T> {
  const existing = map.get(key)
  if (existing) return existing
  const promise = fetcher().then(value => {
    if (Array.isArray(value) && value.length === 0) map.delete(key)
    return value
  }).catch(error => { map.delete(key); throw error })
  map.set(key, promise)
  return promise
}

/**
 * 每個月份的全市場營收快取：
 * yearMonth -> (stockId -> MonthlyRevenueVo)
 *
 * API 每個月份只取得一次，切換股票直接從索引查詢。
 * 不使用 localStorage，重新整理後會重新取得。
 */
const monthlyByStockCache = new Map<string, Map<string, MonthlyRevenueVo>>()
const monthlyIndexPending = new Map<string, Promise<Map<string, MonthlyRevenueVo>>>()

export async function readMonthlyIndexed(yearMonth: string): Promise<Map<string, MonthlyRevenueVo>> {
  const cached = monthlyByStockCache.get(yearMonth)
  if (cached) return Promise.resolve(cached)

  const pending = monthlyIndexPending.get(yearMonth)
  if (pending) return pending

  const request = (async () => {
    // 保留目前專案的 API 路徑與 POST 契約。
    // 注意 POST 會觸發後端重新抓取及寫入 Redis，不是單純讀取。
    const { data } = await apiClient.post<MonthlyRevenueVo[]>(
      '/api/revenue/monthly',
      null,
      { params: { yearMonth } },
    )
    if (!Array.isArray(data)) throw new Error('月營收 API 未回傳陣列')

    const index = new Map<string, MonthlyRevenueVo>()
    for (const row of data) {
      if (!row || row.stockId == null) continue
      const stockId = String(row.stockId).trim()
      if (stockId) index.set(stockId, row)
    }

    // 空陣列可能代表當月尚未發布；不要長期快取。
    if (index.size > 0) monthlyByStockCache.set(yearMonth, index)
    return index
  })()

  monthlyIndexPending.set(yearMonth, request)
  try {
    return await request
  } finally {
    if (monthlyIndexPending.get(yearMonth) === request) {
      monthlyIndexPending.delete(yearMonth)
    }
  }
}

/** 只取得指定股票在指定月份的資料，不重複遍歷全市場陣列。 */
export async function readMonthlyStock(
  yearMonth: string,
  stockCode: string,
): Promise<MonthlyRevenueVo | null> {
  const index = await readMonthlyIndexed(yearMonth)
  return index.get(stockCode.trim()) ?? null
}

/** 相容既有使用 readMonthly 的程式。 */
export async function readMonthly(yearMonth: string): Promise<MonthlyRevenueVo[]> {
  return [...(await readMonthlyIndexed(yearMonth)).values()]
}

// 持股分布為每檔股票最多 200 筆週資料。僅暫存於目前分頁記憶體。
const shareholderPending = new Map<string, Promise<ShareholderStructure[]>>()
export function readShareholderStructure(stockCode: string, force = false): Promise<ShareholderStructure[]> {
  const code = stockCode.trim()
  if (!code) return Promise.reject(new Error('缺少股票代號'))
  if (force) shareholderPending.delete(code)
  return sharedRequest(shareholderPending, code, async () => {
    const { data } = await apiClient.get<ShareholderStructure[]>(
      `/biz/stockShareholderStructure/${encodeURIComponent(code)}`,
    )
    if (!Array.isArray(data)) throw new Error('持股分布 API 未回傳陣列')
    return data
  })
}
