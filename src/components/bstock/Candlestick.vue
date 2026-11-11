<template>
  <section class="bstock-candlestick">
    <header class="chart-heading">
      <div>
        <strong>{{ selectedStockCode }} 股價走勢</strong>
      </div>
      <div class="period-tabs" role="group" aria-label="K 線週期">
        <button
          v-for="p in periods"
          :key="p.id"
          type="button"
          :class="{ active: selectedView === p.id }"
          :aria-pressed="selectedView === p.id"
          :disabled="rangeSelectionActive"
          @click="selectedView = p.id"
        >
          {{ p.label }}
        </button>
      </div>
    </header>
    <div v-if="isIntraday && loadingIntraday" class="intraday-status" role="status">
      正在載入{{ selectedPeriodLabel }}資料...
    </div>
    <div v-else-if="isIntraday && intradayError" class="intraday-status error" role="alert">
      {{ intradayError }}
      <button type="button" class="retry-button" @click="retryIntraday">重試</button>
    </div>
    <UnifiedCandlestickChart
      v-else
      :key="selectedStockCode + ':' + selectedView"
      :candles="candles"
      timezone="Asia/Taipei"
      :title="selectedStockCode + ' · 技術分析'"
      :period-label="selectedPeriodLabel"
      :range-selection-active="rangeSelectionActive"
      :selected-comparison-range="manualComparisonRange"
      @visible-range-change="onVisibleRangeChange"
      @comparison-range-preview="onComparisonRangePreview"
    />
    <section v-if="selectedView === 'day' && candles.length" class="similarity-section">
      <div class="similarity-toolbar">
        <div class="similarity-intro">
          <strong>尋找相似走勢</strong>
          <p>
            按下「選取比對區間」後，K
            線視窗會暫時鎖定。請在圖表下方拖曳範圍條的左右把手，或移動整段區間。
          </p>
          <div class="range-actions">
            <template v-if="rangeSelectionActive">
              <button
                type="button"
                class="range-select-btn"
                :disabled="
                  !draftComparisonRange ||
                  draftComparisonRange.windowSize < 5 ||
                  draftComparisonRange.windowSize > 500
                "
                @click="confirmRangeSelection"
              >
                確認區間
              </button>
              <button type="button" class="range-reset-btn" @click="cancelRangeSelection">
                取消選取
              </button>
            </template>
            <template v-else>
              <button
                type="button"
                class="range-select-btn"
                :disabled="!visibleComparisonRange || visibleComparisonRange.windowSize < 5"
                @click="startRangeSelection"
              >
                {{ manualComparisonRange ? '重新選取比對區間' : '選取比對區間' }}
              </button>
              <button
                v-if="manualComparisonRange"
                type="button"
                class="range-reset-btn"
                @click="clearManualSelection"
              >
                清除選取（改用可見區間）
              </button>
            </template>
          </div>
          <p v-if="rangeSelectionActive" class="range-guidance" role="status">
            選取模式已啟用：K 線圖表已鎖定，確認或取消後才可恢復操作。{{
              draftComparisonRange
                ? `暫選 ${draftComparisonRange.windowSize} 根日 K`
                : '請先將 K 線縮放到至少 5 根日 K，再重新選取。'
            }}
          </p>
          <div class="similarity-range-label">
            <span>目前比對區間</span>
            <InfoTooltip
              title="比對視窗"
              description="你在日 K 圖上選取的走勢長度。例如選取 60 個交易日，就會尋找歷史上與這 60 根 K 棒走勢接近的股票。"
            />
          </div>
          <span class="similarity-range">{{ selectedRangeText }}</span>
        </div>
        <div class="similarity-options">
          <label
            >結果數量
            <select v-model.number="similarityTopN">
              <option :value="5">5</option>
              <option :value="10">10</option>
              <option :value="20">20</option>
            </select></label
          >
          <label>
            <span class="option-label"
              >週月線比對方式
              <InfoTooltip
                title="週月線比對方式"
                description="可選擇是否參考更長期間的走勢。不納入：只比較日 K；加分參考：符合較長期間走勢條件的候選結果可獲得排名加分；條件篩選：僅保留符合條件的候選結果。"
                align="right"
            /></span>
            <select v-model="similarityMode">
              <option value="off">不納入（僅比較日 K）</option>
              <option value="boost">參考週月線加分</option>
              <option value="filter">以週月線條件篩選</option>
            </select>
          </label>
          <button
            type="button"
            :disabled="
              similarityLoading ||
              rangeSelectionActive ||
              !similarityRange ||
              similarityRange.windowSize < 5 ||
              similarityRange.windowSize > 500
            "
            @click="runSimilaritySearch"
          >
            {{ similarityLoading ? '搜尋中...' : '搜尋相似走勢' }}
          </button>
        </div>
      </div>
      <p
        v-if="
          similarityRange && (similarityRange.windowSize < 5 || similarityRange.windowSize > 500)
        "
        class="similarity-warning"
      >
        目前範圍為 {{ similarityRange.windowSize }} 根日 K，請調整為 5～500
        根（實際可查詢範圍依服務設定為準）。
      </p>
      <p v-if="similarityError" class="similarity-warning" role="alert">{{ similarityError }}</p>
      <p v-if="similarityLoading" class="similarity-progress" role="status">
        正在搜尋相似的歷史股價走勢…
      </p>
      <div v-if="similarityResponse" class="similarity-results">
        <div class="similarity-summary">
          <strong>這次搜尋以什麼為基準？</strong>
          <p>
            以 {{ selectedStockCode }} 截至
            <b>{{ similarityResponse.anchor_date || searchedRange?.endDate || '選取日期' }}</b> 的前
            <b>{{ similarityResponse.window_size }}</b> 個交易日之<b>日 K 走勢</b
            >為基準，尋找歷史走勢接近的股票；{{
              modeDescription(similarityResponse.higher_timeframe_mode)
            }}。
          </p>
          <div class="summary-field">
            <span>比對截止日</span
            ><InfoTooltip
              title="比對截止日"
              description="以這一天作為選取走勢的最後一個交易日，往前比較指定數量的交易日。"
            />
          </div>
          <span class="similarity-muted"
            >找到 {{ similarityResponse.results.length }} 筆相似走勢</span
          >
        </div>
        <div class="similarity-layout">
          <div class="similarity-list">
            <div class="similarity-list-title">
              <strong>相似股票排名</strong
              ><span class="similarity-muted">點選股票查看右側走勢</span>
            </div>
            <button
              v-for="(item, index) in similarityResponse.results"
              :key="item.stock_code + ':' + item.start_date + ':' + item.end_date"
              type="button"
              :class="['similarity-result', { active: selectedMatch === item }]"
              @click="selectSimilarityMatch(item)"
            >
              <span class="similarity-rank">{{ index + 1 }}</span>
              <span
                ><b>{{ item.stock_code }}</b
                ><small>{{ item.start_date }} ～ {{ item.end_date }}</small></span
              >
              <span class="similarity-score">{{ formatMetric(item.score) }}</span>
            </button>
            <p v-if="!similarityResponse.results.length" class="similarity-muted">
              這次沒有找到符合條件的相似走勢，可以調整選取區間或搜尋條件再試一次。
            </p>
          </div>
          <div class="similarity-detail">
            <template v-if="selectedMatch">
              <div class="similarity-detail-heading">
                <strong>{{ selectedMatch.stock_code }} · 歷史相似走勢</strong>
                <span>{{ selectedMatch.start_date }} ～ {{ selectedMatch.end_date }}</span>
              </div>
              <div class="similarity-metrics">
                <div class="similarity-metric">
                  <div class="similarity-metric-label">
                    走勢相似度
                    <InfoTooltip
                      title="走勢相似度"
                      description="衡量兩段股價走勢的相近程度。數值越高，代表整體走勢越相似，但不代表未來股價的預測準確率。"
                    />
                  </div>
                  <strong>{{ formatMetric(selectedMatch.score) }}</strong>
                  <small>越高越相似</small>
                </div>
                <div class="similarity-metric">
                  <div class="similarity-metric-label">
                    走勢時間差
                    <InfoTooltip
                      title="走勢時間差"
                      description="顯示兩段相似走勢在時間上的錯開程度，以交易日為單位。數值代表最佳比對時前後錯開的交易日數，不代表未來價格漲跌時間。"
                      align="right"
                    />
                  </div>
                  <strong>{{ formatShift(selectedMatch.best_shift) }}</strong>
                  <small>時間錯開程度</small>
                </div>
              </div>
              <p v-if="matchLoading" class="similarity-muted">正在取得候選股票日 K…</p>
              <p v-else-if="matchError" class="similarity-warning">{{ matchError }}</p>
              <UnifiedCandlestickChart
                v-else-if="matchCandles.length"
                :key="
                  selectedMatch.stock_code +
                  ':' +
                  selectedMatch.start_date +
                  ':' +
                  selectedMatch.end_date
                "
                :candles="matchCandles"
                timezone="Asia/Taipei"
                period-label="日 K"
                :title="selectedMatch.stock_code + ' 相似走勢'"
              />
              <p v-else class="similarity-muted">
                這段歷史行情不在目前日 K API 回傳範圍內，無法繪製。需提供可依起訖日期查詢的歷史 K 線
                API。
              </p>
            </template>
            <p v-else class="similarity-muted">選擇左側股票，查看它在相似日期區間的股價走勢。</p>
          </div>
        </div>
        <p class="similarity-disclaimer">
          提醒：相似走勢僅供歷史資料比較與研究參考，不代表未來走勢會重複發生。
        </p>
      </div>
    </section>
  </section>
