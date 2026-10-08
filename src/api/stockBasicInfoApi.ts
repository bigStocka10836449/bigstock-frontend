import apiClient from '@/router/bstockAxios'
import type { StockBasicInfoResponse } from '@/types/stockBasicInfo'

/** 查詢個股基本資料；預設只讀取後端快取，避免瀏覽頁面時反覆聚合 */
export async function getStockBasicInfo(stockId: string, market?: string, cacheOnly = true): Promise<StockBasicInfoResponse> {
  const response = await apiClient.get<StockBasicInfoResponse>('/api/stock/basic-info', {
    params: { stockId, ...(market ? { market } : {}), cacheOnly },
  })
  return response.data
}
