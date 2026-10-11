export type TagsMapping = Record<string, string>
export type TagStocks = Record<string, string>
export interface StockInfo {
  stockCode: string
  stockName: string
  stockType?: string | null
}
