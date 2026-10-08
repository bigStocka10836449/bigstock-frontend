<template>
  <main class="page">
    <h1>個股基本資訊</h1>
    <form @submit.prevent="load">
      <label>股票代號 <input v-model.trim="stockId" required placeholder="2330" /></label>
      <label
        >市場
        <select v-model="market">
          <option value="">自動</option>
          <option value="TWSE">TWSE</option>
          <option value="TPEX">TPEX</option>
        </select>
      </label>
      <button type="submit" :disabled="loading">查詢</button>
    </form>
    <p v-if="loading">載入中…</p>
    <p v-if="error" role="alert">{{ error }}</p>
    <section v-if="item" class="panel">
      <h2>{{ item.stockId }} {{ item.stockName }}</h2>
      <dl>
        <template v-for="[label, value] in displayItems" :key="label"
          ><dt>{{ label }}</dt>
          <dd>{{ value }}</dd></template
        >
      </dl>
      <p class="note">
        市值價格是後端指定月份的基準價格，不代表即時報價；一年及三年高低是收盤價高低。
      </p>
      <RouterLink to="/industries">查看產業分類</RouterLink>
    </section>
  </main>
</template>
<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { useRoute } from 'vue-router'
  import { getStockBasicInfo } from '@/api/stockBasicInfoApi'
  import type { StockBasicInfoResponse } from '@/types/stockBasicInfo'
  const route = useRoute()
  const stockId = ref(typeof route.params.stockCode === 'string' ? route.params.stockCode : '')
  const market = ref('')
  const item = ref<StockBasicInfoResponse | null>(null)
  const error = ref('')
  const loading = ref(false)
  const show = (value: unknown) =>
    value === null || value === undefined || value === '' ? '—' : String(value)
  const displayItems = computed((): [string, string][] =>
    item.value
      ? [
          ['市場別', show(item.value.market)],
          ['產業分類', show(item.value.industryCategory)],
          ['次產業', show(item.value.subIndustryCategory)],
          ['主要業務', show(item.value.mainBusiness)],
          ['上市日期', show(item.value.listingDate)],
          ['股本', show(item.value.capitalStock)],
          ['市值', show(item.value.marketCap)],
          ['市值參考價格', show(item.value.marketCapPrice)],
          ['市值價格日期', show(item.value.marketCapPriceDate)],
          ['本益比', show(item.value.peRatio)],
          ['EPS', show(item.value.earningsPerShare)],
          ['每股淨值', show(item.value.netAssetValuePerShare)],
          ['一年收盤高點', show(item.value.oneYearHigh)],
          ['一年收盤低點', show(item.value.oneYearLow)],
          ['三年收盤高點', show(item.value.threeYearHigh)],
          ['三年收盤低點', show(item.value.threeYearLow)],
        ]
      : [],
  )
  async function load() {
    if (!stockId.value) return
    const requested = stockId.value
    loading.value = true
    error.value = ''
    item.value = null
    try {
      item.value = await getStockBasicInfo(requested, market.value || undefined)
    } catch (e) {
      console.error(e)
      error.value = '查詢失敗，請檢查快取資料、JWT 與 API 路由。'
    } finally {
      loading.value = false
    }
  }
  watch(
    () => route.params.stockCode,
    (code) => {
      if (typeof code === 'string') {
        stockId.value = code
        void load()
      }
    },
    { immediate: true },
  )
</script>
<style scoped>
  .page {
    padding: 24px;
    min-height: 100vh;
    background: #151515;
    color: #eee;
  }
  form {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
  }
  input,
  select,
  button {
    padding: 8px;
  }
  button {
    cursor: pointer;
  }
  .panel {
    margin-top: 24px;
    padding: 18px;
    background: #222;
    border-radius: 8px;
  }
  dl {
    display: grid;
    grid-template-columns: minmax(110px, 180px) 1fr;
    gap: 8px 18px;
  }
  dt {
    color: #aaa;
  }
  dd {
    margin: 0;
    overflow-wrap: anywhere;
  }
  .note {
    color: #bbb;
    font-size: 13px;
  }
  a {
    color: #90ccff;
  }
</style>
