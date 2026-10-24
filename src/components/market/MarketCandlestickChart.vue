<template>
  <UnifiedCandlestickChart
    :candles="candles"
    :timezone="timezone"
    title="歷史日 K · 技術分析"
    period-label="日 K"
  />
</template>

<script setup lang="ts">
  import UnifiedCandlestickChart from '@/components/charts/UnifiedCandlestickChart.vue'
  type UnifiedCandle = {
    time: number
    open: number
    high: number
    low: number
    close: number
    volume?: number | null
  }

  withDefaults(defineProps<{ candles: UnifiedCandle[]; timezone?: string }>(), { timezone: '' })
</script>
