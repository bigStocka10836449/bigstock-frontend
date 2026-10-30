<template>
  <section class="ranking-panel">
    <!-- Header -->

    <header class="ranking-header">
      <div class="ranking-title">
        <h3>個股漲跌幅排行</h3>

        <p class="description">查看上市與上櫃股票漲跌幅，點擊股票可進入個股查詢。</p>
      </div>

      <button type="button" class="refresh-button" :disabled="loading" @click="refreshRanking">
        {{ loading ? '更新中…' : '重新整理' }}
      </button>
    </header>

    <!-- Filters -->

    <div class="ranking-filters">
      <!-- Market -->

      <div class="filter-group">
        <label>股票市場</label>

        <div class="button-group">
          <button
            type="button"
            :class="{ active: selectedMarket === 'TWSE' }"
            :aria-pressed="selectedMarket === 'TWSE'"
            @click="selectedMarket = 'TWSE'"
          >
            上市
          </button>

          <button
            type="button"
            :class="{ active: selectedMarket === 'TPEX' }"
            :aria-pressed="selectedMarket === 'TPEX'"
            @click="selectedMarket = 'TPEX'"
          >
            上櫃
          </button>
        </div>
      </div>

      <!-- Ranking Type -->

      <div class="filter-group">
        <label>排行類型</label>

        <div class="button-group">
          <button
            type="button"
            :class="{ active: selectedOrder === 'desc' }"
            :aria-pressed="selectedOrder === 'desc'"
            @click="selectedOrder = 'desc'"
          >
            漲幅排行
          </button>

          <button
            type="button"
            :class="{ active: selectedOrder === 'asc' }"
            :aria-pressed="selectedOrder === 'asc'"
            @click="selectedOrder = 'asc'"
          >
            跌幅排行
          </button>
        </div>
      </div>

      <!-- Limit -->

      <div class="filter-group">
        <label for="ranking-limit">顯示數量</label>

        <select id="ranking-limit" v-model.number="selectedLimit">
          <option :value="10">前 10 名</option>

          <option :value="20">前 20 名</option>

          <option :value="30">前 30 名</option>

          <option :value="50">前 50 名</option>
        </select>
      </div>
    </div>

    <!-- Initial loading -->

    <div v-if="loading && !rankingData" class="status-message">正在取得個股漲跌幅排行…</div>

    <!-- Initial error -->

    <div v-else-if="error && !rankingData" class="error-message">
      <p>{{ error }}</p>

      <button type="button" class="retry-button" @click="refreshRanking">重試</button>
    </div>

    <!-- Table -->

    <template v-else>
      <p v-if="error" class="error-hint">{{ error }}，目前顯示上次取得的資料。</p>

      <div
        ref="tableContainer"
        class="table-container"
        tabindex="0"
        aria-label="個股漲跌幅排行，可上下及左右捲動"
      >
        <table>
          <thead>
            <tr>
              <th>排名</th>

              <th>股票代號</th>

              <th>股票名稱</th>

              <th class="numeric">開盤價</th>

              <th class="numeric">收盤價</th>

              <th class="numeric">漲跌</th>

              <th class="numeric">漲跌幅</th>

              <th class="numeric">成交量</th>
            </tr>
          </thead>

          <tbody>
            <tr
              v-for="stock in displayedRankings"
              :key="`${selectedMarket}-${selectedOrder}-${stock.stockCode}`"
              class="stock-row"
            >
              <td>
                <span class="rank-number">{{ stock.rank }}</span>
              </td>

              <td>
                <button type="button" class="stock-link" @click="goToStock(stock)">
                  {{ stock.stockCode }}
                </button>
              </td>

              <td>
                <button type="button" class="stock-link stock-name" @click="goToStock(stock)">
                  {{ stock.stockName }}
                </button>
              </td>

              <td class="numeric">
                {{ formatPrice(stock.openingPrice) }}
              </td>

              <td class="numeric">
                {{ formatPrice(stock.closingPrice) }}
              </td>

              <td class="numeric" :class="changeClass(stock.change)">
                {{ formatChange(stock.change) }}
              </td>

              <td class="numeric" :class="changeClass(stock.changeRate)">
                {{ formatChangeRate(stock.changeRate) }}
              </td>

              <td class="numeric">
                {{ formatVolume(stock.tradingVolume) }}
              </td>
            </tr>
          </tbody>
        </table>

        <div v-if="displayedRankings.length === 0" class="status-message">目前沒有排行榜資料。</div>
      </div>

      <footer class="ranking-footer">
        <span>
          {{ selectedMarket === 'TWSE' ? '上市' : '上櫃' }}

          ·

          {{ selectedOrder === 'desc' ? '漲幅排行' : '跌幅排行' }}
        </span>

        <span> 顯示 {{ displayedRankings.length }} 筆 ／ 共 {{ currentRankings.length }} 筆 </span>
      </footer>
    </template>
  </section>
