<template>
  <section class="kline-card">
    <header class="kline-head">
      <div>
        <h2>{{ selectedStockCode }} 股價走勢</h2>
        <p>價格 · 均線 · 成交量 · MA 扣抵 · KD（按住圖表左右拖曳時間範圍）</p>
      </div>
      <div class="period-tabs" aria-label="K 線週期">
        <button
          v-for="p in periods"
          :key="p.id"
          type="button"
          :class="{ active: selectedView === p.id }"
          :aria-pressed="selectedView === p.id"
          @click="changePeriod(p.id)"
        >
          {{ p.name }}
        </button>
      </div>
    </header>

    <div v-if="displayRow" class="quote-strip">
      <strong class="focus">{{ hoverIndex === null ? '最新一根' : '游標位置' }}</strong>
      <span
        >日期 <b>{{ displayRow.date }}</b></span
      >
      <span
        >開 <b>{{ fmt(displayRow.open) }}</b></span
      >
      <span
        >高 <b class="high">{{ fmt(displayRow.high) }}</b></span
      >
      <span
        >低 <b class="low">{{ fmt(displayRow.low) }}</b></span
      >
      <span
        >收 <b>{{ fmt(displayRow.close) }}</b></span
      >
      <span
        >量 <b>{{ volumeFmt(displayRow.volume) }}</b></span
      >
      <span v-if="displayKd"
        >K <b>{{ fmt(displayKd.k) }}</b> · D <b>{{ fmt(displayKd.d) }}</b> · J
        <b>{{ fmt(displayKd.j) }}</b></span
      >
    </div>

    <div v-if="visibleExtremes" class="range-strip">
      <span
        >可見區間 <b>{{ visibleExtremes.startDate }} ～ {{ visibleExtremes.endDate }}</b></span
      >
      <span
        >最高 <b class="high">{{ fmt(visibleExtremes.high) }}</b>
        <small>{{ visibleExtremes.highDate }}</small></span
      >
      <span
        >最低 <b class="low">{{ fmt(visibleExtremes.low) }}</b>
        <small>{{ visibleExtremes.lowDate }}</small></span
      >
    </div>

    <div v-if="candleRows.length" class="zoom-toolbar">
      <span>顯示範圍</span>
      <div class="zoom-actions" aria-label="以目前視窗中心縮放">
        <button
          type="button"
          class="zoom-action"
          aria-label="放大目前可見時間範圍"
          @click="zoomAroundCenter('in')"
        >
          ＋ 放大
        </button>
        <button
          type="button"
          class="zoom-action"
          aria-label="縮小目前可見時間範圍"
          @click="zoomAroundCenter('out')"
        >
          － 縮小
        </button>
      </div>
      <button v-for="n in [30, 60, 90]" :key="n" type="button" @click="showRecent(n)">
        最近 {{ n }} 根
      </button>
      <button type="button" @click="setZoom(0, 100)">全部</button>
      <small>先縮放至非全部範圍，再按住價格／成交量／KD 圖拖曳平移；滾輪正常捲動頁面</small>
    </div>

    <div v-if="!candleRows.length" class="no-data">此週期目前沒有有效 K 線資料。</div>
    <div class="chart-host">
      <div ref="priceChart" class="chart-container" :class="{ empty: !candleRows.length }"></div>
      <!-- SVG 與 ECharts 疊合但不接受滑鼠事件；四色虛線對準扣抵 K 棒及下方三角形 -->
      <svg
        v-if="candleRows.length"
        class="ma-guide-layer"
        :viewBox="`0 0 ${chartSize.width} ${chartSize.height}`"
        :width="chartSize.width"
        :height="chartSize.height"
        aria-hidden="true"
      >
        <g v-for="marker in deductionMarkers" :key="`guide-${marker.period}`">
          <line
            :x1="marker.x"
            :x2="marker.x"
            :y1="marker.y"
            :y2="marker.trackY"
            :stroke="marker.color"
            stroke-width="1"
            stroke-dasharray="4 5"
            opacity="0.68"
          />
          <circle :cx="marker.x" :cy="marker.y" r="2.6" :fill="marker.color" />
        </g>
      </svg>
      <!-- 扣抵三角形放在成交量下方，按日期與上方 K 棒虛線連動 -->
      <div
        v-if="candleRows.length"
        ref="maTracks"
        class="ma-deduction-tracks"
        aria-label="均線扣抵位置"
      >
        <div
          v-for="period in enabledMaPeriods"
          :key="period"
          class="ma-track-row"
          :style="{ '--ma-color': maColor(period), height: `${100 / enabledMaPeriods.length}%` }"
        >
          <span class="ma-track-title">MA{{ period }}</span>
          <template
            v-for="marker in deductionMarkers.filter((m) => m.period === period)"
            :key="marker.period"
          >
            <div
              class="ma-track-point"
              :style="{ left: `${marker.x}px` }"
              :title="`MA${period} 扣抵：${marker.date} 收盤 ${fmt(marker.value)}`"
            >
              <span class="ma-track-triangle"></span>
              <span class="ma-track-tag">{{ fmt(marker.value) }}</span>
            </div>
          </template>
          <span v-if="!deductionMarkers.some((m) => m.period === period)" class="ma-track-empty">
            {{
              latestDeductions.find((d) => d.period === period)?.value == null
                ? '資料不足'
                : '不在可見範圍'
            }}
          </span>
        </div>
      </div>
    </div>
  </section>
