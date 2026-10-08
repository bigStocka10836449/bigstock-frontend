/**
 * 既有 MarketEvent 型別目前未提供，所以獨立處理 WebSocket Payload。
 * 不推測 MarketSnapshot.ts/sp500/nasdaq/dow 必定有值：後端可能只 setData(raw JSON)。
 * 如果現有 marketParser.ts 已解析出價格，將相應欄位加入此 adapter 即可。
 */
export interface LiveQuote {
  symbol: string
  price: number | null
  change: number | null
  changePercent: number | null
  updatedAt: number | null
  title?: string
}
const rec = (x: unknown): x is Record<string, unknown> => x !== null && typeof x === 'object' && !Array.isArray(x)
function unwrap(x: unknown): unknown {
  let v = x
  for (let i = 0; i < 4 && typeof v === 'string'; i++) {
    try { v = JSON.parse(v) } catch { break }
  }
  return v
}
function number(x: unknown): number | null {
  if (typeof x === 'number' && Number.isFinite(x)) return x
  if (typeof x === 'string' && x.trim() !== '' && x !== '-') {
    const n = Number(x.replace(/,/g, '').replace('%', ''))
    return Number.isFinite(n) ? n : null
  }
  return null
}
function nonzero(x: unknown): number | null {
  const n = number(x)
  return n === 0 ? null : n // MarketSnapshot 未賦值欄位預設 0，不能視為有效報價
}
function findValues(x: unknown, depth = 0): Record<string, unknown>[] {
  if (depth > 5) return []
  const v = unwrap(x)
  if (Array.isArray(v)) return v.flatMap((item) => findValues(item, depth + 1))
  if (!rec(v)) return []
  return [v, ...['data','quote','chart','result','marketData','payload'].flatMap((key) => key in v ? findValues(v[key], depth + 1) : [])]
}
function field(rows: Record<string, unknown>[], keys: string[]): unknown {
  for (const row of rows) for (const key of keys) if (row[key] !== undefined && row[key] !== null) return row[key]
  return undefined
}
const SYMBOLS = ['^SOX', 'MES=F', 'MYM=F', 'MNQ=F', 'WTX00', 'WTX&'] as const
export function adaptMarketEvent(event: unknown): LiveQuote | null {
  const rows = findValues(event)
  const rawTopic = String(field(rows, ['topic','destination']) ?? '')
  const rawSymbol = String(field(rows, ['symbol','stockCode','code','market','ticker']) ?? '')
  const symbol = SYMBOLS.find(s => s === rawSymbol || rawTopic.includes(s))
  if (!symbol) return null
  const price = nonzero(field(rows, ['price', 'regularMarketPrice', 'lastPrice', 'last', 'currentPrice', 'close']))
  const change = number(field(rows, ['change','regularMarketChange','fulldayChange']))
  const changePercent = number(field(rows, ['changePercent','regularMarketChangePercent','fulldayChangePercent']))
  const ts = field(rows, ['ts','timestamp','regularMarketTime'])
  const timestamp = number(ts)
  const updatedAt = timestamp === null || timestamp === 0 ? null : timestamp < 100000000000 ? timestamp * 1000 : timestamp
  // 沒有辨認出任何即時價格欄位就不顯示，避免假資料。
  if (price === null) return null
  return { symbol, price, change, changePercent, updatedAt }
}
