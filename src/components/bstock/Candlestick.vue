<template>
  <div class="stock-query-container">
    <div class="view-toggle" v-if="isKLineChart">
      <div
        :class="['view-option', { selected: selectedView === 'day' }]"
        @click="selectView('day')"
      >
        日K線
      </div>
      <div
        :class="['view-option', { selected: selectedView === 'week' }]"
        @click="selectView('week')"
      >
        周K線
      </div>
      <div
        :class="['view-option', { selected: selectedView === 'month' }]"
        @click="selectView('month')"
      >
        月K線
      </div>
    </div>

    <!-- 表格與圖表區域 -->
    <div v-show="isKLineChart" class="content-section">
      <!-- 表格容器 -->
      <div v-if="tableData.length" class="data-table-container">
        <table>
          <thead>
            <tr>
              <th>日期</th>
              <th>開盤價</th>
              <th>收盤價</th>
              <th>最低價</th>
              <th>最高價</th>
              <th>成交量</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, index) in tableData.slice(0, 1)" :key="index">
              <td>{{ row.tradingDate }}</td>
              <td>{{ row.open }}</td>
              <td>{{ row.close }}</td>
              <td>{{ row.low }}</td>
              <td>{{ row.high }}</td>
              <td>{{ row.volume }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 蠟燭圖容器 -->
      <div id="priceChart" ref="priceChart" class="chart-container"></div>
    </div>
  </div>
</template>

<script>
  import * as echarts from 'echarts'

  export default {
    name: 'Candlestick',

    data() {
      return {
        tableData: [],
        stockCode: '',
        selectedView: 'day', // 默認為日視角
      }
    },
    props: {
      isKLineChart: {
        //是否為 K 線圖模式，默認為 true
        type: Boolean,
        required: true,
      },
      selectedStockCode: {
        type: String,
        default: null,
      },
      stockData: {
        type: Object,
        required: true,
        default: () => ({}),
      },
    },

    watch: {
      stockData: {
        handler() {
          this.updateChartData() // 執行你的邏輯
        },
      },
      selectedStockCode: {
        handler(value) {
          this.stockCode = value
        },
      },
    },
    mounted() {
      this.priceChart = echarts.init(this.$refs.priceChart)
      this.renderChart()
    },
    computed: {
      computedIsKLineChart() {
        return this.isKLineChart
      },
    },
    methods: {
      switchTab(tab) {
        this.isKLineChart = tab === 'kline'
      },
      selectView(view) {
        this.selectedView = view
        this.updateChartData()
        console.log('切換到:', view)
      },

      updateChartData() {
        const { singleStockDayPriceVos, singleStockWeekPriceVos, singleStockMonthPriceVos } =
          this.stockData

        // 組織資料結構
        const localStockData = {
          day: singleStockDayPriceVos.sort(
            (a, b) => new Date(a.tradingDate) - new Date(b.tradingDate),
          ),
          week: singleStockWeekPriceVos.sort(
            (a, b) => new Date(a.tradingDate) - new Date(b.tradingDate),
          ),
          month: singleStockMonthPriceVos.sort(
            (a, b) => new Date(a.tradingDate) - new Date(b.tradingDate),
          ),
        }

        // 根據當前選擇的視角（day、week、month）選擇資料
        if (!localStockData || !localStockData.day) return
        let selectedData
        switch (this.selectedView) {
          case 'day':
            selectedData = localStockData.day
            break
          case 'week':
            selectedData = localStockData.week
            break
          case 'month':
            selectedData = localStockData.month
            break
          default:
            console.error('未知的視角選擇：', this.selectedView)
            return
        }

        // 確保選擇的資料存在
        if (!selectedData || selectedData.length === 0) {
          console.warn(`無法獲取 ${this.selectedView} 資料`)
          this.tableData = []
          return
        }

        // 提取日期、價格和成交量
        const dates = selectedData.map((item) =>
          this.selectedView === 'day' ? item.tradingDate : item.firstTradingDate,
        )
        const prices = selectedData.map((item) => [
          parseFloat(item.openingPrice),
          parseFloat(item.closingPrice),
          parseFloat(item.lowPrice),
          parseFloat(item.highPrice),
        ])
        const volumes = selectedData.map((item) =>
          item.tradingVolume !== null ? parseFloat(item.tradingVolume) : 0,
        )

        const ma5 = selectedData.map((item) => (item.fiveMa == 0 ? null : item.fiveMa))
        const ma10 = selectedData.map((item) => (item.tenMa == 0 ? null : item.tenMa))
        const ma20 = selectedData.map((item) => (item.twentyMa == 0 ? null : item.twentyMa))
        const ma60 = selectedData.map((item) => (item.sixtyMa == 0 ? null : item.sixtyMa))

        // 更新圖表
        this.renderChart(dates, prices, volumes, ma5, ma10, ma20, ma60)
      },

      renderChart(dates, prices, volumes, ma5, ma10, ma20, ma60) {
        if (!prices || !Array.isArray(prices)) return

        const calcVisibleRange = () => {
          const zoom =
            this.priceChart &&
            this.priceChart.getOption &&
            this.priceChart.getOption() &&
            Array.isArray(this.priceChart.getOption().dataZoom)
              ? this.priceChart.getOption().dataZoom[0]
              : { start: 0, end: 100 }

          const startIndex = Math.round((zoom.start / 100) * (prices.length - 1))
          const endIndex = Math.round((zoom.end / 100) * (prices.length - 1))

          const visiblePrices = prices.slice(startIndex, endIndex + 1)
          const highs = visiblePrices.map((p) => p[3])
          const lows = visiblePrices.map((p) => p[2])
          const maxVisible = Math.max(...highs)
          const minVisible = Math.min(...lows)
          const padding = (maxVisible - minVisible) * 0.1

          return {
            yMin: minVisible - padding,
            yMax: maxVisible + padding,
            maxVisible,
            minVisible,
          }
        }

        const { yMin, yMax} = calcVisibleRange()

        const option = {
          title: {
            text: `股票價格 - ${this.stockCode}`,
            left: 'left',
          },
          tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'cross' },
            formatter: (params) => {
              setTimeout(() => this.updateTableData(params, volumes), 0)
              return `${params[0].axisValue}<br/>`
            },
          },
          legend: { data: ['日K', 'MA5', 'MA10', 'MA20', 'MA60'] },
          grid: { left: '10%', right: '10%', bottom: '15%', top: '8%' },
          xAxis: {
            type: 'category',
            data: dates,
            scale: true,
            boundaryGap: false,
            axisLine: { onZero: false },
            splitLine: { show: false },
            min: 'dataMin',
            max: 'dataMax',
          },
          yAxis: {
            scale: true,
            splitNumber: 10,
            min: yMin,
            max: yMax,
            splitArea: { show: true },
          },
          dataZoom: [
            {
              type: 'slider',
              start: 60,
              end: 100,
              textStyle: { color: '#8392A5' },
              handleIcon:
                'path://M10.7,11.9v-1.3H9.3v1.3c-4.9,0.3-8.8,4.4-8.8,9.4c0,5,3.9,9.1,8.8,9.4v1.3h1.3v-1.3c4.9-0.3,8.8-4.4,8.8-9.4C19.5,16.3,15.6,12.2,10.7,11.9z M13.3,24.4H6.7V23h6.6V24.4z M13.3,19.6H6.7v-1.4h6.6V19.6z',
            },
            {
              id: 'dataZoomX',
              type: 'inside',
              start: 60,
              end: 100,
              realtime: true,
              xAxisIndex: [0],
            },
          ],
          series: [
            {
              name: '日K',
              type: 'candlestick',
              data: prices,
              itemStyle: {
                color: '#ec0000',
                color0: '#00da3c',
                borderColor: '#8A0000',
                borderColor0: '#008F28',
              },
              markPoint: {
                symbol: 'circle',
                symbolSize: 1,
                label: {
                  show: true,
                  formatter: (param) => `${param.value}`,
                  fontSize: 12,
                  fontWeight: 'bold',
                },
                itemStyle: { color: 'transparent' },
                data: [
                  {
                    name: '',
                    type: 'max',
                    valueDim: 'highest',
                    label: {
                      position: 'top',
                      color: '#ffcc66',
                    },
                  },
                  {
                    name: '',
                    type: 'min',
                    valueDim: 'lowest',
                    label: {
                      position: 'bottom',
                      color: '#66ccff',
                    },
                  },
                ],
              },
            },
            {
              name: 'MA5',
              type: 'line',
              data: ma5,
              smooth: true,
              symbol: 'none',
              lineStyle: { width: 1.5, opacity: 0.5 },
            },
            {
              name: 'MA10',
              type: 'line',
              data: ma10,
              smooth: true,
              symbol: 'none',
              lineStyle: { width: 1.5, opacity: 0.5 },
            },
            {
              name: 'MA20',
              type: 'line',
              data: ma20,
              smooth: true,
              symbol: 'none',
              lineStyle: { width: 1.5, opacity: 0.5 },
            },
            {
              name: 'MA60',
              type: 'line',
              data: ma60,
              smooth: true,
              symbol: 'none',
              lineStyle: { width: 1.5, opacity: 0.5 },
            },
          ],   
        }

        // 設定圖表
        this.priceChart.setOption(option)
        this.priceChart.resize()

        // 動態更新視圖範圍
        const updateVisibleExtremes = () => {
          const { yMin, yMax} = calcVisibleRange()
          this.priceChart.setOption(
            {
              yAxis: { min: yMin, max: yMax },

            },
            false,
          )
        }

        //  只註冊一次 dataZoom 事件
        if (!this.priceChart._zoomListenerAdded) {
          this.priceChart.on('dataZoom', updateVisibleExtremes)
          this.priceChart._zoomListenerAdded = true
        }

        // 初始化立即執行（避免首次不顯示）
        updateVisibleExtremes()
      },

      updateTableData(params, volumes) {
        this.tableData = params
          .filter((param) => param?.data && param.data.length > 0)
          .map((param) => ({
            tradingDate: param.axisValue,
            open: param.data[1],
            close: param.data[2],
            low: param.data[4],
            high: param.data[3],
            volume: volumes[params[0].dataIndex] || 0,
          }))
      },
    },
  }
</script>

<style scoped>
  /* 頁籤區域樣式 */
  .tab-section {
    display: flex;
    margin-bottom: 15px;
    gap: 10px;
  }

  .tab {
    flex: 1;
    text-align: center;
    padding: 10px;
    cursor: pointer;
    background-color: #383838;
    color: white;
    border-radius: 5px;
    transition: background-color 0.3s;
  }

  .tab.active {
    background-color: #4caf50;
    color: white;
  }

  /* 日K線、周K線、月K線選項樣式 */
  .view-toggle {
    display: flex;
    justify-content: center;
    gap: 15px;
    margin-bottom: 15px;
  }

  .view-option {
    padding: 8px 12px;
    cursor: pointer;
    background-color: #383838;
    color: white;
    border-radius: 5px;
    transition: background-color 0.3s;
  }

  .view-option.selected {
    background-color: #4caf50;
  }

  /* 表格容器樣式 */
  .data-table-container {
    margin-bottom: 15px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 10px;
  }

  th,
  td {
    border: 1px solid #ddd;
    padding: 8px;
    text-align: center;
  }

  th {
    background-color: #4caf50;
    color: white;
  }

  .chart-container {
    height: 400px;
    background-color: #2c2c2c;
  }
</style>