</template>

<script>
  import * as echarts from 'echarts'
  import { markRaw } from 'vue'

  const MA_PERIODS = [5, 10, 20, 60]
  const MA_COLORS = { 5: '#fa646b', 10: '#63a6ff', 20: '#96d17e', 60: '#ffc15d' }
  const toNumber = (v) => {
    if (v === null || v === undefined || String(v).trim() === '') return null
    const n = Number(String(v).replace(/,/g, ''))
    return Number.isFinite(n) ? n : null
  }
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))
  const format = (value, decimals = 2) =>
    value == null ? '—' : Number(value).toLocaleString('zh-TW', { maximumFractionDigits: decimals })
  // KD 使用各週期的高低收價格獨立計算。
  function kdSeries(rows) {
    let k = 50,
      d = 50
    return rows.map((r, i) => {
      let hi = -Infinity,
        lo = Infinity
      for (let j = Math.max(0, i - 8); j <= i; j++) {
        hi = Math.max(hi, rows[j].high)
        lo = Math.min(lo, rows[j].low)
      }
      const rsv = hi === lo ? 50 : clamp(((r.close - lo) / (hi - lo)) * 100, 0, 100)
      k = (k * 2) / 3 + rsv / 3
      d = (d * 2) / 3 + k / 3
      return { k, d, j: 3 * k - 2 * d }
    })
  }
  // 下一根 K 棒更新 MA(N) 時，將離開計算視窗的是目前最近 N 根的第一根。
  function deductedClose(rows, n, atIndex) {
    const index = atIndex - n + 1
    if (index < 0 || index >= rows.length)
      return { period: n, value: null, date: '', index: -1, color: MA_COLORS[n] }
    return {
      period: n,
      value: rows[index].close,
      date: rows[index].date,
      index,
      color: MA_COLORS[n],
    }
  }
  function visibleRange(length, start, end) {
    if (!length) return [0, 0]
    const a = clamp(Math.floor((start / 100) * (length - 1)), 0, length - 1)
    const b = clamp(Math.ceil((end / 100) * (length - 1)), a, length - 1)
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
        chart: null,
        observer: null,
        hoverIndex: null,
        deductionMarkers: [],
        chartSize: { width: 1, height: 1 },
        zoomStart: 0,
        zoomEnd: 100,
        zoomContext: '',
        maVisibility: { 5: true, 10: true, 20: true, 60: true },
        onLegendChanged: null,
        extremesTimer: null,
        resizeFrame: null,
        onZoom: null,
        onAxisPointer: null,
        onChartHover: null,
        onGlobalOut: null,
        onZrMove: null,
        onDragDown: null,
        onDragMove: null,
        onDragUp: null,
        onFinished: null,
        markerFrame: null,
      }
    },
    computed: {
      enabledMaPeriods() {
        return MA_PERIODS.filter((n) => this.maVisibility[n])
      },
      candleRows() {
        const key = {
          day: 'singleStockDayPriceVos',
          week: 'singleStockWeekPriceVos',
          month: 'singleStockMonthPriceVos',
        }[this.selectedView]
        const list = this.stockData?.[key]
        if (!Array.isArray(list)) return []
        return list
          .flatMap((r) => {
            const open = toNumber(r?.openingPrice),
              close = toNumber(r?.closingPrice)
            const high = toNumber(r?.highPrice),
              low = toNumber(r?.lowPrice)
            const date = String(r?.firstTradingDate || r?.tradingDate || '').trim()
            if (!date || [open, close, high, low].some((v) => v === null)) return []
            return [
              {
                date,
                open,
                close,
                high,
                low,
                volume: toNumber(r.tradingVolume),
                ma5: toNumber(r.fiveMa),
                ma10: toNumber(r.tenMa),
                ma20: toNumber(r.twentyMa),
                ma60: toNumber(r.sixtyMa),
              },
            ]
          })
          .sort((a, b) => a.date.localeCompare(b.date))
      },
      kdRows() {
        return kdSeries(this.candleRows)
      },
      displayRow() {
        return this.hoverIndex == null
          ? this.candleRows.at(-1)
          : this.candleRows[this.hoverIndex] || this.candleRows.at(-1)
      },
      displayKd() {
        return this.hoverIndex == null
          ? this.kdRows.at(-1)
          : this.kdRows[this.hoverIndex] || this.kdRows.at(-1)
      },
      latestDeductions() {
        return MA_PERIODS.map((n) => deductedClose(this.candleRows, n, this.candleRows.length - 1))
      },
      visibleExtremes() {
        const rows = this.candleRows
        if (!rows.length) return null
        const [a, b] = visibleRange(rows.length, this.zoomStart, this.zoomEnd)
        let highest = a,
          lowest = a
        for (let i = a + 1; i <= b; i++) {
          if (rows[i].high > rows[highest].high) highest = i
          if (rows[i].low < rows[lowest].low) lowest = i
        }
        return {
          startDate: rows[a].date,
          endDate: rows[b].date,
          high: rows[highest].high,
          highDate: rows[highest].date,
          highIndex: highest,
          low: rows[lowest].low,
          lowDate: rows[lowest].date,
          lowIndex: lowest,
        }
      },
    },
    watch: {
      // 不監聽新的 computed 陣列物件，避免不必要的完整圖表重繪。
      stockData() {
        this.hoverIndex = null
        this.$nextTick(() => this.renderChart())
      },
      selectedStockCode() {
        this.hoverIndex = null
        this.$nextTick(() => this.renderChart())
      },
      selectedView() {
        this.hoverIndex = null
        this.$nextTick(() => this.renderChart())
      },
      isKLineChart() {
        this.$nextTick(() => {
          this.chart?.resize()
          this.scheduleDeductionMarkers()
        })
      },
    },
    mounted() {
      this.chart = markRaw(echarts.init(this.$refs.priceChart, undefined, { renderer: 'canvas' }))
      this.onZoom = (event) => {
        const payload = event?.batch?.[0] ?? event
        let a = Number(payload?.start),
          b = Number(payload?.end)
        if (!Number.isFinite(a) || !Number.isFinite(b)) {
          const z = this.chart?.getOption()?.dataZoom?.find((item) => item.id === 'zoom-inside')
          a = Number(z?.start)
          b = Number(z?.end)
        }
        if (!Number.isFinite(a) || !Number.isFinite(b)) return
        const nextA = clamp(a, 0, 100),
          nextB = clamp(b, nextA, 100)
        if (Math.abs(nextA - this.zoomStart) < 0.0001 && Math.abs(nextB - this.zoomEnd) < 0.0001)
          return
        this.zoomStart = nextA
        this.zoomEnd = nextB
        this.scheduleDeductionMarkers()
        // 不在 dataZoom 回呼中同步 setOption，避免 render-loop 與拖曳卡頓。
        // 更新 Vue 可見區間摘要即可；不要在 dataZoom 事件中 setOption(series)。
      }
      this.onAxisPointer = (event) => {
        const axis =
          event?.axesInfo?.find((x) => x.axisDim === 'x' && x.axisIndex === 0) ||
          event?.axesInfo?.find((x) => x.axisDim === 'x')
        const value = axis?.value
        if (value == null) return
        let i = Number(value)
        if (!Number.isInteger(i)) i = this.candleRows.findIndex((r) => r.date === value)
        if (i >= 0 && i < this.candleRows.length && i !== this.hoverIndex) this.hoverIndex = i
      }
      this.onChartHover = (p) => {
        if (
          Number.isInteger(p?.dataIndex) &&
          p.dataIndex >= 0 &&
          p.dataIndex < this.candleRows.length &&
          this.hoverIndex !== p.dataIndex
        )
          this.hoverIndex = p.dataIndex
      }
      // 滑鼠移動到任何一根 K 棒所在的價格格線時，也要即時更新摘要。
      // 不執行 setOption，避免滑鼠移動造成整張圖重新渲染。
      this.onZrMove = (event) => {
        const chart = this.chart
        if (!chart || chart.isDisposed() || !this.candleRows.length) return
        const x = event.offsetX,
          y = event.offsetY
        if (!Number.isFinite(x) || !Number.isFinite(y)) return
        if (!chart.containPixel({ gridIndex: 0 }, [x, y])) return
        try {
          const point = chart.convertFromPixel({ seriesIndex: 0 }, [x, y])
          if (!Array.isArray(point)) return
          const index = Math.round(Number(point[0]))
          if (
            Number.isInteger(index) &&
            index >= 0 &&
            index < this.candleRows.length &&
            index !== this.hoverIndex
          ) {
            this.hoverIndex = index
          }
        } catch (_) {
          /* 圖表尚未建立座標軸時不更新 */
        }
      }
      // 使用瀏覽器 Pointer Events 拖曳，避免 ZRender/ECharts 的滑鼠事件互相搶奪。
      // pointer capture 可確保游標移出圖表後仍收到移動與放開事件。
      this._dragState = null
      this._dragFrame = null
      this._dragTarget = null
      this.onDragDown = (event) => {
        if (event.button !== 0 || !this.chart || this.chart.isDisposed()) return
        if (!this.candleRows.length) return
        const bounds = this.$refs.priceChart.getBoundingClientRect()
        const point = [event.clientX - bounds.left, event.clientY - bounds.top]
        // 不限制只點中 K 棒；三個繪圖區域都可以按住拖曳。
        if (![0, 1, 2].some((gridIndex) => this.chart.containPixel({ gridIndex }, point))) return
        const width = this.zoomEnd - this.zoomStart
        if (width >= 99.999) return // 先按「最近 30 / 60 / 90 根」或「＋放大」才能平移。
        this._dragState = {
          pointerId: event.pointerId,
          startX: event.clientX,
          start: this.zoomStart,
          end: this.zoomEnd,
        }
        this.$refs.priceChart.setPointerCapture?.(event.pointerId)
        this.$refs.priceChart.style.cursor = 'grabbing'
        event.preventDefault()
      }
      this.onDragMove = (event) => {
        const drag = this._dragState
        if (!drag || event.pointerId !== drag.pointerId || !this.chart || this.chart.isDisposed())
          return
        const plotWidth = Math.max(1, this.chart.getWidth() - 114)
        const width = drag.end - drag.start
        const shift = (-(event.clientX - drag.startX) / plotWidth) * width
        const nextStart = clamp(drag.start + shift, 0, 100 - width)
        const nextEnd = nextStart + width
        // 每一畫格最多派送一個 dataZoom，避免高頻事件塞滿 ECharts Scheduler。
        this._pendingPan = [nextStart, nextEnd]
        if (this._dragFrame !== null) return
        this._dragFrame = requestAnimationFrame(() => {
          this._dragFrame = null
          const next = this._pendingPan
          this._pendingPan = null
          if (next && this.chart && !this.chart.isDisposed()) this.setZoom(next[0], next[1])
        })
        event.preventDefault()
      }
      this.onDragUp = (event) => {
        if (
          !this._dragState ||
          (event?.pointerId !== undefined && event.pointerId !== this._dragState.pointerId)
        )
          return
        // 放開時先套用最後一幀，避免最後位置被丟掉。
        if (this._dragFrame !== null) cancelAnimationFrame(this._dragFrame)
        this._dragFrame = null
        const next = this._pendingPan
        this._pendingPan = null
        if (next && this.chart && !this.chart.isDisposed()) this.setZoom(next[0], next[1])
        if (this.$refs.priceChart?.hasPointerCapture?.(this._dragState.pointerId)) {
          this.$refs.priceChart.releasePointerCapture(this._dragState.pointerId)
        }
        this._dragState = null
        if (this.$refs.priceChart) this.$refs.priceChart.style.cursor = 'grab'
      }
      this.onGlobalOut = () => {
        this.hoverIndex = null
      }
      this.onFinished = () => this.scheduleDeductionMarkers()
      // Legend 是 MA 線與扣抵標記共用的唯一開關，沒有額外的顯示狀態。
      this.onLegendChanged = (event) => {
        const selected = event?.selected || {}
        const next = { ...this.maVisibility }
        for (const n of MA_PERIODS) {
          if (Object.prototype.hasOwnProperty.call(selected, `MA${n}`)) {
            next[n] = selected[`MA${n}`] !== false
          }
        }
        this.maVisibility = next
        // DOM 軌道的數量可能改變，等待 Vue 佈局更新後再定位。
        this.$nextTick(() => this.scheduleDeductionMarkers())
      }
      this.chart.on('legendselectchanged', this.onLegendChanged)
      this.chart.on('finished', this.onFinished)
      this.chart.on('datazoom', this.onZoom)
      this.chart.on('updateAxisPointer', this.onAxisPointer)
      this.chart.on('mouseover', this.onChartHover)
      this.chart.getZr().on('globalout', this.onGlobalOut)
      this.chart.getZr().on('mousemove', this.onZrMove)
      this.$refs.priceChart.addEventListener('pointerdown', this.onDragDown, true)
      this.$refs.priceChart.addEventListener('pointermove', this.onDragMove, true)
      this.$refs.priceChart.addEventListener('pointerup', this.onDragUp, true)
      this.$refs.priceChart.addEventListener('pointercancel', this.onDragUp, true)
      this.$nextTick(() => this.renderChart())
      if (typeof ResizeObserver !== 'undefined') {
        this.observer = new ResizeObserver(() => {
          if (this.resizeFrame != null) return
          this.resizeFrame = requestAnimationFrame(() => {
            this.resizeFrame = null
            if (!this.chart?.isDisposed()) {
              this.chart?.resize()
              this.scheduleDeductionMarkers()
            }
          })
        })
        this.observer.observe(this.$refs.priceChart)
      }
    },
    beforeUnmount() {
      this.observer?.disconnect()
      if (this.extremesTimer !== null) clearTimeout(this.extremesTimer)
      if (this.resizeFrame !== null) cancelAnimationFrame(this.resizeFrame)
      if (this._dragFrame != null) cancelAnimationFrame(this._dragFrame)
      if (this.markerFrame != null) cancelAnimationFrame(this.markerFrame)
      this.$refs.priceChart?.removeEventListener('pointerdown', this.onDragDown, true)
      this.$refs.priceChart?.removeEventListener('pointermove', this.onDragMove, true)
      this.$refs.priceChart?.removeEventListener('pointerup', this.onDragUp, true)
      this.$refs.priceChart?.removeEventListener('pointercancel', this.onDragUp, true)
      if (this.chart) {
        this.chart.off('legendselectchanged', this.onLegendChanged)
        this.chart.off('finished', this.onFinished)
        this.chart.off('datazoom', this.onZoom)
        this.chart.off('updateAxisPointer', this.onAxisPointer)
        this.chart.off('mouseover', this.onChartHover)
        this.chart.getZr().off('globalout', this.onGlobalOut)
        this.chart.getZr().off('mousemove', this.onZrMove)
        this.chart.dispose()
      }
      this.chart = null
    },
    methods: {
      scheduleDeductionMarkers() {
        if (this.markerFrame != null) return
        this.markerFrame = requestAnimationFrame(() => {
          this.markerFrame = null
          this.updateDeductionMarkers()
        })
      },
      updateDeductionMarkers() {
        const chart = this.chart
        if (!chart || chart.isDisposed() || !this.candleRows.length) {
          this.deductionMarkers = []
          return
        }
        // 只透過已存在的價格座標系計算日期的水平座標。
        // 扣抵標籤將放在成交量下方的獨立軌道，絕不蓋住 K 棒。
        const coord = chart.getModel()?.getSeriesByIndex(0)?.coordinateSystem
        if (!coord || typeof coord.dataToPoint !== 'function') {
          this.deductionMarkers = []
          return
        }
        const [start, end] = visibleRange(this.candleRows.length, this.zoomStart, this.zoomEnd)
        const chartWidth = chart.getWidth()
        const chartHeight = chart.getHeight()
        const trackNode = this.$refs.maTracks
        const chartNode = this.$refs.priceChart
        if (!trackNode || !chartNode) return
        // 位置由真實 DOM 幾何取得，防止不同螢幕寬度下虛線與三角形錯位。
        const trackBounds = trackNode.getBoundingClientRect()
        const chartBounds = chartNode.getBoundingClientRect()
        const trackTop = trackBounds.top - chartBounds.top
        const activePeriods = this.enabledMaPeriods
        const rowHeight = trackBounds.height / Math.max(1, activePeriods.length)
        const markers = []
        for (const item of this.latestDeductions) {
          if (
            !this.maVisibility[item.period] ||
            item.value === null ||
            item.index < start ||
            item.index > end
          )
            continue
          const point = coord.dataToPoint([item.index, item.value])
          const x = Array.isArray(point) ? Number(point[0]) : NaN
          const y = Array.isArray(point) ? Number(point[1]) : NaN
          if (!Number.isFinite(x) || !Number.isFinite(y)) continue
          if (x < 54 || x > chartWidth - 60) continue
          const rowIndex = activePeriods.indexOf(item.period)
          const trackY = trackTop + rowHeight * (rowIndex + 0.5)
          markers.push({ ...item, x, y, trackY })
        }
        this.chartSize = { width: chartWidth, height: chartHeight }
        this.deductionMarkers = markers
      },
      changePeriod(period) {
        if (!this.periods.some((p) => p.id === period) || this.selectedView === period) return
        this.selectedView = period
      },
      fmt(v) {
        return format(v)
      },
      maColor(period) {
        return MA_COLORS[period]
      },
      // 不必選中 K 棒：加減按鈕以當前可見區間中央為中心。
      zoomAroundCenter(direction) {
        const length = this.candleRows.length
        if (!length) return
        const a = this.zoomStart
        const b = this.zoomEnd
        const width = Math.max(100 / length, b - a)
        const minWidth = Math.min(100, (5 / length) * 100)
        const nextWidth = clamp(width * (direction === 'in' ? 0.75 : 1.35), minWidth, 100)
        if (Math.abs(nextWidth - width) < 0.001) return
        const center = (a + b) / 2
        const nextStart = clamp(center - nextWidth / 2, 0, 100 - nextWidth)
        this.setZoom(nextStart, nextStart + nextWidth)
      },
      volumeFmt(v) {
        return v == null ? '—' : Number(v).toLocaleString('zh-TW')
      },
      setZoom(start, end) {
        const a = clamp(start, 0, 100),
          b = clamp(end, a, 100)
        this.zoomStart = a
        this.zoomEnd = b
        if (this.chart && !this.chart.isDisposed())
          this.chart.dispatchAction({
            type: 'dataZoom',
            dataZoomId: 'zoom-inside',
            start: a,
            end: b,
          })
        // 更新 Vue 可見區間摘要即可；不要在 dataZoom 事件中 setOption(series)。
      },
      showRecent(n) {
        const size = this.candleRows.length
        if (size) this.setZoom(Math.max(0, ((size - Math.min(size, n)) / size) * 100), 100)
      },
      renderChart() {
        const c = this.chart,
          rows = this.candleRows
        if (!c || c.isDisposed()) return
        if (!rows.length) {
          this.deductionMarkers = []
          c.clear()
          return
        }
        const dates = rows.map((r) => r.date)
        const candles = rows.map((r) => [r.open, r.close, r.low, r.high])
        const volumes = rows.map((r) => ({
          value: r.volume,
          itemStyle: { color: r.close >= r.open ? '#ee565a' : '#1cb29b' },
        }))
        const kd = this.kdRows
        const context = `${this.selectedStockCode}:${this.selectedView}`
        if (this.zoomContext !== context) {
          this.zoomContext = context
          this.zoomStart = Math.max(
            0,
            ((rows.length - Math.min(rows.length, 90)) / rows.length) * 100,
          )
          this.zoomEnd = 100
        }
        const zoomStart = this.zoomStart,
          zoomEnd = this.zoomEnd
        const axisColor = '#9cabb9',
          gridColor = 'rgba(155,176,193,.10)'
        // MA 在沒有 API 均線值時，使用可得收盤價計算；資料不足則保留空值。
        const maValues = (n) =>
          rows.map((r, i) => {
            const apiValue = r[`ma${n}`]
            if (apiValue !== null && apiValue !== 0) return apiValue
            if (i + 1 < n) return null
            let total = 0
            for (let j = i - n + 1; j <= i; j++) total += rows[j].close
            return total / n
          })
        const line = (name, n) => ({
          id: `ma-${n}`,
          name,
          type: 'line',
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: maValues(n),
          smooth: false,
          showSymbol: false,
          connectNulls: false,
          lineStyle: { color: MA_COLORS[n], width: 1.45 },
          itemStyle: { color: MA_COLORS[n] },
          emphasis: { disabled: true },
          animation: false,
        })
        // 暫停 scatter 形式的扣抵 / 極值標籤：在 dataZoom 當下更新這些
        // series 會觸發部分 ECharts 版本的 dataSample / seriesTaskReset 例外。
        // 扣抵與區間高低價仍完整顯示在上方資訊列。
        c.setOption(
          {
            backgroundColor: 'transparent',
            animation: false,
            color: [MA_COLORS[5], MA_COLORS[10], MA_COLORS[20], MA_COLORS[60]],
            legend: {
              top: 6,
              left: 'center',
              textStyle: { color: axisColor },
              selected: Object.fromEntries(MA_PERIODS.map((n) => [`MA${n}`, this.maVisibility[n]])),
              data: ['K 線', 'MA5', 'MA10', 'MA20', 'MA60', 'K(9)', 'D(3)'],
            },
            tooltip: {
              trigger: 'axis',
              axisPointer: { type: 'cross' },
              confine: true,
              backgroundColor: '#111a23',
              borderColor: '#3f586a',
              textStyle: { color: '#e8f1f7' },
              formatter: (params) => {
                const i =
                  params?.find((p) => p.seriesType === 'candlestick')?.dataIndex ??
                  params?.[0]?.dataIndex
                const r = rows[i]
                if (!r) return ''
                return `<b>${r.date}</b><br/>開 ${format(r.open)}　高 ${format(r.high)}<br/>低 ${format(r.low)}　收 ${format(r.close)}<br/>量 ${this.volumeFmt(r.volume)}`
              },
            },
            axisPointer: { link: [{ xAxisIndex: 'all' }], label: { backgroundColor: '#34495b' } },
            grid: [
              { left: 54, right: 60, top: 52, height: '45%' },
              { left: 54, right: 60, top: '58%', height: '9%' },
              { left: 54, right: 60, top: '85%', height: '11%' },
            ],
            xAxis: [
              {
                type: 'category',
                data: dates,
                boundaryGap: true,
                axisLabel: { show: false },
                axisTick: { show: false },
                axisLine: { lineStyle: { color: '#526575' } },
                splitLine: { show: false },
              },
              {
                type: 'category',
                gridIndex: 1,
                data: dates,
                boundaryGap: true,
                axisLabel: { show: false },
                axisTick: { show: false },
                axisLine: { lineStyle: { color: '#526575' } },
                splitLine: { show: false },
              },
              {
                type: 'category',
                gridIndex: 2,
                data: dates,
                boundaryGap: true,
                axisLabel: { color: axisColor, hideOverlap: true },
                axisTick: { show: false },
                axisLine: { lineStyle: { color: '#526575' } },
                splitLine: { show: false },
              },
            ],
            yAxis: [
              {
                type: 'value',
                position: 'right',
                scale: true,
                splitNumber: 5,
                axisLabel: { color: axisColor },
                splitLine: { lineStyle: { color: gridColor } },
                axisLine: { show: false },
              },
              {
                type: 'value',
                gridIndex: 1,
                position: 'right',
                scale: true,
                splitNumber: 2,
                axisLabel: {
                  color: axisColor,
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
                position: 'right',
                min: 0,
                max: 100,
                interval: 50,
                axisLabel: { color: axisColor },
                splitLine: { lineStyle: { color: gridColor } },
                axisLine: { show: false },
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
                zoomOnMouseWheel: false,
                moveOnMouseWheel: false,
                moveOnMouseMove: false,
                preventDefaultMouseMove: false,
                throttle: 60,
              },
            ],
            series: [
              {
                id: 'candles',
                name: 'K 線',
                type: 'candlestick',
                xAxisIndex: 0,
                yAxisIndex: 0,
                data: candles,
                animation: false,
                itemStyle: {
                  color: '#ee565a',
                  color0: '#1cb29b',
                  borderColor: '#ee565a',
                  borderColor0: '#1cb29b',
                },
              },
              line('MA5', 5),
              line('MA10', 10),
              line('MA20', 20),
              line('MA60', 60),
              {
                id: 'volume',
                name: '成交量',
                type: 'bar',
                xAxisIndex: 1,
                yAxisIndex: 1,
                data: volumes,
                barMaxWidth: 12,
                animation: false,
              },
              {
                id: 'kd-k',
                name: 'K(9)',
                type: 'line',
                xAxisIndex: 2,
                yAxisIndex: 2,
                data: kd.map((v) => v.k),
                showSymbol: false,
                animation: false,
                lineStyle: { width: 1.5, color: '#60b2ff' },
                itemStyle: { color: '#60b2ff' },
              },
              {
                id: 'kd-d',
                name: 'D(3)',
                type: 'line',
                xAxisIndex: 2,
                yAxisIndex: 2,
                data: kd.map((v) => v.d),
                showSymbol: false,
                animation: false,
                lineStyle: { width: 1.5, color: '#ffc15d' },
                itemStyle: { color: '#ffc15d' },
              },
            ],
          },
          { notMerge: true, lazyUpdate: false },
        )
        // 僅在資料集或週期改變時做一次完整 setOption；滑鼠移動與縮放不重建圖表。
        c.resize()
        this.scheduleDeductionMarkers()
      },
    },
  }
