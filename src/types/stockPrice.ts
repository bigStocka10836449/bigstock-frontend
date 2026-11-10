// 與 Spring Boot SingleStockPriceVo 對應
export interface StockPriceBar {
  stockCode: string
  stockName: string
  openingPrice: string
  closingPrice: string
  highPrice: string
  lowPrice: string
  tradingVolume: string
  fiveMa: number | null
  tenMa: number | null
  twentyMa: number | null
  sixtyMa: number | null
  oneTwentyMa: number | null
  twoFourtyMa: number | null
  lineKvalue: number | null
  lineDvalue: number | null
}

export interface SingleStockDayPriceVo extends StockPriceBar {
  tradingDate: string
  change: string | null
  changeRate: string | null
  marginPurchaseBalancePreviousDay: string | null
  marginPurchase: string | null
  marginSales: string | null
  cashRedemption: string | null
  marginPurchaseBalance: string | null
  marginPurchaseQuota: string | null
  shortSaleBalancePreviousDay: string | null
  shortSale: string | null
  shortConvering: string | null
  stockRedemption: string | null
  shortSaleBalance: string | null
  shortSaleQuota: string | null
  offsetting: string | null
}
export interface SingleStockWeekPriceVo extends StockPriceBar { firstTradingDate: string }
export interface SingleStockMonthPriceVo extends StockPriceBar { firstTradingDate: string }
export interface SingleStockPriceVo {
  singleStockDayPriceVos: SingleStockDayPriceVo[]
  singleStockWeekPriceVos: SingleStockWeekPriceVo[]
  singleStockMonthPriceVos: SingleStockMonthPriceVo[]
}
export type KlinePeriod = 'day' | 'week' | 'month'
export interface ChartBar {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  fiveMa: number | null
  tenMa: number | null
  twentyMa: number | null
  sixtyMa: number | null
  oneTwentyMa: number | null
  twoFourtyMa: number | null
  lineKvalue: number | null
  lineDvalue: number | null
}

/** Spring Boot StockIntradayPrice 的盤中 K 線 JSON。 */
export interface StockIntradayPrice {
  stockCode: string
  period: '5m' | '60m'
  // JavaTimeModule 預設可能序列化為 [yyyy, M, d, HH, mm, ss]。
  tradingTime: string | number[]
  openingPrice: string | number | null
  closingPrice: string | number | null
  highPrice: string | number | null
  lowPrice: string | number | null
  tradingVolume: string | number | null
  fiveMa?: number | null
  tenMa?: number | null
  twentyMa?: number | null
  sixtyMa?: number | null
  lineKValue?: number | null
  lineDValue?: number | null
  lineRsvValue?: number | null
}
