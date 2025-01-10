<template>
  <div class="container">
    <!-- Sidebar -->
    <Sidebar
      @apply-filters="handleFilters"
    />
    <!-- Filter Results -->
    <FilterResults
      :results="results"
      :shouldShow="shouldShowResults"
      @select-stock = "handleSelectStock"
    />
    <!-- Main Content -->
    <div class="content space-theme">
      <Candlestick :outerStockCode="selectedStockCode" />
    </div>
  </div>
</template>

<script>
import Candlestick from "../components/bstock/Candlestick.vue";
import FilterResults from "../components/bstock/FilterResults.vue";
import Sidebar from "../components/bstock/Sidebar.vue";
import apiClient from '../router/BstockAxios';

export default {
  name: "BstockCandlestick",
  components: { Sidebar, FilterResults, Candlestick },
  data() {
    return {
      filters: null, // 存儲篩選條件
      results: null, // 存儲查詢結果
      shouldShowResults: false, // 控制 FilterResults 展開
      isCollapsed: false, // 控制側邊欄的伸展/摺疊
      isFilterResultsExpanded: false, // FilterResults 展開/摺疊狀態
      selectedStockCode: null, // 選中的股票代碼
    };
  },
  methods: {
    toggleSidebar() {
      this.isCollapsed = !this.isCollapsed; // 切換側邊欄狀態
    },
    toggleFilterResults() {
      // 手動摺疊/展開 FilterResults
      this.isFilterResultsExpanded = !this.isFilterResultsExpanded;
    },


    handleSelectStock(stockCode) {
      // 更新選中的股票代碼
      console.log("選中的股票代碼:", stockCode);
      this.selectedStockCode = stockCode;
    },

    async handleFilters(filters) {
      // 儲存過濾條件
      this.filters = filters;

      // 假設執行查詢
      const queryResults = await this.executeQuery(filters);

      // 更新結果與狀態
      this.results = queryResults;
      this.shouldShowResults = queryResults && queryResults.length > 0;
      this.isFilterResultsExpanded = true; // 自動展開
    },


     async fetchToken() {
      try {
        const response = await apiClient.get('/auth/tempToken');
        const token = response.data.token;
        if (token) {
          console.log('新 Token 獲取成功:', token);
          sessionStorage.setItem('authToken', token);
        } else {
          console.error('未獲取到有效的 Token:', response.data);
        }
      } catch (error) {
        console.error('獲取 Token 失敗:', error);
      }
    },

    async executeQuery(filters) {
      console.log("執行查詢條件：", filters);
      let localResult = null; // 用於存儲最終結果

      // 构建 conditions
      const conditions = [];

      if (filters.kd) {
        conditions.push({
          name: "kd",
          value: [filters.kd],
          limit: filters.kdDays.toString(),
          operator: "notconcerned",
          type: "kd",
        });
      }

      if (filters.priceRise) {
        conditions.push({
          name: "priceRise",
          value: [filters.risePercentage.toString()],
          limit: filters.riseDays,
          operator: "notconcerned",
          type: "change",
        });
      }

      if (filters.limitUp) {
        conditions.push({
          name: "limitUp",
          value: ["notconcerned"],
          operator: "notconcerned",
          type: "limitUp",
        });
      }

      Object.entries(filters.movingAverage).forEach(([key, value]) => {
        if (value.trend) {
          const maMapping = {
            "5日均線": "five_days_slope",
            "10日均線": "ten_days_slope",
            "20日均線": "twenty_days_slope",
            "60日均線": "sixty_days_slope",
            "120日均線": "one_twenty_days_slope",
            "240日均線": "two_fourty_days_slope",
          };

          if (maMapping[key]) {
            conditions.push({
              name: maMapping[key],
              value: [value.trend],
              limit: value.days,
              operator: "notconcerned",
              type: "ma",
            });
          }
        }
      });

      const payload = { conditions };
      console.log("构建的 payload：", payload);

      const token = sessionStorage.getItem("authToken");
      try {
        const response = await apiClient.post("/gateway/StockCodeByFilter", payload, {
          headers: { Authorization: `Bearer ${token}` },
        });

        localResult = response.data;
        this.shouldShowResults = localResult && localResult.length > 0;
      } catch (error) {
        if (error.response && error.response.status === 401) {
          console.warn("Token 無效或過期，嘗試重新獲取 Token...");
          await this.fetchToken();
          const newToken = sessionStorage.getItem("authToken");

          if (newToken) {
            console.log("重新嘗試請求股票數據...");
            try {
              const retryResponse = await apiClient.post("/gateway/StockCodeByFilter", payload, {
                headers: { Authorization: `Bearer ${newToken}` },
              });

              localResult = retryResponse.data;
            } catch (retryError) {
              console.error("重新請求失敗:", retryError);
            }
          }
        } else {
          console.error("請求股票數據失敗:", error);
        }
      }

      return localResult;
    },
  },
};
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
  transition: width 0.3s ease, box-shadow 0.3s ease; /* 添加陰影過渡效果 */
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
  transition: transform 0.3s ease, box-shadow 0.3s ease; /* 過渡效果 */
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


</style>
