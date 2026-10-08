export interface MarketCandle {
  time: number // Unix seconds, not milliseconds
  open: number
  high: number
  low: number
  close: number
  volume: number | null
}
export interface MarketHistory {
  symbol: string
  name: string
  currency: string
  timezone: string
  candles: MarketCandle[]
}

const empty = (symbol: string): MarketHistory => ({
  symbol,
  name: symbol,
  currency: '',
  timezone: '',
  candles: [],
})
const object = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v)

/** 有些 Redis String 內含經過多次 JSON.stringify 的字串。 */
function decode(value: unknown): unknown {
  let next = value
  for (let i = 0; i < 5 && typeof next === 'string'; i++) next = JSON.parse(next)
  return next
}

function getChart(value: unknown): Record<string, unknown> | null {
  const raw = decode(value)
  if (Array.isArray(raw)) {
    for (const row of raw) {
      const found = getChart(row)
      if (found) return found
    }
    return null
  }
  if (!object(raw)) return null
  if (Array.isArray(raw.timestamp) && object(raw.indicators)) return raw
  if (!('chart' in raw)) return null
  const chart = decode(raw.chart)
  if (object(chart) && Array.isArray(chart.result)) return getChart(chart.result)
  return getChart(chart)
}

const valid = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)
const values = (x: unknown): unknown[] => (Array.isArray(x) ? x : [])

export function parseMarketHistory(symbol: string, raw: string | null): MarketHistory {
  if (!raw) return empty(symbol)
  const chart = getChart(raw)
  if (!chart) throw new Error(`無法識別市場 ${symbol} 的日 K 資料`)
  const meta = object(chart.meta) ? chart.meta : {}
  const indicators = object(chart.indicators) ? chart.indicators : {}
  const firstQuote = Array.isArray(indicators.quote) ? indicators.quote[0] : null
  if (!object(firstQuote)) throw new Error(`${symbol} 缺少日 K OHLC 欄位`)
  const ts = values(chart.timestamp)
  const opens = values(firstQuote.open)
  const highs = values(firstQuote.high)
  const lows = values(firstQuote.low)
  const closes = values(firstQuote.close)
  const volumes = values(firstQuote.volume)
  const map = new Map<number, MarketCandle>()
  for (let i = 0; i < ts.length; i++) {
    const t = ts[i],
      open = opens[i],
      high = highs[i],
      low = lows[i],
      close = closes[i]
    if (!valid(t) || !valid(open) || !valid(high) || !valid(low) || !valid(close)) continue
    if (low > high || Math.max(open, close) > high || Math.min(open, close) < low) continue
    const volume = volumes[i]

    map.set(t, {
      time: t,
      open,
      high,
      low,
      close,
      volume: valid(volume) ? volume : null,
    })
  }
  return {
    symbol,
    name:
      typeof meta.name === 'string'
        ? meta.name
        : typeof meta.shortName === 'string'
          ? meta.shortName
          : symbol,
    currency: typeof meta.currency === 'string' ? meta.currency : '',
    timezone: typeof meta.exchangeTimezoneName === 'string' ? meta.exchangeTimezoneName : '',
    candles: [...map.values()].sort((a, b) => a.time - b.time),
  }
}

export function parseAllMarketHistories(
  input: Record<string, string | null>,
): Record<string, MarketHistory> {
  const output: Record<string, MarketHistory> = {}
  for (const [symbol, json] of Object.entries(input)) {
    try {
      output[symbol] = parseMarketHistory(symbol, json)
    } catch (e) {
      console.error('[MarketHistory]', symbol, e)
      output[symbol] = empty(symbol)
    }
  }
  return output
}
