import apiClient from '@/router/bstockAxios'


/**
 * 取得單一股票價格資料。
 */
export async function getSingleStockPrice(
  stockCode: string,
) {

  const response =
    await apiClient.post(
      '/gateway/SingleStockPrice',
      {
        stockCode,
      },
    )

  return response.data
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
