export interface MarginRecord {
  tradingDay?: string | null
  stockCode?: string | null

  marginPurchase?: string | number | null
  marginSales?: string | number | null
  cashRedemption?: string | number | null

  shortSale?: string | number | null
  shortConvering?: string | number | null
  stockRedemption?: string | number | null
}
