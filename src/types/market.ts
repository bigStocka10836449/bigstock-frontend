export interface MarketSnapshot {
  ts: number
  sp500: number
  nasdaq: number
  dow: number
  // Yahoo 回傳的原始 JSON 被包成字串；不可假定每種市場具有相同內部欄位
  data: string | null
}
export type MarketTopic =
  | '/topic/marketTWPM'
  | '/topic/marketTWPMN'
  | '/topic/marketNASDAQ_F'
  | '/topic/marketS_P_500_F'
  | '/topic/marketDOW_JONES_F'
  | '/topic/marketPHLX_SEMICONDUCTOR_SECTOR'
export const MARKET_TOPICS: MarketTopic[] = [
  '/topic/marketTWPM', '/topic/marketTWPMN', '/topic/marketNASDAQ_F',
  '/topic/marketS_P_500_F', '/topic/marketDOW_JONES_F',
  '/topic/marketPHLX_SEMICONDUCTOR_SECTOR',
]
export interface MarketEvent {
  topic: MarketTopic
  snapshot: MarketSnapshot
  rawMarketData: unknown
  receivedAt: number
}
