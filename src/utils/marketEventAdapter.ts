
import type {
  MarketEvent,
  MarketTopic,
} from '@/types/market'

/**
 * ============================================================
 * BigStock - Market Event Adapter
 * ============================================================
 *
 * 將 WebSocket MarketEvent 轉成統一的 LiveQuote。
 *
 * 資料流程：
 *
 * WebSocket STOMP Message
 *        ↓
 * marketParser.ts
 *        ↓
 * MarketEvent
 *        ↓
 * marketEventAdapter.ts
 *        ↓
 * LiveQuote
 *        ↓
 * marketStore.ts
 *        ↓
 * MarketLiveView.vue
 *
 * 注意：
 * 後端 MarketSnapshot 的 sp500/nasdaq/dow
 * 可能沒有賦值，預設為 0。
 *
 * 真正的市場資料應優先從
 * event.rawMarketData 取得。
 */

/**
 * 前端統一的即時報價格式。
 */
export interface LiveQuote {
  symbol: string

  price: number | null

  change: number | null

  changePercent: number | null

  updatedAt: number | null

  title?: string
}

/**
 * ============================================================
 * STOMP Topic -> 市場代碼
 * ============================================================
 *
 * 依目前前端定義的 MARKET_TOPICS 對應。
 *
 * 注意：
 * 台灣兩個 Topic 的對應暫定如下，
 * 需與後端實際發送內容確認。
 */
const TOPIC_SYMBOL_MAP: Record<MarketTopic, string> = {
  '/topic/marketTWPM': 'WTX00',

  '/topic/marketTWPMN': 'WTX&',

  '/topic/marketNASDAQ_F': 'MNQ=F',

  '/topic/marketS_P_500_F': 'MES=F',

  '/topic/marketDOW_JONES_F': 'MYM=F',

  '/topic/marketPHLX_SEMICONDUCTOR_SECTOR': '^SOX',
}

/**
 * 判斷是否為一般物件。
 */
function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
  )
}

/**
 * 解析可能被多層 JSON 字串包裝的資料。
 */
function unwrapJson(value: unknown): unknown {
  let current = value

  for (let i = 0; i < 5; i++) {
    if (typeof current !== 'string') {
      break
    }

    try {
      current = JSON.parse(current)
    } catch {
      break
    }
  }

  return current
}

/**
 * 將 number 或數字字串轉換為 number。
 */
function toNumber(value: unknown): number | null {
  if (
    typeof value === 'number' &&
    Number.isFinite(value)
  ) {
    return value
  }

  if (
    typeof value === 'string' &&
    value.trim() !== '' &&
    value.trim() !== '-'
  ) {
    const normalized = value
      .replace(/,/g, '')
      .replace(/%/g, '')
      .trim()

    const parsed = Number(normalized)

    return Number.isFinite(parsed)
      ? parsed
      : null
  }

  return null
}

/**
 * 時間戳記轉換成 milliseconds。
 *
 * 支援：
 * - Unix seconds
 * - Unix milliseconds
 * - ISO 日期字串
 */
function toTimestamp(value: unknown): number | null {
  if (
    typeof value === 'string' &&
    value.trim() !== '' &&
    Number.isNaN(Number(value))
  ) {
    const parsed = Date.parse(value)

    return Number.isFinite(parsed)
      ? parsed
      : null
  }

  const numeric = toNumber(value)

  if (
    numeric === null ||
    numeric <= 0
  ) {
    return null
  }

  return numeric < 1e11
    ? numeric * 1000
    : numeric
}

/**
 * 將巢狀市場資料展開成可搜尋的物件。
 *
 * 例如 Yahoo：
 *
 * {
 *   chart: {
 *     result: [
 *       {
 *         meta: {
 *           regularMarketPrice: 123
 *         }
 *       }
 *     ]
 *   }
 * }
 *
 * 同時支援：
 * - chart
 * - result
 * - meta
 * - quote
 * - data
 * - payload
 * - marketData
 */
