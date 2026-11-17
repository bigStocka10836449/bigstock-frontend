export const DEFAULT_STOCK_QUOTE_TOPIC = '/topic/marketQuotes/default'
export const DEFAULT_STOCKS = [
  { code: '2330', label: '台積電' },
  { code: '2303', label: '聯電' },
  { code: '2317', label: '鴻海' },
  { code: '2454', label: '聯發科' },
  { code: '2881', label: '富邦金' },
] as const

type StockCode = (typeof DEFAULT_STOCKS)[number]['code']

export interface DefaultStockQuotes {
  fetchedAt: number
  prices: Partial<Record<StockCode, number | null>>
}

export function parseDefaultStockQuotes(body: string): DefaultStockQuotes | null {
  const message = JSON.parse(body) as {
    source?: unknown
    fetchedAt?: unknown
    items?: { name?: unknown; price?: unknown }[]
  } | null
  // All five default stocks are in the TradingView snapshot.
  if (message?.source !== 'tradingview' || typeof message.fetchedAt !== 'string' ||
      !Array.isArray(message.items)) return null
  const fetchedAt = Date.parse(message.fetchedAt)
  if (!Number.isFinite(fetchedAt)) return null

  const prices: DefaultStockQuotes['prices'] = {}
  for (const { code } of DEFAULT_STOCKS) {
    const price = message.items.find(item => item?.name === code)?.price
    if (price === null || (typeof price === 'number' && Number.isFinite(price))) prices[code] = price
  }
  return { fetchedAt, prices }
}
