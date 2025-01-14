<template>
  <div class="container">
    <!-- Sidebar -->
    <Sidebar @apply-filters="handleFilters" />

    <!-- Filter Results -->
    <FilterResults
      :results="results"
      :shouldShow="shouldShowResults"
      @select-stock="handleSelectStock"
    />

    <!-- Main Content -->
    <div class="content space-theme">
      <!-- 查詢區域 -->
      <div class="query-section">
        <div class="stock-input">
          <input type="text" v-model="selectedStockCode" placeholder="請輸入股票代碼" />
          <button @click="handleSelectStock(selectedStockCode)">查詢</button>
        </div>
      </div>
      <!-- 頁籤區域 -->
      <div class="tab-section">
        <div :class="['tab', { active: isKLineChart }]" @click="switchTab('kline')">K線圖</div>
        <div :class="['tab', { active: !isKLineChart }]" @click="switchTab('info')">資券訊息</div>
      </div>
      <Candlestick
        :stockData="stockData"
        :selectedStockCode="selectedStockCode"
        :isKLineChart="isKLineChart"
      />
      <StockInfoChart
        v-show="!isKLineChart"
        :marginShortData="stockMarginShortData"
        :selectedStockCode="selectedStockCode"
      />
    </div>
  </div>
</template>

<script>
import Candlestick from '../components/bstock/Candlestick.vue'
import StockInfoChart from '../components/bstock/StockInfoChart.vue'
import FilterResults from '../components/bstock/FilterResults.vue'
import Sidebar from '../components/bstock/Sidebar.vue'
import apiClient from '../router/BstockAxios'

export default {
  name: 'BstockCandlestick',
  components: { Sidebar, FilterResults, Candlestick, StockInfoChart },

  data() {
    return {
      filters: null, // 儲存篩選條件
      results: null, // 查詢結果
      shouldShowResults: false, // 控制 FilterResults 展開
      selectedStockCode: null, // 選中的股票代碼
      stockData: null, // 股票價格數據
      stockMarginShortData: null, // 資券數據
      isKLineChart: true,
    }
  },
  methods: {
    switchTab(tab) {
      this.isKLineChart = tab === 'kline'
    },
    async fetchData(apiEndpoint, payload, method) {
      const token = sessionStorage.getItem('authToken')
      try {
        let response = []
        if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
          response = await apiClient.post(apiEndpoint, payload, {
            headers: { Authorization: `Bearer ${token}` },
          })
        } else {
          response = await apiClient.get(apiEndpoint, {
            headers: { Authorization: `Bearer ${token}` },
          })
        }
        return response.data
      } catch (error) {
        if (error.response?.status === 401) {
          console.warn('Token 無效或過期，嘗試重新獲取 Token...')
          await this.fetchToken()
          const newToken = sessionStorage.getItem('authToken')
          if (newToken) {
            return await this.fetchData(apiEndpoint, payload, method)
          }
        }
        console.error('API 請求失敗:', error)
      }
    },

    async fetchToken() {
      try {
        const response = await apiClient.get('/auth/tempToken')
        const token = response.data.token
        if (token) {
          console.log('新 Token 獲取成功:', token)
          sessionStorage.setItem('authToken', token)
        } else {
          console.error('未獲取到有效的 Token:', response.data)
        }
      } catch (error) {
        console.error('獲取 Token 失敗:', error)
      }
    },

    async fetchStockData(stockCode) {
      const payload = { stockCode }
      const data = await this.fetchData('/gateway/SingleStockPrice', payload, 'POST')
      this.stockData = data
    },

    async fetchMarginShortData(stockCode) {
      const data = await this.fetchData(`/api/biz/stockCodeMarginShortInfo/${stockCode}`, {}, 'GET')
      this.stockMarginShortData = data
    },

    async handleFilters(filters) {
      this.filters = filters
      const conditions = this.constructConditions(filters)
      const payload = { conditions }

      const data = await this.fetchData('/gateway/StockCodeByFilter', payload, 'POST')
      this.results = data
      this.shouldShowResults = data && data.length > 0
    },

    handleSelectStock(stockCode) {
      this.selectedStockCode = stockCode
      this.fetchStockData(stockCode)
      this.fetchMarginShortData(stockCode)
    },

    constructConditions(filters) {
      const conditions = []

      if (filters.kd) {
        conditions.push({
          name: 'kd',
          value: [filters.kd],
          limit: filters.kdDays.toString(),
          operator: 'notconcerned',
          type: 'kd',
        })
      }

      if (filters.priceRise) {
        conditions.push({
          name: 'priceRise',
          value: [filters.risePercentage.toString()],
          limit: filters.riseDays,
          operator: 'notconcerned',
          type: 'change',
        })
      }

      if (filters.limitUp) {
        conditions.push({
          name: 'limitUp',
          value: ['notconcerned'],
          operator: 'notconcerned',
          type: 'limitUp',
        })
      }

      Object.entries(filters.movingAverage).forEach(([key, value]) => {
        if (value.trend) {
          const maMapping = {
            '5日均線': 'five_days_slope',
            '10日均線': 'ten_days_slope',
            '20日均線': 'twenty_days_slope',
            '60日均線': 'sixty_days_slope',
            '120日均線': 'one_twenty_days_slope',
            '240日均線': 'two_fourty_days_slope',
          }

          if (maMapping[key]) {
            conditions.push({
              name: maMapping[key],
              value: [value.trend],
              limit: value.days,
              operator: 'notconcerned',
              type: 'ma',
            })
          }
        }
      })

      return conditions
    },
  },
}
</script>

