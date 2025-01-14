<template>
  <div class="stock-info-chart-container">
    <h3>資券訊息</h3>
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
    <div id="stock-info-chart" ref="stockInfoChart" class="chart-container"></div>
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
      this.updateChartData(this.localMarginShortData)
    })
  },
  methods: {
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
              shortSalesList[index] - shortConveringList[index] - stockRedemptionList[index],
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
            // 確保顯示對應的 X 軸數據和系列數據
            return `日期: ${params.name}<br>數值: ${params.value}`
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
                return params.value >= 0 ? '#f44336' : '#4caf50' // 紅色為正數，綠色為負數
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
      this.chart = echarts.init(this.$refs.stockInfoChart)
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
      if (this.chart) {
        this.chart.resize()
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
</style>
