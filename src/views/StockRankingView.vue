<template>
  <main class="ranking-page">
    <div class="ranking-container">
      <StockChangeRanking />
    </div>
  </main>
</template>

<script setup lang="ts">
  import StockChangeRanking from '@/components/bstock/StockChangeRanking.vue'
</script>

<style scoped>
  .ranking-page {
    width: 100%;
    min-height: 100%;
    box-sizing: border-box;
    padding: 20px;
    background: #111315;
  }

  .ranking-container {
    width: 100%;
    max-width: 1500px;
    margin: 0 auto;
  }

  @media (max-width: 768px) {
    .ranking-page {
      padding: 12px;
    }
  }
</style>
