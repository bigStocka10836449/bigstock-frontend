<template>
  <section class="margin-card">
    <header class="margin-head">
      <div>
        <h3>{{ selectedStockCode }} 資券變化</h3>
        <p>每日融資／融券淨變動；缺值不視為零</p>
      </div>
      <div class="mode-tabs" role="group" aria-label="資券類型">
        <button
          type="button"
          :class="{ active: activeTab === 'margin' }"
          @click="activeTab = 'margin'"
        >
          融資
        </button>
        <button
          type="button"
          :class="{ active: activeTab === 'short' }"
          @click="activeTab = 'short'"
        >
          融券
        </button>
      </div>
    </header>

    <div v-if="!normalizedRows.length" class="empty">目前沒有資券紀錄</div>
    <template v-else>
      <div ref="chartElement" class="margin-chart" aria-label="資券淨變動圖"></div>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>交易日期</th>
              <th>融資淨變動</th>
              <th>融券淨變動</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in descendingRows" :key="row.tradingDay">
              <td>{{ row.tradingDay }}</td>
              <td :class="valueClass(row.marginDelta)">{{ formatDelta(row.marginDelta) }}</td>
              <td :class="valueClass(row.shortDelta)">{{ formatDelta(row.shortDelta) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
  import { computed, markRaw, nextTick, onBeforeUnmount, ref, watch } from 'vue'
  import * as echarts from 'echarts'
  import type { ECharts, EChartsOption } from 'echarts'

  interface MarginRecord {
    tradingDay?: string | null
    stockCode?: string | null
    marginPurchase?: string | number | null
    marginSales?: string | number | null
    cashRedemption?: string | number | null
    shortSale?: string | number | null
    shortConvering?: string | number | null
    stockRedemption?: string | number | null
  }
  type NumericField =
    | 'marginPurchase'
    | 'marginSales'
    | 'cashRedemption'
    | 'shortSale'
    | 'shortConvering'
    | 'stockRedemption'
  type NormalizedRow = { tradingDay: string; marginDelta: number | null; shortDelta: number | null }

  const props = defineProps<{
    selectedStockCode: string
    marginShortData: MarginRecord[] | null
  }>()

  const activeTab = ref<'margin' | 'short'>('margin')
  const chartElement = ref<HTMLElement | null>(null)
  let chart: ECharts | null = null
  let resizeObserver: ResizeObserver | null = null
  let renderSequence = 0

  const fields: NumericField[] = [
    'marginPurchase',
    'marginSales',
    'cashRedemption',
    'shortSale',
    'shortConvering',
    'stockRedemption',
  ]

  function num(raw: unknown): number | null {
    if (raw === null || raw === undefined || String(raw).trim() === '') return null
    const n = Number(String(raw).replaceAll(',', '').trim())
    return Number.isFinite(n) ? n : null
  }

  function delta(values: Array<number | null>): number | null {
    // API 缺值時不推算為 0；只有明確的 0 才代表 0。
    if (values.some((v) => v === null)) return null
    return (values[0] as number) - (values[1] as number) - (values[2] as number)
  }

  const normalizedRows = computed<NormalizedRow[]>(() => {
    // 後端可能同時回傳同一天的實際紀錄與 stockCode=null 的補位紀錄。
    // 對每個日期只保留一列，但保留真正缺值的日期。
    const byDay = new Map<string, Partial<Record<NumericField, number | null>>>()
    for (const record of props.marginShortData ?? []) {
      const date = record?.tradingDay?.trim()
      if (!date) continue
      // 非本股票的有效代號不納入；null 可以作為缺值補位。
      if (record.stockCode && record.stockCode.trim() !== props.selectedStockCode.trim()) continue
      const merged = byDay.get(date) ?? {}
      for (const field of fields) {
        const current = num(record[field])
        // 有值優先於 null，避免補位資料覆蓋當日實際數據。
        if (current !== null) merged[field] = current
        else if (!(field in merged)) merged[field] = null
      }
      byDay.set(date, merged)
    }
    return Array.from(byDay, ([tradingDay, row]) => ({
      tradingDay,
      marginDelta: delta([
        row.marginPurchase ?? null,
        row.marginSales ?? null,
        row.cashRedemption ?? null,
      ]),
      // 與表格統一：融券賣出－融券回補－現券償還
      shortDelta: delta([
        row.shortSale ?? null,
        row.shortConvering ?? null,
        row.stockRedemption ?? null,
      ]),
    })).sort((a, b) => a.tradingDay.localeCompare(b.tradingDay))
  })
  const descendingRows = computed(() => [...normalizedRows.value].reverse())

  function formatDelta(n: number | null): string {
    if (n === null) return '—'
    return `${n > 0 ? '+' : ''}${n.toLocaleString('zh-TW')}`
  }
  function valueClass(n: number | null): string {
    if (n === null || n === 0) return 'neutral'
    return n > 0 ? 'positive' : 'negative'
  }

  function initializeChart(): void {
    if (!chartElement.value || chart || normalizedRows.value.length === 0) return
    chart = markRaw(echarts.init(chartElement.value, undefined, { renderer: 'canvas' }))
    resizeObserver = new ResizeObserver(() => chart?.resize())
    resizeObserver.observe(chartElement.value)
  }

  function updateChart(): void {
    if (!chart) return
    const list = normalizedRows.value
    const values = list.map((r) => (activeTab.value === 'margin' ? r.marginDelta : r.shortDelta))
    const option: EChartsOption = {
      animation: false,
      backgroundColor: 'transparent',
      grid: { left: 66, right: 20, top: 16, bottom: 68 },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (items: any) => {
          const item = Array.isArray(items) ? items[0] : items
          if (!item) return ''
          return `${item.axisValue}<br/>${activeTab.value === 'margin' ? '融資' : '融券'}淨變動：${formatDelta(num(item.data))}`
        },
      },
      xAxis: {
        type: 'category',
        data: list.map((r) => r.tradingDay),
        axisLabel: { color: '#9fb2c2', hideOverlap: true },
        axisLine: { lineStyle: { color: '#506270' } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        scale: true,
        axisLabel: { color: '#9fb2c2' },
        splitLine: { lineStyle: { color: 'rgba(142,166,185,.14)' } },
      },
      dataZoom: [
        {
          id: 'margin-slider',
          type: 'slider',
          xAxisIndex: 0,
          height: 20,
          bottom: 16,
          start: 60,
          end: 100,
          brushSelect: false,
          borderColor: '#415769',
          fillerColor: 'rgba(65,144,185,.18)',
          textStyle: { color: '#a7bbc9' },
        },
      ],
      series: [
        {
          id: 'margin-delta',
          name: activeTab.value === 'margin' ? '融資淨變動' : '融券淨變動',
          type: 'bar',
          data: values,
          barMaxWidth: 18,
          itemStyle: {
            color: (p: any) => {
              const value = num(p.value)
              return value === null ? 'transparent' : value >= 0 ? '#ef5350' : '#26a69a'
            },
          },
        },
      ],
    }
    // 不要頻繁替換 series 元件或使用多個互相衝突的 dataZoom。
    chart.setOption(option, { notMerge: true, lazyUpdate: false })
  }

  async function sync(): Promise<void> {
    const sequence = ++renderSequence
    await nextTick()
    if (sequence !== renderSequence) return
    if (!normalizedRows.value.length) {
      resizeObserver?.disconnect()
      resizeObserver = null
      chart?.dispose()
      chart = null
      return
    }
    initializeChart()
    updateChart()
  }

  watch(
    [normalizedRows, activeTab],
    () => {
      void sync()
    },
    { immediate: true },
  )
  onBeforeUnmount(() => {
    renderSequence++
    resizeObserver?.disconnect()
    chart?.dispose()
    chart = null
  })
</script>

<style scoped>
  .margin-card {
    width: 100%;
    box-sizing: border-box;
    padding: 18px;
    border: 1px solid #304353;
    border-radius: 14px;
    background: #1b2630;
    color: #e4edf4;
  }
  .margin-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 12px;
  }
  .margin-head h3 {
    margin: 0 0 8px;
    font-size: 18px;
  }
  .margin-head p {
    margin: 0;
    color: #9cafc0;
    font-size: 12px;
  }
  .mode-tabs {
    display: flex;
    gap: 8px;
  }
  .mode-tabs button {
    cursor: pointer;
    background: #273746;
    color: #cedce6;
    border: 1px solid #3b5262;
    border-radius: 7px;
    padding: 10px 15px;
  }
  .mode-tabs button.active {
    background: #195a45;
    border-color: #257a5c;
    color: #dcfff0;
  }
  .margin-chart {
    width: 100%;
    height: 365px;
  }
  .empty {
    padding: 36px;
    color: #9cafc0;
    text-align: center;
  }
  .table-scroll {
    max-height: 280px;
    overflow: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  thead {
    position: sticky;
    top: 0;
    background: #243544;
    z-index: 1;
  }
  th,
  td {
    text-align: right;
    padding: 12px 14px;
    border-bottom: 1px solid #364a5a;
  }
  th:first-child,
  td:first-child {
    text-align: left;
  }
  .positive {
    color: #ef6967;
  }
  .negative {
    color: #32bca8;
  }
  .neutral {
    color: #a4b6c3;
  }
  @media (max-width: 640px) {
    .margin-head {
      flex-direction: column;
    }
    .margin-card {
      padding: 12px;
    }
  }
</style>
