export const WEB_STOCK_QUOTE_TOPIC = '/topic/marketQuotes/web'

export interface WebStockQuote {
  name: string
  label: string
  price: number | null
}

export interface WebStockQuoteUpdate {
  source: 'tradingview' | 'emerging'
  fetchedAt: number | null
  stockCodes: string[]
  items: WebStockQuote[]
  reconnectRequired: boolean
}

export function parseWebStockQuotes(body: string): WebStockQuoteUpdate | null {
  const raw = JSON.parse(body) as {
    source?: unknown
    fetchedAt?: unknown
    stockCodes?: unknown
    items?: { name?: unknown; description?: unknown; price?: unknown }[]
    reconnectRequired?: unknown
  } | null
  if (
    (raw?.source !== 'tradingview' && raw?.source !== 'emerging') ||
    !Array.isArray(raw.stockCodes) || !raw.stockCodes.every(code => typeof code === 'string') ||
    !Array.isArray(raw.items)
  ) return null
  const parsedTime = typeof raw.fetchedAt === 'string' ? Date.parse(raw.fetchedAt) : NaN
  const items: WebStockQuote[] = []
  for (const item of raw.items) {
    if (typeof item?.name !== 'string' || !raw.stockCodes.includes(item.name)) continue
    items.push({
      name: item.name,
      label: typeof item.description === 'string' ? item.description : item.name,
      price: typeof item.price === 'number' && Number.isFinite(item.price) ? item.price : null,
    })
  }
  return {
    source: raw.source,
    fetchedAt: Number.isFinite(parsedTime) ? parsedTime : null,
    stockCodes: raw.stockCodes,
    items,
    reconnectRequired: raw.reconnectRequired === true,
  }
}
