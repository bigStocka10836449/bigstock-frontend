<template>
  <section class="market-chart-shell">
    <header class="chart-bar">
      <div class="legend"><span class="up">● 上漲</span><span class="down">● 下跌</span></div>
    </header>

    <div v-if="rows.length" class="info-panel">
      <div class="quote-line">
        <span
          >日期 <b>{{ selectedRow?.date ?? '—' }}</b></span
        >
        <span
          >開 <b>{{ formatPrice(selectedRow?.open) }}</b></span
        >
        <span
          >高 <b class="up">{{ formatPrice(selectedRow?.high) }}</b></span
        >
        <span
          >低 <b class="down">{{ formatPrice(selectedRow?.low) }}</b></span
        >
        <span
          >收 <b>{{ formatPrice(selectedRow?.close) }}</b></span
        >
        <span
          >量 <b>{{ formatVolume(selectedRow?.volume) }}</b></span
        >
        <span class="quote-divider"></span>
        <span
          >K(9) <b class="kd-k">{{ formatIndicator(selectedKd?.k) }}</b></span
        >
        <span
          >D(3) <b class="kd-d">{{ formatIndicator(selectedKd?.d) }}</b></span
        >
        <span
          >J <b>{{ formatIndicator(selectedKd?.j) }}</b></span
        >
        <span v-if="hoverIndex !== null" class="hint">游標所在 K 棒</span>
      </div>

      <div class="range-line">
        <span
          >可見區間 <b>{{ visibleStartDate }} ～ {{ visibleEndDate }}</b></span
        >
        <span
          >最高 <b class="up">{{ formatPrice(extremes?.high.price) }}</b></span
        >
        <span
          >最低 <b class="down">{{ formatPrice(extremes?.low.price) }}</b></span
        >
      </div>
    </div>

    <div v-if="!rows.length" class="empty">目前沒有可繪製的 K 線資料</div>
    <div v-show="rows.length > 0" class="chart-container">
      <div
        ref="chartEl"
        class="chart"
        role="img"
        aria-label="歷史 K 線、MA 均線、成交量、MA 扣抵與 KD 指標圖"
      ></div>
      <!-- 圖表鎖定層僅在選取模式出現，攔截整張 ECharts 的滑鼠與觸控事件。 -->
      <div
        v-if="rangeSelectionActive"
        class="chart-interaction-lock"
        aria-label="K 線已鎖定，請使用下方比對範圍條"
        @wheel.prevent
        @pointerdown.prevent
        @dblclick.prevent
      >
        <span>區間選取中 · K 線視窗已鎖定</span>
      </div>
      <!-- 僅標示，不攔截圖表的滑鼠事件。 -->
      <div v-if="highlightStyle" class="range-selection-layer">
        <div class="comparison-highlight" :style="highlightStyle"></div>
      </div>
    </div>
    <section
      v-if="periodLabel === '日 K' && rangeSelectionActive && draftIndices"
      class="comparison-range-editor"
      aria-label="相似走勢比對區間設定"
    >
      <div class="range-editor-top">
        <strong>調整搜尋範圍</strong>
        <span>拖曳兩端改變長度；拖曳中間移動整段</span>
      </div>
      <div class="range-track-row">
        <span class="range-track-date">{{ rows[lockedVisible.start]?.date.slice(0, 10) }}</span>
        <div
          ref="rangeTrackEl"
          class="range-track"
          @pointerdown="onTrackPointerDown"
          @pointermove="onTrackPointerMove"
          @pointerup="onTrackPointerUp"
          @pointercancel="onTrackPointerCancel"
          @lostpointercapture="onTrackPointerCancel"
        >
          <div class="range-track-highlight" :style="trackHighlightStyle">
            <button
              type="button"
              class="range-handle start"
              aria-label="調整比對起始位置"
              tabindex="0"
              @keydown="onHandleKeydown($event, 'start')"
            ></button>
            <span class="range-move-label">移動區間</span>
            <button
              type="button"
              class="range-handle end"
              aria-label="調整比對結束位置"
              tabindex="0"
              @keydown="onHandleKeydown($event, 'end')"
            ></button>
          </div>
        </div>
        <span class="range-track-date">{{ rows[lockedVisible.end]?.date.slice(0, 10) }}</span>
      </div>
      <div class="range-editor-meta" aria-live="polite">
        {{ draftRange?.startDate }} ～ {{ draftRange?.endDate }} · {{ draftRange?.windowSize }} 根日
        K
      </div>
    </section>
  </section>
</template>

