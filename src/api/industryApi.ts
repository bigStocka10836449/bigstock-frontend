import apiClient from '@/router/bstockAxios'
import type { StockInfo, TagStocks, TagsMapping } from '@/types/industry'

export async function getIndustryMappings(): Promise<TagsMapping> {
  const { data } = await apiClient.get<TagsMapping>('/biz/tagsMapping')
  return data
}

export async function getIndustryStocks(tag: string): Promise<TagStocks> {
  const { data } = await apiClient.get<TagStocks>(`/biz/tagStocks/${encodeURIComponent(tag)}`)
  return data
}

// 保留後端既有拼字 tagMaping。
export async function getStockTags(stockCode: string): Promise<unknown> {
  const { data } = await apiClient.get<unknown>(`/biz/tagMaping/${encodeURIComponent(stockCode)}`)
  return data
}

/**
 * 股票名錄是全量資料，使用同源 localStorage 持久快取。
 * - 同一瀏覽器的多分頁共享（不需要 SharedWorker）。
 * - 24 小時內直接讀本地，不呼叫 stockInfo API。
 * - v2 快取必須包含 stockType，避免沿用缺少市場資訊的舊版名錄。
 * - 超過 24 小時重新取得，成功後才覆蓋舊快取。
 * - API 失敗時允許沿用舊名錄，避免搜尋整個失效。
 * - 同一分頁並行呼叫共用同一 Promise。
 *
 * 這裡快取的是公開股票名錄，不是 JWT 或使用者個資。
 */
const STOCK_INFO_URL = '/biz/stockInfo'
const STOCK_INFO_CACHE_KEY = 'bigstock:stock-info:v2'
const STOCK_INFO_TTL_MS = 24 * 60 * 60 * 1000

interface StockInfoCache {
  savedAt: number
  stocks: StockInfo[]
}

let pendingStockInfo: Promise<StockInfo[]> | null = null

function isStockInfoArray(value: unknown): value is StockInfo[] {
  return Array.isArray(value) && value.every(item =>
    item !== null &&
    typeof item === 'object' &&
    typeof item.stockCode === 'string' &&
    typeof item.stockName === 'string' &&
    (typeof item.stockType === 'string' || typeof item.stockType === 'number'),
  )
}

function readStockInfoCache(): StockInfoCache | null {
  try {
    const raw = localStorage.getItem(STOCK_INFO_CACHE_KEY)
    if (!raw) return null

    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object') return null

    const candidate = value as Partial<StockInfoCache>
    if (
      typeof candidate.savedAt !== 'number' ||
      !Number.isFinite(candidate.savedAt) ||
      candidate.savedAt > Date.now() ||
      !isStockInfoArray(candidate.stocks)
    ) return null

    return { savedAt: candidate.savedAt, stocks: candidate.stocks }
  } catch (error) {
    console.warn('[Industry] 無法讀取 stockInfo localStorage 快取', error)
    return null
  }
}

function writeStockInfoCache(stocks: StockInfo[]): void {
  try {
    const entry: StockInfoCache = { savedAt: Date.now(), stocks }
    localStorage.setItem(STOCK_INFO_CACHE_KEY, JSON.stringify(entry))
  } catch (error) {
    // 儲存空間不足／使用者禁止儲存時，仍允許正常使用 API 結果。
    console.warn('[Industry] 無法儲存 stockInfo localStorage 快取', error)
  }
}

/** forceRefresh=true 可供未來管理介面手動刷新名錄。 */
export function getAllStockInfo(forceRefresh = false): Promise<StockInfo[]> {
  const cached = readStockInfoCache()
  const fresh = cached && Date.now() - cached.savedAt < STOCK_INFO_TTL_MS

  if (!forceRefresh && fresh) {
    return Promise.resolve(cached.stocks)
  }

  if (pendingStockInfo) return pendingStockInfo

  const request = (async (): Promise<StockInfo[]> => {
    try {
      const { data } = await apiClient.get<StockInfo[]>(STOCK_INFO_URL)
      if (!isStockInfoArray(data)) {
        throw new Error('stockInfo API 回傳資料格式不正確')
      }
      writeStockInfoCache(data)
      return data
    } catch (error) {
      if (cached && !forceRefresh) {
        console.warn('[Industry] stockInfo API 失敗，暫時沿用舊名錄', error)
        return cached.stocks
      }
      throw error
    }
  })()

  pendingStockInfo = request
  void request.finally(() => {
    if (pendingStockInfo === request) pendingStockInfo = null
  }).catch(() => undefined)
  return request
}

/** 需要立即更新時可先清除快取，下一次載入會重新抓取。 */
export function clearStockInfoCache(): void {
  try {
    localStorage.removeItem(STOCK_INFO_CACHE_KEY)
  } catch (error) {
    console.warn('[Industry] 無法清除 stockInfo 快取', error)
  }
}
