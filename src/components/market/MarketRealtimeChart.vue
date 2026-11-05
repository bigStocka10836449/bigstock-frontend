<script setup lang="ts">
  import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
  import type { LivePricePoint } from '@/stores/marketStore'

  /** SVG 即時行情圖：所有顯示時間固定使用台灣時間，原始 Unix 毫秒不變。 */
  const props = withDefaults(
    defineProps<{
      points: LivePricePoint[]
      /** 保留既有元件呼叫相容性；顯示時間一律使用 Asia/Taipei。 */
      timezone?: string
    }>(),
    {
      timezone: 'Asia/Taipei',
    },
  )

  const DISPLAY_TIMEZONE = 'Asia/Taipei'
  const DISPLAY_OFFSET = 'UTC+8'

  const WIDTH = 1000
  const HEIGHT = 270
  const PADDING_X = 24
  const PADDING_Y = 18
  const PLOT_WIDTH = WIDTH - PADDING_X * 2
  const CHART_HEIGHT = 260

  const containerRef = ref<HTMLElement | null>(null)
  const containerWidth = ref(1000)
  const pointerX = ref<number | null>(null)
  let resizeObserver: ResizeObserver | null = null

  const series = computed(() =>
    props.points
      .filter((p) => Number.isFinite(p.price) && p.price > 0 && Number.isFinite(p.time))
      .slice()
      .sort((a, b) => a.time - b.time),
  )
  const first = computed(() => series.value[0] ?? null)
  const last = computed(() => series.value[series.value.length - 1] ?? null)
  const rising = computed(
    () => !first.value || !last.value || last.value.price >= first.value.price,
  )
  const color = computed(() => (rising.value ? '#ee8388' : '#54cca0'))

  const bounds = computed(() => {
    const items = series.value
    if (!items.length) return null
    let low = Infinity
    let high = -Infinity
    for (const item of items) {
      low = Math.min(low, item.price)
      high = Math.max(high, item.price)
    }
    return { low, high, start: items[0]!.time, end: items[items.length - 1]!.time }
  })

  function xAt(time: number, index = 0, count = series.value.length): number {
    const b = bounds.value
    if (!b) return PADDING_X
    const duration = b.end - b.start
    if (duration > 0) return PADDING_X + ((time - b.start) / duration) * PLOT_WIDTH
    return PADDING_X + (count > 1 ? (index / (count - 1)) * PLOT_WIDTH : 0)
  }
  function yAt(price: number): number {
    const b = bounds.value
    if (!b || b.high === b.low) return HEIGHT / 2
    return HEIGHT - PADDING_Y - ((price - b.low) / (b.high - b.low)) * (HEIGHT - PADDING_Y * 2)
  }

  const plot = computed(() => series.value.map((p, i) => ({ x: xAt(p.time, i), y: yAt(p.price) })))
  const linePath = computed(() =>
    plot.value.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' '),
  )
  const areaPath = computed(() => {
    const points = plot.value
    if (points.length < 2) return ''
    return `${linePath.value} L ${points[points.length - 1]!.x} ${HEIGHT} L ${points[0]!.x} ${HEIGHT} Z`
  })
  const lastCoordinate = computed(() => plot.value[plot.value.length - 1] ?? null)
  const lowPrice = computed(() => bounds.value?.low ?? null)
  const highPrice = computed(() => bounds.value?.high ?? null)
  const fmtPrice = (value: number | null): string =>
    value === null
      ? '--'
      : value.toLocaleString('zh-TW', { maximumFractionDigits: 2, minimumFractionDigits: 2 })

  function datePart(time: number): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: DISPLAY_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(time))
  }
  function timePart(time: number): string {
    return new Intl.DateTimeFormat('zh-TW', {
      timeZone: DISPLAY_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(time))
  }
  function fullDateTime(time: number): string {
    return new Intl.DateTimeFormat('zh-TW', {
      timeZone: DISPLAY_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date(time))
  }
  function shortDate(time: number): string {
    return new Intl.DateTimeFormat('zh-TW', {
      timeZone: DISPLAY_TIMEZONE,
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(time))
  }

  /** 時間軸採實際 Unix 毫秒等比例，而非依點數平均分布。 */
  const tickCount = computed(() =>
    containerWidth.value < 430 ? 3 : containerWidth.value < 700 ? 5 : 7,
  )
  const ticks = computed(() => {
    const b = bounds.value
    if (!b) return []
    if (b.start === b.end)
      return [{ key: 0, x: xAt(b.start), label: fullDateTime(b.start), isDate: true }]
    const result: { key: number; x: number; label: string; isDate: boolean }[] = []
    const count = tickCount.value
    const startDay = datePart(b.start)
    let priorDay = ''
    for (let i = 0; i < count; i++) {
      const time = b.start + ((b.end - b.start) * i) / (count - 1)
      const currentDay = datePart(time)
      const dayChanged = currentDay !== priorDay
      const isDate = i === 0 || (dayChanged && currentDay !== startDay)
      result.push({
        key: i,
        x: xAt(time),
        label: isDate ? `${shortDate(time)} ${timePart(time)}` : timePart(time),
        isDate,
      })
      priorDay = currentDay
    }
    return result
  })

  /** 游標對應實際時間，二分搜尋最近的有效價點。 */
  const hoveredIndex = computed(() => {
    const b = bounds.value
    const px = pointerX.value
    const items = series.value
    if (!b || px === null || !items.length) return -1
    if (items.length === 1 || b.end === b.start) return 0
    const time = b.start + ((px - PADDING_X) / PLOT_WIDTH) * (b.end - b.start)
    let lo = 0
    let hi = items.length
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      if (items[mid]!.time < time) lo = mid + 1
      else hi = mid
    }
    if (lo === 0) return 0
    if (lo >= items.length) return items.length - 1
    return time - items[lo - 1]!.time <= items[lo]!.time - time ? lo - 1 : lo
  })
  const hovered = computed(() => {
    const index = hoveredIndex.value
    if (index < 0) return null
    const point = series.value[index]!
    return { point, x: plot.value[index]!.x, y: plot.value[index]!.y }
  })
  const tooltipLeft = computed(() => {
    const x = hovered.value?.x ?? 0
    return `${Math.max(11, Math.min(89, (x / WIDTH) * 100))}%`
  })

  function onPointerMove(event: PointerEvent): void {
    const element = containerRef.value?.querySelector('svg')
    if (!element) return
    const rect = element.getBoundingClientRect()
    if (!rect.width) return
    const x = ((event.clientX - rect.left) / rect.width) * WIDTH
    pointerX.value = Math.max(PADDING_X, Math.min(WIDTH - PADDING_X, x))
  }
  function clearHover(): void {
    pointerX.value = null
  }

  onMounted(() => {
    if (!containerRef.value) return
    containerWidth.value = containerRef.value.clientWidth
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver((entries) => {
        containerWidth.value = entries[0]?.contentRect.width ?? containerWidth.value
      })
      resizeObserver.observe(containerRef.value)
    }
  })
  onBeforeUnmount(() => resizeObserver?.disconnect())
</script>

<template>
  <div ref="containerRef" class="realtime-chart">
    <div v-if="!series.length" class="empty" role="status">
      <strong>尚未收到即時行情</strong>
      <span>等待傳回有效價格資料，收到後才會開始繪圖。</span>
    </div>
    <template v-else>
      <div class="chart-info">
        <span>最高 {{ fmtPrice(highPrice) }}</span>
        <span>最低 {{ fmtPrice(lowPrice) }}</span>
        <span>已記錄 {{ series.length }} 點</span>
      </div>
      <div class="chart-main">
        <svg
          :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
          preserveAspectRatio="none"
          role="img"
          aria-label="即時價格走勢，水平位置依實際時間等比例呈現"
          @pointermove="onPointerMove"
          @pointerleave="clearHover"
          @pointercancel="clearHover"
        >
          <line
            v-for="i in 4"
            :key="i"
            x1="0"
            :y1="(i * HEIGHT) / 5"
            :x2="WIDTH"
            :y2="(i * HEIGHT) / 5"
            stroke="#35424e"
            stroke-dasharray="4 7"
            stroke-width="1"
          />
          <line
            v-for="tick in ticks.slice(1, -1)"
            :key="tick.key"
            :x1="tick.x"
            y1="0"
            :x2="tick.x"
            :y2="HEIGHT"
            stroke="#35424e"
            stroke-opacity="0.27"
            stroke-dasharray="3 8"
            stroke-width="1"
          />
          <path v-if="plot.length > 1" :d="areaPath" :fill="color" fill-opacity="0.10" />
          <path
            v-if="plot.length > 1"
            :d="linePath"
            :stroke="color"
            stroke-width="2.5"
            fill="none"
            stroke-linecap="round"
            stroke-linejoin="round"
            vector-effect="non-scaling-stroke"
          />
          <circle
            v-if="lastCoordinate"
            :cx="lastCoordinate.x"
            :cy="lastCoordinate.y"
            r="5"
            :fill="color"
          />
          <template v-if="hovered">
            <line
              :x1="hovered.x"
              y1="0"
              :x2="hovered.x"
              :y2="HEIGHT"
              stroke="#afc2d0"
              stroke-width="1"
              stroke-dasharray="4 5"
              vector-effect="non-scaling-stroke"
            />
            <line
              x1="0"
              :y1="hovered.y"
              :x2="WIDTH"
              :y2="hovered.y"
              stroke="#afc2d0"
              stroke-opacity="0.65"
              stroke-width="1"
              stroke-dasharray="4 5"
              vector-effect="non-scaling-stroke"
            />
            <circle
              :cx="hovered.x"
              :cy="hovered.y"
              r="5"
              :fill="color"
              stroke="#151d24"
              stroke-width="2"
              vector-effect="non-scaling-stroke"
            />
          </template>
        </svg>
        <div v-if="hovered" class="chart-tooltip" :style="{ left: tooltipLeft }">
          <span>{{ fullDateTime(hovered.point.time) }} ({{ DISPLAY_OFFSET }})</span>
          <strong>{{ fmtPrice(hovered.point.price) }}</strong>
        </div>
      </div>
      <div class="time-axis" aria-label="台灣時間軸 UTC+8">
        <div
          v-for="(tick, index) in ticks"
          :key="tick.key"
          class="time-tick"
          :class="{ 'is-date': tick.isDate, first: index === 0, last: index === ticks.length - 1 }"
          :style="{ left: `${(tick.x / WIDTH) * 100}%` }"
        >
          {{ tick.label }}
        </div>
      </div>
      <p v-if="series.length === 1" class="waiting-next">等待下一個不同價格</p>
    </template>
  </div>
</template>

<style scoped>
  .realtime-chart {
    width: 100%;
    min-width: 0;
  }
  .chart-main {
    position: relative;
  }
  .chart-main svg {
    display: block;
    width: 100%;
    height: 260px;
    touch-action: pan-y;
  }
  .chart-info {
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px 18px;
    color: #8fa5b5;
    font-size: 12px;
    padding: 10px 4px;
  }
  .time-axis {
    position: relative;
    height: 35px;
    margin-top: 3px;
    border-top: 1px solid #293845;
  }
  .time-tick {
    position: absolute;
    top: 8px;
    transform: translateX(-50%);
    white-space: nowrap;
    font-size: 11px;
    color: #91a6b8;
    font-variant-numeric: tabular-nums;
  }
  .time-tick.first {
    transform: translateX(-12%);
  }
  .time-tick.last {
    transform: translateX(-88%);
  }
  .time-tick.is-date {
    color: #b7ccd8;
  }
  .chart-tooltip {
    position: absolute;
    top: 8px;
    transform: translateX(-50%);
    pointer-events: none;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 9px 12px;
    background: rgba(15, 23, 30, 0.94);
    color: #c9d8e1;
    border: 1px solid #425260;
    border-radius: 8px;
    font-size: 11px;
    white-space: nowrap;
    box-shadow: 0 8px 20px #0005;
    z-index: 1;
  }
  .chart-tooltip strong {
    font-size: 16px;
    color: #f0f6fa;
    font-variant-numeric: tabular-nums;
  }
  .waiting-next {
    color: #8fa5b5;
    text-align: center;
    font-size: 11px;
    margin: 0;
  }
  .empty {
    min-height: 200px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 10px;
    text-align: center;
    background: #19222a;
    border: 1px dashed #43505a;
    border-radius: 10px;
    padding: 22px;
  }
  .empty strong {
    color: #eaf1f6;
    font-size: 19px;
  }
  .empty span {
    color: #96a9b9;
    font-size: 12px;
    line-height: 1.7;
  }
  @media (max-width: 600px) {
    .chart-main svg {
      height: 220px;
    }
    .time-tick {
      font-size: 10px;
    }
    .chart-tooltip {
      font-size: 10px;
      max-width: 90%;
    }
  }
</style>
