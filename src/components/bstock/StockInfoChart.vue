<template>
  <section class="margin-card">
    <header class="card-head">
      <div>
        <h2>{{ selectedStockCode }} 資券變化</h2>
        <p>每日融資／融券淨變動；缺值不視為零</p>
      </div>
      <div class="tab-buttons" role="group" aria-label="資券類型">
        <button
          type="button"
          :class="{ active: activeTab === '融資' }"
          :aria-pressed="activeTab === '融資'"
          @click="setActiveTab('融資')"
        >
          融資
        </button>
        <button
          type="button"
          :class="{ active: activeTab === '融券' }"
          :aria-pressed="activeTab === '融券'"
          @click="setActiveTab('融券')"
        >
          融券
        </button>
      </div>
    </header>
    <div v-if="!sortedRows.length" class="no-data">目前沒有資券歷史資料。</div>
    <div v-else>
      <div ref="stockInfoChart" class="chart-container"></div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>交易日期</th>
              <th>融資淨變動</th>
              <th>融券淨變動</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, index) in reversedRows" :key="`${row.tradingDay}-${index}`">
              <td>{{ row.tradingDay }}</td>
              <td :class="changeClass(marginDelta(row))">{{ formatDelta(marginDelta(row)) }}</td>
              <td :class="changeClass(shortDelta(row))">{{ formatDelta(shortDelta(row)) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<script>
  import * as echarts from 'echarts'

  const parseNullableNumber = (v) => {
    if (v === null || v === undefined || String(v).trim() === '') return null
    const num = Number(String(v).replace(/,/g, ''))
    return Number.isFinite(num) ? num : null
  }
  const calcDelta = (a, b, c) => {
    const values = [a, b, c].map(parseNullableNumber)
    if (values.some((v) => v === null)) return null
    return values[0] - values[1] - values[2]
  }
  export default {
    name: 'StockInfoChart',
    props: {
      selectedStockCode: { type: String, default: '' },
      marginShortData: { type: Array, default: () => [] },
    },
    data() {
      return { activeTab: '融資', chart: null, resizeObserver: null }
    },
    computed: {
      sortedRows() {
        // 缺少資券欄位可以是合法紀錄。只有日期無法辨識時才排除。
        return (Array.isArray(this.marginShortData) ? this.marginShortData : [])
          .filter((row) => row && typeof row.tradingDay === 'string' && row.tradingDay.trim())
          .slice()
          .sort((a, b) => a.tradingDay.localeCompare(b.tradingDay))
      },
      reversedRows() {
        return [...this.sortedRows].reverse()
      },
    },
    watch: {
      sortedRows() {
        this.$nextTick(() => {
          this.ensureChart()
          this.renderChart()
        })
      },
      activeTab() {
        this.$nextTick(() => this.renderChart())
      },
    },
    mounted() {
      this.$nextTick(() => {
        this.ensureChart()
        this.renderChart()
      })
    },
    beforeUnmount() {
      this.resizeObserver?.disconnect()
      this.chart?.dispose()
      this.chart = null
    },
    methods: {
      setActiveTab(tab) {
        this.activeTab = tab
      },
      marginDelta(row) {
        return calcDelta(row.marginPurchase, row.marginSales, row.cashRedemption)
      },
      // 使用「融券賣出 - 還券 - 現券償還」作為淨增加量，正數表示融券增加。
      shortDelta(row) {
        return calcDelta(row.shortSale, row.shortConvering, row.stockRedemption)
      },
      formatDelta(value) {
        return value === null ? '—' : `${value > 0 ? '+' : ''}${value.toLocaleString('zh-TW')}`
      },
      changeClass(value) {
        return value === null ? '' : value > 0 ? 'up' : value < 0 ? 'down' : ''
      },
      ensureChart() {
        const element = this.$refs.stockInfoChart
        if (!element || this.chart || !this.sortedRows.length) return
        this.chart = echarts.init(element, 'dark', { renderer: 'canvas' })
        if (typeof ResizeObserver !== 'undefined') {
          this.resizeObserver = new ResizeObserver(() => this.chart?.resize())
          this.resizeObserver.observe(element)
        }
      },
      renderChart() {
        if (!this.sortedRows.length) {
          this.chart?.clear()
          return
        }
        this.ensureChart()
        if (!this.chart) return
        const data = this.sortedRows
        const dates = data.map((row) => row.tradingDay)
        const values = data.map((row) =>
          this.activeTab === '融資' ? this.marginDelta(row) : this.shortDelta(row),
        )
        const zoomStart = Math.max(0, 100 - (Math.min(data.length, 80) / data.length) * 100)
        this.chart.setOption(
          {
            backgroundColor: 'transparent',
            animation: false,
            tooltip: {
              trigger: 'axis',
              axisPointer: { type: 'shadow' },
              backgroundColor: '#101a23',
              borderColor: '#3d5362',
              textStyle: { color: '#e6eff6' },
              formatter: (params) => {
                const p = params?.[0]
                const v = values[p?.dataIndex]
                return `${p?.axisValue || ''}<br/>${this.activeTab}淨變動：${v == null ? '無資料' : this.formatDelta(v)}`
              },
            },
            grid: { left: 52, right: 22, top: 24, bottom: 78, containLabel: true },
            xAxis: {
              type: 'category',
              data: dates,
              axisLine: { lineStyle: { color: '#607384' } },
              axisLabel: { color: '#a9b8c5', hideOverlap: true },
              axisTick: { show: false },
            },
            yAxis: {
              type: 'value',
              scale: true,
              axisLabel: { color: '#a9b8c5' },
              splitLine: { lineStyle: { color: 'rgba(162,184,203,.12)' } },
            },
            dataZoom: [
              { type: 'inside', start: zoomStart, end: 100, filterMode: 'none' },
              {
                type: 'slider',
                start: zoomStart,
                end: 100,
                bottom: 12,
                height: 20,
                showDetail: false,
                borderColor: '#415665',
                backgroundColor: '#14212c',
                fillerColor: 'rgba(84,157,179,.15)',
                textStyle: { color: '#9cadbd' },
              },
            ],
            series: [
              {
                name: this.activeTab,
                type: 'bar',
                barMaxWidth: 14,
                data: values.map((v) => ({
                  value: v,
                  itemStyle: { color: v === null ? 'transparent' : v >= 0 ? '#ef5350' : '#26a69a' },
                })),
                markLine: {
                  silent: true,
                  symbol: ['none', 'none'],
                  label: { show: false },
                  lineStyle: { color: '#81919d', opacity: 0.5 },
                  data: [{ yAxis: 0 }],
                },
              },
            ],
          },
          true,
        )
        this.$nextTick(() => this.chart?.resize())
      },
    },
  }
</script>

<style scoped>
  .margin-card {
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    color: #e6eff6;
    padding: 16px;
    background: #1c252e;
    border: 1px solid #34424e;
    border-radius: 14px;
  }
  .card-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 15px;
    flex-wrap: wrap;
  }
  .card-head h2 {
    margin: 0;
    font-size: 18px;
  }
  .card-head p {
    margin: 5px 0 0;
    color: #8ea5b8;
    font-size: 12px;
  }
  .tab-buttons {
    display: flex;
    gap: 8px;
  }
  .tab-buttons button {
    background: #293844;
    color: #bed0de;
    border: 1px solid #405261;
    padding: 8px 16px;
    border-radius: 7px;
    cursor: pointer;
  }
  .tab-buttons button.active {
    background: #205a46;
    border-color: #347e60;
    color: #9bf0c9;
  }
  .chart-container {
    width: 100%;
    height: 370px;
  }
  .table-wrap {
    max-height: 320px;
    overflow: auto;
    margin-top: 12px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  th,
  td {
    border-bottom: 1px solid #344450;
    padding: 11px 12px;
    text-align: right;
  }
  th:first-child,
  td:first-child {
    text-align: left;
  }
  th {
    position: sticky;
    top: 0;
    background: #263441;
    color: #b7cad9;
  }
  .up {
    color: #ef7d7d;
  }
  .down {
    color: #4bd0af;
  }
  .no-data {
    text-align: center;
    color: #a3b5c4;
    padding: 35px;
  }
</style>
