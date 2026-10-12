import apiClient from '@/router/bstockAxios'
import type { ShareholderStructure } from '@/types/shareholderStructure'
import type {
  MonthlyRevenueVo,
  QuarterlyFinancialVo,
  StockBasicInfoResponse,
} from '@/types/stockFundamentals'

export type ExchangeMarket = 'TWSE' | 'TPEX'
export function normalizeMarket(raw: unknown): ExchangeMarket | null {
  const value = String(raw ?? '')
    .trim()
    .toUpperCase()
  if (value === 'TWSE' || value === 'TSE' || value === '上市') return 'TWSE'
  if (value === 'TPEX' || value === 'OTC' || value === '上櫃') return 'TPEX'
  return null
}

export async function getStockBasicInfo(
  stockCode: string,
  market: 'TWSE' | 'TPEX',
): Promise<StockBasicInfoResponse> {
  const { data } = await apiClient.get<StockBasicInfoResponse>('/api/stock/basic-info', {
    params: {
      stockId: stockCode,
      market,
      cacheOnly: false,
    },
  })

  return data
}

// 全市場、整期 API：同分頁相同期間只請求一次；不使用 localStorage 持久儲存。
const quarterlyPending = new Map<string, Promise<QuarterlyFinancialVo[]>>()
const monthlyPending = new Map<string, Promise<MonthlyRevenueVo[]>>()
function sharedRequest<T>(
  map: Map<string, Promise<T>>,
  key: string,
  fetcher: () => Promise<T>,
): Promise<T> {
  const existing = map.get(key)
  if (existing) return existing
  const promise = fetcher()
    .then((value) => {
      // Redis 尚未發布時的空陣列不應在頁面存活期間永久快取。
      if (Array.isArray(value) && value.length === 0) map.delete(key)
      return value
    })
    .catch((error) => {
      map.delete(key)
      throw error
    })
  map.set(key, promise)
  return promise
}
export function readQuarterly(
  year: number,
  quarter: number,
  market: ExchangeMarket,
): Promise<QuarterlyFinancialVo[]> {
  const key = `${year}-${quarter}-${market}`
  return sharedRequest(quarterlyPending, key, async () => {
    const { data } = await apiClient.get<QuarterlyFinancialVo[]>('/financial/quarterly', {
      params: { year, quarter, market },
    })
    if (!Array.isArray(data)) throw new Error('季度財報 API 未回傳陣列')
    return data
  })
}
export function readMonthly(yearMonth: string): Promise<MonthlyRevenueVo[]> {
  return sharedRequest(monthlyPending, yearMonth, async () => {
    const { data } = await apiClient.post<MonthlyRevenueVo[]>('/api/revenue/monthly', null, {
      params: { yearMonth },
    })

    if (!Array.isArray(data)) {
      throw new Error('月營收 API 未回傳陣列')
    }

    return data
  })
}

// 持股分布為每檔股票最多 200 筆週資料。僅暫存於目前分頁記憶體。
const shareholderPending = new Map<string, Promise<ShareholderStructure[]>>()
export function readShareholderStructure(
  stockCode: string,
  force = false,
): Promise<ShareholderStructure[]> {
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
