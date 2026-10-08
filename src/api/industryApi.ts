import apiClient from '@/router/bstockAxios'
import type { TagsMapping, TagStocks } from '@/types/industry'

/** 取得全部標籤與分類名稱 */
export async function getIndustryMappings(): Promise<TagsMapping> {
  const response = await apiClient.get<TagsMapping>('/biz/tagsMapping')
  return response.data
}

/** 取得指定分類下的股票代號與名稱 */
export async function getIndustryStocks(tag: string): Promise<TagStocks> {
  const response = await apiClient.get<TagStocks>(`/biz/tagStocks/${encodeURIComponent(tag)}`)
  return response.data
}

/** 注意：後端路徑 tagMaping 的拼字是既有契約，不可自行改名 */
export async function getStockTags(stockCode: string): Promise<unknown> {
  const response = await apiClient.get(`/biz/tagMaping/${encodeURIComponent(stockCode)}`)
  return response.data
}
