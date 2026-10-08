<template>
  <div class="market-chart-shell">
    <div class="chart-bar">
      <div>
        <strong>歷史日 K</strong>
        <span class="sub">{{ candles.length }} 根 · {{ timezone || '交易所時區' }}</span>
      </div>
      <div class="legend"><span class="up">● 上漲</span><span class="down">● 下跌</span></div>
    </div>
    <div v-if="!candles.length" class="empty">目前沒有可繪製的日 K 資料</div>
    <div
      v-show="candles.length > 0"
      ref="chartEl"
      class="chart"
      role="img"
      aria-label="歷史日 K 線與成交量圖"
    ></div>
  </div>
</template>

<script setup lang="ts">
  import { onBeforeUnmount, onMounted, ref, watch, nextTick } from 'vue'
  import * as echarts from 'echarts'
  import type { MarketCandle } from '@/utils/marketHistoryParser'
  const props = withDefaults(defineProps<{ candles: MarketCandle[]; timezone?: string }>(), {
    timezone: '',
  })
  const chartEl = ref<HTMLDivElement | null>(null)
  let instance: echarts.ECharts | null = null
  let observer: ResizeObserver | null = null
  const up = '#ec696c' // 台股習慣：紅漲
  const down = '#39b98b' // 台股習慣：綠跌

  function dayAt(seconds: number): string {
    try {
      // 日期採用交易市場本地時區，不能直接使用瀏覽器當地時區。
      const s = new Intl.DateTimeFormat('en-CA', {
        timeZone: props.timezone || 'Asia/Taipei',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(seconds * 1000))
      return s
    } catch {
      return new Date(seconds * 1000).toISOString().slice(0, 10)
    }
  }

  function render(): void {
    const el = chartEl.value
    if (!el || !props.candles.length || el.clientWidth === 0 || el.clientHeight === 0) return
    if (!instance) instance = echarts.init(el, undefined, { renderer: 'canvas' })
    const dates = props.candles.map((x) => dayAt(x.time))
    const ohlc = props.candles.map((x) => [x.open, x.close, x.low, x.high])
    const volumes = props.candles.map((x) => ({
      value: x.volume ?? 0,
      itemStyle: { color: x.close >= x.open ? up : down },
    }))
    const zoomStart = Math.max(0, 100 - (90 / Math.max(1, props.candles.length)) * 100)
    instance.setOption(
      {
        backgroundColor: 'transparent',
        animationDurationUpdate: 250,
        legend: { show: false },
        grid: [
          { left: 65, right: 18, top: 18, height: '57%' },
          { left: 65, right: 18, top: '77%', height: '13%' },
        ],
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'cross' },
          backgroundColor: '#242a31',
          borderColor: '#39434c',
          textStyle: { color: '#eaf1f7' },
        },
        axisPointer: { link: [{ xAxisIndex: 'all' }] },
        xAxis: [
          {
            type: 'category',
            data: dates,
            scale: true,
            boundaryGap: true,
            axisLine: { lineStyle: { color: '#687580' } },
            axisLabel: { show: false },
            splitLine: { show: false },
            min: 'dataMin',
            max: 'dataMax',
          },
          {
            type: 'category',
            gridIndex: 1,
            data: dates,
            scale: true,
            boundaryGap: true,
            axisLine: { lineStyle: { color: '#687580' } },
            axisLabel: { color: '#92a0ad', hideOverlap: true },
            splitLine: { show: false },
            min: 'dataMin',
            max: 'dataMax',
          },
        ],
        yAxis: [
          {
            scale: true,
            axisLabel: { color: '#92a0ad' },
            splitLine: { lineStyle: { color: '#26303a' } },
          },
          {
            scale: true,
            gridIndex: 1,
            axisLabel: {
              color: '#92a0ad',
              formatter: (v: number) => (v >= 1000000 ? `${(v / 1000000).toFixed(0)}M` : `${v}`),
            },
            splitLine: { show: false },
          },
        ],
        dataZoom: [
          { type: 'inside', xAxisIndex: [0, 1], start: zoomStart, end: 100 },
          {
            type: 'slider',
            xAxisIndex: [0, 1],
            start: zoomStart,
            end: 100,
            bottom: 4,
            height: 18,
            borderColor: '#34404a',
            fillerColor: 'rgba(83,190,139,.14)',
            textStyle: { color: '#9daab4' },
          },
        ],
        series: [
          {
            name: '日 K',
            type: 'candlestick',
            data: ohlc,
            itemStyle: { color: up, color0: down, borderColor: up, borderColor0: down },
          },
          {
            name: '成交量',
            type: 'bar',
            xAxisIndex: 1,
            yAxisIndex: 1,
            data: volumes,
            barMaxWidth: 9,
          },
        ],
      },
      { notMerge: true },
    )
  }
  async function scheduleRender(): Promise<void> {
    await nextTick()
    render()
  }
  watch(
    () => [props.candles, props.timezone],
    () => void scheduleRender(),
    { deep: false },
  )
  onMounted(() => {
    observer = new ResizeObserver(() => {
      const el = chartEl.value
      if (!el || !props.candles.length || el.clientWidth === 0 || el.clientHeight === 0) return
      if (!instance) render()
      else instance.resize()
    })
    if (chartEl.value) observer.observe(chartEl.value)
    void scheduleRender()
  })
  onBeforeUnmount(() => {
    observer?.disconnect()
    instance?.dispose()
    instance = null
  })
</script>

<style scoped>
  .market-chart-shell {
    min-width: 0;
    width: 100%;
  }
  .chart-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  }
  .chart-bar strong {
    font-size: 16px;
  }
  .sub {
    margin-left: 12px;
    color: #9ba9b5;
    font-size: 12px;
  }
  .legend {
    display: flex;
    gap: 12px;
    font-size: 12px;
  }
  .up {
    color: #ec696c;
  }
  .down {
    color: #39b98b;
  }
  .chart {
    width: 100%;
    height: 490px;
    min-height: 350px;
  }
  .empty {
    padding: 100px 20px;
    text-align: center;
    color: #95a4b0;
  }
  @media (max-width: 640px) {
    .chart {
      height: 390px;
    }
    .sub {
      display: block;
      margin-left: 0;
      margin-top: 3px;
    }
  }
</style>