function collectObjects(
  value: unknown,
  depth = 0,
): Record<string, unknown>[] {
  if (depth > 6) {
    return []
  }

  const normalized = unwrapJson(value)

  if (Array.isArray(normalized)) {
    return normalized.flatMap((item) =>
      collectObjects(item, depth + 1),
    )
  }

  if (!isRecord(normalized)) {
    return []
  }

  const result: Record<string, unknown>[] = [
    normalized,
  ]

  const nestedKeys = [
    'chart',
    'result',
    'meta',
    'quote',
    'data',
    'payload',
    'marketData',
  ]

  for (const key of nestedKeys) {
    if (key in normalized) {
      result.push(
        ...collectObjects(
          normalized[key],
          depth + 1,
        ),
      )
    }
  }

  return result
}

/**
 * 從候選物件中取得第一個有效數字。
 */
function findNumber(
  rows: Record<string, unknown>[],
  keys: string[],
): number | null {
  for (const row of rows) {
    for (const key of keys) {
      const parsed = toNumber(row[key])

      if (parsed !== null) {
        return parsed
      }
    }
  }

  return null
}

/**
 * 取得第一個非空字串。
 */
function findString(
  rows: Record<string, unknown>[],
  keys: string[],
): string | null {
  for (const row of rows) {
    for (const key of keys) {
      const value = row[key]

      if (
        typeof value === 'string' &&
        value.trim() !== ''
      ) {
        return value.trim()
      }
    }
  }

  return null
}

/**
 * 防止未初始化欄位的 0
 * 被錯誤當成有效市場報價。
 */
function validPrice(
  value: number | null,
): number | null {
  if (
    value === null ||
    value <= 0
  ) {
    return null
  }

  return value
}

/**
 * ============================================================
 * MarketEvent -> LiveQuote
 * ============================================================
 */
export function adaptMarketEvent(
  event: MarketEvent,
): LiveQuote | null {

  /**
   * ----------------------------------------------------------
   * 1. 根據 STOMP Topic 辨識市場
   * ----------------------------------------------------------
   */
  const symbol =
    TOPIC_SYMBOL_MAP[event.topic]

  if (!symbol) {
    console.warn(
      '[MarketAdapter] 未知的市場 Topic',
      event.topic,
    )

    return null
  }

  /**
   * ----------------------------------------------------------
   * 2. 解析原始行情資料
   * ----------------------------------------------------------
   *
   * marketParser.ts 已經解析 MarketSnapshot.data。
   *
   * 因此直接使用 rawMarketData，
   * 不需要重新解析外層 MarketSnapshot。
   */
  const rows = collectObjects(
    event.rawMarketData,
  )

  /**
   * ----------------------------------------------------------
   * 3. 取得即時成交價
   * ----------------------------------------------------------
   *
   * 依序嘗試：
   *
   * Yahoo：
   * regularMarketPrice
   *
   * 其他市場：
   * price / lastPrice / currentPrice / last
   */
  const price = validPrice(
    findNumber(rows, [
      'regularMarketPrice',
      'price',
      'lastPrice',
      'currentPrice',
      'fulldayPrice',
      'last',
    ]),
  )

  /**
   * 沒有有效報價：
   * 不更新市場行情。
   */
  if (price === null) {
    return null
  }

  /**
   * ----------------------------------------------------------
   * 4. 取得漲跌點數
   * ----------------------------------------------------------
   */
  let change = findNumber(rows, [
    'regularMarketChange',
    'fulldayChange',
    'change',
  ])

  /**
   * ----------------------------------------------------------
   * 5. 取得漲跌幅
   * ----------------------------------------------------------
   *
   * 例如：
   * -0.85 代表 -0.85%
   */
  let changePercent = findNumber(rows, [
    'regularMarketChangePercent',
    'fulldayChangePercent',
    'changePercent',
  ])

  /**
   * ----------------------------------------------------------
   * 6. 沒有漲跌資料時，嘗試以昨收計算
   * ----------------------------------------------------------
   */
  const previousClose = findNumber(rows, [
    'previousClose',
  ])

  if (
    change === null &&
    previousClose !== null &&
    previousClose !== 0
  ) {
    change = price - previousClose
  }

  if (
    changePercent === null &&
    previousClose !== null &&
    previousClose !== 0
  ) {
    changePercent =
      ((price - previousClose) / previousClose) * 100
  }

  /**
   * ----------------------------------------------------------
   * 7. 解析行情更新時間
   * ----------------------------------------------------------
   */
  const updatedAt =
    toTimestamp(
      findNumber(rows, [
        'regularMarketTime',
        'timestamp',
        'ts',
      ]),
    ) ??
    toTimestamp(
      findString(rows, [
        'refreshedTs',
        'datetime',
        'time',
      ]),
    ) ??
    event.receivedAt

  /**
   * ----------------------------------------------------------
   * 8. 取得市場名稱
   * ----------------------------------------------------------
   */
  const title = findString(rows, [
    'shortName',
    'longName',
    'name',
  ])

  /**
   * ----------------------------------------------------------
   * 9. 回傳統一的即時報價
   * ----------------------------------------------------------
   */
  return {
    symbol,
    price,
    change,
    changePercent,
    updatedAt,
    title: title ?? undefined,
  }
}

