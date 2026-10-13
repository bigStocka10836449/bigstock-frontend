<template>
  <div class="stock-dashboard">
    <!-- 原本技術條件篩選；內部日／週／月長列表自行捲動 -->
    <Sidebar @apply-filters="handleFilters" />

    <!-- 查詢結果與 Sidebar 平行放置，結果很多時使用內部捲動 -->
    <FilterResults
      :results="results"
      :shouldShow="shouldShowResults"
      @select-stock="handleSelectStock"
    />

    <!-- 主內容不裁切過長資料，交給整個網頁垂直捲動 -->
    <div class="content space-theme">
      <div class="content-inner">
        <h1 class="page-title">個股查詢</h1>
        <!-- 股票輸入與查詢 -->
        <div class="query-section">
          <div class="stock-input">
            <input
              v-model.trim="selectedStockCode"
              type="text"
              placeholder="請輸入股票代碼"
              @keyup.enter="handleSelectStock(selectedStockCode)"
            />
            <button
              type="button"
              :disabled="!selectedStockCode || loadingStock"
              @click="handleSelectStock(selectedStockCode)"
            >
              {{ loadingStock ? '查詢中...' : '查詢' }}
            </button>
          </div>
        </div>

        <!-- 個股查詢的六個主頁籤；每次只展示一種分析資料 -->
        <nav class="tab-section" aria-label="個股查詢頁籤">
          <button
            v-for="tab in mainTabs"
            :key="tab.id"
            type="button"
            class="tab"
            :class="{ active: activeTab === tab.id }"
            :aria-current="activeTab === tab.id ? 'page' : undefined"
            @click="selectMainTab(tab.id)"
          >
            {{ tab.label }}
          </button>
        </nav>

        <!-- 技術分析保留原始 K 線、資券元件與側邊股票篩選 -->
        <section v-if="activeTab === 'technical'" class="technical-section">
          <div class="subtabs" aria-label="技術分析顯示類型">
            <button type="button" :class="{ active: isKLineChart }" @click="switchTab('kline')">
              K 線圖
            </button>
            <button type="button" :class="{ active: !isKLineChart }" @click="switchTab('info')">
              資券訊息
            </button>
          </div>
          <section v-if="isKLineChart" class="chart-panel">
            <div v-if="loadingStock" class="data-status">正在載入股票 K 線資料...</div>
            <div v-else-if="stockError" class="data-status error">{{ stockError }}</div>
            <Candlestick
              v-else-if="stockData && loadedStockCode"
              :key="loadedStockCode"
              :stockData="stockData"
              :selectedStockCode="loadedStockCode"
              :isKLineChart="true"
            />
            <div v-else class="data-status">請輸入股票代碼以查看 K 線圖</div>
          </section>
          <section v-else class="margin-panel">
            <div v-if="loadingMargin" class="data-status">正在載入資券資料...</div>
            <div v-else-if="marginError" class="data-status error">{{ marginError }}</div>
            <div v-else-if="stockMarginShortData && loadedStockCode" class="margin-scroll">
              <StockInfoChart
                :key="loadedStockCode"
                :marginShortData="stockMarginShortData"
                :selectedStockCode="loadedStockCode"
              />
            </div>
            <div v-else class="data-status">請先選擇股票以查看資券資料</div>
          </section>
        </section>

        <!-- 持續掛載頁籤容器：已開過的元件保留資料；未開過的元件不打 API -->
        <StockFundamentals
          v-if="loadedStockCode && fundamentalsVisited"
          v-show="activeTab !== 'technical'"
          :stock-code="loadedStockCode"
          :active-tab="activeTab"
        />
      </div>
    </div>
  </div>
</template>

