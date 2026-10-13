<template>
  <section class="kline-card">
    <header class="kline-head">
      <div>
        <h2>{{ selectedStockCode }} 股價走勢</h2>
        <p>價格、均線與成交量</p>
      </div>
      <div class="period-tabs" role="group" aria-label="K線週期">
        <button
          v-for="period in periods"
          :key="period.id"
          type="button"
          :class="{ active: selectedView === period.id }"
          :aria-pressed="selectedView === period.id"
          @click="selectView(period.id)"
        >
          {{ period.name }}
        </button>
      </div>
    </header>
    <div v-if="latest" class="quote-strip">
      <span
        >日期 <b>{{ latest.date }}</b></span
      >
      <span
        >開 <b>{{ formatPrice(latest.open) }}</b></span
      >
      <span
        >高 <b>{{ formatPrice(latest.high) }}</b></span
      >
      <span
        >低 <b>{{ formatPrice(latest.low) }}</b></span
      >
      <span
        >收 <b>{{ formatPrice(latest.close) }}</b></span
      >
      <span
        >量 <b>{{ formatVolume(latest.volume) }}</b></span
      >
    </div>
    <div v-if="visibleExtremes" class="range-strip">
      <span
        >可見區間 <b>{{ visibleExtremes.startDate }} ～ {{ visibleExtremes.endDate }}</b></span
      >
      <span
        >最高 <b class="high-price">{{ formatPrice(visibleExtremes.high) }}</b>
        <small>{{ visibleExtremes.highDate }}</small></span
      >
      <span
        >最低 <b class="low-price">{{ formatPrice(visibleExtremes.low) }}</b>
        <small>{{ visibleExtremes.lowDate }}</small></span
      >
      <span v-if="latestKd"
        >KD (9,3,3)
        <b
          >K {{ formatPrice(latestKd.k) }} · D {{ formatPrice(latestKd.d) }} · J
          {{ formatPrice(latestKd.j) }}</b
        ></span
      >
    </div>
    <div v-if="candleRows.length" class="zoom-toolbar" role="group" aria-label="K 線顯示範圍">
      <span>顯示範圍</span>
      <button type="button" @click="showRecent(30)">最近 30 根</button>
      <button type="button" @click="showRecent(60)">最近 60 根</button>
      <button type="button" @click="showRecent(90)">最近 90 根</button>
      <button type="button" @click="showAll">全部</button>
      <small>拖曳底部滑桿兩端可縮放；拖曳中間可移動視窗</small>
    </div>
    <div v-if="!candleRows.length" class="no-data">目前沒有此週期的有效 K 線資料。</div>
    <div ref="priceChart" class="chart-container" :class="{ hidden: !candleRows.length }"></div>
  </section>
</template>

