import type { MarketEvent, MarketSnapshot, MarketTopic } from '@/types/market'

export function parseMarketMessage(topic: MarketTopic, body: string): MarketEvent {
  // 後端先序列化 MarketSnapshot，再以字串形式 STOMP 發送
  const parsed = JSON.parse(body) as MarketSnapshot | string
  const snapshot: MarketSnapshot = typeof parsed === 'string' ? JSON.parse(parsed) : parsed
  if (!snapshot || typeof snapshot !== 'object') throw new Error('市場快照格式不正確')
  let rawMarketData: unknown = snapshot.data
  if (typeof snapshot.data === 'string' && snapshot.data.trim()) {
    try {
      rawMarketData = JSON.parse(snapshot.data)
    } catch {
      /* 上游不一定回傳 JSON */
    }
  }
  return { topic, snapshot, rawMarketData, receivedAt: Date.now() }
}