</template>

<script setup lang="ts">
  import { computed, onBeforeUnmount, ref, watch } from 'vue'
  import {
    getSingleStockIntradayPrice,
    getSingleStockPrice,
    searchSimilarStocks,
    type IntradayPeriod,
    type HigherTimeframeMode,
    type SimilarityMatch,
    type SimilaritySearchResponse,
  } from '@/api/stockApi'
  import type { StockIntradayPrice } from '@/types/stockPrice'
  import UnifiedCandlestickChart from '@/components/charts/UnifiedCandlestickChart.vue'
  import InfoTooltip from '@/components/bstock/InfoTooltip.vue'
  type UnifiedCandle = {
    time: number
    open: number
    high: number
    low: number
    close: number
    volume?: number | null
  }

  type RawStockBar = {
    tradingDate?: string
    firstTradingDate?: string
    openingPrice?: string | number | null
    closingPrice?: string | number | null
    lowPrice?: string | number | null
    highPrice?: string | number | null
    tradingVolume?: string | number | null
  }
  type StockData = {
    singleStockDayPriceVos?: RawStockBar[]
    singleStockWeekPriceVos?: RawStockBar[]
    singleStockMonthPriceVos?: RawStockBar[]
  }
  const props = withDefaults(
    defineProps<{
      stockData?: StockData | null
      selectedStockCode?: string
      isKLineChart?: boolean
    }>(),
    { selectedStockCode: '', isKLineChart: true, stockData: null },
  )

  type SimilarityRange = { startDate: string; endDate: string; windowSize: number }
  const similarityRange = ref<SimilarityRange | null>(null)
  const manualComparisonRange = ref<SimilarityRange | null>(null)
  const draftComparisonRange = ref<SimilarityRange | null>(null)
  const visibleComparisonRange = ref<SimilarityRange | null>(null)
  const rangeSelectionActive = ref(false)
  const similarityTopN = ref(10)
  const similarityMode = ref<HigherTimeframeMode>('off')
  const similarityLoading = ref(false)
  const similarityError = ref('')
  const similarityResponse = ref<SimilaritySearchResponse | null>(null)
  const searchedRange = ref<SimilarityRange | null>(null)
  const selectedMatch = ref<SimilarityMatch | null>(null)
  const matchCandles = ref<UnifiedCandle[]>([])
  const matchLoading = ref(false)
  const matchError = ref('')
  let similarityRequestVersion = 0
  let matchRequestVersion = 0
  const selectedRangeText = computed(() =>
    similarityRange.value
      ? `${similarityRange.value.startDate} ～ ${similarityRange.value.endDate}（${similarityRange.value.windowSize} 個交易日）`
      : '請先在日 K 圖選擇區間',
  )

  function onVisibleRangeChange(range: SimilarityRange): void {
    visibleComparisonRange.value = range
    if (manualComparisonRange.value || rangeSelectionActive.value) return
    const previous = similarityRange.value
    if (
      previous?.startDate === range.startDate &&
      previous?.endDate === range.endDate &&
      previous?.windowSize === range.windowSize
    )
      return
    similarityRange.value = range
    // 比對範圍變動後，舊結果不再對應目前選擇的條件。
    clearSearchResult()
  }

  function startRangeSelection(): void {
    if (visibleComparisonRange.value && visibleComparisonRange.value.windowSize < 5) return
    draftComparisonRange.value = null
    rangeSelectionActive.value = true
  }

  function onComparisonRangePreview(range: SimilarityRange | null): void {
    draftComparisonRange.value = range ? { ...range } : null
  }

  function cancelRangeSelection(): void {
    rangeSelectionActive.value = false
    draftComparisonRange.value = null
    // 保留先前已確認的區間；若尚未確認則回到原本可見區間。
    similarityRange.value = manualComparisonRange.value ?? visibleComparisonRange.value
  }

  function confirmRangeSelection(): void {
    const range = draftComparisonRange.value
    if (!range || range.windowSize < 5 || range.windowSize > 500) return
    rangeSelectionActive.value = false
    manualComparisonRange.value = { ...range }
    similarityRange.value = { ...range }
    draftComparisonRange.value = null
    clearSearchResult()
  }

  function clearManualSelection(): void {
    rangeSelectionActive.value = false
    draftComparisonRange.value = null
    manualComparisonRange.value = null
    similarityRange.value = visibleComparisonRange.value
    clearSearchResult()
  }

  function clearSearchResult(): void {
    similarityRequestVersion++
    matchRequestVersion++
    similarityLoading.value = false
    matchLoading.value = false
    similarityResponse.value = null
    searchedRange.value = null
    selectedMatch.value = null
    matchCandles.value = []
    similarityError.value = ''
    matchError.value = ''
  }

  function modeDescription(mode: HigherTimeframeMode): string {
    return mode === 'boost'
      ? '額外參考週 K、月 K 條件調整排名'
      : mode === 'filter'
        ? '使用週 K、月 K 條件篩選結果'
        : '不納入週 K、月 K 條件'
  }

  function formatMetric(value: number | null | undefined): string {
    return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(4) : '—'
  }

  function formatShift(value: number | null | undefined): string {
    return typeof value === 'number' && Number.isFinite(value)
      ? `${value > 0 ? '+' : ''}${value} 日`
      : '—'
  }

  function resetSimilarity(): void {
    clearSearchResult()
    rangeSelectionActive.value = false
    draftComparisonRange.value = null
    manualComparisonRange.value = null
    visibleComparisonRange.value = null
    similarityRange.value = null
  }

  async function runSimilaritySearch(): Promise<void> {
    if (rangeSelectionActive.value) return
    const range = similarityRange.value
    const code = props.selectedStockCode.trim()
    if (!range || !code || range.windowSize < 5 || range.windowSize > 500) return
    const version = ++similarityRequestVersion
    ++matchRequestVersion
    similarityLoading.value = true
    similarityError.value = ''
    similarityResponse.value = null
    searchedRange.value = null
    selectedMatch.value = null
    matchCandles.value = []
    try {
      const response = await searchSimilarStocks({
        stock_code: code,
        window_size: range.windowSize,
        top_n: similarityTopN.value,
        anchor_date: range.endDate,
        higher_timeframe_mode: similarityMode.value,
      })
      if (version !== similarityRequestVersion) return
      if (!response || !Array.isArray(response.results))
        throw new Error('Invalid similarity search response')
      similarityResponse.value = response
      searchedRange.value = { ...range }
      if (response.results.length) void selectSimilarityMatch(response.results[0]!)
    } catch (error) {
      if (version !== similarityRequestVersion) return
      console.error('[Similarity] search failed', error)
      similarityError.value = '相似走勢搜尋暫時無法完成，請稍後再試。'
    } finally {
      if (version === similarityRequestVersion) similarityLoading.value = false
    }
  }

  async function selectSimilarityMatch(item: SimilarityMatch): Promise<void> {
    const version = ++matchRequestVersion
    selectedMatch.value = item
    matchCandles.value = []
    matchError.value = ''
    matchLoading.value = true
    try {
      // 現有 SingleStockPrice API 取得日 K；依 Python 回傳的候選起訖日裁切。
      const response = (await getSingleStockPrice(item.stock_code)) as StockData

      if (version !== matchRequestVersion) return

      const raw = response?.singleStockDayPriceVos ?? []

      matchCandles.value = raw
        .flatMap((bar) => {
          const date = String(bar.tradingDate ?? '').slice(0, 10)
          const time = dateSeconds(date)

          const open = numeric(bar.openingPrice)
          const close = numeric(bar.closingPrice)
          const high = numeric(bar.highPrice)
          const low = numeric(bar.lowPrice)
          const volume = numeric(bar.tradingVolume)

          if (
            time == null ||
            open == null ||
            close == null ||
            high == null ||
            low == null ||
            high < low
          ) {
            return []
          }

          return [{ time, open, close, high, low, volume }]
        })
        .sort((a, b) => a.time - b.time)
    } catch (error) {
      if (version !== matchRequestVersion) return
      console.error('[Similarity] candidate prices failed', error)
      matchError.value = '候選股票 K 線載入失敗。'
    } finally {
      if (version === matchRequestVersion) matchLoading.value = false
    }
  }

  const periods = [
    { id: 'day', label: '日 K', key: 'singleStockDayPriceVos' },
    { id: 'week', label: '週 K', key: 'singleStockWeekPriceVos' },
    { id: 'month', label: '月 K', key: 'singleStockMonthPriceVos' },
    { id: '60m', label: '60 分 K', key: null },
    { id: '5m', label: '5 分 K', key: null },
  ] as const
  type PeriodId = (typeof periods)[number]['id']
  const selectedView = ref<PeriodId>('day')
  const selectedPeriod = computed(() => periods.find((p) => p.id === selectedView.value)!)
  const selectedPeriodLabel = computed(() => selectedPeriod.value.label)
  const isIntraday = computed(() => selectedView.value === '5m' || selectedView.value === '60m')
  const loadingIntraday = ref(false)
  const intradayError = ref('')
  const intradayData = ref<Partial<Record<IntradayPeriod, StockIntradayPrice[]>>>({})
  let intradayRequestVersion = 0

  async function loadIntraday(force = false): Promise<void> {
    const period = selectedView.value
    const stockCode = props.selectedStockCode.trim()
    const requestVersion = ++intradayRequestVersion
    if ((period !== '5m' && period !== '60m') || !stockCode) {
      loadingIntraday.value = false
      intradayError.value = ''
      return
    }
    if (!force && intradayData.value[period] !== undefined) {
      loadingIntraday.value = false
      intradayError.value = ''
      return
    }
    loadingIntraday.value = true
    intradayError.value = ''
    try {
      const response = await getSingleStockIntradayPrice(stockCode, period)
      if (requestVersion !== intradayRequestVersion) return
      if (!Array.isArray(response)) throw new Error('Unexpected intraday response')
      intradayData.value = { ...intradayData.value, [period]: response }
    } catch (error) {
      if (requestVersion !== intradayRequestVersion) return
      console.error('[Candlestick] Intraday price request failed:', error)
      intradayError.value = '盤中 K 線資料載入失敗，請稍後再試'
    } finally {
      if (requestVersion === intradayRequestVersion) loadingIntraday.value = false
    }
  }

  function retryIntraday(): void {
    void loadIntraday(true)
  }

  watch(
    () => props.selectedStockCode,
    () => {
      intradayData.value = {}
      resetSimilarity()
      void loadIntraday()
    },
  )
  watch(selectedView, () => {
    rangeSelectionActive.value = false
    draftComparisonRange.value = null
    manualComparisonRange.value = null
    similarityRange.value = visibleComparisonRange.value
    clearSearchResult()
    void loadIntraday()
  })
  watch([similarityTopN, similarityMode], clearSearchResult)
  onBeforeUnmount(() => {
    intradayRequestVersion++
    similarityRequestVersion++
    matchRequestVersion++
  })

  function intradaySeconds(value: string | number[] | undefined): number | null {
    if (Array.isArray(value)) {
      if (value.length < 5 || !value.slice(0, 5).every(Number.isFinite)) return null
      const [year, month, day, hour, minute, second = 0] = value
      return taipeiSeconds(year!, month!, day!, hour!, minute!, second)
    }
    if (typeof value !== 'string') return null
    // Java LocalDateTime：無時區的 yyyy-MM-ddTHH:mm:ss，視為台灣當地時間。
    const match = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[T ](\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(value)
    if (!match) return null
    return taipeiSeconds(
      Number(match[1]),
      Number(match[2]),
      Number(match[3]),
      Number(match[4]),
      Number(match[5]),
      Number(match[6] ?? 0),
    )
  }

  function taipeiSeconds(
    y: number,
    m: number,
    d: number,
    h: number,
    min: number,
    sec: number,
  ): number | null {
    if (
      m < 1 ||
      m > 12 ||
      d < 1 ||
      d > 31 ||
      h < 0 ||
      h > 23 ||
      min < 0 ||
      min > 59 ||
      sec < 0 ||
      sec > 59
    )
      return null
    // UTC+08:00；與圖表的 Asia/Taipei 格式化一致。
    const timestamp = Date.UTC(y, m - 1, d, h - 8, min, sec)
    const check = new Date(timestamp + 8 * 60 * 60 * 1000)
    if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d)
      return null
    return timestamp / 1000
  }

  function numeric(v: unknown): number | null {
    if (v == null || String(v).trim() === '') return null
    const n = Number(String(v).replace(/,/g, ''))
    return Number.isFinite(n) ? n : null
  }
  function dateSeconds(value: unknown): number | null {
    const text = String(value ?? '').trim()
    // API 預期 yyyy-MM-dd / yyyy/MM/dd；避開瀏覽器對非標準字串的 Date.parse 差異。
    const match = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(text)
    if (!match) return null
    const y = Number(match[1]),
      m = Number(match[2]),
      d = Number(match[3])
    if (m < 1 || m > 12 || d < 1 || d > 31) return null
    const ms = Date.UTC(y, m - 1, d, 4) // 台灣中午 12 點
    const dt = new Date(ms)
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d)
      return null
    return ms / 1000
  }
  const candles = computed<UnifiedCandle[]>(() => {
    const raw = isIntraday.value
      ? (intradayData.value[selectedView.value as IntradayPeriod] ?? [])
      : (props.stockData?.[selectedPeriod.value.key as keyof StockData] ?? [])
    if (!Array.isArray(raw)) return []
    return raw
      .flatMap((bar) => {
        const time = isIntraday.value
          ? intradaySeconds((bar as StockIntradayPrice).tradingTime)
          : dateSeconds((bar as RawStockBar).tradingDate ?? (bar as RawStockBar).firstTradingDate)
        const open = numeric(bar.openingPrice),
          close = numeric(bar.closingPrice)
        const low = numeric(bar.lowPrice),
          high = numeric(bar.highPrice)
        const volume = numeric(bar.tradingVolume)
        if (
          time == null ||
          open == null ||
          close == null ||
          high == null ||
          low == null ||
          high < low
        )
          return []
        return [{ time, open, close, high, low, volume }]
      })
      .sort((a, b) => a.time - b.time)
  })