<style scoped>
/* Container styles */
.container {
  display: flex;
  height: 100vh;
  background-color: #000; /* 背景為黑色 */
}

/* Sidebar styles */
.sidebar {
  width: 250px; /* 展開時的寬度 */
  background: linear-gradient(135deg, #23272a, #1d2024); /* 漸變背景 */
  color: #ffffff;
  padding: 20px;
  display: flex;
  flex-direction: column;
  box-shadow: 6px 0 25px rgba(0, 0, 0, 0.4); /* 更濃的陰影 */
  border-top-right-radius: 20px; /* 圓角 */
  border-bottom-right-radius: 20px;
  position: relative;
  overflow: visible; /* 確保內容不被裁切 */
  transition:
    width 0.3s ease,
    box-shadow 0.3s ease; /* 添加陰影過渡效果 */
}

.sidebar.collapsed {
  width: 60px; /* 摺疊時的寬度 */
  box-shadow: 3px 0 15px rgba(0, 0, 0, 0.3); /* 改變陰影大小 */
}

/* Toggle button styles */
.toggle-btn {
  position: absolute;
  top: 50%; /* 垂直居中 */
  right: -20px; /* 按鈕位置在側邊欄外側 */
  transform: translateY(-50%); /* 調整垂直居中 */
  width: 40px;
  height: 40px;
  background-color: #7289da;
  color: #ffffff;
  border: none;
  border-radius: 50%; /* 圓形按鈕 */
  cursor: pointer;
  display: flex;
  justify-content: center;
  align-items: center;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5); /* 更深的陰影 */
  transition:
    transform 0.3s ease,
    box-shadow 0.3s ease; /* 過渡效果 */
  z-index: 10; /* 確保按鈕不被其他元素遮蓋 */
}

.toggle-btn:hover {
  transform: translateY(-50%) scale(1.1); /* 懸停時放大 */
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.6); /* 懸停時陰影更深 */
}

/* Arrow animation */
.arrow {
  display: inline-block;
  transition: transform 0.3s ease; /* 平滑旋轉動畫 */
}

.arrow.rotated {
  transform: rotate(180deg); /* 旋轉 180 度 */
}

/* 太空主題背景 */
.space-theme {
  flex: 1;
  position: relative;
  overflow: hidden;
  border-top-left-radius: 20px;
  border-bottom-left-radius: 20px;
  background: radial-gradient(circle at center, #1a1a1a, #000); /* 星空漸變背景 */
}

/* 星星 */
.space-theme::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 300%;
  height: 300%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.7) 0%, rgba(255, 255, 255, 0.1) 70%);
  animation: twinkling 5s infinite ease-in-out;
  opacity: 0.8;
  pointer-events: none; /* 禁止攔截事件 */
}

/* 流星 */
.space-theme::after {
  content: '';
  position: absolute;
  width: 2px;
  height: 50px;
  background: linear-gradient(to bottom, rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0));
  top: 10%;
  left: 80%;
  transform: rotate(45deg);
  animation: shooting-star 2s infinite ease-in-out;
  opacity: 0.8;
  pointer-events: none; /* 禁止攔截事件 */
}

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
</style>
