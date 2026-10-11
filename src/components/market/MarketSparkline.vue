<script setup lang="ts">
import { computed } from 'vue'
import type { MarketCandle } from '@/utils/marketHistoryParser'

/**
 * 六張卡片固定顯示歷史 OHLC 縮圖，不管 WebSocket 是否連線，也不判斷開休市。
 * 所有資料來自 marketStore.histories，由既有 REST API 載入。
 */
const props = withDefaults(defineProps<{
  candles: MarketCandle[]
  historyPoints?: number
}>(), { historyPoints: 28 })

const WIDTH = 300
const HEIGHT = 78
const PADDING = 6

const candles = computed(() => (props.candles ?? [])
  .filter(c => [c.open, c.high, c.low, c.close].every(Number.isFinite)
    && c.high >= c.low && c.open > 0 && c.close > 0)
    .slice(-Math.max(1, props.historyPoints)))
    
const bars = computed(() => {
  const rows = candles.value
  if (!rows.length) return []
  const min = Math.min(...rows.map(c => c.low))
  const max = Math.max(...rows.map(c => c.high))
  const range = max - min
  const step = (WIDTH - PADDING * 2) / rows.length
  const y = (value: number): number => range === 0
    ? HEIGHT / 2
    : HEIGHT - PADDING - (value - min) / range * (HEIGHT - 2 * PADDING)

  return rows.map((c, index) => ({
    x: PADDING + (index + 0.5) * step,
    wickTop: y(c.high),
    wickBottom: y(c.low),
    bodyTop: Math.min(y(c.open), y(c.close)),
    bodyHeight: Math.max(1.2, Math.abs(y(c.open) - y(c.close))),
    bodyWidth: Math.max(1.5, Math.min(8, step * 0.64)),
    color: c.close >= c.open ? '#ee8388' : '#54cca0',
  }))
})
</script>

<template>
  <div class="market-sparkline" aria-label="歷史日 K 走勢縮圖">
    <svg :viewBox="`0 0 ${WIDTH} ${HEIGHT}`" preserveAspectRatio="none" role="img" aria-label="最近的歷史日 K 棒">
      <template v-for="(bar, index) in bars" :key="index">
        <line :x1="bar.x" :x2="bar.x" :y1="bar.wickTop" :y2="bar.wickBottom" :stroke="bar.color" stroke-width="1.4" vector-effect="non-scaling-stroke" />
        <rect :x="bar.x - bar.bodyWidth / 2" :y="bar.bodyTop" :width="bar.bodyWidth" :height="bar.bodyHeight" :fill="bar.color" />
      </template>
    </svg>
    <div class="sparkline-footer">
      <span>歷史日 K 縮圖</span>
      <span>{{ bars.length ? `${bars.length} 根` : '歷史資料載入中' }}</span>
    </div>
  </div>
</template>

<style scoped>
.market-sparkline { width: 100%; min-width: 0; padding-top: 8px; }
.market-sparkline svg { display: block; width: 100%; height: 80px; }
.sparkline-footer { display: flex; justify-content: space-between; gap: 8px; margin-top: 6px; font-size: 10px; color: #8a9cab; }
</style>