</script>

<style scoped>
  .bstock-candlestick {
    width: 100%;
    min-width: 0;
    color: #edf3f7;
  }
  .chart-heading {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
  }
  .chart-heading strong {
    display: block;
    font-size: 18px;
  }
  .chart-heading span {
    display: block;
    font-size: 12px;
    color: #9daebc;
    margin-top: 4px;
  }
  .intraday-status {
    padding: 20px 12px;
    color: #aebdcc;
    text-align: center;
  }
  .intraday-status.error {
    color: #f19a9e;
  }
  .retry-button {
    margin-left: 12px;
    cursor: pointer;
    color: #effff9;
    background: #295b4e;
    border: 1px solid #49b994;
    border-radius: 6px;
    padding: 5px 10px;
  }
  .period-tabs {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .period-tabs button {
    cursor: pointer;
    background: #202d38;
    color: #aebdcc;
    border: 1px solid #364b5b;
    border-radius: 6px;
    padding: 7px 12px;
  }
  .period-tabs button.active {
    background: #295b4e;
    color: #effff9;
    border-color: #49b994;
  }
  .similarity-section {
    margin-top: 24px;
    padding: 18px;
    border: 1px solid #344c59;
    background: #17252f;
    border-radius: 12px;
  }
  .similarity-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
  }
  .similarity-toolbar strong {
    font-size: 17px;
  }
  .similarity-toolbar p {
    font-size: 13px;
    color: #aebdcc;
    margin: 8px 0;
  }
  .similarity-range {
    color: #8fe0bb;
    font-size: 13px;
  }
  .range-actions {
    display: flex;
    gap: 9px;
    flex-wrap: wrap;
    margin: 12px 0 8px;
  }
  .range-select-btn,
  .range-reset-btn {
    cursor: pointer;
    background: #243d4b;
    border: 1px solid #5786a0;
    color: #e8f5ff;
    padding: 8px 13px;
    border-radius: 7px;
    font-size: 13px;
  }
  .range-select-btn.active {
    background: #28694d;
    border-color: #66d9a7;
  }
  .range-reset-btn {
    border-color: #445d6b;
    background: transparent;
    color: #afc7d6;
  }
  .range-guidance {
    color: #8fe0bb !important;
    font-weight: 600;
  }
  .similarity-options {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: end;
  }
  .similarity-options label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 12px;
    color: #b8cbd6;
  }
  .similarity-options select {
    border: 1px solid #466070;
    background: #243540;
    color: #f2f6f9;
    border-radius: 6px;
    padding: 8px;
  }
  .similarity-options button {
    padding: 9px 15px;
    border-radius: 7px;
    border: 1px solid #4db58c;
    color: #fff;
    background: #24664f;
    cursor: pointer;
  }
  .similarity-options button:disabled {
    opacity: 0.48;
    cursor: not-allowed;
  }
  .similarity-warning {
    margin-top: 12px;
    color: #f2a4a4;
  }
  .similarity-progress,
  .similarity-muted {
    color: #afbfcb;
    font-size: 13px;
  }
  .similarity-results {
    margin-top: 20px;
  }
  .similarity-summary {
    color: #a8bdc7;
    font-size: 12px;
    margin-bottom: 12px;
  }
  .similarity-layout {
    display: grid;
    grid-template-columns: minmax(200px, 265px) minmax(0, 1fr);
    gap: 16px;
  }
  .similarity-list {
    display: flex;
    flex-direction: column;
    gap: 7px;
    max-height: 800px;
    overflow-y: auto;
  }
  .similarity-list > strong {
    margin-bottom: 8px;
  }
  .similarity-result {
    display: flex;
    align-items: center;
    text-align: left;
    gap: 10px;
    padding: 10px;
    color: #e6edf2;
    border: 1px solid #344e5c;
    background: #22313c;
    border-radius: 8px;
    cursor: pointer;
  }
  .similarity-result.active {
    border-color: #55c69a;
    background: #254538;
  }
  .similarity-result span:nth-child(2) {
    flex: 1;
    min-width: 0;
  }
  .similarity-result small {
    display: block;
    margin-top: 3px;
    color: #adc0ca;
    font-size: 11px;
  }
  .similarity-rank {
    color: #9fcbb3;
  }
  .similarity-score {
    font-variant-numeric: tabular-nums;
    font-size: 12px;
  }
  .similarity-detail {
    min-width: 0;
  }
  .similarity-detail-heading {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 10px;
  }
  .similarity-detail-heading span {
    color: #a7b7c5;
    font-size: 12px;
  }
  @media (max-width: 1100px) {
    .similarity-layout {
      grid-template-columns: 1fr;
    }
    .similarity-list {
      max-height: 250px;
    }
  }