<script setup lang="ts">
  import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
  import * as echarts from 'echarts'
  interface UnifiedCandle {
    time: number
    open: number
    high: number
    low: number
    close: number
    volume?: number | null
  }
  import {
    calculateMarketIndicators,
    findVisibleExtremes,
    type OhlcvCandle,
  } from '@/utils/marketIndicators'

  type ComparisonRange = { startDate: string; endDate: string; windowSize: number }
  const emit = defineEmits<{
    (e: 'visible-range-change', range: ComparisonRange): void
    (e: 'comparison-range-preview', range: ComparisonRange | null): void
  }>()
  const props = withDefaults(
    defineProps<{
      candles: UnifiedCandle[]
      timezone?: string
      periodLabel?: string
      title?: string
      rangeSelectionActive?: boolean
      selectedComparisonRange?: ComparisonRange | null
      /** 初次載入時顯示幾根 K 棒；all 表示完整歷史，仍可自由縮放。 */
      initialVisibleBars?: number | 'all'
    }>(),
    {
      timezone: '',
      periodLabel: '日 K',
      title: '技術分析',
      rangeSelectionActive: false,
      selectedComparisonRange: null,
      initialVisibleBars: 90,
    },
  )

  type PriceRow = OhlcvCandle & { date: string; time: number }
  const chartEl = ref<HTMLDivElement | null>(null)
  const hoverIndex = ref<number | null>(null)
  type IndexRange = { start: number; end: number }
  const draftIndices = ref<IndexRange | null>(null)
  const lockedVisible = ref<IndexRange>({ start: 0, end: 0 })
  const rangeTrackEl = ref<HTMLDivElement | null>(null)
  const highlightStyle = ref<Record<string, string> | null>(null)
  type DragMode = 'start' | 'end' | 'move'
  let rangeDrag: {
    pointerId: number
    mode: DragMode
    originX: number
    initial: IndexRange
  } | null = null
  const draftRange = computed<ComparisonRange | null>(() => {
    if (!draftIndices.value) return null
    const { start, end } = draftIndices.value
    return rows.value[start] && rows.value[end]
      ? {
          startDate: rows.value[start]!.date.slice(0, 10),
          endDate: rows.value[end]!.date.slice(0, 10),
          windowSize: end - start + 1,
        }
      : null
  })
  const trackHighlightStyle = computed(() => {
    const selected = draftIndices.value
    const visible = lockedVisible.value
    if (!selected) return {}
    const count = visible.end - visible.start + 1
    return {
      left: `${((selected.start - visible.start) / count) * 100}%`,
      width: `${((selected.end - selected.start + 1) / count) * 100}%`,
    }
  })
  const visibleRange = ref({ start: 0, end: 0 })
  const up = '#ec696c'
  const down = '#39b98b'
  const maColors: Record<number, string> = {
    5: '#f05f65',
    10: '#70a7ff',
    20: '#93cf7c',
    60: '#f7c15b',
  }
  const periods = [5, 10, 20, 60] as const
  let instance: echarts.ECharts | null = null
  let observer: ResizeObserver | null = null
  let renderSequence = 0
  let extremeTimer: ReturnType<typeof setTimeout> | null = null
  let resizing = false
  let mounted = false
  let previousContext = ''

  const isMinutePeriod = computed(() => props.periodLabel.includes('分 K'))
  const dateFormat = computed(() => {
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: props.timezone || 'Asia/Taipei',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        ...(isMinutePeriod.value
          ? { hour: '2-digit' as const, minute: '2-digit' as const, hourCycle: 'h23' as const }
          : {}),
      })
    } catch {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'UTC',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        ...(isMinutePeriod.value
          ? { hour: '2-digit' as const, minute: '2-digit' as const, hourCycle: 'h23' as const }
          : {}),
      })
    }
  })

  // 固定輸出 yyyy-MM-dd，避免不同瀏覽器對 en-CA 格式的差異。
  function formatAxisDate(timestamp: number): string {
    const parts = dateFormat.value.formatToParts(new Date(timestamp * 1000))
    const value = (kind: string) => parts.find((part) => part.type === kind)?.value ?? ''
    const day = `${value('year')}-${value('month')}-${value('day')}`
    return isMinutePeriod.value ? `${day} ${value('hour')}:${value('minute')}` : day
  }

  // API 只需提供 OHLCV；不依賴後端的技術指標欄位。
  const rows = computed<PriceRow[]>(() =>
    (props.candles ?? [])
      .map((x) => ({
        time: Number(x.time),
        date: formatAxisDate(Number(x.time)),
        open: Number(x.open),
        close: Number(x.close),
        high: Number(x.high),
        low: Number(x.low),
        volume: x.volume == null ? null : Number(x.volume),
      }))
      .filter(
        (x) =>
          Number.isFinite(x.time) &&
          Number.isFinite(x.open) &&
          Number.isFinite(x.close) &&
          Number.isFinite(x.high) &&
          Number.isFinite(x.low) &&
          x.high >= x.low &&
          (x.volume === null || Number.isFinite(x.volume)),
      )
      .sort((a, b) => a.time - b.time),
  )
  const indicators = computed(() => calculateMarketIndicators(rows.value))
  const selectedIndex = computed(() =>
    hoverIndex.value !== null && hoverIndex.value >= 0 && hoverIndex.value < rows.value.length
      ? hoverIndex.value
      : rows.value.length - 1,
  )
  const selectedRow = computed(() => rows.value[selectedIndex.value] ?? null)
  const selectedKd = computed(() => indicators.value.kdj[selectedIndex.value] ?? null)
  const extremes = computed(() =>
    findVisibleExtremes(rows.value, visibleRange.value.start, visibleRange.value.end),
  )
  const visibleStartDate = computed(() => rows.value[visibleRange.value.start]?.date ?? '—')
  const visibleEndDate = computed(() => rows.value[visibleRange.value.end]?.date ?? '—')

  function formatPrice(v: number | null | undefined): string {
    if (v == null || !Number.isFinite(v)) return '—'
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(v)
  }
  function formatIndicator(v: number | null | undefined): string {
    return v == null || !Number.isFinite(v) ? '—' : v.toFixed(2)
  }
  function formatVolume(v: number | null | undefined): string {
    if (v == null || !Number.isFinite(v)) return '—'
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(v)
  }
  function compactVolume(v: number): string {
    if (v >= 1e6) return `${+(v / 1e6).toFixed(1)}M`
    if (v >= 1e3) return `${+(v / 1e3).toFixed(1)}K`
    return String(Math.round(v))
  }

  // ECharts getOption() 的 dataZoom 型別可能是 {}，不可直接用 [0] 索引。
  // 先確認實際為陣列，避免 TS7053 與尚未初始化時的執行錯誤。
  type CurrentZoom = {
    start?: number
    end?: number
    startValue?: string | number
    endValue?: string | number
  }

  function getCurrentZoom(): CurrentZoom | null {
    if (!instance || instance.isDisposed()) return null
    // echarts.init() 完成後、第一次 setOption() 前，getOption() 可能是 undefined。
    // 這時尚無縮放狀態，直接讓 draw() 使用預設顯示區間。
    const option = instance.getOption()
    if (!option) return null
    const dataZoom: unknown = option.dataZoom
    if (!Array.isArray(dataZoom) || dataZoom.length === 0) return null
    const first: unknown = dataZoom[0]
    if (first === null || typeof first !== 'object') return null
    const record = first as Record<string, unknown>
    const asNumber = (value: unknown): number | undefined =>
      typeof value === 'number' && Number.isFinite(value) ? value : undefined
    const asAxisValue = (value: unknown): string | number | undefined =>
      typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value))
        ? value
        : undefined
    return {
      start: asNumber(record.start),
      end: asNumber(record.end),
      startValue: asAxisValue(record.startValue),
      endValue: asAxisValue(record.endValue),
    }
  }

  // 根據 ECharts 實際 zoom 狀態重算區間，不在拖曳中重建整張圖。
  function publishVisibleRange(): void {
    if (props.periodLabel !== '日 K' || !rows.value.length) return
    const start = rows.value[visibleRange.value.start]
    const end = rows.value[visibleRange.value.end]
    if (!start || !end) return
    emit('visible-range-change', {
      startDate: start.date.slice(0, 10),
      endDate: end.date.slice(0, 10),
      windowSize: visibleRange.value.end - visibleRange.value.start + 1,
    })
  }
  function syncVisibleRange(): void {
    if (!instance || !rows.value.length) return
    const z = getCurrentZoom()
    const n = rows.value.length
    const dates = rows.value.map((x) => x.date)
    const asIndex = (v: unknown, fallback: number): number => {
      if (typeof v === 'string') {
        const i = dates.indexOf(v)
        if (i !== -1) return i
      }
      if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < n) return v
      return fallback
    }
    const start = asIndex(z?.startValue, Math.floor(((z?.start ?? 0) / 100) * (n - 1)))
    const end = asIndex(z?.endValue, Math.ceil(((z?.end ?? 100) / 100) * (n - 1)))
    visibleRange.value = {
      start: Math.max(0, Math.min(n - 1, start)),
      end: Math.max(0, Math.min(n - 1, end)),
    }
    if (visibleRange.value.end < visibleRange.value.start)
      visibleRange.value.end = visibleRange.value.start
    publishVisibleRange()
  }

  function indexRangeFromDates(range: ComparisonRange | null): IndexRange | null {
    if (!range) return null
    const start = rows.value.findIndex((r) => r.date.slice(0, 10) === range.startDate)
    const end = rows.value.findIndex((r) => r.date.slice(0, 10) === range.endDate)
    return start >= 0 && end >= start ? { start, end } : null
  }

  function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value))
  }

  function setDraftIndices(range: IndexRange): void {
    draftIndices.value = range
    updateComparisonHighlight()
    emit('comparison-range-preview', draftRange.value)
  }

  function beginRangeSelection(): void {
    // 選取期間不再讀取新的 zoom：鎖住使用者開始選取當下的 K 線可見索引。
    syncVisibleRange()
    lockedVisible.value = { ...visibleRange.value }
    const { start, end } = lockedVisible.value
    const maxLength = end - start + 1
    if (maxLength < 5) {
      draftIndices.value = null
      emit('comparison-range-preview', null)
      return
    }
    const preserved = indexRangeFromDates(props.selectedComparisonRange ?? null)
    if (
      preserved &&
      preserved.start >= start &&
      preserved.end <= end &&
      preserved.end - preserved.start + 1 >= 5
    ) {
      setDraftIndices(preserved)
    } else {
      const length = Math.min(500, maxLength, Math.max(5, Math.round(maxLength * 0.6)))
      const first = start + Math.floor((maxLength - length) / 2)
      setDraftIndices({ start: first, end: first + length - 1 })
    }
    // ECharts 原有 dataZoom 設定不覆寫，只按 id 停用兩種縮放；覆蓋層另行擋住其他互動。
    instance?.setOption(
      {
        dataZoom: [
          { id: 'market-inside', disabled: true },
          { id: 'market-slider', disabled: true },
        ],
        tooltip: { show: false },
      },
      { lazyUpdate: false },
    )
  }

  function finishRangeSelection(): void {
    rangeDrag = null
    draftIndices.value = null
    emit('comparison-range-preview', null)
    instance?.setOption(
      {
        dataZoom: [
          { id: 'market-inside', disabled: false },
          { id: 'market-slider', disabled: false },
        ],
        tooltip: { show: true },
      },
      { lazyUpdate: false },
    )
    nextTick(updateComparisonHighlight)
  }

  watch(
    () => props.rangeSelectionActive,
    async (enabled, previous) => {
      if (enabled === previous) return
      await nextTick()
      if (enabled && props.periodLabel === '日 K') beginRangeSelection()
      else finishRangeSelection()
    },
  )
  watch(
    () => props.selectedComparisonRange,
    () => nextTick(updateComparisonHighlight),
    { deep: true },
  )

  function updateComparisonHighlight(): void {
    if (!instance || !chartEl.value || !rows.value.length) {
      highlightStyle.value = null
      return
    }
    const pair = draftIndices.value ?? indexRangeFromDates(props.selectedComparisonRange ?? null)
    if (!pair) {
      highlightStyle.value = null
      return
    }
    const a = instance.convertToPixel({ xAxisIndex: 0 }, pair.start)
    const b = instance.convertToPixel({ xAxisIndex: 0 }, pair.end)
    if (
      typeof a !== 'number' ||
      typeof b !== 'number' ||
      !Number.isFinite(a) ||
      !Number.isFinite(b)
    ) {
      highlightStyle.value = null
      return
    }
    const zoom = visibleRange.value
    if (pair.end < zoom.start || pair.start > zoom.end) {
      highlightStyle.value = null
      return
    }
    const plotWidth = chartEl.value.clientWidth - 68 - 90
    const step =
      zoom.end > zoom.start
        ? Math.abs(
            instance.convertToPixel({ xAxisIndex: 0 }, zoom.start + 1) -
              instance.convertToPixel({ xAxisIndex: 0 }, zoom.start),
          )
        : 0
    const half = typeof step === 'number' && Number.isFinite(step) ? step / 2 : 2
    const left = clamp(Math.min(a, b) - half, 68, 68 + plotWidth)
    const right = clamp(Math.max(a, b) + half, 68, 68 + plotWidth)
    highlightStyle.value = { left: `${left}px`, width: `${Math.max(0, right - left)}px` }
  }

  function trackX(event: PointerEvent): number {
    const rect = rangeTrackEl.value!.getBoundingClientRect()
    return clamp((event.clientX - rect.left) / Math.max(rect.width, 1), 0, 1)
  }

  function onTrackPointerDown(event: PointerEvent): void {
    if (!props.rangeSelectionActive || !draftIndices.value || event.button !== 0) return
    const current = draftIndices.value
    const range = lockedVisible.value
    const count = range.end - range.start + 1
    const index = range.start + clamp(Math.floor(trackX(event) * count), 0, count - 1)
    const target = event.target as HTMLElement
    let mode: DragMode
    if (target.closest('.range-handle.start')) mode = 'start'
    else if (target.closest('.range-handle.end')) mode = 'end'
    else if (index >= current.start && index <= current.end) mode = 'move'
    else mode = Math.abs(index - current.start) <= Math.abs(index - current.end) ? 'start' : 'end'
    rangeDrag = {
      pointerId: event.pointerId,
      mode,
      originX: event.clientX,
      initial: { ...current },
    }
    rangeTrackEl.value?.setPointerCapture(event.pointerId)
    event.preventDefault()
  }

  function onTrackPointerMove(event: PointerEvent): void {
    if (!rangeDrag || rangeDrag.pointerId !== event.pointerId || !rangeTrackEl.value) return
    const width = rangeTrackEl.value.getBoundingClientRect().width
    const { start: min, end: max } = lockedVisible.value
    const count = max - min + 1
    const delta = Math.round(((event.clientX - rangeDrag.originX) / Math.max(width, 1)) * count)
    const initial = rangeDrag.initial
    const maxWindow = Math.min(500, count)
    const minWindow = Math.min(5, count)
    let selected: IndexRange
    if (rangeDrag.mode === 'start') {
      selected = {
        start: clamp(
          initial.start + delta,
          Math.max(min, initial.end - maxWindow + 1),
          initial.end - minWindow + 1,
        ),
        end: initial.end,
      }
    } else if (rangeDrag.mode === 'end') {
      selected = {
        start: initial.start,
        end: clamp(
          initial.end + delta,
          initial.start + minWindow - 1,
          Math.min(max, initial.start + maxWindow - 1),
        ),
      }
    } else {
      const shift = clamp(delta, min - initial.start, max - initial.end)
      selected = { start: initial.start + shift, end: initial.end + shift }
    }
    if (selected.start !== draftIndices.value?.start || selected.end !== draftIndices.value?.end)
      setDraftIndices(selected)
  }
  function onTrackPointerUp(event: PointerEvent): void {
    if (rangeDrag?.pointerId !== event.pointerId) return
    onTrackPointerMove(event)
    rangeDrag = null
    if (rangeTrackEl.value?.hasPointerCapture(event.pointerId))
      rangeTrackEl.value.releasePointerCapture(event.pointerId)
  }
  function onTrackPointerCancel(): void {
    rangeDrag = null
  }
  function onHandleKeydown(event: KeyboardEvent, mode: 'start' | 'end'): void {
    if (!draftIndices.value || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return
    event.preventDefault()
    const delta = event.key === 'ArrowLeft' ? -1 : 1
    const { start, end } = draftIndices.value
    const { start: min, end: max } = lockedVisible.value
    if (mode === 'start')
      setDraftIndices({ start: clamp(start + delta, Math.max(min, end - 499), end - 4), end })
    else setDraftIndices({ start, end: clamp(end + delta, start + 4, Math.min(max, start + 499)) })
  }

  function scatterMarker(
    id: string,
    name: string,
    index: number | null,
    price: number | null,
    position: 'top' | 'bottom',
    color: string,
  ) {
    return {
      id,
      name,
      type: 'scatter' as const,
      xAxisIndex: 0,
      yAxisIndex: 0,
      symbolSize: 5,
      silent: true,
      z: 10,
      itemStyle: { color },
      label: {
        show: true,
        position,
        distance: 8,
        color,
        fontWeight: 700,
        fontSize: 12,
        formatter: () => `${name} ${formatPrice(price)}`,
      },
      data: index === null || price === null ? [] : [[rows.value[index]!.date, price]],
    }
  }
  function refreshExtremeMarkers(): void {
    if (!instance) return
    const ex = extremes.value
    // 僅更新兩個 scatter Series；不重建 K 棒、MA、KD 與 zoom。
    instance.setOption(
      {
        series: [
          {
            id: 'visible-high',
            data: ex ? [[rows.value[ex.high.index]!.date, ex.high.price]] : [],
          },
          { id: 'visible-low', data: ex ? [[rows.value[ex.low.index]!.date, ex.low.price]] : [] },
        ],
      },
      { lazyUpdate: true },
    )
  }
  function onZoom(): void {
    syncVisibleRange()
    updateComparisonHighlight()
    if (extremeTimer) clearTimeout(extremeTimer)
    extremeTimer = setTimeout(() => {
      extremeTimer = null
      refreshExtremeMarkers()
    }, 120)
  }
  function onAxisPointer(event: {
    axesInfo?: Array<{ axisDim?: string; axisIndex?: number; value?: string | number }>
  }): void {
    const entry = event.axesInfo?.find((x) => x.axisDim === 'x' && x.axisIndex === 0)
    if (!entry) return
    const value = entry.value
    if (typeof value === 'string') {
      const idx = rows.value.findIndex((x) => x.date === value)
      if (idx >= 0) hoverIndex.value = idx
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      const idx = Math.round(value)
      if (idx >= 0 && idx < rows.value.length) hoverIndex.value = idx
    }
  }
  function clearHover(): void {
    hoverIndex.value = null
  }

  function draw(): void {
    const el = chartEl.value
    const candles = rows.value
    if (!mounted || !el || !candles.length || !el.clientWidth || !el.clientHeight) return
    if (!instance) {
      instance = echarts.init(el, undefined, { renderer: 'canvas' })
      instance.on('datazoom', onZoom)
      instance.on('updateAxisPointer', onAxisPointer as (...args: any[]) => void)
      instance.getZr().on('globalout', clearHover)
    }
    if (extremeTimer) clearTimeout(extremeTimer)
    hoverIndex.value = null
    const length = candles.length
    const context = `${props.timezone}|${props.periodLabel}`
    const zoom = getCurrentZoom()
    const preserveZoom =
      previousContext === context &&
      zoom &&
      Number.isFinite(zoom.start) &&
      Number.isFinite(zoom.end)
    const initialBars =
      props.initialVisibleBars === 'all'
        ? length
        : Math.max(1, Number(props.initialVisibleBars) || 90)
    const start = preserveZoom
      ? Number(zoom!.start)
      : Math.max(0, 100 - (initialBars / length) * 100)
    const end = preserveZoom ? Number(zoom!.end) : 100
    previousContext = context
    visibleRange.value = {
      start: Math.max(0, Math.floor((start / 100) * (length - 1))),
      end: Math.min(length - 1, Math.ceil((end / 100) * (length - 1))),
    }
    publishVisibleRange()
    const dates = candles.map((x) => x.date)
    const indicator = indicators.value
    const ex = extremes.value
    const line = (period: number) => ({
      id: `ma-${period}`,
      name: `MA${period}`,
      type: 'line',
      xAxisIndex: 0,
      yAxisIndex: 0,
      data: indicator.ma[period],
      showSymbol: false,
      connectNulls: false,
      smooth: false,
      silent: true,
      lineStyle: { width: 1.5, color: maColors[period] },
      itemStyle: { color: maColors[period] },
    })
    const kdLine = (key: 'k' | 'd', color: string) => ({
      id: `kd-${key}`,
      name: key === 'k' ? 'K(9)' : 'D(3)',
      type: 'line',
      xAxisIndex: 3,
      yAxisIndex: 3,
      data: indicator.kdj.map((r) => r[key]),
      connectNulls: false,
      showSymbol: false,
      smooth: false,
      silent: true,
      lineStyle: { width: 1.5, color },
      itemStyle: { color },
    })
    // MA 扣抵：用「下一根 MA 將扣掉的那根 K 棒」的原始交易日期定位。
    // 不顯示日期標籤；每條均線各佔一個很薄的 lane，箭頭朝向上方成交量。
    // 四個 xAxis 使用相同完整索引範圍；扣抵使用原始 K 棒索引，不允許稀疏序列縮小軸範圍。
    const deductionSeries = periods.map((period, order) => {
      const point = indicator.deductions.find((x) => x.period === period)
      const color = maColors[period]
      const lane = 4 - order
      return {
        id: `deduct-${period}`,
        name: `MA${period} 扣抵`,
        type: 'scatter',
        xAxisIndex: 2,
        yAxisIndex: 2,
        symbol: 'triangle',
        symbolRotate: 0,
        symbolSize: 12,
        silent: true,
        z: 12,
        itemStyle: { color, borderColor: '#16222c', borderWidth: 1 },
        label: { show: false },
        // category 的數值索引，對齊 xAxis.data[point.index] 與 K 棒的同一格。
        // 不能使用偏移、日曆日減法或該序列獨立縮放範圍。
        data: point && candles[point.index] ? [[point.index, lane]] : [],
      }
    })
    instance.setOption(
      {
        backgroundColor: 'transparent',
        animation: false,
        legend: {
          top: 2,
          left: 'center',
          textStyle: { color: '#a9b9c6', fontSize: 11 },
          data: [props.periodLabel, 'MA5', 'MA10', 'MA20', 'MA60', 'K(9)', 'D(3)'],
        },
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'cross' },
          backgroundColor: '#1c2934',
          borderColor: '#354b5a',
          textStyle: { color: '#ecf3f7' },
          // 不能使用 items[0].dataIndex：扣抵 scatter 只有一筆資料，
          // dataIndex=0 並非原始 K 棒的索引，會誤顯示第一根（例如 2025 年）。
          formatter: (
            items: Array<{ seriesId?: string; axisValue?: string | number; dataIndex?: number }>,
          ) => {
            const candleItem = items.find((item) => item.seriesId === 'candle')
            const axisValue = candleItem?.axisValue ?? items[0]?.axisValue
            let index = typeof axisValue === 'string' ? dates.indexOf(axisValue) : -1
            if (index < 0 && typeof axisValue === 'number' && Number.isInteger(axisValue)) {
              index = axisValue
            }
            if (index < 0 && candleItem) index = candleItem.dataIndex ?? -1
            const x = candles[index]
            const kd = indicator.kdj[index]
            if (!x) return ''
            return `${x.date}<br/>開 ${formatPrice(x.open)}　高 ${formatPrice(x.high)}<br/>低 ${formatPrice(x.low)}　收 ${formatPrice(x.close)}<br/>量 ${formatVolume(x.volume)}<br/>K ${formatIndicator(kd?.k)}　D ${formatIndicator(kd?.d)}`
          },
        },
        axisPointer: { link: [{ xAxisIndex: [0, 1, 2, 3] }] },
        grid: [
          { left: 68, right: 90, top: 55, height: '39%' },
          { left: 68, right: 90, top: '52%', height: '12%' },
          { left: 68, right: 90, top: '64.5%', height: '6%' },
          { left: 68, right: 90, top: '74%', height: '17%' },
        ],
        xAxis: [0, 1, 2, 3].map((i) => ({
          type: 'category',
          gridIndex: i,
          data: dates,
          scale: true,
          boundaryGap: true,
          min: 0,
          max: dates.length - 1,
          axisLine: { lineStyle: { color: '#657687' } },
          axisLabel: { show: i === 3, color: '#9aabba', hideOverlap: true },
          axisTick: { show: false },
          splitLine: { show: false },
        })),
        yAxis: [
          {
            type: 'value',
            scale: true,
            axisLabel: { color: '#91a5b5' },
            splitLine: { lineStyle: { color: '#293746' } },
          },
          {
            type: 'value',
            gridIndex: 1,
            scale: true,
            axisLabel: { color: '#91a5b5', formatter: compactVolume },
            splitLine: { show: false },
          },
          {
            type: 'value',
            gridIndex: 2,
            min: 0.5,
            max: 4.5,
            interval: 1,
            axisLabel: { show: false },
            axisLine: { show: false },
            axisTick: { show: false },
            splitLine: { show: false },
          },
          {
            type: 'value',
            gridIndex: 3,
            min: 0,
            max: 100,
            interval: 50,
            axisLabel: { color: '#91a5b5' },
            splitLine: { lineStyle: { color: '#283746' } },
          },
        ],
        dataZoom: [
          {
            id: 'market-inside',
            type: 'inside',
            xAxisIndex: [0, 1, 2, 3],
            filterMode: 'none',
            start,
            end,
            zoomOnMouseWheel: true,
            moveOnMouseMove: true,
            moveOnMouseWheel: false,
            throttle: 65,
          },
          {
            id: 'market-slider',
            type: 'slider',
            xAxisIndex: [0, 1, 2, 3],
            filterMode: 'none',
            start,
            end,
            bottom: 3,
            height: 17,
            borderColor: '#364958',
            fillerColor: 'rgba(84, 184, 150, .16)',
            textStyle: { color: '#9aabba' },
            showDetail: false,
          },
        ],
        series: [
          {
            id: 'candle',
            name: props.periodLabel,
            type: 'candlestick',
            xAxisIndex: 0,
            yAxisIndex: 0,
            data: candles.map((x) => [x.open, x.close, x.low, x.high]),
            itemStyle: { color: up, color0: down, borderColor: up, borderColor0: down },
          },
          ...periods.map(line),
          {
            id: 'volume',
            name: '成交量',
            type: 'bar',
            xAxisIndex: 1,
            yAxisIndex: 1,
            data: candles.map((x) => ({
              value: x.volume,
              itemStyle: { color: x.close >= x.open ? up : down },
            })),
            barMaxWidth: 9,
            silent: true,
          },
          kdLine('k', '#61aeff'),
          kdLine('d', '#f9bc5a'),
          ...deductionSeries,
          scatterMarker(
            'visible-high',
            '最高',
            ex?.high.index ?? null,
            ex?.high.price ?? null,
            'top',
            '#f58d91',
          ),
          scatterMarker(
            'visible-low',
            '最低',
            ex?.low.index ?? null,
            ex?.low.price ?? null,
            'bottom',
            '#5cddac',
          ),
        ],
      },
      { notMerge: true, lazyUpdate: false },
    )
    // ECharts 在設置資料後才具備 dataZoom 狀態；此處只讀、不重新繪圖。
    syncVisibleRange()
    if (props.rangeSelectionActive) beginRangeSelection()
    updateComparisonHighlight()
  }

  async function scheduleDraw(): Promise<void> {
    const sequence = ++renderSequence
    await nextTick()
    if (sequence !== renderSequence) return
    draw()
  }
  watch(
    () => [props.candles, props.timezone, props.periodLabel],
    () => {
      void scheduleDraw()
    },
  )
  onMounted(() => {
    mounted = true
    observer = new ResizeObserver(() => {
      const el = chartEl.value
      if (!el || !el.clientWidth || !el.clientHeight) return
      if (!instance) {
        void scheduleDraw()
        return
      }
      if (resizing) return
      resizing = true
      requestAnimationFrame(() => {
        resizing = false
        instance?.resize()
        updateComparisonHighlight()
      })
    })
    if (chartEl.value) observer.observe(chartEl.value)
    void scheduleDraw()
  })
  onBeforeUnmount(() => {
    mounted = false
    renderSequence++
    if (extremeTimer) clearTimeout(extremeTimer)
    observer?.disconnect()
    instance?.dispose()
    instance = null
  })
