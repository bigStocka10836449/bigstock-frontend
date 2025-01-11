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
  import * as echarts from "echarts";
  
  export default {
    name: "StockInfoChart",
    props: {
        outerStockCode: {
        type: String,
        required: true,
      },
    },
    data() {
      return {
        chart: null,
        activeTab: "融資", // 預設顯示融資
        stockCode: '',
      };
    },
    watch: {
      outerStockCode: {
        immediate: true, // 保證初始化時執行一次
        handler(outerStockCode) {
    
            this.fetchStockData(outerStockCode); // 執行你的邏輯
        },
        deep: true,
      }
    },
    mounted() {
      this.initChart();
    },
    methods: {
      setActiveTab(tab) {
        this.activeTab = tab;
      },
      initChart() {
        this.chart = echarts.init(this.$refs.stockInfoChart);
        this.fetchStockData();
      },
      fetchStockData(excuceStockCode = this.stockCode) {


        if (!excuceStockCode) {
            console.error('請輸入股票代碼')
            return
        }
        console.log(excuceStockCode);

        const token = sessionStorage.getItem('authToken')
        apiClient
        .get(
            '/biz/stockCodeFilterType/' + excuceStockCode,
            {
            headers: {
                Authorization: `Bearer ${token}`,
            },
            }
        ) .then((response) => {
            const {
            tradingDay,
            stockCode,
            marginPurchaseBalancePreviousDay,
            marginPurchase,
            marginSales,
            cashRedemption,
            marginPurchaseBalance,
            marginPurchaseQuota,
            shortSaleBalancePreviousDay,
            shortSale,
            shortConvering,
            stockRedemption,
            shortSaleBalance,
            shortSaleQuota,
            offsetting,
            } = response.data;
            console.log('成功回應:', response.data);
        }) 
        const option = {
          tooltip: {
            trigger: "axis",
            axisPointer: {
              type: "shadow",
            },
          },
          xAxis: {
            type: "category",
            data: dates,
            axisLabel: {
              color: "#fff",
            },
            axisLine: {
              lineStyle: {
                color: "#ccc",
              },
            },
          },
          yAxis: {
            type: "value",
            axisLabel: {
              color: "#fff",
            },
            axisLine: {
              lineStyle: {
                color: "#ccc",
              },
            },
            splitLine: {
              lineStyle: {
                color: "rgba(255, 255, 255, 0.1)",
              },
            },
          },
          series: [
            {
              name: this.activeTab,
              type: "bar",
              data: this.activeTab,
              itemStyle: {
                color: (params) => {
                  return params.value >= 0 ? "#f44336" : "#4caf50"; // 紅色為正數，綠色為負數
                },
              },
            },
          ],
          backgroundColor: "#2c2c2c",
        };
  
        this.chart.setOption(option);
      },
      resizeChart() {
        if (this.chart) {
          this.chart.resize();
        }
      },
    },
    beforeDestroy() {
      if (this.chart) {
        this.chart.dispose();
      }
    },
  };
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
    transition: background-color 0.3s, transform 0.3s;
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
  