</style>

<style scoped>
  .similarity-intro {
    min-width: 200px;
    flex: 1;
  }
  .similarity-range-label,
  .option-label,
  .similarity-metric-label,
  .summary-field {
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }
  .similarity-range-label {
    color: #b8cbd6;
    font-size: 12px;
    margin: 3px 0;
  }
  .similarity-summary {
    padding: 13px 15px;
    border: 1px solid #344e5c;
    border-radius: 9px;
    background: #1e303b;
    margin-bottom: 16px;
    line-height: 1.7;
  }
  .similarity-summary > strong {
    color: #e9f7ef;
    font-size: 14px;
  }
  .similarity-summary p {
    margin: 5px 0 4px;
    font-size: 13px;
    color: #d2e0e7;
  }
  .summary-field {
    color: #b6c7d0;
    font-size: 12px;
    margin-right: 10px;
  }
  .similarity-list-title {
    display: flex;
    flex-direction: column;
    gap: 3px;
    margin-bottom: 9px;
  }
  .similarity-metrics {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin: 12px 0 16px;
  }
  .similarity-metric {
    padding: 11px 13px;
    border-radius: 9px;
    background: #203540;
    border: 1px solid #334c5a;
    min-width: 0;
  }
  .similarity-metric-label {
    color: #b9cbd6;
    font-size: 12px;
  }
  .similarity-metric > strong {
    display: block;
    font-size: 20px;
    margin: 5px 0 2px;
    font-variant-numeric: tabular-nums;
  }
  .similarity-metric > small {
    color: #9db4c2;
    font-size: 11px;
  }
  .similarity-disclaimer {
    margin: 16px 0 0;
    font-size: 12px;
    color: #aabfc9;
  }
  @media (max-width: 520px) {
    .similarity-section {
      padding: 12px;
    }
    .similarity-metrics {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>

<style scoped>
  .period-tabs button:disabled {
    opacity: 0.48;
    cursor: not-allowed;
  }
  .range-select-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
</style>
