/** 與 Spring StockBasicInfoResponse 欄位一致 */
export interface StockBasicInfoResponse {
  stockId: string
  stockName: string
  market: string | null
  mainBusiness: string | null
  industryCategory: string | null
  listingDate: string | null
  subIndustryCategory: string | null
  capitalStock: number | null
  netAssetValuePerShare: number | null
  earningsPerShare: number | null
  marketCapPriceDate: string | null
  marketCapPrice: number | null
  marketCap: number | null
  peRatio: number | null
  oneYearHigh: number | null
  oneYearLow: number | null
  threeYearHigh: number | null
  threeYearLow: number | null
  maStatus: number
}
