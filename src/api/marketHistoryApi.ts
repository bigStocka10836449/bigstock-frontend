
import apiClient from '@/router/bstockAxios'

/**
 * Spring Boot USHistoryResponse
 *
 * Map<String, String> usHistory
 *
 * 每個市場的 Value 是原始 JSON 字串，
 * 並不是已經展開的 JavaScript Object。
 */
export interface USHistoryResponse {
  usHistory: Record<string, string | null>
}

/**
 * 取得六個市場的歷史行情。
 *
 * 實際路徑假設：
 * /biz/market/USHistory
 *
 * 如果 Controller 類別有額外 @RequestMapping，
 * 須對照完整路徑調整。
 */
export async function getUSMarketHistory():
  Promise<USHistoryResponse> {

  const response =
    await apiClient.get<USHistoryResponse>(
      '/biz/market/USHistory'
    )

  return response.data
}
