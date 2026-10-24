/** Indicators calculated only from historical OHLC candles; no backend indicator fields required. */
export interface OhlcvCandle {
  open: number
  high: number
  low: number
  close: number
  volume: number | null
}

export interface KdjValue {
  k: number | null
  d: number | null
  j: number | null
}

export interface DeductionPoint {
  period: number
  index: number
  closingPrice: number
}

export interface MarketIndicators {
  ma: Record<number, Array<number | null>>
  kdj: KdjValue[]
  deductions: DeductionPoint[]
}

const PERIODS = [5, 10, 20, 60] as const

export function calculateMovingAverage(
  candles: readonly OhlcvCandle[],
  period: number,
): Array<number | null> {
  if (!Number.isInteger(period) || period <= 0) {
    throw new RangeError('MA period must be a positive integer')
  }
  let sum = 0
  return candles.map((candle, index) => {
    sum += candle.close
    if (index >= period) sum -= candles[index - period]!.close
    return index >= period - 1 ? sum / period : null
  })
}

/** Taiwan convention: RSV(9), K and D smoothed with 1/3; seeds K=D=50. */
export function calculateKdj(
  candles: readonly OhlcvCandle[],
  period = 9,
): KdjValue[] {
  if (!Number.isInteger(period) || period <= 0) {
    throw new RangeError('KD period must be a positive integer')
  }
  let previousK = 50
  let previousD = 50
  return candles.map((candle, index) => {
    if (index < period - 1) return { k: null, d: null, j: null }
    const window = candles.slice(index - period + 1, index + 1)
    const highest = Math.max(...window.map(item => item.high))
    const lowest = Math.min(...window.map(item => item.low))
    const rsv = highest === lowest ? 50 : ((candle.close - lowest) / (highest - lowest)) * 100
    const k = (2 * previousK + rsv) / 3
    const d = (2 * previousD + k) / 3
    previousK = k
    previousD = d
    return { k, d, j: 3 * k - 2 * d }
  })
}

/** Next candle's MA will remove this historical close. */
export function calculateDeductionPoints(
  candles: readonly OhlcvCandle[],
  periods: readonly number[] = PERIODS,
): DeductionPoint[] {
  return periods.flatMap(period => {
    if (candles.length < period) return []
    const index = candles.length - period
    return [{ period, index, closingPrice: candles[index]!.close }]
  })
}

export function calculateMarketIndicators(
  candles: readonly OhlcvCandle[],
): MarketIndicators {
  return {
    ma: Object.fromEntries(
      PERIODS.map(period => [period, calculateMovingAverage(candles, period)]),
    ),
    kdj: calculateKdj(candles),
    deductions: calculateDeductionPoints(candles),
  }
}

/** High/low among currently visible bars, inclusive indexes. */
export function findVisibleExtremes(
  candles: readonly OhlcvCandle[],
  startIndex: number,
  endIndex: number,
): { high: { index: number; price: number }; low: { index: number; price: number } } | null {
  if (!candles.length) return null
  const first = Math.max(0, Math.min(candles.length - 1, Math.floor(startIndex)))
  const last = Math.max(first, Math.min(candles.length - 1, Math.floor(endIndex)))
  let high = { index: first, price: candles[first]!.high }
  let low = { index: first, price: candles[first]!.low }
  for (let index = first + 1; index <= last; index++) {
    const candle = candles[index]!
    if (candle.high > high.price) high = { index, price: candle.high }
    if (candle.low < low.price) low = { index, price: candle.low }
  }
  return { high, low }
}
