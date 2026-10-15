<template>
  <section class="kline-card">
    <header class="kline-head">
      <div>
        <h2>{{ selectedStockCode }} 股價走勢</h2>
        <p>價格 · 均線 · 成交量 · KD（按住圖表左右拖曳時間範圍）</p>
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

    <div v-if="candleRows.length" class="deduction-strip" aria-label="均線扣抵價">
      <div class="deduction-heading">
        <strong>MA 扣抵價</strong>
        <small>下一根 K 棒將從均線計算中移出的收盤價（可在圖中找到同色標記）</small>
      </div>
      <div class="deduction-list">
        <div
          v-for="d in latestDeductions"
          :key="d.period"
          class="deduction-chip"
          :style="{ '--ma-color': d.color }"
        >
          <b>MA{{ d.period }}</b>
          <span>{{ d.value === null ? '資料不足' : fmt(d.value) }}</span>
          <small>{{ d.date || '—' }}</small>
        </div>
      </div>
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
      <small>以視窗中央縮放；按住圖表左右拖曳平移；滾輪維持頁面捲動</small>
    </div>

    <div v-if="!candleRows.length" class="no-data">此週期目前沒有有效 K 線資料。</div>
    <div ref="priceChart" class="chart-container" :class="{ empty: !candleRows.length }"></div>
  </section>
</template>

