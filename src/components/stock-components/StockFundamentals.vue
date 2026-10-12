<template>
  <section class="fundamentals">
    <header class="headline">
      <h2>個股資訊與財務分析</h2>
      <small>{{ stockCode }}</small>
    </header>
    <div class="two-cols">
      <StockBasicInfoPanel :stock-code="stockCode" :market="market" />
      <StockIndustriesPanel :stock-code="stockCode" />
    </div>
    <div class="two-cols">
      <StockEpsPanel :stock-code="stockCode" :market="market" />
      <StockMonthlyRevenuePanel :stock-code="stockCode" />
    </div>
    <ShareholderStructurePanel :stock-code="stockCode" />
  </section>
</template>
<script setup lang="ts">
  import { ref, watch } from 'vue'
  import { getAllStockInfo } from '@/api/industryApi'
  import { normalizeMarket } from '@/api/stockFundamentalsApi'
  import type { ExchangeMarket } from '@/api/stockFundamentalsApi'
  import StockBasicInfoPanel from '@/components//stock-components/StockBasicInfoPanel.vue'
  import StockIndustriesPanel from '@/components/stock-components/StockIndustriesPanel.vue'
  import StockEpsPanel from '@/components/stock-components/StockEpsPanel.vue'
  import StockMonthlyRevenuePanel from '@/components/stock-components/StockMonthlyRevenuePanel.vue'
  import ShareholderStructurePanel from '@/components/stock-components/ShareholderStructurePanel.vue'
  const props = defineProps<{ stockCode: string }>()
  const market = ref<ExchangeMarket | null>(null)
  let revision = 0
  // 僅 EPS 需要市場別。其他元件在掛載後各自呼叫 GET API，不互相等待。
  watch(
    () => props.stockCode,
    async (code) => {
      const seq = ++revision
      market.value = null
      if (!code) return
      try {
        const directory = await getAllStockInfo() // 已有 localStorage 24h 快取
        if (seq !== revision) return
        const stock = directory.find((x) => x.stockCode === code)
        market.value = normalizeMarket(stock?.stockType)
      } catch (e) {
        if (seq === revision) console.error('[StockFundamentals] 無法判斷市場別', e)
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
  .two-cols {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
    margin-bottom: 16px;
  }
  @media (max-width: 1000px) {
    .two-cols {
      grid-template-columns: 1fr;
    }
  }
</style>
