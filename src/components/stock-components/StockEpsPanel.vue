<template>
  <section class="tile">
    <div class="header">
      <h3>EPS（季度財報）</h3>

      <div class="period-filter">
        <label for="eps-period">查詢期間</label>

        <select id="eps-period" v-model.number="selectedPeriod">
          <option :value="4">最近 4 季</option>
          <option :value="12">最近 12 季</option>
        </select>
      </div>
    </div>

    <p class="note">
      資料為當年度累計 EPS；單季 EPS = 本季累計 EPS − 前季累計 EPS（Q1 直接使用累計值）。
    </p>

    <p v-if="!market && marketStatus === 'loading'" class="muted">正在確認上市／上櫃市場…</p>

    <p v-else-if="!market && marketStatus === 'unsupported'" class="muted">
      興櫃股票暫無此季度財報資料。
    </p>

    <p v-else-if="!market" class="error">
      無法辨識股票市場別。請在上方選擇上市（TWSE） 或上櫃（TPEX）。
    </p>

    <p v-else-if="loading" class="muted">正在讀取季度財報…</p>

    <p v-else-if="error" class="error">
      {{ error }}
    </p>

    <template v-else>
      <div class="scroll">
        <table>
          <thead>
            <tr>
              <th>季度</th>
              <th>累計 EPS</th>
              <th>單季 EPS</th>
            </tr>
          </thead>

          <tbody>
            <tr v-for="row in displayedRows" :key="row.key">
              <td>{{ row.key }}</td>

              <td>
                {{ format(row.cumulative) }}
              </td>

              <td>
                {{ format(row.single) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p v-if="displayedRows.length === 0" class="muted">查無此股票的季度 EPS 資料。</p>
    </template>
  </section>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'

  import type { ExchangeMarket, StockQuarterFinancial } from '@/api/stockFundamentalsApi'

  import { readStockFinancialHistory } from '@/api/stockFundamentalsApi'

  // ============================================================
  // Props
  // ============================================================

  const props = defineProps<{
    stockCode: string
    market: ExchangeMarket | null
    marketStatus?: 'loading' | 'resolved' | 'unresolved' | 'unsupported'
  }>()

  // ============================================================
  // Types
  // ============================================================

  type EpsPeriod = 4 | 12

  type EpsRow = {
    key: string
    cumulative: number | null
    single: number | null
  }

  // ============================================================
  // Cache 設定
  //
  // 宣告在 setup 外面，因此元件重新掛載時仍可共用。
  // 適用於同一個瀏覽器分頁的 JavaScript 執行環境。
  // ============================================================

  const CACHE_TTL = 5 * 60 * 1000

  const MAX_CACHE_SIZE = 100

  type CacheEntry = {
    data: StockQuarterFinancial[]
    expiresAt: number
  }

  const financialCache = new Map<string, CacheEntry>()

  const pendingRequests = new Map<string, Promise<StockQuarterFinancial[]>>()

  // ============================================================
  // State
  // ============================================================

  const selectedPeriod = ref<EpsPeriod>(12)

  const rows = ref<EpsRow[]>([])

  const loading = ref(false)

  const error = ref('')

  let revision = 0

  // ============================================================
  // Cached API
  // ============================================================

  async function fetchFinancials(
    market: ExchangeMarket,
    stockCode: string,
  ): Promise<StockQuarterFinancial[]> {
    const cacheKey = `${market}:${stockCode}`

    const cached = financialCache.get(cacheKey)

    // 1. Cache Hit
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data
    }

    // 移除過期 Cache
    if (cached) {
      financialCache.delete(cacheKey)
    }

    // 2. 已經有相同股票的 Request
    const pending = pendingRequests.get(cacheKey)

    if (pending) {
      return pending
    }

    // 3. 發送 API
    const request = readStockFinancialHistory(market, stockCode)
      .then((data) => {
        if (!Array.isArray(data)) {
          throw new Error('INVALID_FINANCIAL_RESPONSE')
        }

        // 限制 Cache 數量，避免無限制成長
        if (financialCache.size >= MAX_CACHE_SIZE) {
          const firstKey = financialCache.keys().next().value

          if (firstKey !== undefined) {
            financialCache.delete(firstKey)
          }
        }

        financialCache.set(cacheKey, {
          data,
          expiresAt: Date.now() + CACHE_TTL,
        })

        return data
      })
      .finally(() => {
        pendingRequests.delete(cacheKey)
      })

    pendingRequests.set(cacheKey, request)

    return request
  }

  // ============================================================
  // EPS 計算
  // ============================================================

  function buildEpsRows(financials: StockQuarterFinancial[]): EpsRow[] {
    // 複製並依年度、季度由新到舊排序
    const sorted = [...financials]
      .filter(
        (item) =>
          item != null &&
          Number.isInteger(item.year) &&
          Number.isInteger(item.quarter) &&
          item.quarter >= 1 &&
          item.quarter <= 4,
      )
      .sort((a, b) => b.year - a.year || b.quarter - a.quarter)

    // 累計 EPS 索引
    const epsMap = new Map<string, number | null>()

    for (const financial of sorted) {
      const key = `${financial.year}Q${financial.quarter}`

      const eps = financial.earningsPerShare

      epsMap.set(key, typeof eps === 'number' && Number.isFinite(eps) ? eps : null)
    }

    // 只顯示最近 12 季
    return sorted.slice(0, 12).map((financial) => {
      const year = financial.year
      const quarter = financial.quarter

      const key = `${year}Q${quarter}`

      const cumulative = epsMap.get(key) ?? null

      // Q1 為當季累計 EPS
      // Q2~Q4 必須減去同年度上一季
      const previous = quarter === 1 ? 0 : (epsMap.get(`${year}Q${quarter - 1}`) ?? null)

      const single =
        cumulative === null || previous === null ? null : Number((cumulative - previous).toFixed(4))

      return {
        key,
        cumulative,
        single,
      }
    })
  }

  // ============================================================
  // Displayed Rows
  //
  // 切換下拉選單不會發送任何 HTTP Request。
  // ============================================================

  const displayedRows = computed(() => {
    return rows.value.slice(0, selectedPeriod.value)
  })

  // ============================================================
  // Format
  // ============================================================

  function format(value: number | null): string {
    if (value === null) {
      return '—'
    }

    return value.toLocaleString('zh-TW', {
      maximumFractionDigits: 2,
    })
  }

  // ============================================================
  // Watch Stock / Market
  //
  // 不再監聽 selectedPeriod。
  // 因為切換期間只需要前端 Filter。
  // ============================================================

  watch(
    () => [props.stockCode, props.market] as const,

    async ([stockCode, market]) => {
      const seq = ++revision

      rows.value = []
      error.value = ''
      loading.value = Boolean(stockCode && market)

      if (!stockCode || !market) {
        return
      }

      try {
        const financials = await fetchFinancials(market, stockCode.trim())

        if (seq !== revision) {
          return
        }

        rows.value = buildEpsRows(financials)
      } catch (err) {
        if (seq !== revision) {
          return
        }

        console.error('[EPS] Failed to load financial history', err)

        error.value = '季度財報讀取失敗，請稍後再試。'
      } finally {
        if (seq === revision) {
          loading.value = false
        }
      }
    },

    {
      immediate: true,
    },
  )
</script>

<style scoped>
  .tile {
    background: #1d252d;
    border: 1px solid #33414c;
    border-radius: 12px;
    padding: 18px;
    min-width: 0;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    margin-bottom: 12px;
    flex-wrap: wrap;
  }

  h3 {
    margin: 0;
    font-size: 17px;
  }

  .period-filter {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .period-filter label {
    font-size: 12px;
    color: #a6bac8;
    white-space: nowrap;
  }

  .period-filter select {
    background: #1d252d;
    border: 1px solid #475768;
    border-radius: 6px;
    color: #e5edf4;
    padding: 8px 10px;
    font-size: 12px;
    outline: none;
    cursor: pointer;
  }

  .period-filter select:focus {
    border-color: #4caf50;
  }

  .muted,
  .note {
    color: #a0aebd;
    font-size: 13px;
    line-height: 1.6;
  }

  .note {
    margin-bottom: 16px;
  }

  .error {
    color: #f2aaaa;
  }

  .scroll {
    overflow: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
    font-size: 13px;
  }

  td,
  th {
    padding: 10px;
    border-bottom: 1px solid #38444d;
  }

  th {
    color: #a6bac8;
  }

  tbody tr:hover {
    background: rgba(255, 255, 255, 0.035);
  }
</style>