<script>
  import * as echarts from 'echarts'

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
        zoomStart: 0,
        zoomEnd: 100,
        zoomContext: '',
        extremesTimer: null,
        resizeFrame: null,
        onZoom: null,
        onAxisPointer: null,
        onChartHover: null,
        onGlobalOut: null,
        onZrMove: null,
      }
    },
    computed: {
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
        this.$nextTick(() => this.chart?.resize())
      },
    },
    mounted() {
      this.chart = echarts.init(this.$refs.priceChart, undefined, { renderer: 'canvas' })
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
        // 不在 dataZoom 回呼中同步 setOption，避免 render-loop 與拖曳卡頓。
        this.queueExtremeUpdate()
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
      this.onGlobalOut = () => {
        this.hoverIndex = null
      }
      this.chart.on('datazoom', this.onZoom)
      this.chart.on('updateAxisPointer', this.onAxisPointer)
      this.chart.on('mouseover', this.onChartHover)
      this.chart.getZr().on('globalout', this.onGlobalOut)
      this.chart.getZr().on('mousemove', this.onZrMove)
      this.$nextTick(() => this.renderChart())
      if (typeof ResizeObserver !== 'undefined') {
        this.observer = new ResizeObserver(() => {
          if (this.resizeFrame != null) return
          this.resizeFrame = requestAnimationFrame(() => {
            this.resizeFrame = null
            if (!this.chart?.isDisposed()) this.chart?.resize()
          })
        })
        this.observer.observe(this.$refs.priceChart)
      }
    },
    beforeUnmount() {
      this.observer?.disconnect()
      if (this.extremesTimer !== null) clearTimeout(this.extremesTimer)
      if (this.resizeFrame !== null) cancelAnimationFrame(this.resizeFrame)
      if (this.chart) {
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
      changePeriod(period) {
        if (!this.periods.some((p) => p.id === period) || this.selectedView === period) return
        this.selectedView = period
      },
      fmt(v) {
        return format(v)
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
      queueExtremeUpdate() {
        if (this.extremesTimer !== null) clearTimeout(this.extremesTimer)
        this.extremesTimer = setTimeout(() => {
          this.extremesTimer = null
          this.updateExtremeMarkers()
        }, 240)
      },
      updateExtremeMarkers() {
        const c = this.chart,
          e = this.visibleExtremes
        if (!c || c.isDisposed() || !e) return
        // 僅更新兩個資料點，不重新計算 MA/KD 或重建圖表。
        c.setOption(
          {
            series: [
              {
                id: 'range-high',
                type: 'scatter',
                xAxisIndex: 0,
                yAxisIndex: 0,
                data: [[e.highDate, e.high]],
              },
              {
                id: 'range-low',
                type: 'scatter',
                xAxisIndex: 0,
                yAxisIndex: 0,
                data: [[e.lowDate, e.low]],
              },
            ],
          },
          { lazyUpdate: true },
        )
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
        this.queueExtremeUpdate()
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
        const extremes = this.visibleExtremes
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
        const labelMarker = (d, order) => ({
          id: `deduct-${d.period}`,
          name: `MA${d.period}扣抵`,
          type: 'scatter',
          xAxisIndex: 0,
          yAxisIndex: 0,
          silent: true,
          z: 18,
          animation: false,
          symbol: 'diamond',
          symbolSize: 9,
          itemStyle: { color: d.color, borderColor: '#1b2631', borderWidth: 1 },
          data: d.value == null ? [] : [[d.date, d.value]],
          label: {
            show: d.value != null,
            position: order % 2 ? 'bottom' : 'top',
            distance: 9,
            formatter: () => `MA${d.period}扣 ${format(d.value)}`,
            color: d.color,
            fontSize: 10,
            padding: [3, 5],
            borderRadius: 4,
            backgroundColor: 'rgba(19,29,40,.94)',
          },
          emphasis: { disabled: true },
        })
        const extremeMarker = (id, name, position, color, price, date) => ({
          id,
          name,
          type: 'scatter',
          xAxisIndex: 0,
          yAxisIndex: 0,
          silent: true,
          z: 25,
          symbol: 'circle',
          symbolSize: 7,
          animation: false,
          itemStyle: { color, borderColor: '#1c252e', borderWidth: 1 },
          data: date ? [[date, price]] : [],
          label: {
            show: true,
            position,
            distance: 8,
            formatter: () => `${name} ${format(price)}`,
            color,
            fontSize: 11,
            fontWeight: 'bold',
            backgroundColor: '#17232d',
            borderRadius: 4,
            padding: [4, 6],
          },
          emphasis: { disabled: true },
        })
        c.setOption(
          {
            backgroundColor: 'transparent',
            animation: false,
            color: [MA_COLORS[5], MA_COLORS[10], MA_COLORS[20], MA_COLORS[60]],
            legend: {
              top: 6,
              left: 'center',
              textStyle: { color: axisColor },
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
              { left: 54, right: 60, top: 52, height: '49%' },
              { left: 54, right: 60, top: '63%', height: '10%' },
              { left: 54, right: 60, top: '78%', height: '12%' },
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
                moveOnMouseMove: true,
                preventDefaultMouseMove: true,
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
              extremeMarker(
                'range-high',
                '最高',
                'top',
                '#ff9c9c',
                extremes?.high,
                extremes?.highDate,
              ),
              extremeMarker(
                'range-low',
                '最低',
                'bottom',
                '#65e1b2',
                extremes?.low,
                extremes?.lowDate,
              ),
              ...this.latestDeductions.map(labelMarker),
            ],
          },
          { notMerge: true, lazyUpdate: false },
        )
        // 僅在資料集或週期改變時做一次完整 setOption；滑鼠移動與縮放不重建圖表。
        c.resize()
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
  .deduction-strip {
    margin: 12px 0;
    padding: 12px;
    border: 1px solid #344958;
    background: #15212b;
    border-radius: 9px;
  }
  .deduction-heading {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    align-items: baseline;
    margin-bottom: 10px;
  }
  .deduction-heading strong {
    font-size: 13px;
    color: #e9f3fa;
  }
  .deduction-heading small {
    color: #93a9bc;
    font-size: 11px;
  }
  .deduction-list {
    display: flex;
    flex-wrap: wrap;
    gap: 9px;
  }
  .deduction-chip {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 7px 9px;
    border: 1px solid #405365;
    border-left: 3px solid var(--ma-color);
    border-radius: 6px;
    background: #1d2d3a;
    font-size: 12px;
  }
  .deduction-chip b {
    color: var(--ma-color);
  }
  .deduction-chip small {
    color: #93aabc;
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

  .chart-container {
    width: 100%;
    height: 640px;
    cursor: grab;
    user-select: none;
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