<script>
  import * as echarts from 'echarts'

  const numeric = (v) => {
    if (v === null || v === undefined || String(v).trim() === '') return null
    const n = Number(String(v).replace(/,/g, ''))
    return Number.isFinite(n) ? n : null
  }
  const niceDate = (v) => String(v ?? '').trim()

  // KD (9,3,3)：依所選的日／週／月 K 獨立計算，初始 K/D = 50。
  function calculateKD(rows, period = 9) {
    let previousK = 50
    let previousD = 50
    return rows.map((row, index) => {
      const window = rows.slice(Math.max(0, index - period + 1), index + 1)
      const highest = Math.max(...window.map((r) => r.high))
      const lowest = Math.min(...window.map((r) => r.low))
      const rsv =
        highest === lowest
          ? 50
          : Math.min(100, Math.max(0, ((row.close - lowest) / (highest - lowest)) * 100))
      const k = (2 * previousK + rsv) / 3
      const d = (2 * previousD + k) / 3
      previousK = k
      previousD = d
      return { k, d, j: 3 * k - 2 * d }
    })
  }

  function visibleIndices(length, start, end) {
    if (!length) return [0, 0]
    const a = Math.max(0, Math.min(length - 1, Math.floor(((start ?? 0) / 100) * (length - 1))))
    const b = Math.max(a, Math.min(length - 1, Math.ceil(((end ?? 100) / 100) * (length - 1))))
    return [a, b]
  }
  export default {
    name: 'Candlestick',
    props: {
      isKLineChart: { type: Boolean, default: true },
      selectedStockCode: { type: String, default: '' },
      stockData: { type: Object, default: () => ({}) },
    },
    data() {
      return {
        selectedView: 'day',
        periods: [
          { id: 'day', name: '日 K' },
          { id: 'week', name: '週 K' },
          { id: 'month', name: '月 K' },
        ],
        priceChart: null,
        resizeObserver: null,
        zoomStart: 0,
        zoomEnd: 100,
        zoomContext: '',
        onZoom: null,
      }
    },
    computed: {
      candleRows() {
        const prop = {
          day: 'singleStockDayPriceVos',
          week: 'singleStockWeekPriceVos',
          month: 'singleStockMonthPriceVos',
        }[this.selectedView]
        const source = this.stockData?.[prop]
        if (!Array.isArray(source)) return []
        return source
          .flatMap((item) => {
            if (!item || typeof item !== 'object') return []
            const open = numeric(item.openingPrice)
            const close = numeric(item.closingPrice)
            const low = numeric(item.lowPrice)
            const high = numeric(item.highPrice)
            const date = niceDate(item.firstTradingDate || item.tradingDate)
            if (!date || [open, close, low, high].some((n) => n === null)) return []
            return [
              {
                date,
                open,
                close,
                low,
                high,
                volume: numeric(item.tradingVolume),
                ma5: numeric(item.fiveMa),
                ma10: numeric(item.tenMa),
                ma20: numeric(item.twentyMa),
                ma60: numeric(item.sixtyMa),
              },
            ]
          })
          .sort((a, b) => a.date.localeCompare(b.date))
      },
      latest() {
        return this.candleRows[this.candleRows.length - 1] ?? null
      },
      kdRows() {
        return calculateKD(this.candleRows)
      },
      latestKd() {
        return this.kdRows[this.kdRows.length - 1] ?? null
      },
      visibleExtremes() {
        const rows = this.candleRows
        if (!rows.length) return null
        const [a, b] = visibleIndices(rows.length, this.zoomStart, this.zoomEnd)
        const visible = rows.slice(a, b + 1)
        const max = visible.reduce((best, row) => (row.high > best.high ? row : best), visible[0])
        const min = visible.reduce((best, row) => (row.low < best.low ? row : best), visible[0])
        return {
          startDate: visible[0].date,
          endDate: visible[visible.length - 1].date,
          high: max.high,
          highDate: max.date,
          low: min.low,
          lowDate: min.date,
        }
      },
    },
    watch: {
      candleRows: {
        handler() {
          this.$nextTick(() => this.renderChart())
        },
        immediate: false,
      },
      isKLineChart() {
        this.$nextTick(() => this.priceChart?.resize())
      },
    },
    mounted() {
      this.priceChart = echarts.init(this.$refs.priceChart, 'dark', { renderer: 'canvas' })
      // 只同步可見範圍，不在 datazoom 回呼中重繪整張圖。
      this.onZoom = (event) => {
        if (!this.priceChart || this.priceChart.isDisposed()) return
        const payload = event?.batch?.[0] ?? event
        let start = Number(payload?.start)
        let end = Number(payload?.end)
        // 不同 ECharts 版本、滑鼠/滑桿操作可能不帶百分比，從當前 option 補取。
        if (!Number.isFinite(start) || !Number.isFinite(end)) {
          const zoom = this.priceChart.getOption()?.dataZoom?.find((z) => z.id === 'zoom-slider')
          start = Number(zoom?.start)
          end = Number(zoom?.end)
        }
        if (!Number.isFinite(start) || !Number.isFinite(end)) return
        this.zoomStart = Math.max(0, Math.min(100, start))
        this.zoomEnd = Math.max(this.zoomStart, Math.min(100, end))
      }
      this.priceChart.on('datazoom', this.onZoom)
      this.renderChart()
      if (typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(() => this.priceChart?.resize())
        this.resizeObserver.observe(this.$refs.priceChart)
      }
    },
    beforeUnmount() {
      this.resizeObserver?.disconnect()
      if (this.onZoom && this.priceChart) this.priceChart.off('datazoom', this.onZoom)
      this.priceChart?.dispose()
      this.priceChart = null
    },
    methods: {
      selectView(view) {
        this.selectedView = view
      },
      setZoom(start, end) {
        this.zoomStart = Math.max(0, Math.min(100, start))
        this.zoomEnd = Math.max(this.zoomStart, Math.min(100, end))
        if (this.priceChart && !this.priceChart.isDisposed()) {
          // 同時更新 inside / slider；不重建 ECharts instance。
          this.priceChart.dispatchAction({
            type: 'dataZoom',
            start: this.zoomStart,
            end: this.zoomEnd,
          })
        }
      },
      showRecent(count) {
        const length = this.candleRows.length
        if (!length) return
        this.setZoom(Math.max(0, 100 * (1 - Math.min(length, count) / length)), 100)
      },
      showAll() {
        this.setZoom(0, 100)
      },
      formatPrice(value) {
        return value == null
          ? '—'
          : Number(value).toLocaleString('zh-TW', { maximumFractionDigits: 2 })
      },
      formatVolume(value) {
        return value == null ? '—' : Number(value).toLocaleString('zh-TW')
      },
      renderChart() {
        const chart = this.priceChart
        if (!chart) return
        const rows = this.candleRows
        if (!rows.length) {
          chart.clear()
          return
        }
        const dates = rows.map((r) => r.date)
        const candles = rows.map((r) => [r.open, r.close, r.low, r.high])
        const volumes = rows.map((r) => ({
          value: r.volume,
          itemStyle: { color: r.close >= r.open ? '#ef5350' : '#26a69a' },
        }))
        const ma = (field) =>
          rows.map((r) => (r[field] == null || r[field] === 0 ? null : r[field]))
        const kd = this.kdRows
        // 同一股票、同一週期重新整理時保留滑桿位置；切換股票或週期才重設。
        const context = `${this.selectedStockCode}:${this.selectedView}`
        if (this.zoomContext !== context) {
          this.zoomStart = Math.max(0, 100 * (1 - Math.min(rows.length, 90) / rows.length))
          this.zoomEnd = 100
          this.zoomContext = context
        }
        const zoomStart = this.zoomStart
        const zoomEnd = this.zoomEnd
        const text = '#9daeba'
        const gridLine = 'rgba(161,181,196,.11)'
        chart.setOption(
          {
            backgroundColor: 'transparent',
            animation: false,
            color: ['#ef5350', '#6ba4ff', '#92cb73', '#ffc460', '#c19af4'],
            tooltip: {
              trigger: 'axis',
              axisPointer: { type: 'cross', crossStyle: { color: '#7b8e9d' } },
              backgroundColor: '#111b24',
              borderColor: '#3e5363',
              textStyle: { color: '#e8eef4' },
              formatter(params) {
                const p = params?.find((item) => item.seriesType === 'candlestick')
                const i = p?.dataIndex ?? params?.[0]?.dataIndex
                const r = rows[i]
                if (!r) return ''
                const fmt = (v) =>
                  v == null ? '—' : Number(v).toLocaleString('zh-TW', { maximumFractionDigits: 2 })
                return `<b>${r.date}</b><br/>開 ${fmt(r.open)}　高 ${fmt(r.high)}<br/>低 ${fmt(r.low)}　收 ${fmt(r.close)}<br/>量 ${fmt(r.volume)}`
              },
            },
            legend: {
              top: 9,
              left: 'center',
              textStyle: { color: text },
              data: ['K 線', 'MA5', 'MA10', 'MA20', 'MA60', 'K(9)', 'D(3)'],
            },
            axisPointer: { link: [{ xAxisIndex: 'all' }], label: { backgroundColor: '#34485b' } },
            grid: [
              { left: 68, right: 45, top: 56, height: '47%' },
              { left: 68, right: 45, top: '62%', height: '10%' },
              { left: 68, right: 45, top: '77%', height: '11%' },
            ],
            xAxis: [
              {
                type: 'category',
                data: dates,
                boundaryGap: true,
                axisLine: { lineStyle: { color: '#526372' } },
                axisLabel: { show: false },
                axisTick: { show: false },
                splitLine: { show: false },
              },
              {
                type: 'category',
                gridIndex: 1,
                data: dates,
                boundaryGap: true,
                axisLine: { lineStyle: { color: '#526372' } },
                axisLabel: { show: false },
                axisTick: { show: false },
                splitLine: { show: false },
              },
              {
                type: 'category',
                gridIndex: 2,
                data: dates,
                boundaryGap: true,
                axisLine: { lineStyle: { color: '#526372' } },
                axisLabel: { color: text, hideOverlap: true },
                axisTick: { show: false },
                splitLine: { show: false },
              },
            ],
            yAxis: [
              {
                type: 'value',
                scale: true,
                position: 'right',
                splitNumber: 5,
                axisLabel: { color: text, formatter: (v) => Number(v).toFixed(1) },
                axisLine: { show: false },
                splitLine: { lineStyle: { color: gridLine } },
                splitArea: { show: false },
              },
              {
                type: 'value',
                gridIndex: 1,
                scale: true,
                position: 'right',
                splitNumber: 2,
                axisLabel: {
                  color: text,
                  formatter: (v) =>
                    v >= 1000000
                      ? `${(v / 1000000).toFixed(1)}M`
                      : v >= 1000
                        ? `${(v / 1000).toFixed(0)}K`
                        : v,
                },
                splitLine: { show: false },
                axisLine: { show: false },
              },
              {
                type: 'value',
                gridIndex: 2,
                min: 0,
                max: 100,
                interval: 50,
                position: 'right',
                axisLabel: { color: text },
                axisLine: { show: false },
                splitLine: { lineStyle: { color: gridLine } },
              },
            ],
            dataZoom: [
              {
                id: 'zoom-inside',
                type: 'inside',
                xAxisIndex: [0, 1, 2],
                start: zoomStart,
                end: zoomEnd,
                filterMode: 'none',
                zoomOnMouseWheel: 'ctrl',
                moveOnMouseWheel: false,
                moveOnMouseMove: true,
                throttle: 50,
              },
              {
                id: 'zoom-slider',
                type: 'slider',
                xAxisIndex: [0, 1, 2],
                bottom: 7,
                height: 28,
                start: zoomStart,
                end: zoomEnd,
                filterMode: 'none',
                realtime: true,
                brushSelect: false,
                showDataShadow: false,
                showDetail: false,
                borderColor: '#42535f',
                backgroundColor: '#111922',
                fillerColor: 'rgba(83,155,184,.22)',
                handleSize: '90%',
                handleStyle: { color: '#83becb', borderColor: '#a5d8df' },
                moveHandleStyle: { color: '#6d99a8' },
                textStyle: { color: text },
              },
            ],
            series: [
              {
                name: 'K 線',
                type: 'candlestick',
                xAxisIndex: 0,
                yAxisIndex: 0,
                data: candles,
                itemStyle: {
                  color: '#ef5350',
                  color0: '#26a69a',
                  borderColor: '#ef5350',
                  borderColor0: '#26a69a',
                },
              },
              ...[
                ['MA5', 'ma5'],
                ['MA10', 'ma10'],
                ['MA20', 'ma20'],
                ['MA60', 'ma60'],
              ].map(([name, key]) => ({
                name,
                type: 'line',
                xAxisIndex: 0,
                yAxisIndex: 0,
                data: ma(key),
                smooth: false,
                showSymbol: false,
                connectNulls: false,
                lineStyle: { width: 1.4 },
              })),
              {
                name: '成交量',
                type: 'bar',
                xAxisIndex: 1,
                yAxisIndex: 1,
                data: volumes,
                barMaxWidth: 12,
                silent: false,
              },
              {
                name: 'K(9)',
                type: 'line',
                xAxisIndex: 2,
                yAxisIndex: 2,
                data: kd.map((x) => x.k),
                showSymbol: false,
                lineStyle: { width: 1.5, color: '#5aa9ff' },
                itemStyle: { color: '#5aa9ff' },
              },
              {
                name: 'D(3)',
                type: 'line',
                xAxisIndex: 2,
                yAxisIndex: 2,
                data: kd.map((x) => x.d),
                showSymbol: false,
                lineStyle: { width: 1.5, color: '#ffc460' },
                itemStyle: { color: '#ffc460' },
              },
            ],
          },
          { notMerge: true, lazyUpdate: false },
        )
        this.$nextTick(() => chart.resize())
      },
    },
  }
