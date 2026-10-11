<script setup lang="ts">
import { computed } from 'vue'
import type { LivePricePoint } from '@/stores/marketStore'

/**
 * 單一市場的  即時走勢。
 * 僅顯示 Pinia 已儲存的有效價格變動，不使用歷史日 K 偽造即時資料。
 */
const props = defineProps<{
  points: LivePricePoint[]
}>()

const WIDTH = 1000
const HEIGHT = 270
const PADDING_X = 24
const PADDING_Y = 18

const series = computed(() => props.points.filter(p => Number.isFinite(p.price) && p.price > 0 && Number.isFinite(p.time)))
const first = computed(() => series.value[0] ?? null)
const last = computed(() => series.value[series.value.length - 1] ?? null)
const rising = computed(() => !first.value || !last.value || last.value.price >= first.value.price)
const color = computed(() => rising.value ? '#ee8388' : '#54cca0')

const plot = computed(() => {
  const items = series.value
  if (!items.length) return []
  const low = Math.min(...items.map(p => p.price))
  const high = Math.max(...items.map(p => p.price))
  const gap = high - low
  const firstTime = items[0]!.time
  const lastTime = items[items.length - 1]!.time
  const duration = lastTime - firstTime
  return items.map((p, index) => ({
    x: duration > 0
      ? PADDING_X + (p.time - firstTime) / duration * (WIDTH - PADDING_X * 2)
      : PADDING_X + (items.length === 1 ? 0 : index / (items.length - 1) * (WIDTH - PADDING_X * 2)),
    y: gap === 0 ? HEIGHT / 2
      : HEIGHT - PADDING_Y - (p.price - low) / gap * (HEIGHT - PADDING_Y * 2),
  }))
})

const linePath = computed(() => plot.value.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' '))
const areaPath = computed(() => {
  const points = plot.value
  if (points.length < 2) return ''
  return `${linePath.value} L ${points[points.length - 1]!.x} ${HEIGHT} L ${points[0]!.x} ${HEIGHT} Z`
})
const lastCoordinate = computed(() => plot.value[plot.value.length - 1] ?? null)
const lowPrice = computed(() => series.value.length ? Math.min(...series.value.map(p => p.price)) : null)
const highPrice = computed(() => series.value.length ? Math.max(...series.value.map(p => p.price)) : null)
const fmtPrice = (value: number | null): string => value === null ? '--' : value.toLocaleString('zh-TW', { maximumFractionDigits: 2 })
const fmtTime = (value: number): string => new Date(value).toLocaleTimeString('zh-TW', { hour12: false })
</script>

<template>
  <div class="realtime-chart">
    <div v-if="!series.length" class="empty" role="status">
      <strong>尚未收到即時行情</strong>
      <span>等待  傳回有效價格資料，收到後才會開始繪圖。</span>
    </div>
    <template v-else>
      <div class="chart-info">
        <span>最高 {{ fmtPrice(highPrice) }}</span>
        <span>最低 {{ fmtPrice(lowPrice) }}</span>
        <span>已記錄 {{ series.length }} 點</span>
      </div>
      <svg :viewBox="`0 0 ${WIDTH} ${HEIGHT}`" preserveAspectRatio="none" role="img" aria-label=" 即時價格走勢">
        <line v-for="i in 4" :key="i" x1="0" :y1="i * HEIGHT / 5" :x2="WIDTH" :y2="i * HEIGHT / 5" stroke="#35424e" stroke-dasharray="4 7" stroke-width="1" />
        <path v-if="plot.length > 1" :d="areaPath" :fill="color" fill-opacity="0.10" />
        <path v-if="plot.length > 1" :d="linePath" :stroke="color" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
        <circle v-if="lastCoordinate" :cx="lastCoordinate.x" :cy="lastCoordinate.y" r="5" :fill="color" />
      </svg>
      <div class="chart-footer">
        <span>{{ first ? fmtTime(first.time) : '--' }}</span>
        <span v-if="series.length === 1">等待下一個不同價格</span>
        <span>{{ last ? fmtTime(last.time) : '--' }}</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.realtime-chart { width: 100%; min-width: 0; }
.realtime-chart svg { display: block; width: 100%; height: 260px; }
.chart-info, .chart-footer { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px 18px; color: #8fa5b5; font-size: 12px; padding: 10px 4px; }
.chart-footer { font-size: 11px; }
.empty { min-height: 200px; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 10px; text-align: center; background: #19222a; border: 1px dashed #43505a; border-radius: 10px; padding: 22px; }
.empty strong { color: #eaf1f6; font-size: 19px; }
.empty span { color: #96a9b9; font-size: 12px; line-height: 1.7; }
</style>
