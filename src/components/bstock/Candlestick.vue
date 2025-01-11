<template>
  <div class="stock-query-container">
    <!-- 查詢區域 -->
    <div class="query-section">
      <div class="stock-input">
        <input type="text" v-model="stockCode" placeholder="請輸入股票代碼" />
        <button @click="fetchStockData(stockCode)">查詢</button>
      </div>
    </div>

    <!-- 頁籤區域 -->
    <div class="tab-section">
      <div
        :class="['tab', { active: isKLineChart }]"
        @click="switchTab('kline')"
      >
        K線圖
      </div>
      <div
        :class="['tab', { active: !isKLineChart }]"
        @click="switchTab('info')"
      >
        資券訊息
      </div>
    </div>
    <div class="view-toggle" v-if="!isKLineChart">
    <stockInfoChart :outerStockCode="stockCode" />
    </div>
    <!-- 日K線、周K線、月K線選項 -->
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
    <div v-if="isKLineChart" class="content-section">
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
import stockInfoChart from "./StockInfoChart.vue";

export default {
  name: 'StockQueryPage',
  components: {
    stockInfoChart,
  },
  data() {
    return {
      stockCode: '',
      startDate: '',
      endDate: '',
      stockData: [],
      tableData: [],
      selectedView: 'day', // 默認為日視角
      isKLineChart: true, // 是否為 K 線圖模式，默認為 true
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

    switchTab(tab) {
      this.isKLineChart = tab === "kline";
    },
    selectView(view) {
      this.selectedView = view;
      this.updateChartData();
      console.log("切換到:", view);
    },
    fetchStockData(excuceStockCode = this.stockCode) {
      if (!excuceStockCode) {
        console.error('請輸入股票代碼')
        return
      }
      console.log(excuceStockCode);
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
        }
      )
      .then((response) => {
        const {
          singleStockDayPriceVos,
          singleStockWeekPriceVos,
          singleStockMonthPriceVos,
        } = response.data;

        // 組織資料結構
        this.stockData = {
          day: singleStockDayPriceVos.sort(
            (a, b) => new Date(a.tradingDate) - new Date(b.tradingDate)
          ),
          week: singleStockWeekPriceVos.sort(
            (a, b) => new Date(a.tradingDate) - new Date(b.tradingDate)
          ),
          month: singleStockMonthPriceVos.sort(
            (a, b) => new Date(a.tradingDate) - new Date(b.tradingDate)
          ),
        };

        // 儲存到 sessionStorage
        const cachedData = JSON.parse(sessionStorage.getItem('cachedStockData')) || {};
        cachedData[this.stockCode] = {
          stockData: this.stockData,
        };
        sessionStorage.setItem('cachedStockData', JSON.stringify(cachedData));

        // 更新圖表
        this.updateChartData();
      })
      .catch((error) => {
        if (error.response && error.response.status === 401) {
          console.warn('Token 無效或過期，正在嘗試重新獲取 Token...');

          // 獲取新 Token
          this.fetchToken()
            .then(() => {
               // 從 sessionStorage 獲取新的 Token
              const newToken = sessionStorage.getItem('authToken');
              if (newToken) {
                console.log('重新嘗試請求股票數據... stockCode :'+ excuceStockCode );
                // 重新執行請求
                return apiClient.post(
                  '/gateway/SingleStockPrice',
                  {
                    stockCode: excuceStockCode,
                    searchStartDate: formattedStartDate,
                    searchEndDate: formattedEndDate,
                  },
                  {
                    headers: {
                      Authorization: `Bearer ${newToken}`,
                    },
                  }
                );
              } else {
                throw new Error('無法獲取新 Token');
              }
            })
            .then((response) => {
              const {
                singleStockDayPriceVos,
                singleStockWeekPriceVos,
                singleStockMonthPriceVos,
              } = response.data;

              // 組織資料結構
              this.stockData = {
                day: singleStockDayPriceVos.sort(
                  (a, b) => new Date(a.tradingDate) - new Date(b.tradingDate)
                ),
                week: singleStockWeekPriceVos.sort(
                  (a, b) => new Date(a.tradingDate) - new Date(b.tradingDate)
                ),
                month: singleStockMonthPriceVos.sort(
                  (a, b) => new Date(a.tradingDate) - new Date(b.tradingDate)
                ),
              };

              // 儲存到 sessionStorage
              const cachedData =
                JSON.parse(sessionStorage.getItem('cachedStockData')) || {};
              cachedData[this.stockCode] = {
                stockData: this.stockData,
              };
              sessionStorage.setItem(
                'cachedStockData',
                JSON.stringify(cachedData)
              );

                // 更新圖表
                this.updateChartData();
              })
              .catch((retryError) => {
                console.error('重新請求失敗:', retryError);
              });
          } else {
            console.error('請求股票數據失敗:', error);
          }
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
/* 查詢區域樣式 */
.query-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.stock-input {
  display: flex;
  align-items: center;
  gap: 10px;
}

.stock-input input {
  padding: 8px;
  border: 2px solid #4caf50;
  border-radius: 5px;
  font-size: 14px;
}

.stock-input button {
  padding: 8px 16px;
  background-color: #4caf50;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
}

.token-button {
  padding: 8px 16px;
  background-color: #66bb6a;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
}

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
