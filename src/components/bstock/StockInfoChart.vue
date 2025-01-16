<template>
  <div class="stock-info-chart-container">
    <div class="tab-section">
      <button
        class="tab-button"
        :class="{ active: activeTab === '融資' }"
        @click="setActiveTab('融資')"
      >
        融資
      </button>
      <button
        class="tab-button"
        :class="{ active: activeTab === '融券' }"
        @click="setActiveTab('融券')"
      >
        融券
      </button>
    </div>
    <div
      v-show="this.localMarginShortData.length"
      id="stock-info-chart"
      ref="stockInfoChart"
      class="chart-container"
    ></div>
    <div class="table-container">
      <div class="scrollable-table-wrapper">
        <table v-if="this.localMarginShortData.length" class="stock-info-table">
          <thead>
            <tr>
              <th>交易日期</th>
              <th>融資餘額變動</th>
              <th>融券餘額變動</th>
            </tr>
          </thead>
          <tbody>
            <!-- 動態生成資料列 -->
            <tr v-for="(item, index) in reversedMarginShortData" :key="index">
              <td>{{ item.tradingDay }}</td>
              <td
                :style="{
                  color: getColor(item.marginPurchase - item.marginSales - item.cashRedemption),
                }"
              >
                {{ item.marginPurchase - item.marginSales - item.cashRedemption }}
              </td>
              <td
                :style="{
                  color: getColor(item.shortSale - item.shortConvering - item.stockRedemption),
                }"
              >
                {{ item.shortSale - item.shortConvering - item.stockRedemption }}
              </td>
            </tr>
          </tbody>
        </table>
        <!-- 當沒有資料時顯示提示 -->
        <div v-else class="no-data-message">
          <p>🌿 暫無數據 🌿</p>
          <p>或許，市場正在醞釀著下一次波動的契機。</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import * as echarts from 'echarts'
