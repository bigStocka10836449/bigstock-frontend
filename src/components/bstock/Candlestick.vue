<template>
  <section class="bstock-candlestick">
    <header class="chart-heading">
      <div>
        <strong>{{ selectedStockCode }} 股價走勢</strong>
      </div>
      <div class="period-tabs" role="group" aria-label="K 線週期">
        <button
          v-for="p in periods"
          :key="p.id"
          type="button"
          :class="{ active: selectedView === p.id }"
          :aria-pressed="selectedView === p.id"
          @click="selectedView = p.id"
        >
          {{ p.label }}
        </button>
      </div>
    </header>
    <div v-if="isIntraday && loadingIntraday" class="intraday-status" role="status">
      正在載入{{ selectedPeriodLabel }}資料...
    </div>
    <div v-else-if="isIntraday && intradayError" class="intraday-status error" role="alert">
      {{ intradayError }}
      <button type="button" class="retry-button" @click="retryIntraday">重試</button>
    </div>
    <UnifiedCandlestickChart
      v-else
      :key="selectedStockCode + ':' + selectedView"
      :candles="candles"
      timezone="Asia/Taipei"
      :title="selectedStockCode + ' · 技術分析'"
      :period-label="selectedPeriodLabel"
    />
  </section>
</template>

<script setup lang="ts">
  import { computed, onBeforeUnmount, ref, watch } from 'vue'
  import { getSingleStockIntradayPrice, type IntradayPeriod } from '@/api/stockApi'
  import type { StockIntradayPrice } from '@/types/stockPrice'
  import UnifiedCandlestickChart from '@/components/charts/UnifiedCandlestickChart.vue'
  type UnifiedCandle = {
    time: number
    open: number
    high: number
    low: number
    close: number
    volume?: number | null
  }

  type RawStockBar = {
    tradingDate?: string
    firstTradingDate?: string
    openingPrice?: string | number | null
    closingPrice?: string | number | null
    lowPrice?: string | number | null
    highPrice?: string | number | null
    tradingVolume?: string | number | null
  }
  type StockData = {
    singleStockDayPriceVos?: RawStockBar[]
    singleStockWeekPriceVos?: RawStockBar[]
    singleStockMonthPriceVos?: RawStockBar[]
  }
  const props = withDefaults(
    defineProps<{
      stockData?: StockData | null
      selectedStockCode?: string
      isKLineChart?: boolean
    }>(),
    { selectedStockCode: '', isKLineChart: true, stockData: null },
  )

  const periods = [
    { id: 'day', label: '日 K', key: 'singleStockDayPriceVos' },
    { id: 'week', label: '週 K', key: 'singleStockWeekPriceVos' },
    { id: 'month', label: '月 K', key: 'singleStockMonthPriceVos' },
    { id: '60m', label: '60 分 K', key: null },
    { id: '5m', label: '5 分 K', key: null },
  ] as const
  type PeriodId = (typeof periods)[number]['id']
  const selectedView = ref<PeriodId>('day')
  const selectedPeriod = computed(() => periods.find((p) => p.id === selectedView.value)!)
  const selectedPeriodLabel = computed(() => selectedPeriod.value.label)
  const isIntraday = computed(() => selectedView.value === '5m' || selectedView.value === '60m')
  const loadingIntraday = ref(false)
  const intradayError = ref('')
  const intradayData = ref<Partial<Record<IntradayPeriod, StockIntradayPrice[]>>>({})
  let intradayRequestVersion = 0

  async function loadIntraday(force = false): Promise<void> {
    const period = selectedView.value
    const stockCode = props.selectedStockCode.trim()
    const requestVersion = ++intradayRequestVersion
    if ((period !== '5m' && period !== '60m') || !stockCode) {
      loadingIntraday.value = false
      intradayError.value = ''
      return
    }
    if (!force && intradayData.value[period] !== undefined) {
      loadingIntraday.value = false
      intradayError.value = ''
      return
    }
    loadingIntraday.value = true
    intradayError.value = ''
    try {
      const response = await getSingleStockIntradayPrice(stockCode, period)
      if (requestVersion !== intradayRequestVersion) return
      if (!Array.isArray(response)) throw new Error('Unexpected intraday response')
      intradayData.value = { ...intradayData.value, [period]: response }
    } catch (error) {
      if (requestVersion !== intradayRequestVersion) return
      console.error('[Candlestick] Intraday price request failed:', error)
      intradayError.value = '盤中 K 線資料載入失敗，請稍後再試'
    } finally {
      if (requestVersion === intradayRequestVersion) loadingIntraday.value = false
    }
  }

  function retryIntraday(): void {
    void loadIntraday(true)
  }

  watch(
    () => props.selectedStockCode,
    () => {
      intradayData.value = {}
      void loadIntraday()
    },
  )
  watch(selectedView, () => {
    void loadIntraday()
  })
  onBeforeUnmount(() => {
    intradayRequestVersion++
  })

  function intradaySeconds(value: string | number[] | undefined): number | null {
    if (Array.isArray(value)) {
      if (value.length < 5 || !value.slice(0, 5).every(Number.isFinite)) return null
      const [year, month, day, hour, minute, second = 0] = value
      return taipeiSeconds(year!, month!, day!, hour!, minute!, second)
    }
    if (typeof value !== 'string') return null
    // Java LocalDateTime：無時區的 yyyy-MM-ddTHH:mm:ss，視為台灣當地時間。
    const match = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[T ](\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(value)
    if (!match) return null
    return taipeiSeconds(
      Number(match[1]),
      Number(match[2]),
      Number(match[3]),
      Number(match[4]),
      Number(match[5]),
      Number(match[6] ?? 0),
    )
  }

  function taipeiSeconds(
    y: number,
    m: number,
    d: number,
    h: number,
    min: number,
    sec: number,
  ): number | null {
    if (
      m < 1 ||
      m > 12 ||
      d < 1 ||
      d > 31 ||
      h < 0 ||
      h > 23 ||
      min < 0 ||
      min > 59 ||
      sec < 0 ||
      sec > 59
    )
      return null
    // UTC+08:00；與圖表的 Asia/Taipei 格式化一致。
    const timestamp = Date.UTC(y, m - 1, d, h - 8, min, sec)
    const check = new Date(timestamp + 8 * 60 * 60 * 1000)
    if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d)
      return null
    return timestamp / 1000
  }

  function numeric(v: unknown): number | null {
    if (v == null || String(v).trim() === '') return null
    const n = Number(String(v).replace(/,/g, ''))
    return Number.isFinite(n) ? n : null
  }
  function dateSeconds(value: unknown): number | null {
    const text = String(value ?? '').trim()
    // API 預期 yyyy-MM-dd / yyyy/MM/dd；避開瀏覽器對非標準字串的 Date.parse 差異。
    const match = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(text)
    if (!match) return null
    const y = Number(match[1]),
      m = Number(match[2]),
      d = Number(match[3])
    if (m < 1 || m > 12 || d < 1 || d > 31) return null
    const ms = Date.UTC(y, m - 1, d, 4) // 台灣中午 12 點
    const dt = new Date(ms)
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d)
      return null
    return ms / 1000
  }
  const candles = computed<UnifiedCandle[]>(() => {
    const raw = isIntraday.value
      ? (intradayData.value[selectedView.value as IntradayPeriod] ?? [])
      : (props.stockData?.[selectedPeriod.value.key as keyof StockData] ?? [])
    if (!Array.isArray(raw)) return []
    return raw
      .flatMap((bar) => {
        const time = isIntraday.value
          ? intradaySeconds((bar as StockIntradayPrice).tradingTime)
          : dateSeconds((bar as RawStockBar).tradingDate ?? (bar as RawStockBar).firstTradingDate)
        const open = numeric(bar.openingPrice),
          close = numeric(bar.closingPrice)
        const low = numeric(bar.lowPrice),
          high = numeric(bar.highPrice)
        const volume = numeric(bar.tradingVolume)
        if (
          time == null ||
          open == null ||
          close == null ||
          high == null ||
          low == null ||
          high < low
        )
          return []
        return [{ time, open, close, high, low, volume }]
      })
      .sort((a, b) => a.time - b.time)
  })
</script>

<style scoped>
  .bstock-candlestick {
    width: 100%;
    min-width: 0;
    color: #edf3f7;
  }
  .chart-heading {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
  }
  .chart-heading strong {
    display: block;
    font-size: 18px;
  }
  .chart-heading span {
    display: block;
    font-size: 12px;
    color: #9daebc;
    margin-top: 4px;
  }
  .intraday-status {
    padding: 20px 12px;
    color: #aebdcc;
    text-align: center;
  }
  .intraday-status.error {
    color: #f19a9e;
  }
  .retry-button {
    margin-left: 12px;
    cursor: pointer;
    color: #effff9;
    background: #295b4e;
    border: 1px solid #49b994;
    border-radius: 6px;
    padding: 5px 10px;
  }
  .period-tabs {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .period-tabs button {
    cursor: pointer;
    background: #202d38;
    color: #aebdcc;
    border: 1px solid #364b5b;
    border-radius: 6px;
    padding: 7px 12px;
  }
  .period-tabs button.active {
    background: #295b4e;
    color: #effff9;
    border-color: #49b994;
  }
</style>
