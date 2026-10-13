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
    <!-- OHLC 與成交量依十字線所在 K 棒更新，離開圖表則顯示最新交易日。 -->
    <div v-if="displayRow" class="quote-strip">
      <span class="quote-focus">{{ hoverIndex === null ? '最新一根' : '游標位置' }}</span>
      <span
        >日期 <b>{{ displayRow.date }}</b></span
      >
      <span
        >開盤 <b>{{ formatPrice(displayRow.open) }}</b></span
      >
      <span
        >最高 <b class="high-price">{{ formatPrice(displayRow.high) }}</b></span
      >
      <span
        >最低 <b class="low-price">{{ formatPrice(displayRow.low) }}</b></span
      >
      <span
        >收盤 <b>{{ formatPrice(displayRow.close) }}</b></span
      >
      <span
        >成交量 <b>{{ formatVolume(displayRow.volume) }}</b></span
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
      <span v-if="displayKd"
        >KD (9,3,3)
        <b
          >K {{ formatPrice(displayKd.k) }} · D {{ formatPrice(displayKd.d) }} · J
          {{ formatPrice(displayKd.j) }}</b
        >
        <small>{{ hoverIndex === null ? '最新一根' : candleRows[hoverIndex]?.date }}</small></span
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
    <!-- 極值使用 ECharts scatter series，直接綁定價格 grid，避免 convertToPixel finder 失敗。 -->
    <div class="chart-shell">
      <div ref="priceChart" class="chart-container" :class="{ hidden: !candleRows.length }"></div>
    </div>
    <!-- 使用原生 pointer events 控制可見範圍，避免 ECharts slider 在部分版本無法拖曳。 -->
    <div v-if="candleRows.length" class="native-zoom" aria-label="K 線時間區間調整">
      <span class="zoom-label">時間區間拖曳</span>
      <div ref="zoomTrack" class="zoom-track" @pointerdown="onTrackPointerDown">
        <div
          class="zoom-selection"
          :style="selectionStyle"
          @pointerdown.stop="startZoomDrag($event, 'window')"
        ></div>
        <button
          type="button"
          class="zoom-handle start"
          :style="startHandleStyle"
          aria-label="拖曳左端調整開始日期"
          @pointerdown.stop="startZoomDrag($event, 'start')"
        ></button>
        <button
          type="button"
          class="zoom-handle end"
          :style="endHandleStyle"
          aria-label="拖曳右端調整結束日期"
          @pointerdown.stop="startZoomDrag($event, 'end')"
        ></button>
      </div>
      <div class="zoom-dates">
        <span>{{ visibleExtremes?.startDate }}</span
        ><span>{{ visibleExtremes?.endDate }}</span>
      </div>
    </div>
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
        onAxisPointer: null,
        onChartHover: null,
        onGlobalOut: null,
        hoverIndex: null,
        dragState: null,
        extremeFrame: null,
        lastExtremeKey: '',
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
      displayRow() {
        return this.hoverIndex == null
          ? this.latest
          : (this.candleRows[this.hoverIndex] ?? this.latest)
      },
      kdRows() {
        return calculateKD(this.candleRows)
      },
      latestKd() {
        return this.kdRows[this.kdRows.length - 1] ?? null
      },
      displayKd() {
        return this.hoverIndex == null
          ? this.latestKd
          : (this.kdRows[this.hoverIndex] ?? this.latestKd)
      },
      selectionStyle() {
        return { left: `${this.zoomStart}%`, width: `${this.zoomEnd - this.zoomStart}%` }
      },
      startHandleStyle() {
        return { left: `${this.zoomStart}%` }
      },
      endHandleStyle() {
        return { left: `${this.zoomEnd}%` }
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
          highIndex: rows.indexOf(max),
          low: min.low,
          lowDate: min.date,
          lowIndex: rows.indexOf(min),
        }
      },
    },
    watch: {
      candleRows: {
        handler() {
          this.hoverIndex = null
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
          const zoom = this.priceChart.getOption()?.dataZoom?.find((z) => z.id === 'zoom-inside')
          start = Number(zoom?.start)
          end = Number(zoom?.end)
        }
        if (!Number.isFinite(start) || !Number.isFinite(end)) return
        this.zoomStart = Math.max(0, Math.min(100, start))
        this.zoomEnd = Math.max(this.zoomStart, Math.min(100, end))
        this.scheduleExtremes()
      }
      this.priceChart.on('datazoom', this.onZoom)
      // 移動十字線時更新上方 KD；不呼叫 setOption，避免破壞 slider 狀態。
      this.onAxisPointer = (event) => {
        const axis =
          event?.axesInfo?.find((item) => item.axisDim === 'x' && item.axisIndex === 0) ??
          event?.axesInfo?.find((item) => item.axisDim === 'x')
        const rawIndex = axis?.value
        if (rawIndex == null) return
        let index = Number(rawIndex)
        if (!Number.isInteger(index))
          index = this.candleRows.findIndex((row) => row.date === rawIndex)
        if (index >= 0 && index < this.candleRows.length) this.hoverIndex = index
      }
      this.onChartHover = (params) => {
        if (Number.isInteger(params?.dataIndex) && params.dataIndex < this.candleRows.length) {
          this.hoverIndex = params.dataIndex
        }
      }
      this.onGlobalOut = () => {
        this.hoverIndex = null
      }
      this.priceChart.on('updateAxisPointer', this.onAxisPointer)
      this.priceChart.on('mouseover', this.onChartHover)
      this.priceChart.getZr().on('globalout', this.onGlobalOut)
      this.renderChart()
      if (typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(() => {
          this.priceChart?.resize()
          this.scheduleExtremes()
        })
        this.resizeObserver.observe(this.$refs.priceChart)
      }
    },
    beforeUnmount() {
      this.resizeObserver?.disconnect()
      if (this.onZoom && this.priceChart) this.priceChart.off('datazoom', this.onZoom)
      if (this.onAxisPointer && this.priceChart)
        this.priceChart.off('updateAxisPointer', this.onAxisPointer)
      if (this.onChartHover && this.priceChart) this.priceChart.off('mouseover', this.onChartHover)
      if (this.onGlobalOut && this.priceChart)
        this.priceChart.getZr().off('globalout', this.onGlobalOut)
      this.stopZoomDrag()
      if (this.extremeFrame !== null) cancelAnimationFrame(this.extremeFrame)
      this.extremeFrame = null
      this.priceChart?.dispose()
      this.priceChart = null
    },
    methods: {
      /**
       * 將可見區間高低點更新到 ECharts scatter series。
       * Scatter 與 K 線共用 xAxisIndex=0/yAxisIndex=0，所以 ECharts 自行定位
       * 在影線價格。整個過程不用 convertToPixel、markPoint 或重建主圖。
       */
      scheduleExtremes() {
        if (this.extremeFrame !== null) cancelAnimationFrame(this.extremeFrame)
        this.extremeFrame = requestAnimationFrame(() => {
          this.extremeFrame = null
          this.updateExtremeSeries()
        })
      },
      updateExtremeSeries() {
        const chart = this.priceChart
        const range = this.visibleExtremes
        if (!chart || chart.isDisposed() || !range) return
        const key = `${this.zoomContext}:${range.highIndex}:${range.high}:${range.lowIndex}:${range.low}`
        if (key === this.lastExtremeKey) return
        this.lastExtremeKey = key
        chart.setOption({
          series: [
            {
              id: 'visible-high',
              type: 'scatter',
              xAxisIndex: 0,
              yAxisIndex: 0,
              data: [[range.highDate, range.high]],
            },
            {
              id: 'visible-low',
              type: 'scatter',
              xAxisIndex: 0,
              yAxisIndex: 0,
              data: [[range.lowDate, range.low]],
            },
          ],
        })
      },
      selectView(view) {
        this.selectedView = view
      },
      pointerPercent(event) {
        const track = this.$refs.zoomTrack
        if (!track) return null
        const rect = track.getBoundingClientRect()
        if (!rect.width) return null
        return Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100))
      },
      onTrackPointerDown(event) {
        const p = this.pointerPercent(event)
        if (p == null) return
        const distStart = Math.abs(p - this.zoomStart)
        const distEnd = Math.abs(p - this.zoomEnd)
        this.startZoomDrag(event, distStart < distEnd ? 'start' : 'end')
      },
      startZoomDrag(event, mode) {
        if (event.button !== 0) return
        event.preventDefault()
        const p = this.pointerPercent(event)
        if (p == null) return
        this.dragState = { mode, origin: p, start: this.zoomStart, end: this.zoomEnd }
        window.addEventListener('pointermove', this.moveZoomDrag)
        window.addEventListener('pointerup', this.stopZoomDrag)
        window.addEventListener('pointercancel', this.stopZoomDrag)
      },
      moveZoomDrag(event) {
        if (!this.dragState) return
        const p = this.pointerPercent(event)
        if (p == null) return
        const { mode, origin, start, end } = this.dragState
        const minGap = Math.min(100, 100 / Math.max(1, this.candleRows.length))
        if (mode === 'start') this.setZoom(Math.min(end - minGap, p), end)
        else if (mode === 'end') this.setZoom(start, Math.max(start + minGap, p))
        else {
          const width = end - start
          const nextStart = Math.max(0, Math.min(100 - width, start + p - origin))
          this.setZoom(nextStart, nextStart + width)
        }
      },
      stopZoomDrag() {
        this.dragState = null
        window.removeEventListener('pointermove', this.moveZoomDrag)
        window.removeEventListener('pointerup', this.stopZoomDrag)
        window.removeEventListener('pointercancel', this.stopZoomDrag)
      },
      setZoom(start, end) {
        this.zoomStart = Math.max(0, Math.min(100, start))
        this.zoomEnd = Math.max(this.zoomStart, Math.min(100, end))
        this.scheduleExtremes()
        if (this.priceChart && !this.priceChart.isDisposed()) {
          // 同時更新 inside / slider；不重建 ECharts instance。
          this.priceChart.dispatchAction({
            type: 'dataZoom',
            dataZoomId: 'zoom-inside',
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
          this.lastExtremeKey = ''
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
        this.lastExtremeKey = ''
        const extremes = this.visibleExtremes
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
              // 區間最高與最低直接用價格 grid 的 scatter 定位（不是 markPoint）。
              {
                id: 'visible-high',
                name: '區間最高',
                type: 'scatter',
                xAxisIndex: 0,
                yAxisIndex: 0,
                silent: true,
                z: 30,
                symbol: 'circle',
                symbolSize: 8,
                itemStyle: { color: '#ff7e85', borderColor: '#14202a', borderWidth: 1 },
                data: extremes ? [[extremes.highDate, extremes.high]] : [],
                label: {
                  show: true,
                  position: 'top',
                  distance: 10,
                  formatter: (params) => `最高 ${Number(params.value[1]).toLocaleString('zh-TW')}`,
                  color: '#ffb5b9',
                  fontSize: 12,
                  fontWeight: 'bold',
                  backgroundColor: '#14202a',
                  borderColor: '#92515a',
                  borderWidth: 1,
                  borderRadius: 5,
                  padding: [5, 7],
                },
                emphasis: { disabled: true },
              },
              {
                id: 'visible-low',
                name: '區間最低',
                type: 'scatter',
                xAxisIndex: 0,
                yAxisIndex: 0,
                silent: true,
                z: 30,
                symbol: 'circle',
                symbolSize: 8,
                itemStyle: { color: '#55d9ab', borderColor: '#14202a', borderWidth: 1 },
                data: extremes ? [[extremes.lowDate, extremes.low]] : [],
                label: {
                  show: true,
                  position: 'bottom',
                  distance: 10,
                  formatter: (params) => `最低 ${Number(params.value[1]).toLocaleString('zh-TW')}`,
                  color: '#8ce9c5',
                  fontSize: 12,
                  fontWeight: 'bold',
                  backgroundColor: '#14202a',
                  borderColor: '#377662',
                  borderWidth: 1,
                  borderRadius: 5,
                  padding: [5, 7],
                },
                emphasis: { disabled: true },
              },
            ],
          },
          { notMerge: true, lazyUpdate: false },
        )
        this.$nextTick(() => {
          chart.resize()
        })
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
  .quote-strip .quote-focus {
    font-weight: 700;
    color: #9cf1cb;
  }
  .quote-strip .high-price {
    color: #ff7c80;
  }
  .quote-strip .low-price {
    color: #58d5ad;
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
  .chart-shell {
    position: relative;
    width: 100%;
    min-width: 0;
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
  .native-zoom {
    padding: 3px 64px 8px;
    user-select: none;
    touch-action: none;
  }
  .zoom-label {
    display: block;
    font-size: 11px;
    color: #91aabb;
    margin-bottom: 9px;
  }
  .zoom-track {
    position: relative;
    height: 23px;
    background: #101922;
    border: 1px solid #3c5465;
    border-radius: 6px;
    cursor: pointer;
    touch-action: none;
  }
  .zoom-selection {
    position: absolute;
    top: 1px;
    bottom: 1px;
    background: rgba(100, 179, 204, 0.27);
    border: 1px solid #528ba3;
    box-sizing: border-box;
    cursor: grab;
    touch-action: none;
  }
  .zoom-selection:active {
    cursor: grabbing;
  }
  .zoom-handle {
    position: absolute;
    top: -4px;
    transform: translateX(-50%);
    height: 30px;
    width: 12px;
    border-radius: 4px;
    border: 1px solid #bee5ee;
    background: #79b5cd;
    cursor: ew-resize;
    touch-action: none;
    z-index: 3;
    padding: 0;
  }
  .zoom-dates {
    display: flex;
    justify-content: space-between;
    color: #829aab;
    font-size: 11px;
    margin-top: 6px;
  }
  @media (max-width: 700px) {
    .native-zoom {
      padding: 3px 16px 8px;
    }
  }
</style>
