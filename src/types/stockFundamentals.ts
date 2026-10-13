export interface StockBasicInfoResponse {
  stockId?: string | null
  stockName?: string | null
  market?: string | null
  mainBusiness?: string | null
  industryCategory?: string | null
  subIndustryCategory?: string | null
  listingDate?: string | null
  capitalStock?: number | null
  netAssetValuePerShare?: number | null
  earningsPerShare?: number | null
  marketCapPriceDate?: string | null
  marketCapPrice?: number | null
  marketCap?: number | null
  peRatio?: number | null
  oneYearHigh?: number | null
  oneYearLow?: number | null
  threeYearHigh?: number | null
  threeYearLow?: number | null
  maStatus?: unknown
}
export interface QuarterlyFinancialVo {
  stockId: string; stockName: string; market: string
  year: number; quarter: number; periodStartMonth: number; periodEndMonth: number
  unit: string | null
  operatingRevenue: number | null
  operatingProfit: number | null
  nonOperatingIncomeExpense: number | null
  netProfitAfterTax: number | null
  capitalStockEndPeriod: number | null
  earningsPerShare: number | null  // 累計 EPS，非單季 EPS
  netAssetValuePerShare: number | null
  quickRatio: number | null
  currentRatio: number | null
  depn: number | null
}
export interface MonthlyRevenueVo {
  stockId: string; stockName: string; revenue: number | null
  date: string; market: string | null
}
