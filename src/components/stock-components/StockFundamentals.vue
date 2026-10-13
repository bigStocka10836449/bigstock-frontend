<template>
  <section class="fundamentals" aria-label="個股基本面">
    <!-- 市場別由 stockInfo 對應股票代號取得，僅在相關頁籤顯示提示 -->
    <div v-if="requiresMarket && marketStatus === 'unsupported'" class="market-warning">
      {{ stockCode }} 為興櫃股票；季度財報 API 目前僅支援上市／上櫃。
    </div>
    <div v-else-if="requiresMarket && marketStatus === 'unresolved'" class="market-warning">
      <span>無法從 stockInfo 判斷市場別，可手動選擇：</span>
      <select v-model="manualMarket" aria-label="選擇股票市場">
        <option value="">請選擇</option>
        <option value="TWSE">上市（TWSE）</option>
        <option value="TPEX">上櫃（TPEX）</option>
      </select>
    </div>
    <p v-else-if="requiresMarket && marketStatus === 'loading'" class="market-hint">
      正在辨識股票市場別…
    </p>

    <!-- 第一次點擊才建立 Component；之後使用 v-show 保留其狀態 -->
    <div v-if="visitedTabs.includes('basic')" v-show="activeTab === 'basic'">
      <StockBasicInfoPanel :stock-code="stockCode" :market="effectiveMarket" />
    </div>
    <div v-if="visitedTabs.includes('eps')" v-show="activeTab === 'eps'">
      <StockEpsPanel
        :stock-code="stockCode"
        :market="effectiveMarket"
        :market-status="marketStatus"
      />
    </div>
    <div v-if="visitedTabs.includes('revenue')" v-show="activeTab === 'revenue'">
      <StockMonthlyRevenuePanel :stock-code="stockCode" />
    </div>
    <div v-if="visitedTabs.includes('shareholders')" v-show="activeTab === 'shareholders'">
      <ShareholderStructurePanel :stock-code="stockCode" />
    </div>
    <div v-if="visitedTabs.includes('industries')" v-show="activeTab === 'industries'">
      <StockIndustriesPanel :stock-code="stockCode" />
    </div>
  </section>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { getAllStockInfo } from '@/api/industryApi'
  import { normalizeMarket } from '@/api/stockFundamentalsApi'
  import type { ExchangeMarket } from '@/api/stockFundamentalsApi'
  import StockBasicInfoPanel from '@/components/stock-components/StockBasicInfoPanel.vue'
  import StockIndustriesPanel from '@/components/stock-components/StockIndustriesPanel.vue'
  import StockEpsPanel from '@/components/stock-components/StockEpsPanel.vue'
  import StockMonthlyRevenuePanel from '@/components/stock-components/StockMonthlyRevenuePanel.vue'
  import ShareholderStructurePanel from '@/components/stock-components/ShareholderStructurePanel.vue'

  type MarketStatus = 'loading' | 'resolved' | 'unresolved' | 'unsupported'
  type StockTab = 'technical' | 'basic' | 'eps' | 'revenue' | 'shareholders' | 'industries'
  const props = defineProps<{ stockCode: string; activeTab: StockTab }>()
  const visitedTabs = ref<StockTab[]>([])
  const requiresMarket = computed(() => props.activeTab === 'basic' || props.activeTab === 'eps')
  watch(
    () => props.activeTab,
    (tab) => {
      if (tab !== 'technical' && !visitedTabs.value.includes(tab)) visitedTabs.value.push(tab)
    },
    { immediate: true },
  )
  const detectedMarket = ref<ExchangeMarket | null>(null)
  const manualMarket = ref<ExchangeMarket | ''>('')
  const marketStatus = ref<MarketStatus>('loading')
  const effectiveMarket = computed<ExchangeMarket | null>(
    () => manualMarket.value || detectedMarket.value,
  )
  let revision = 0

  watch(
    () => props.stockCode,
    async (code) => {
      const seq = ++revision
      detectedMarket.value = null
      manualMarket.value = ''
      marketStatus.value = 'loading'
      if (!code) {
        marketStatus.value = 'unresolved'
        return
      }

      try {
        const directory = await getAllStockInfo()
        if (seq !== revision) return
        const item = directory.find((s) => String(s.stockCode).trim() === code.trim())
        const normalized = normalizeMarket(item?.stockType)
        console.debug('[StockFundamentals] 股票市場辨識', {
          stockCode: code,
          stockType: item?.stockType ?? null,
          market: normalized,
        })
        detectedMarket.value = normalized
        marketStatus.value = normalized
          ? 'resolved'
          : String(item?.stockType ?? '').trim() === '2'
            ? 'unsupported'
            : 'unresolved'
      } catch (error) {
        if (seq !== revision) return
        console.error('[StockFundamentals] stockInfo 載入失敗', error)
        marketStatus.value = 'unresolved'
      }
    },
    { immediate: true },
  )
</script>

<style scoped>
  .fundamentals {
    margin-top: 28px;
    color: #e6edf4;
  }
  .headline {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }
  .headline h2 {
    font-size: 23px;
    margin: 0 0 15px;
  }
  .headline small {
    color: #a0aebd;
  }

  .market-warning {
    display: flex;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;
    padding: 12px 16px;
    margin-bottom: 16px;
    background: #3b3025;
    border: 1px solid #9b7044;
    border-radius: 10px;
    color: #f0ddc6;
    font-size: 13px;
  }
  .market-warning select {
    background: #1d252d;
    color: #e6edf4;
    border: 1px solid #65717f;
    padding: 8px;
    border-radius: 6px;
  }
  .market-hint {
    color: #a0aebd;
    font-size: 13px;
  }
  @media (max-width: 1000px) {
    .two-cols {
      grid-template-columns: 1fr;
    }
  }
</style>