</script>

<style scoped>
  .market-chart-shell {
    min-width: 0;
    width: 100%;
    color: #edf3f7;
  }
  .chart-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;
  }
  .chart-bar strong {
    font-size: 16px;
  }
  .sub {
    margin-left: 12px;
    color: #9baab8;
    font-size: 12px;
  }
  .legend {
    display: flex;
    gap: 14px;
    font-size: 12px;
  }
  .up {
    color: #ec696c;
  }
  .down {
    color: #39b98b;
  }
  .info-panel {
    padding: 12px 14px;
    margin-bottom: 12px;
    border: 1px solid #304555;
    border-radius: 10px;
    background: #1c2a35;
    font-size: 12px;
  }
  .quote-line,
  .range-line,
  .deduction-line {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 18px;
    align-items: center;
    line-height: 1.8;
  }
  .quote-line b,
  .range-line b {
    margin-left: 4px;
    color: #e9f0f5;
  }
  .quote-line b.up,
  .range-line b.up {
    color: #ec696c;
  }
  .quote-line b.down,
  .range-line b.down {
    color: #39b98b;
  }
  .quote-divider {
    border-left: 1px solid #476071;
    height: 15px;
  }
  .range-line,
  .deduction-line {
    margin-top: 6px;
  }
  .muted,
  .hint {
    color: #91a3b3;
  }
  .hint {
    font-size: 11px;
  }
  .kd-k {
    color: #61aeff !important;
  }
  .kd-d {
    color: #f9bc5a !important;
  }
  .deduction {
    color: var(--indicator-color);
    display: inline-flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px;
    border: 1px solid color-mix(in srgb, var(--indicator-color) 30%, transparent);
    border-radius: 6px;
    padding: 3px 7px;
  }
  .deduction-symbol {
    font-size: 12px;
  }
  .deduction b {
    color: #edf3f7;
  }
  .deduction small {
    color: #9daebc;
    margin-left: 4px;
  }
  .chart-container {
    position: relative;
  }
  .range-selection-layer {
    position: absolute;
    inset: 55px 0 auto 0;
    height: 39%;
    pointer-events: none;
    z-index: 4;
  }
  .chart-interaction-lock {
    position: absolute;
    inset: 0;
    z-index: 5;
    cursor: not-allowed;
    touch-action: none;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    pointer-events: auto;
  }
  .chart-interaction-lock span {
    margin-top: 26px;
    background: rgba(24, 48, 57, 0.94);
    color: #b3f2d6;
    font-size: 12px;
    padding: 6px 12px;
    border-radius: 8px;
    border: 1px solid #3c8e73;
  }
  .comparison-highlight {
    position: absolute;
    top: 0;
    height: 100%;
    box-sizing: border-box;
    background: rgba(85, 196, 154, 0.14);
    border: 2px dashed #65d7af;
    pointer-events: none;
  }
  .comparison-range-editor {
    padding: 14px 18px;
    border: 1px solid #3c675b;
    border-radius: 10px;
    background: #1e343b;
    margin-top: 12px;
  }
  .range-editor-top {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 8px;
    font-size: 13px;
    margin-bottom: 18px;
  }
  .range-editor-top span {
    color: #b5c9d2;
    font-size: 12px;
  }
  .range-track-row {
    display: flex;
    align-items: center;
    gap: 0;
    padding-left: 68px;
    padding-right: 90px;
    position: relative;
    margin: 25px -18px 8px;
  }
  .range-track-date {
    position: absolute;
    top: -20px;
    font-size: 11px;
    color: #b4c9d0;
    white-space: nowrap;
  }
  .range-track-date:first-child {
    left: 68px;
  }
  .range-track-date:last-child {
    right: 90px;
  }
  .range-track {
    position: relative;
    height: 28px;
    flex: 1;
    background: #344957;
    border-radius: 7px;
    touch-action: none;
    cursor: crosshair;
    min-width: 0;
  }
  .range-track-highlight {
    position: absolute;
    height: 100%;
    background: rgba(72, 186, 149, 0.45);
    border: 2px solid #64e0b4;
    border-radius: 5px;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: grab;
  }
  .range-handle {
    position: absolute;
    top: -4px;
    bottom: -4px;
    width: 14px;
    background: #82e9c1;
    border: 2px solid #133b32;
    border-radius: 5px;
    cursor: ew-resize;
    padding: 0;
  }
  .range-handle.start {
    left: -7px;
  }
  .range-handle.end {
    right: -7px;
  }
  .range-handle:focus-visible {
    outline: 2px solid white;
    outline-offset: 2px;
  }
  .range-move-label {
    font-size: 11px;
    color: #ebfff5;
    pointer-events: none;
    margin: auto;
    white-space: nowrap;
    overflow: hidden;
  }
  .range-editor-meta {
    text-align: center;
    font-size: 12px;
    margin-top: 14px;
    color: #9debc8;
  }
  @media (max-width: 640px) {
    .range-track-date {
      display: none;
    }
    .comparison-range-editor {
      padding: 12px;
    }
    .range-track-row {
      margin-left: -12px;
      margin-right: -12px;
    }
  }
  .chart {
    width: 100%;
    height: 740px;
    min-height: 560px;
  }
  .empty {
    padding: 80px 20px;
    text-align: center;
    color: #95a4b0;
  }
  @media (max-width: 640px) {
    .chart {
      height: 630px;
    }
    .sub {
      display: block;
      margin: 3px 0 0;
    }
  }
</style>
