import bstockAxios from '@/router/bstockAxios'

// ============================================================
// Types
// ============================================================

export type RankingMarket = 'TWSE' | 'TPEX'
export type RankingOrder = 'asc' | 'desc'
export type RankingLimit = 10 | 20 | 30 | 50

export interface RankingResponse {
  rank: number
  stockCode: string
  stockName: string

  changeRate: number | null
  change: number | null
  tradingVolume: number | null

  openingPrice: number | null
  closingPrice: number | null

  limitUp: number | null
  limitDown: number | null
  tradingQuantity: number | null
}

export type RankingDataset = Record<
  RankingMarket,
  Record<RankingOrder, RankingResponse[]>
>

// ============================================================
// Config
// ============================================================

// 請沿用已確認能正常連線的完整 API 路徑
const RANKING_API_PATH = '/biz/ranking/raiseChange'

const FETCH_LIMIT = 50
const CACHE_TTL = 3 * 60 * 1000

// ============================================================
// Cache
// ============================================================

interface RankingCacheEntry {
  data: RankingDataset
  expiresAt: number
}

let cache: RankingCacheEntry | null = null

let pendingRequest: Promise<RankingDataset> | null = null

// ============================================================
// Single API
// ============================================================

export async function getStockChangeRanking(
  market: RankingMarket,
  limit = FETCH_LIMIT,
  order: RankingOrder = 'desc',
): Promise<RankingResponse[]> {
  const response = await bstockAxios.get<RankingResponse[]>(
    RANKING_API_PATH,
    {
      params: {
        market,
        limit,
        order,
      },
    },
  )

  if (!Array.isArray(response.data)) {
    throw new Error(
      `INVALID_RANKING_RESPONSE_${market}_${order}`,
    )
  }

  return response.data
}

// ============================================================
// Fetch all rankings
// ============================================================

async function requestAllRankings(): Promise<RankingDataset> {
  const [twseDesc, twseAsc, tpexDesc, tpexAsc] = await Promise.all([
    getStockChangeRanking('TWSE', FETCH_LIMIT, 'desc'),
    getStockChangeRanking('TWSE', FETCH_LIMIT, 'asc'),
    getStockChangeRanking('TPEX', FETCH_LIMIT, 'desc'),
    getStockChangeRanking('TPEX', FETCH_LIMIT, 'asc'),
  ])

  return {
    TWSE: {
      desc: twseDesc,
      asc: twseAsc,
    },
    TPEX: {
      desc: tpexDesc,
      asc: tpexAsc,
    },
  }
}

// ============================================================
// Cached API
// ============================================================

export function getCachedRankings(
  forceRefresh = false,
): Promise<RankingDataset> {
  const now = Date.now()

  // 1. 已有正在執行的請求時，直接共用。
  if (pendingRequest) {
    return pendingRequest
  }

  // 2. Cache 命中。
  if (
    !forceRefresh &&
    cache &&
    now < cache.expiresAt
  ) {
    return Promise.resolve(cache.data)
  }

  // 3. Cache 未命中，重新請求。
  const request = requestAllRankings()
    .then((data) => {
      cache = {
        data,
        expiresAt: Date.now() + CACHE_TTL,
      }

      return data
    })
    .finally(() => {
      if (pendingRequest === request) {
        pendingRequest = null
      }
    })

  pendingRequest = request

  return request
}

// ============================================================
// Cache Utils
// ============================================================

export function getRankingCacheSnapshot(): RankingDataset | null {
  return cache?.data ?? null
}

export function clearRankingCache(): void {
  cache = null
}