</script>

<style scoped>
  .kline-card {
    background: #1c252e;
    border: 1px solid #34424e;
    border-radius: 14px;
    padding: 16px;
    color: #e6eef5;
    min-width: 0;
  }
  .kline-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
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
  .period-tabs button,
  .zoom-toolbar button {
    cursor: pointer;
    color: #d7e8f3;
    background: #293844;
    border: 1px solid #405b6d;
    border-radius: 7px;
    padding: 8px 13px;
  }
  .period-tabs button.active {
    color: #a3f4cb;
    background: #205b46;
    border-color: #328161;
  }
  .quote-strip,
  .range-strip {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px 22px;
    margin: 14px 0 6px;
    color: #9ab0c2;
    font-size: 12px;
  }
  .quote-strip b,
  .range-strip b {
    color: #ecf4fa;
    margin-left: 4px;
  }
  .quote-strip .focus {
    color: #94e8c0;
  }
  .quote-strip .high,
  .range-strip .high {
    color: #ff9095;
  }
  .quote-strip .low,
  .range-strip .low {
    color: #5be0b2;
  }
  .range-strip {
    padding: 10px 12px;
    background: #15212b;
    border: 1px solid #344958;
    border-radius: 8px;
  }
  .range-strip small {
    color: #849aaa;
    margin-left: 4px;
  }
  .zoom-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin: 9px 0;
    font-size: 12px;
    color: #9db2c1;
  }
  .zoom-toolbar small {
    color: #859daa;
  }
  .zoom-actions {
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .zoom-action {
    font-weight: 700;
  }

  .chart-host {
    position: relative;
    width: 100%;
    min-width: 0;
  }
  .ma-guide-layer {
    position: absolute;
    top: 0;
    left: 0;
    pointer-events: none;
    z-index: 2;
    overflow: visible;
  }
  /* 隨 MA 圖例狀態顯示扣抵軌道；置於成交量與 KD 之間 */
  .ma-deduction-tracks {
    position: absolute;
    top: 69%;
    height: 13%;
    left: 0;
    right: 0;
    pointer-events: none;
    overflow: hidden;
    border-top: 1px solid rgba(143, 168, 188, 0.18);
    border-bottom: 1px solid rgba(143, 168, 188, 0.18);
    background: rgba(11, 22, 31, 0.28);
  }
  .ma-track-row {
    position: relative;
    border-bottom: 1px dashed rgba(143, 168, 188, 0.12);
  }
  .ma-track-row:last-child {
    border-bottom: 0;
  }
  .ma-track-title {
    position: absolute;
    z-index: 2;
    top: 50%;
    left: 4px;
    transform: translateY(-50%);
    font-size: 10px;
    font-weight: 700;
    color: var(--ma-color);
    background: rgba(18, 32, 44, 0.95);
    padding: 1px 3px;
  }
  .ma-track-point {
    position: absolute;
    top: 50%;
    transform: translate(-6px, -50%);
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--ma-color);
    white-space: nowrap;
  }
  .ma-track-triangle {
    width: 0;
    height: 0;
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-bottom: 10px solid var(--ma-color);
    filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.5));
    flex: none;
  }
  .ma-track-tag {
    color: var(--ma-color);
    background: #14222e;
    border: 1px solid var(--ma-color);
    border-radius: 3px;
    padding: 0 3px;
    font-size: 10px;
    line-height: 15px;
    font-weight: 600;
  }
  .ma-track-empty {
    position: absolute;
    right: 65px;
    top: 50%;
    transform: translateY(-50%);
    color: #7c8c9a;
    font-size: 10px;
  }
  .chart-container {
    width: 100%;
    height: 640px;
    cursor: grab;
    user-select: none;
    touch-action: pan-y;
  }
  .chart-container:active {
    cursor: grabbing;
  }
  .chart-container.empty {
    height: 0;
  }
  .no-data {
    text-align: center;
    color: #a1b2c0;
    padding: 32px 0;
  }
  @media (max-width: 720px) {
    .kline-card {
      padding: 10px;
    }
    .chart-container {
      height: 530px;
    }
  }
</style>
