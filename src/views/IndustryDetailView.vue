<template>
  <main class="page">
    <RouterLink to="/industries">← 返回所有分類</RouterLink>
    <h1>分類：{{ tag }}</h1>
    <p v-if="loading">載入中…</p>
    <p v-if="error" role="alert">{{ error }}</p>
    <p v-if="!loading && !error">共 {{ stocks.length }} 檔股票</p>
    <ul>
      <li v-for="stock in stocks" :key="stock.stockCode">
        <RouterLink :to="{ name: 'stock-basic-info', params: { stockCode: stock.stockCode } }"
          >{{ stock.stockCode }} {{ stock.stockName || '（未提供股票名稱）' }}</RouterLink
        >
      </li>
    </ul>
  </main>
</template>
<script setup lang="ts">
  import { ref, watch, computed } from 'vue'
  import { useRoute } from 'vue-router'
  import { getIndustryStocks } from '@/api/industryApi'
  const route = useRoute()
  const tag = computed(() => String(route.params.tag ?? ''))
  const stocks = ref<{ stockCode: string; stockName: string }[]>([])
  const loading = ref(false)
  const error = ref('')
  watch(
    tag,
    async (current) => {
      stocks.value = []
      error.value = ''
      if (!current) return
      loading.value = true
      try {
        stocks.value = Object.entries(await getIndustryStocks(current))
          .map(([stockCode, stockName]) => ({ stockCode, stockName }))
          .sort((a, b) => a.stockCode.localeCompare(b.stockCode))
      } catch (e) {
        console.error(e)
        error.value = '成分股載入失敗'
      } finally {
        loading.value = false
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
  ul {
    padding-left: 24px;
  }
  li {
    padding: 7px 0;
  }
  a {
    color: #90ccff;
  }
</style>