<script>
  import Candlestick from '../components/bstock/Candlestick.vue'
  import StockInfoChart from '../components/bstock/StockInfoChart.vue'
  import FilterResults from '../components/bstock/FilterResults.vue'
  import StockFundamentals from '@/components/stock-components/StockFundamentals.vue'
  import Sidebar from '../components/bstock/Sidebar.vue'
  import {
    getSingleStockPrice,
    getStockMarginShortInfo,
    getStockCodeByFilter,
  } from '@/api/stockApi'

  export default {
    name: 'BstockCandlestick',
    components: { Sidebar, FilterResults, Candlestick, StockInfoChart, StockFundamentals },
    data() {
      return {
        filters: null, // 儲存篩選條件
        results: [], // 查詢結果
        shouldShowResults: false, // 控制 FilterResults 展開
        selectedStockCode: '', // 股票輸入框
        loadedStockCode: '', // 已確定查詢的代號
        stockData: null, // 股票價格數據
        stockMarginShortData: null, // 資券數據
        isKLineChart: true,
        activeTab: 'technical',
        fundamentalsVisited: false,
        mainTabs: [
          { id: 'technical', label: '技術分析' },
          { id: 'basic', label: '個股資訊' },
          { id: 'eps', label: 'EPS' },
          { id: 'revenue', label: '月營收' },
          { id: 'shareholders', label: '持股分布' },
          { id: 'industries', label: '相關產業' },
        ],
        loadingStock: false, // K 線載入狀態
        loadingMargin: false, // 資券載入狀態
        stockError: '', // 股票查詢錯誤
        marginError: '', // 資券查詢錯誤
        stockRequestVersion: 0, // 防止慢速舊請求覆蓋新股票資料
        filterRequestVersion: 0, // 防止慢速舊篩選覆蓋新結果
      }
    },
    watch: {
      '$route.query.stockCode': {
        immediate: true,
        handler(value) {
          const code = typeof value === 'string' ? value.trim() : ''
          if (code && code !== this.loadedStockCode) this.handleSelectStock(code)
        },
      },
    },
    methods: {
      switchTab(tab) {
        this.isKLineChart = tab === 'kline'
      },
      selectMainTab(tab) {
        if (!this.mainTabs.some((item) => item.id === tab)) return
        this.activeTab = tab
        if (tab !== 'technical') this.fundamentalsVisited = true
      },
      /** 取得股票價格資料，保留既有日／週／月 K API */
      async fetchStockData(stockCode, version) {
        this.loadingStock = true
        this.stockError = ''
        try {
          const data = await getSingleStockPrice(stockCode)
          if (version !== this.stockRequestVersion) return
          // K 線 API 的資料格式由既有 Candlestick.vue 負責解析。
          // 如 Network 回應正常但畫面空白，可用這則訊息核對實際資料形狀。
          console.debug('[Candlestick] SingleStockPrice response:', data)
          this.stockData = data
        } catch (error) {
          if (version !== this.stockRequestVersion) return
          console.error('取得股票價格失敗:', error)
          this.stockData = null
          this.stockError = '股票價格資料載入失敗，請稍後重試'
        } finally {
          if (version === this.stockRequestVersion) this.loadingStock = false
        }
      },
      /** 取得資券資料；獨立於 K 線 API 載入 */
      async fetchMarginShortData(stockCode, version) {
        this.loadingMargin = true
        this.marginError = ''
        try {
          const data = await getStockMarginShortInfo(stockCode)
          if (version !== this.stockRequestVersion) return
          this.stockMarginShortData = data
        } catch (error) {
          if (version !== this.stockRequestVersion) return
          console.error('取得股票資券資料失敗:', error)
          this.stockMarginShortData = null
          this.marginError = '資券資料載入失敗，請稍後重試'
        } finally {
          if (version === this.stockRequestVersion) this.loadingMargin = false
        }
      },
      /** 執行股票篩選；結果為空仍顯示「無查詢結果」 */
      async handleFilters(filters) {
        this.filters = filters
        const version = ++this.filterRequestVersion
        const conditions = this.constructConditions(filters)
        // 先隱藏面板，再於本次查詢成功後展開
        this.shouldShowResults = false
        try {
          const data = await getStockCodeByFilter(conditions)
          if (version !== this.filterRequestVersion) return
          this.results = Array.isArray(data) ? data : []
          this.shouldShowResults = true
        } catch (error) {
          if (version !== this.filterRequestVersion) return
          console.error('股票篩選失敗:', error)
          this.results = []
          this.shouldShowResults = false
        }
      },
      /** 選股時同時更新 K 線和資券，避免舊股票資料殘留 */
      handleSelectStock(stockCode) {
        const code = String(stockCode ?? '').trim()
        if (!code) return
        this.selectedStockCode = code
        this.loadedStockCode = code
        // 切換股票後維持目前主頁籤；進入技術分析預設日 K。
        this.isKLineChart = true
        this.stockData = null
        this.stockMarginShortData = null
        this.stockError = ''
        this.marginError = ''
        const version = ++this.stockRequestVersion
        void this.fetchStockData(code, version)
        void this.fetchMarginShortData(code, version)
      },
      /** 完全保留原本 KD、漲幅、漲停、MA 的查詢條件格式 */
      constructConditions(filters) {
        const aspects = ['daily', 'weekly', 'monthly']
        const maMapping = {
          '5均線': 'five_ma_slope',
          '10均線': 'ten_ma_slope',
          '20均線': 'twenty_ma_slope',
          '60均線': 'sixty_ma_slope',
          '120均線': 'one_twenty_ma_slope',
          '240均線': 'two_fourty_ma_slope',
        }
        return aspects
          .map((aspect) => {
            const aspectFilters = filters[aspect]
            const movingAverageFilters = filters.movingAverage[aspect] || {}
            const conditions = []
            // Handle KD
            if (aspectFilters?.kd) {
              conditions.push({
                name: 'kd',
                value: [aspectFilters.kd],
                limit: aspectFilters.KDdays?.toString() || null,
                operator: 'notconcerned',
                type: 'kd',
              })
            }
            // Handle Price Rise
            if (aspectFilters?.priceRise) {
              conditions.push({
                name: 'priceRise',
                value: [aspectFilters.risePercentage?.toString() || null],
                limit: aspectFilters.riseDays || null,
                operator: 'notconcerned',
                type: 'change',
              })
            }
            // Handle Limit Up
            if (aspectFilters?.limitUp) {
              conditions.push({
                name: 'limitUp',
                value: ['notconcerned'],
                operator: 'notconcerned',
                type: 'limitUp',
              })
            }
            // Handle Moving Averages
            Object.entries(movingAverageFilters).forEach(([key, value]) => {
              if (value?.trend && maMapping[key]) {
                conditions.push({
                  name: maMapping[key],
                  value: [value.trend],
                  limit: value.days || null,
                  operator: 'notconcerned',
                  type: 'ma',
                })
              }
            })
            return { aspect, conditions }
          })
          .filter((entry) => entry.conditions.length > 0)
      },
    },
  }
