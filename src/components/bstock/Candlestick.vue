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
    <UnifiedCandlestickChart
      :key="selectedStockCode + ':' + selectedView"
      :candles="candles"
      timezone="Asia/Taipei"
      :title="selectedStockCode + ' · 技術分析'"
      :period-label="selectedPeriodLabel"
    />
  </section>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
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
  ] as const
  type PeriodId = (typeof periods)[number]['id']
  const selectedView = ref<PeriodId>('day')
  const selectedPeriod = computed(() => periods.find((p) => p.id === selectedView.value)!)
  const selectedPeriodLabel = computed(() => selectedPeriod.value.label)

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
    const raw = props.stockData?.[selectedPeriod.value.key] ?? []
    if (!Array.isArray(raw)) return []
    return raw
      .flatMap((bar) => {
        const time = dateSeconds(bar.tradingDate ?? bar.firstTradingDate)
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