export default {
  name: 'StockInfoChart',
  props: {
    selectedStockCode: {
      type: String,
      default: null,
    },
    marginShortData: {
      type: Object,
      required: true,
      default: () => ({}),
    },
  },
  computed: {
    reversedMarginShortData() {
      return this.localMarginShortData.slice().reverse()
    },
  },
  data() {
    return {
      chart: null,
      activeTab: '融資', // 預設顯示融資
      localMarginShortData: [],
    }
  },

  watch: {
    marginShortData: {
      handler(value) {
        if (!value) return // 確保數據存在
        this.localMarginShortData = [...value]
        this.updateChartData(this.localMarginShortData)
      },
    },
    selectedStockCode: {
      handler(value) {
        console.log(value)
      },
    },
  },
  mounted() {
    //確保 DOM 完全準備好後再初始化圖表
    this.$nextTick(() => {
      this.initChart()
      const resizeObserver = new ResizeObserver(() => {
      this.resizeChart();
    });
    resizeObserver.observe(this.$refs.stockInfoChart.parentElement);
      this.updateChartData(this.localMarginShortData)
    })
  },
  methods: {
    getColor(value) {
      if (value > 0) return '#f44336' // 紅色
      if (value < 0) return '#4caf50' // 綠色
      return '#000000' // 黑色
    },

    renderChart(
      dates,
      marginPurchaseList,
      marginSalesList,
      cashRedemptionList,
      shortSalesList,
      shortConveringList,
      stockRedemptionList,
    ) {
      let values = []

      switch (this.activeTab) {
        case '融資':
          console.log('融資')
          // 融資情況下計算 values
          values = dates.map(
            (_, index) =>
              marginPurchaseList[index] - marginSalesList[index] - cashRedemptionList[index],
          )
          break

        case '融券':
          console.log('融券')
          // 融券情況下計算 values
          values = dates.map(
            (_, index) =>
              shortConveringList[index] - stockRedemptionList[index] - shortSalesList[index],
          )
          break

        default:
          console.error('Unknown activeTab value:', this.activeTab)
          break
      }

      const option = {
        tooltip: {
          trigger: 'item',
          formatter: (params) => {
            return '日期:' + params.name + '<br>' + '數值:' + params.value
          },
        },
        xAxis: {
          type: 'category',
          data: dates,
          axisLabel: {
            color: '#fff',
          },
          axisLine: {
            lineStyle: {
              color: '#ccc',
            },
          },
        },
        yAxis: {
          type: 'value',
          axisLabel: {
            color: '#fff',
          },
          axisLine: {
            lineStyle: {
              color: '#ccc',
            },
          },
          splitLine: {
            lineStyle: {
              color: 'rgba(255, 255, 255, 0.1)',
            },
          },
        },
        series: [
          {
            name: this.activeTab,
            type: 'bar',
            data: values,
            itemStyle: {
              color: (params) => {
                return this.getColor(params.value) // 紅色為正數，綠色為負數
              },
            },
          },
        ],
        backgroundColor: '#2c2c2c',
        // 加入 Zoom 功能
        dataZoom: [
          {
            type: 'slider', // 滑動條
            show: true,
            realtime: true,
            start: 60, // 初始範圍
            end: 100, // 初始範圍
            xAxisIndex: 0, // 關聯的 X 軸
          },
          {
            type: 'inside', // 滑動滾輪放大
            realtime: true,
            start: 0,
            end: 100,
          },
          {
            // 內部滾動縮放
            id: 'dataZoomX',
            type: 'inside',
            start: 60, // 數據範圍起始百分比
            end: 100, // 數據範圍結束百分比
            realtime: true, // 開啟實時更新
            filterMode: 'weakFilter', // 允許部分數據在縮放範圍內顯示
            xAxisIndex: [0], // 應用到第一個 xAxis
          },
        ],
      }

      this.chart.setOption(option)
    },
    setActiveTab(tab) {
      this.activeTab = tab
      this.updateChartData(this.localMarginShortData)
    },
    initChart() {
      const chartContainer = this.$refs.stockInfoChart

      // 动态获取容器的宽度
      const containerWidth = chartContainer.parentElement.offsetWidth

      // 设置宽度为容器宽度，高度可以固定
      chartContainer.style.width = `${containerWidth}px`
      chartContainer.style.height = '400px'

      // 初始化图表
      this.chart = echarts.init(chartContainer)
    },

    resizeChart() {
    const chartContainer = this.$refs.stockInfoChart;

    // 动态获取父容器的宽度
    const containerWidth = chartContainer.parentElement.offsetWidth;

    // 更新容器宽度并触发图表调整
    chartContainer.style.width = `${containerWidth}px`;
    chartContainer.style.height = '400px'; // 高度保持固定
    if (this.chart) {
      this.chart.resize();
    }
  },

    updateChartData(localMarginShortData) {
      if (!localMarginShortData || localMarginShortData.length === 0) {
        console.warn('localMarginShortData is null or empty. Skipping update.')
        return
      }
      const sortedData = localMarginShortData.sort(
        (a, b) => new Date(a.tradingDay) - new Date(b.tradingDay),
      )
      const dates = sortedData.map((item) => item.tradingDay)
      const marginPurchaseList = sortedData.map((item) => item.marginPurchase)
      const marginSalesList = sortedData.map((item) => item.marginSales)
      const cashRedemptionList = sortedData.map((item) => item.cashRedemption)
      const shortSaleList = sortedData.map((item) => item.shortSale)
      const shortConveringList = sortedData.map((item) => item.shortConvering)
      const stockRedemptionList = sortedData.map((item) => item.stockRedemption)
      this.renderChart(
        dates,
        marginPurchaseList,
        marginSalesList,
        cashRedemptionList,
        shortSaleList,
        shortConveringList,
        stockRedemptionList,
      )
    },
    resizeChart() {
      console.log('chart 被 要重製')
      if (this.chart) {
        this.chart.resize()
        console.log('chart 已被重製')
      }
    },
  },
  beforeDestroy() {
    if (this.chart) {
      this.chart.dispose()
    }
  },
}
</script>

<style scoped>
.stock-info-chart-container {
  width: 100%;
  height: 100%;
  padding: 10px;
  background-color: #2c2c2c;
  color: #fff;
  border-radius: 8px;
}

.chart-container {
  width: 100%;
  height: 400px;
}

.tab-section {
  display: flex;
  justify-content: center;
  margin-bottom: 10px;
}

.tab-button {
  padding: 10px 20px;
  margin: 0 5px;
  background-color: #383838;
  color: #fff;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  transition:
    background-color 0.3s,
    transform 0.3s;
}

.tab-button:hover {
  background-color: #4caf50;
  transform: translateY(-2px);
}

.tab-button.active {
  background-color: #66bb6a;
  font-weight: bold;
}

.scrollable-table-wrapper {
  max-height: 250px;
  overflow-y: auto;
  border: 1px solid #585858;
  border-radius: 8px;
}

.table-container {
  background: linear-gradient(to bottom, #b8aaaa, #fefefe);
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
  max-width: 800px;
  margin: 20px auto;
  font-family: 'Georgia', serif;
}

.stock-info-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 16px;
  color: #333;
}

.stock-info-table thead {
  background: rgb(146, 143, 143);
  border-bottom: 2px solid #ddd;
}

.stock-info-table th {
  padding: 12px;
  font-weight: bold;
  text-align: center;
}

.stock-info-table td {
  padding: 10px;
  border-bottom: 1px solid #eee;
  text-align: center;
}

.stock-info-table tr:hover {
  background: #f9f9f9;
}

.no-data-message {
  text-align: center;
  color: #555;
  font-style: italic;
  margin-top: 20px;
  font-size: 18px;
}

.no-data-message p {
  margin: 5px 0;
}
</style>