</script>

<style scoped>
  .kline-card {
    width: 100%;
    min-width: 0;
    padding: 16px;
    box-sizing: border-box;
    background: #1c252e;
    border: 1px solid #34424e;
    border-radius: 14px;
    color: #e6eef5;
  }
  .kline-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
  }
  .kline-head h2 {
    font-size: 18px;
    margin: 0;
  }
  .kline-head p {
    font-size: 12px;
    color: #8fa3b4;
    margin: 5px 0 0;
  }
  .period-tabs {
    display: flex;
    gap: 6px;
  }
  .period-tabs button {
    background: #293844;
    color: #bed0de;
    border: 1px solid #405261;
    border-radius: 7px;
    cursor: pointer;
    padding: 8px 14px;
  }
  .period-tabs button.active {
    background: #205a46;
    color: #9bf0c9;
    border-color: #347e60;
  }
  .quote-strip {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 22px;
    margin: 15px 0 5px;
    font-size: 12px;
    color: #8ea5b5;
  }
  .quote-strip b {
    color: #e7eff6;
    margin-left: 6px;
  }
  .range-strip {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 9px 24px;
    padding: 10px 12px;
    margin: 10px 0;
    border: 1px solid #354652;
    background: #15212b;
    border-radius: 8px;
    font-size: 12px;
    color: #94a9bc;
  }
  .range-strip b {
    margin-left: 5px;
    color: #e9f2f8;
  }
  .range-strip small {
    color: #8298aa;
    margin-left: 4px;
  }
  .range-strip .high-price {
    color: #f16b70;
  }
  .range-strip .low-price {
    color: #4ad0a8;
  }
  .zoom-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin: 8px 0 4px;
    color: #9ab0c0;
    font-size: 12px;
  }
  .zoom-toolbar button {
    padding: 6px 10px;
    border: 1px solid #426071;
    border-radius: 6px;
    background: #253745;
    color: #d9eaf5;
    cursor: pointer;
  }
  .zoom-toolbar button:hover {
    background: #335369;
  }
  .zoom-toolbar small {
    color: #849cac;
  }
  .chart-container {
    height: 660px;
    width: 100%;
    min-width: 0;
  }
  .chart-container.hidden {
    height: 0;
    overflow: hidden;
  }
  .no-data {
    padding: 32px 12px;
    color: #a1b2c0;
    text-align: center;
  }
  @media (max-width: 700px) {
    .kline-card {
      padding: 10px;
    }
    .chart-container {
      height: 540px;
    }
  }
</style>