</template>

<script setup lang="ts">
  import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

  import { useRouter } from 'vue-router'

  import { getCachedRankings, getRankingCacheSnapshot } from '@/api/stockRankingApi'

  import type {
    RankingDataset,
    RankingLimit,
    RankingMarket,
    RankingOrder,
    RankingResponse,
  } from '@/api/stockRankingApi'

  // ============================================================
  // Router
  // ============================================================

  const router = useRouter()

  // ============================================================
  // State
  // ============================================================

  const selectedMarket = ref<RankingMarket>('TWSE')
  const selectedOrder = ref<RankingOrder>('desc')
  const selectedLimit = ref<RankingLimit>(10)

  // 初始化先讀取已存在的 Cache。
  // 讓使用者從首頁切到排行榜時，不會先看到 Loading。
  const rankingData = ref<RankingDataset | null>(getRankingCacheSnapshot())

  const loading = ref(false)
  const error = ref('')

  const tableContainer = ref<HTMLElement | null>(null)

  let requestRevision = 0

  // ============================================================
  // Computed
  // ============================================================

  const currentRankings = computed<RankingResponse[]>(() => {
    const data = rankingData.value

    if (!data) {
      return []
    }

    return data[selectedMarket.value][selectedOrder.value]
  })

  const displayedRankings = computed<RankingResponse[]>(() => {
    return currentRankings.value.slice(0, selectedLimit.value)
  })

  // ============================================================
  // Load
  // ============================================================

  async function loadRanking(forceRefresh = false): Promise<void> {
    const seq = ++requestRevision

    loading.value = true
    error.value = ''

    try {
      const data = await getCachedRankings(forceRefresh)

      if (seq !== requestRevision) {
        return
      }

      rankingData.value = data
    } catch (err) {
      if (seq !== requestRevision) {
        return
      }

      console.error('[StockRanking] Request failed:', err)
      error.value = '排行榜資料讀取失敗，請稍後再試。'
    } finally {
      if (seq === requestRevision) {
        loading.value = false
      }
    }
  }

  function refreshRanking(): void {
    void loadRanking(true)
  }

  // ============================================================
  // Navigation
  // 跳轉至 BigStock 現有的個股股價查詢頁面
  // ============================================================

  async function goToStock(stock: RankingResponse): Promise<void> {
    const stockCode = stock.stockCode?.trim()

    if (!stockCode) {
      return
    }

    try {
      await router.push({
        path: '/candlestick',
        query: {
          stockCode: stockCode,
          market: selectedMarket.value,
        },
      })
    } catch (error) {
      console.error('[StockRanking] Navigation failed:', error)
    }
  }

  // ============================================================
  // Scroll
  // ============================================================

  watch([selectedMarket, selectedOrder, selectedLimit], async () => {
    await nextTick()

    if (tableContainer.value) {
      tableContainer.value.scrollTop = 0
    }
  })

  // ============================================================
  // Format
  // ============================================================

  function formatPrice(value: number | null): string {
    if (value == null || !Number.isFinite(value)) {
      return '—'
    }

    return value.toLocaleString('zh-TW', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  function formatChange(value: number | null): string {
    if (value == null || !Number.isFinite(value)) {
      return '—'
    }

    const prefix = value > 0 ? '+' : ''

    return `${prefix}${value.toLocaleString('zh-TW', {
      maximumFractionDigits: 2,
    })}`
  }

  function formatChangeRate(value: number | null): string {
    if (value == null || !Number.isFinite(value)) {
      return '—'
    }

    const prefix = value > 0 ? '+' : ''

    return `${prefix}${value.toFixed(2)}%`
  }

  function formatVolume(value: number | null): string {
    if (value == null || !Number.isFinite(value)) {
      return '—'
    }

    return value.toLocaleString('zh-TW', {
      maximumFractionDigits: 0,
    })
  }

  function changeClass(value: number | null): string {
    if (value == null || !Number.isFinite(value) || value === 0) {
      return ''
    }

    return value > 0 ? 'price-up' : 'price-down'
  }

  // ============================================================
  // Lifecycle
  // ============================================================

  onMounted(() => {
    void loadRanking()
  })

  onUnmounted(() => {
    // 讓舊請求結果失效。
    // 不取消共用 Request，避免其他頁面重複請求。
    requestRevision++
  })
</script>

<style scoped>
  .ranking-panel {
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    background: #1d252d;
    border: 1px solid #33414c;
    border-radius: 12px;
    padding: 20px;
    color: #e5edf4;
  }

  .ranking-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 20px;
  }

  .ranking-title {
    min-width: 0;
  }

  .ranking-header h3 {
    margin: 0 0 8px;
    font-size: 18px;
  }

  .description {
    margin: 0;
    color: #a0aebd;
    font-size: 13px;
    line-height: 1.6;
  }

  .refresh-button,
  .retry-button {
    flex-shrink: 0;
    background: #34434e;
    border: 1px solid #51616d;
    border-radius: 6px;
    padding: 8px 14px;
    color: #e5edf4;
    font-size: 13px;
    cursor: pointer;
  }

  .refresh-button:hover,
  .retry-button:hover {
    background: #415463;
  }

  .refresh-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .ranking-filters {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 20px;
    margin-bottom: 20px;
  }

  .filter-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .filter-group label {
    color: #a6bac8;
    font-size: 12px;
  }

  .button-group {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .button-group button {
    background: #24313b;
    border: 1px solid #40515c;
    border-radius: 6px;
    padding: 9px 16px;
    color: #e5edf4;
    font-size: 13px;
    cursor: pointer;
    transition:
      background-color 0.15s ease,
      border-color 0.15s ease;
  }

  .button-group button:hover {
    background: #34434e;
  }

  .button-group button.active {
    background: #4caf50;
    border-color: #4caf50;
    color: #fff;
  }

  .filter-group select {
    background: #24313b;
    border: 1px solid #40515c;
    border-radius: 6px;
    padding: 9px 12px;
    color: #e5edf4;
    font-size: 13px;
    cursor: pointer;
  }

  /* 表格固定高度，內部滾動 */

  .table-container {
    width: 100%;
    min-width: 0;
    max-height: 520px;
    overflow: auto;
    border-radius: 6px;
    scrollbar-width: thin;
    scrollbar-color: #566674 #1d252d;
  }

  .table-container:focus-visible {
    outline: 2px solid #70b8ff;
    outline-offset: 2px;
  }

  .table-container::-webkit-scrollbar {
    width: 7px;
    height: 7px;
  }

  .table-container::-webkit-scrollbar-thumb {
    background: #566674;
    border-radius: 5px;
  }

  .table-container::-webkit-scrollbar-thumb:hover {
    background: #718493;
  }

  table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    font-size: 13px;
  }

  th,
  td {
    padding: 13px 12px;
    border-bottom: 1px solid #38444d;
    white-space: nowrap;
    text-align: left;
  }

  thead th {
    position: sticky;
    top: 0;
    z-index: 2;
    background: #24313b;
    color: #a6bac8;
    font-weight: 500;
  }

  .numeric {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .stock-row:hover {
    background: #293843;
  }

  .stock-link {
    padding: 2px 0;
    border: none;
    background: transparent;
    color: #70b8ff;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  .stock-link:hover {
    color: #a6d4ff;
    text-decoration: underline;
  }

  .stock-link:focus-visible {
    outline: 2px solid #70b8ff;
    outline-offset: 3px;
    border-radius: 2px;
  }

  .stock-name {
    font-weight: 400;
  }

  .rank-number {
    font-weight: 600;
  }

  .price-up {
    color: #f26b6b;
  }

  .price-down {
    color: #54b989;
  }

  .ranking-footer {
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
    padding-top: 16px;
    color: #a0aebd;
    font-size: 12px;
  }

  .status-message,
  .error-message {
    text-align: center;
    padding: 28px 10px;
    font-size: 13px;
  }

  .status-message {
    color: #a0aebd;
  }

  .error-message,
  .error-hint {
    color: #f2aaaa;
  }

  .error-message p {
    margin: 0 0 12px;
  }

  .error-hint {
    font-size: 12px;
    margin-bottom: 12px;
  }

  @media (max-width: 768px) {
    .ranking-panel {
      padding: 14px;
    }
    .ranking-header {
      flex-direction: column;
      align-items: stretch;
    }
    .ranking-filters {
      gap: 14px;
    }
    .table-container {
      max-height: 460px;
    }
    th,
    td {
      padding: 11px 9px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .button-group button {
      transition: none;
    }
  }
</style>