/** Yahoo Chart 分鐘資料中的有效價格點（時間為 Unix 毫秒）。 */
export interface IntradayPricePoint {
  time: number
  price: number
}

export interface IntradayHistoryData {
  symbol: string
  /** 此份走勢對應的交易時段；優先採用 Yahoo regular.start。 */
  sessionStart: number | null
  timeZone: string
  points: IntradayPricePoint[]
}

/** 從已解析的 MarketEvent 擷取 Yahoo 當日分鐘價格，不影響原本最新報價的解析。 */
export function extractIntradayPoints(event: MarketEvent): IntradayHistoryData | null {
  const symbol = TOPIC_SYMBOL_MAP[event.topic]
  if (!symbol) return null

  const raw = unwrapJson(event.rawMarketData)
  const candidates = Array.isArray(raw) ? raw : [raw]

  const matching = candidates.find(item =>
    isRecord(item) && String(item.symbol ?? '') === symbol,
  ) ?? candidates[0]
  if (!isRecord(matching)) return null

  const outerChart = unwrapJson(matching.chart)
  if (!isRecord(outerChart)) return null

  let chart: Record<string, unknown> = outerChart
  if (Array.isArray(outerChart.result)) {
    const first = unwrapJson(outerChart.result[0])
    if (!isRecord(first)) return null
    chart = first
  }

  const timestamps = chart.timestamp
  const indicators = chart.indicators
  if (!Array.isArray(timestamps) || !isRecord(indicators)) return null

  const quotes = indicators.quote
  const firstQuote = Array.isArray(quotes) ? quotes[0] : null
  if (!isRecord(firstQuote) || !Array.isArray(firstQuote.close)) return null

  const closes = firstQuote.close
  const pointsByTime = new Map<number, IntradayPricePoint>()
  for (let i = 0; i < Math.min(timestamps.length, closes.length); i++) {
    const time = toTimestamp(timestamps[i])
    const price = toNumber(closes[i])
    if (time === null || price === null || price <= 0) continue
    pointsByTime.set(time, { time, price })
  }

  if (pointsByTime.size === 0) return null

  const meta = isRecord(chart.meta) ? chart.meta : null
  const period = isRecord(meta?.currentTradingPeriod) ? meta.currentTradingPeriod : null
  const regular = isRecord(period?.regular) ? period.regular : null
  const sessionStart = toTimestamp(regular?.start)
  const timeZone = typeof meta?.exchangeTimezoneName === 'string'
    ? meta.exchangeTimezoneName
    : (symbol.startsWith('WTX') ? 'Asia/Taipei' : 'America/New_York')

  return {
    symbol,
    sessionStart,
    timeZone,
    points: [...pointsByTime.values()].sort((a, b) => a.time - b.time),
  }
}
