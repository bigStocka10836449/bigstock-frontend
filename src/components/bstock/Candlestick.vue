<template>
  <div class="stock-query-container">
    <div class="input-section">
  <input type="text" v-model="stockCode" placeholder="請輸入股票代碼" />
  <div>
    <button @click="fetchStockData">查詢</button>
    <button @click="fetchToken">獲取 Token</button>
  </div>
  <div class="tab-section">
    <label>
      <input type="radio" name="chartType" @click="showKLineChart" checked />
      K線圖
    </label>
    <label>
      <input type="radio" name="chartType" @click="showInfoChart" />
      資券訊息
    </label>
  </div>
  <div class="view-toggle" v-if="isKLineChart">
    <label>
      <input
        type="radio"
        value="day"
        v-model="selectedView"
        @change="selectView('day')"
      />
      日
    </label>
    <label>
      <input
        type="radio"
        value="week"
        v-model="selectedView"
        @change="selectView('week')"
      />
      週
    </label>
    <label>
      <input
        type="radio"
        value="month"
        v-model="selectedView"
        @change="selectView('month')"
      />
      月
    </label>
  </div>
</div>

    <div class="content-section">
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
import apiClient from '../../router/BstockAxios'

export default {
  name: 'StockQueryPage',
  data() {
    return {
      stockCode: '',
      startDate: '',
      endDate: '',
      stockData: [],
      tableData: [],
      selectedView: 'day', // 默認為日視角
      isKLineChart: false, // 是否為 K 線圖模式，默認為 true
    }
  },
  props: {
    outerStockCode: {
      type: String,
      default: null,
    },
  },

  watch: {
    outerStockCode: {
      immediate: true, // 保證初始化時執行一次
      handler(newStockCode) {
        console.log("更新蠟燭圖，股票代碼:", newStockCode);
        this.fetchStockData(newStockCode); // 執行你的邏輯
      },
    },
  },
    created() {
      // 無論 outerStockCode 是否變化，初始化時手動調用一次
      if (this.outerStockCode) {
        this.fetchStockData(this.outerStockCode);
      }
    },

  mounted() {
    this.priceChart = echarts.init(this.$refs.priceChart)
    this.renderChart()
  },
  computed: {
    computedIsKLineChart() {
      return this.isKLineChart;
    },
  },
  methods: {
    showKLineChart() {
      this.isKLineChart = true
    },

    // 切換到 資券訊息 模式
    showInfoChart() {
      this.isKLineChart = false
    },
    fetchStockData(excuceStockCode = this.stockCode) {
      if (!excuceStockCode) {
        console.error('請輸入股票代碼')
        return
      }
      // 格式化 startDate 和 endDate 成為 YYYY-MM-DDTHH:mm:ss.sssZ 格式
      const formattedStartDate = this.startDate ? new Date(this.startDate).toISOString() : ''
      const formattedEndDate = this.endDate ? new Date(this.endDate).toISOString() : ''

      const token = sessionStorage.getItem('authToken')
      apiClient
        .post(
          '/gateway/SingleStockPrice',
          {
            stockCode: excuceStockCode,
            searchStartDate: formattedStartDate,
            searchEndDate: formattedEndDate,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        )
        .then((response) => {
          const { singleStockDayPriceVos, singleStockWeekPriceVos, singleStockMonthPriceVos } =
            response.data

          // 組織資料結構
          this.stockData = {
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

          // 儲存到 sessionStorage
          const cachedData = JSON.parse(sessionStorage.getItem('cachedStockData')) || {}
          cachedData[this.stockCode] = {
            stockData: this.stockData,
          }
          sessionStorage.setItem('cachedStockData', JSON.stringify(cachedData))

          // 更新圖表
          this.updateChartData()
        })
    },
    fetchToken() {
      return apiClient
        .get('/auth/tempToken')
        .then((response) => {
          const token = response.data.token
          if (token) {
            console.log('Token:', token)
            sessionStorage.setItem('authToken', token)
          } else {
            console.error('Token not found in response:', response.data)
          }
        })
        .catch((error) => {
          console.error('Error fetching token:', error)
        })
    },
    updateChartData() {
      // 根據當前選擇的視角（day、week、month）選擇資料
      if (!this.stockData || !this.stockData.day) return;
      let selectedData
      switch (this.selectedView) {
        case 'day':
          selectedData = this.stockData.day
          break
        case 'week':
          selectedData = this.stockData.week
          break
        case 'month':
          selectedData = this.stockData.month
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
       this.selectedView === 'day' ? item.tradingDate : item.firstTradingDate
      )
      const prices = selectedData.map((item) => [
        parseFloat(item.openingPrice),
        parseFloat(item.closingPrice),
        parseFloat(item.lowPrice),
        parseFloat(item.highPrice),
      ])
      const volumes = selectedData.map((item) =>
      item.tradingVolume !== null ? parseFloat(item.tradingVolume) : 0
      )

      const ma5 = selectedData.map((item) => item.fiveMa  == 0 ? null:item.fiveMa ); 
      const ma10 = selectedData.map((item) => item.tenMa == 0 ? null:item.tenMa ); 
      const ma20 = selectedData.map((item) => item.twentyMa == 0 ? null:item.twentyMa ); 
      const ma60 = selectedData.map((item) => item.sixtyMa == 0 ?null:item.sixtyMa );

      // 更新圖表
      this.renderChart(dates, prices, volumes, ma5, ma10, ma20, ma60)

      // 更新表格
      this.tableData = selectedData
    },

    selectView(view) {
      this.selectedView = view // 更新當前視角
      this.updateChartData() // 根據新的視角更新數據
    },

    renderChart(dates, prices, volumes,ma5, ma10, ma20, ma60) {
      if (!prices || !Array.isArray(prices)) {
        return;
      }
      console.log(prices);
      const maxPrice = Math.max(
      ...prices.flatMap(price => (Array.isArray(price) ? price : []))
      );
      if (!isFinite(maxPrice)) {
        console.warn('无法计算 maxPrice，prices 数据可能有误:', prices);
      }

      const yAxisMax = maxPrice * 1.2; // 最大值的 1.2 倍
      const option = {
        title: {
          text: `股票價格 - ${this.stockCode}`,
          left: 'left',
        },
        tooltip: {
          trigger: 'axis',
          axisPointer: {
            type: 'cross',
          },
          formatter: (params) => {
            // 異步更新表格數據，避免阻塞 tooltip 的正常顯示
            setTimeout(() => {
              this.updateTableData(params)
            }, 0)

            // 繼續正常生成 tooltipText
            let tooltipText = `${params[0].axisValue}<br/>`
            return tooltipText
          },
        },
        legend: {
          data: ['日K', 'MA5', 'MA10', 'MA20', 'MA60'],
        },
        grid: {
          left: '10%',
          right: '10%',
          bottom: '15%',
        },
        xAxis: {
          type: 'category',
          data: dates,
          scale: true,
          boundaryGap: false,
          axisLine: { onZero: false },
          splitLine: {
            show: false,
          },
          min: 'dataMin',
          max: 'dataMax',
        },
        yAxis: {
          scale: true,
          splitNumber: 10,
          max: yAxisMax, // 將 Y 軸的最大值設置為最大值的 1.2 倍
          splitArea: {
            show: true,
          },
        },
        dataZoom: [
  {
    // 滑块缩放
    type: 'slider',
    start: 60, // 显示数据的起始百分比
    end: 100,   // 显示数据的结束百分比
    textStyle: {
      color: '#8392A5',
    },
    handleIcon:
      'path://M10.7,11.9v-1.3H9.3v1.3c-4.9,0.3-8.8,4.4-8.8,9.4c0,5,3.9,9.1,8.8,9.4v1.3h1.3v-1.3c4.9-0.3,8.8-4.4,8.8-9.4C19.5,16.3,15.6,12.2,10.7,11.9z M13.3,24.4H6.7V23h6.6V24.4z M13.3,19.6H6.7v-1.4h6.6V19.6z',
    dataBackground: {
      areaStyle: {
        color: '#8392A5',
      },
      lineStyle: {
        opacity: 0.8,
        color: '#8392A5',
      },
    },
    brushSelect: true,
  },
  {
    // 内部滚动缩放
    id: 'dataZoomX',
    type: 'inside',
    start: 60, // 数据范围起始百分比
    end: 100,   // 数据范围结束百分比
    realtime: true, // 开启实时更新
    filterMode: 'weakFilter', // 允许部分数据在缩放范围内显示
    xAxisIndex: [0], // 应用到第一个 xAxis
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
              label: {
                formatter: function (param) {
                  return param != null ? Math.round(param.value) : ''
                },
              },
              data: [
                {
                  name: '最高值',
                  type: 'none',
                  valueDim: 'highest',
                },
                {
                  name: '最低值',
                  type: 'none',
                  valueDim: 'lowest',
                },
              ],
            },
        /*    markLine: {
              symbol: ['none', 'none'],
              data: [
                {
                  name: '平均值',
                  type: 'average',
                  valueDim: 'close',
                },
              ],
            },*/
          },
          {
            name: 'MA5',
            type: 'line',
            data: ma5,
            smooth: true,
            lineStyle: {
              width: 1.5,
              opacity: 0.5,
            },
            symbol: 'none',
            emphasis: {
              focus: 'series',
              itemStyle: {
                opacity: 1,
              },
              symbol: 'circle',
              symbolSize: 6,
            },
          },
          {
            name: 'MA10',
            type: 'line',
            data: ma10,
            smooth: true,
            lineStyle: {
              width: 1.5,
              opacity: 0.5,
            },
            symbol: 'none',
            emphasis: {
              focus: 'series',
              itemStyle: {
                opacity: 1,
              },
              symbol: 'circle',
              symbolSize: 6,
            },
          },
          {
            name: 'MA20',
            type: 'line',
            data: ma20,
            smooth: true,
            lineStyle: {
              width: 1.5,
              opacity: 0.5,
            },
            symbol: 'none',
            emphasis: {
              focus: 'series',
              itemStyle: {
                opacity: 1,
              },
              symbol: 'circle',
              symbolSize: 6,
            },
          },
          {
            name: 'MA60',
            type: 'line',
            data: ma60,
            smooth: true,
            lineStyle: {
              width: 1.5,
              opacity: 0.5,
            },
            symbol: 'none',
            emphasis: {
              focus: 'series',
              itemStyle: {
                opacity: 1,
              },
              symbol: 'circle',
              symbolSize: 6,
            },
          },
        ],
      }

      this.priceChart.setOption(option)
      this.priceChart.resize()
    },
    /*calculateMA(dayCount, data) {
      const result = []
      for (let i = 0; i < data.length; i++) {
        if (i < dayCount) {
          result.push('-')
          continue
        }
        let sum = 0
        for (let j = 0; j < dayCount; j++) {
          sum += data[i - j][1]
        }
        result.push((sum / dayCount).toFixed(2))
      }
      return result
    },*/

    updateTableData(params) {
      console.log("Params:", params);
    console.log("Type of params:", typeof params);
      let selectedData
      switch (this.selectedView) {
        case 'day':
          selectedData = this.stockData.day
          break
        case 'week':
        selectedData = this.stockData.week
          break
        case 'month':
        selectedData = this.stockData.month
          break
        default:
          console.error('未知的視角選擇：', this.selectedView)
          return
      }
      const volumes = selectedData.map((item) =>
      item.tradingVolume !== null ? parseFloat(item.tradingVolume) : 0
      )
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
.stock-query-container {
  width: 70%;
  margin: 0 auto;
  text-align: center;
}
.input-section {
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
}
input[type='text'],
input[type='date'] {
  padding: 12px 16px;
  font-size: 16px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  box-shadow: 2px 2px 8px rgba(0, 0, 0, 0.1);
  outline: none;
  background: linear-gradient(145deg, #ffffff, #f4f4f4);
  transition: all 0.3s ease;
  width: 250px;
  font-family: 'Georgia', serif; /* 文藝字體 */
}

input[type='text']:focus,
input[type='date']:focus {
  border-color: #a9c9ff;
  box-shadow: 0px 0px 8px rgba(169, 201, 255, 0.8);
  background: linear-gradient(145deg, #f4f4f4, #ffffff);
}

button {
  padding: 12px 20px;
  font-size: 16px;
  font-weight: bold;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  background: linear-gradient(145deg, #85a9ff, #567bcf);
  box-shadow: 2px 2px 8px rgba(0, 0, 0, 0.2);
  cursor: pointer;
  transition: all 0.3s ease;
}

button:hover {
  background: linear-gradient(145deg, #567bcf, #85a9ff);
  box-shadow: 4px 4px 12px rgba(0, 0, 0, 0.3);
  transform: scale(1.05);
}

button:active {
  background: linear-gradient(145deg, #456ab8, #567bcf);
  box-shadow: inset 2px 2px 6px rgba(0, 0, 0, 0.2);
}

.tab-section label {
  font-size: 16px;
  color: #333;
  font-family: 'Georgia', serif;
  margin-right: 20px;
  display: flex;
  align-items: center;
  gap: 5px;
}

input[type='radio'] {
  appearance: none;
  width: 16px;
  height: 16px;
  border: 2px solid #a9c9ff;
  border-radius: 50%;
  outline: none;
  background: #f4f4f4;
  box-shadow: 1px 1px 4px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  cursor: pointer;
}

input[type='radio']:checked {
  background: #85a9ff;
  border-color: #567bcf;
  box-shadow: 0px 0px 6px rgba(169, 201, 255, 0.8);
}


.chart-container {
  width: 1200px;
  height: 600px;
  margin: 0 auto;
}

.content-section {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.data-table-container {
  margin: 10px 0;
  width: 80%;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  border: 1px solid #ddd;
  padding: 8px;
  text-align: center;
}

th {
  background-color: #f4f4f4;
  font-weight: bold;
}

</style>