</script>

<style scoped>
  .page-title {
    margin: 0 0 16px;
    font-size: 25px;
    font-weight: 750;
    color: #e8f2ef;
  }
  .subtabs {
    display: flex;
    justify-content: center;
    gap: 12px;
    margin: 10px 0 18px;
  }
  .subtabs button {
    background: #353535;
    color: #fff;
    border: 0;
    border-radius: 6px;
    padding: 10px 20px;
    cursor: pointer;
  }
  .subtabs button.active {
    background: #4caf50;
  }
  /* 整頁允許自然延伸，避免 Header + 100vh 使畫面超高並被裁切 */
  .stock-dashboard {
    display: flex;
    align-items: flex-start;
    width: 100%;
    min-width: 0;
    min-height: calc(100dvh - var(--bigstock-header-height, 110px));
    background: #000;
  }
  .content {
    flex: 1 1 auto;
    min-width: 0;
    position: relative;
    overflow: visible;
  }
  .content-inner {
    position: relative;
    z-index: 1;
    width: 100%;
    min-width: 0;
    padding: 20px;
  }
  /* 星空背景只畫在容器範圍，不讓裝飾元素撐出水平捲軸 */
  .space-theme {
    position: relative;
    isolation: isolate;
    background: radial-gradient(circle at center, #1a1a1a, #000);
    border-radius: 20px 0 0 20px;
  }
  .space-theme::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    background: radial-gradient(circle, rgba(255, 255, 255, 0.11), rgba(255, 255, 255, 0.01) 70%);
  }
  .space-theme::after {
    content: '';
    position: absolute;
    top: 10%;
    right: 20%;
    width: 2px;
    height: 50px;
    z-index: 0;
    pointer-events: none;
    background: linear-gradient(to bottom, rgba(255, 255, 255, 0.5), transparent);
    transform: rotate(45deg);
    animation: shooting-star 5s ease-in-out infinite;
  }
  @keyframes shooting-star {
    0% {
      opacity: 0;
      transform: translate(0, 0) rotate(45deg);
    }
    15% {
      opacity: 0.8;
    }
    45%,
    100% {
      opacity: 0;
      transform: translate(-100px, 100px) rotate(45deg);
    }
  }
  .query-section {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 15px;
    min-width: 0;
  }
  .stock-input {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    min-width: 0;
    max-width: 100%;
  }
  .stock-input input {
    padding: 8px;
    max-width: 100%;
    min-width: 0;
    border: 2px solid #4caf50;
    border-radius: 5px;
    font-size: 14px;
  }
  .stock-input button {
    padding: 8px 16px;
    border: 0;
    border-radius: 5px;
    background: #4caf50;
    color: white;
    cursor: pointer;
  }
  .stock-input button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .tab-section {
    display: flex;
    gap: 8px;
    margin-bottom: 20px;
    min-width: 0;
    overflow-x: auto;
    padding-bottom: 4px;
  }
  .tab {
    flex: 1 0 auto;
    padding: 12px 14px;
    border: 1px solid #33414c;
    border-radius: 7px;
    background: #20282f;
    color: #c5d2dc;
    cursor: pointer;
    white-space: nowrap;
  }
  .tab.active {
    background: #4caf50;
  }
  /* 圖表 DOM 本身仍需由 Candlestick.vue 設定明確 height */
  .chart-panel {
    width: 100%;
    min-width: 0;
    min-height: 450px;
  }
  .margin-panel {
    width: 100%;
    min-width: 0;
    min-height: 350px;
  }
  /* 超寬資券資料僅在這個容器內水平捲動 */
  .margin-scroll {
    width: 100%;
    max-width: 100%;
    overflow-x: auto;
    scrollbar-width: thin;
    scrollbar-color: #777 #222;
  }
  .data-status {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 300px;
    padding: 24px;
    text-align: center;
    color: #aaa;
  }
  .data-status.error {
    color: #ff8585;
  }
  /* 桌面寬度不足時由三欄變直向，避免中間 K 線被擠到只剩少量寬度 */
  @media (max-width: 900px) {
    .stock-dashboard {
      flex-direction: column;
      min-height: 0;
    }
    .content {
      width: 100%;
    }
    .content-inner {
      padding: 12px;
    }
    .space-theme {
      border-radius: 0;
    }
    .chart-panel {
      min-height: 350px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .space-theme::after {
      animation: none;
    }
  }
</style>
