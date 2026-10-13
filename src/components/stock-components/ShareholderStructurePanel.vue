<template>
  <section class="shareholder-panel">
    <header class="panel-header">
      <div>
        <h2>持股分布</h2>
        <p class="muted">集保股權分散資料 · 最新資料優先顯示</p>
      </div>
      <button type="button" class="refresh" :disabled="loading" @click="load(true)">
        {{ loading ? '載入中…' : '重新整理' }}
      </button>
    </header>

    <p v-if="loading && !rows.length" class="state">持股分布資料載入中…</p>
    <p v-else-if="error && !rows.length" class="state error">{{ error }}</p>
    <p v-else-if="!sortedRows.length" class="state">沒有持股分布資料。</p>

    <template v-else>
      <p v-if="error" class="error">{{ error }}（目前顯示上次成功取得的資料）</p>
      <div class="summary">
        <div>
          <span>最新日期</span
          ><strong>{{ displayDate(latestRow?.countDate, latestRow?.weekOfYear) }}</strong>
        </div>
        <div>
          <span>最新週次</span><strong>{{ latestRow?.weekOfYear || '—' }}</strong>
        </div>
        <div>
          <span>股東總人數</span
          ><strong>{{ formatNumber(toNumber(latestRow?.totalPeople)) }}</strong>
        </div>
        <div>
          <span>持有股數總量</span
          ><strong>{{ formatNumber(toNumber(latestRow?.stockTotal)) }}</strong>
        </div>
      </div>

      <div class="section-heading">
        <div>
          <h3>級距分布及週增減</h3>
          <p class="muted">
            {{ displayDate(latestRow?.countDate, latestRow?.weekOfYear) }} 與前一期
            {{ displayDate(previousRow?.countDate, previousRow?.weekOfYear) }} 比較
          </p>
        </div>
        <div class="tabs" role="tablist" aria-label="分布統計類型">
          <button
            type="button"
            role="tab"
            :aria-selected="activeTab === 'people'"
            :class="{ active: activeTab === 'people' }"
            @click="activeTab = 'people'"
          >
            股東人數
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="activeTab === 'shares'"
            :class="{ active: activeTab === 'shares' }"
            @click="activeTab = 'shares'"
          >
            持有股數
          </button>
        </div>
      </div>
      <div class="table-scroll" role="tabpanel">
        <table>
          <thead>
            <tr>
              <th>持股級距</th>
              <th>{{ activeTab === 'people' ? '本週人數' : '本週持有股數' }}</th>
              <th>{{ activeTab === 'people' ? '前週人數' : '前週持有股數' }}</th>
              <th>增減</th>
              <th>增減幅</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in distributionRows" :key="item.label">
              <td>{{ item.label }}</td>
              <td>{{ formatNumber(item.current) }}</td>
              <td>{{ formatNumber(item.previous) }}</td>
              <td :class="changeClass(item.diff)">{{ formatSigned(item.diff) }}</td>
              <td :class="changeClass(item.diff)">{{ formatPct(item.pct) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="note">
        增減幅＝(本週－前週) ÷ 前週 × 100%。前週為 0
        或缺少資料時顯示「—」。持有股數的單位依後端原始資料。
      </p>

      <div class="section-heading history-title">
        <div>
          <h3>每週歷史紀錄</h3>
          <p class="muted">依週次／完整日期降冪排序，最新紀錄在最上方</p>
        </div>
      </div>
      <div class="table-scroll history-scroll">
        <table>
          <thead>
            <tr>
              <th>日期</th>
              <th>週次</th>
              <th>股東總人數</th>
              <th>持有股數總量</th>
              <th>超過 1000 張人數</th>
              <th>超過 1000 張持有股數</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(item, index) in sortedRows"
              :key="item.id || `${item.weekOfYear}-${item.countDate}-${index}`"
            >
              <td>{{ displayDate(item.countDate, item.weekOfYear) }}</td>
              <td>{{ item.weekOfYear || '—' }}</td>
              <td>{{ formatNumber(toNumber(item.totalPeople)) }}</td>
              <td>{{ formatNumber(toNumber(item.stockTotal)) }}</td>
              <td>{{ formatNumber(toNumber(item.overOneThousandBoardLotPeople)) }}</td>
              <td>{{ formatNumber(toNumber(item.overOneThousandBoardLot)) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { readShareholderStructure } from '@/api/stockFundamentalsApi'
  import type { ShareholderStructure } from '@/types/shareholderStructure'

  const props = defineProps<{ stockCode: string }>()

  type Mode = 'people' | 'shares'
  type StructureField = keyof ShareholderStructure
  const activeTab = ref<Mode>('people')
  const loading = ref(false)
  const error = ref('')
  const rows = ref<ShareholderStructure[]>([])
  let requestSequence = 0

  const BANDS: Array<{ label: string; people: StructureField; shares: StructureField }> = [
    { label: '未滿 1 張', people: 'lessThanOneBoardLotPeople', shares: 'lessThanOneBoardLot' },
    {
      label: '1–5 張',
      people: 'betweenOneAndFiveBoardLotPeople',
      shares: 'betweenOneAndFiveBoardLot',
    },
    {
      label: '5–10 張',
      people: 'betweenFiveAndTenBoardLotPeople',
      shares: 'betweenFiveAndTenBoardLot',
    },
    {
      label: '10–15 張',
      people: 'betweenTenAndFifteenBoardLotPeople',
      shares: 'betweenTenAndFifteenBoardLot',
    },
    {
      label: '15–20 張',
      people: 'betweenFifteenAndTwentyBoardLotPeople',
      shares: 'betweenFifteenAndTwentyBoardLot',
    },
    {
      label: '20–30 張',
      people: 'betweenTwentyAndThirtyBoardLotPeople',
      shares: 'betweenTwentyAndThirtyBoardLot',
    },
    {
      label: '30–40 張',
      people: 'betweenThirtyAndFortyBoardLotPeople',
      shares: 'betweenThirtyAndFortyBoardLot',
    },
    {
      label: '40–50 張',
      people: 'betweenFortyAndFiftyBoardLotPeople',
      shares: 'betweenFortyAndFiftyBoardLot',
    },
    {
      label: '50–100 張',
      people: 'betweenFiftyAndOneHundredBoardLotPeople',
      shares: 'betweenFiftyAndOneHundredBoardLot',
    },
    {
      label: '100–200 張',
      people: 'betweenOneHundredAndTwoHundredBoardLotPeople',
      shares: 'betweenOneHundredAndTwoHundredBoardLot',
    },
    {
      label: '200–400 張',
      people: 'betweenTwoHundredAndFourHundredBoardLotPeople',
      shares: 'betweenTwoHundredAndFourHundredBoardLot',
    },
    {
      label: '400–600 張',
      people: 'betweenFourHundredAndSixHundredBoardLotPeople',
      shares: 'betweenFourHundredAndSixHundredBoardLot',
    },
    {
      label: '600–800 張',
      people: 'betweenSixHundredAndEightHundredBoardLotPeople',
      shares: 'betweenSixHundredAndEightHundredBoardLot',
    },
    {
      label: '800–1000 張',
      people: 'betweenEightHundredAndOneThousandBoardLotPeople',
      shares: 'betweenEightHundredAndOneThousandBoardLot',
    },
    {
      label: '超過 1000 張',
      people: 'overOneThousandBoardLotPeople',
      shares: 'overOneThousandBoardLot',
    },
  ]

  function toNumber(value: unknown): number | null {
    if (value === null || value === undefined) return null
    const text = String(value).trim().replace(/,/g, '')
    if (!text) return null
    const number = Number(text)
    return Number.isFinite(number) ? number : null
  }

  function weekOrder(value: unknown): number | null {
    // 2026W39 -> 202639; avoids incorrect parsing of dates such as "9/4".
    const match = String(value ?? '')
      .trim()
      .toUpperCase()
      .match(/^(\d{4})\s*W\s*(\d{1,2})$/)
    if (!match) return null
    const year = Number(match[1])
    const week = Number(match[2])
    if (week < 1 || week > 53) return null
    return year * 100 + week
  }

  function dateOrder(rawDate: unknown, rawWeek: unknown): number | null {
    const text = String(rawDate ?? '').trim()
    let match = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T].*)?$/)
    if (match) return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    // Some countDate values are only M/D. Derive the year from weekOfYear, not current year.
    match = text.match(/^(\d{1,2})[-/](\d{1,2})$/)
    const week = String(rawWeek ?? '')
      .trim()
      .match(/^(\d{4})\s*W\s*\d{1,2}$/i)
    if (match && week) return Date.UTC(Number(week[1]), Number(match[1]) - 1, Number(match[2]))
    return null
  }

  // Preferred primary sort: actual weekly sequence; date is fallback and tie breaker.
  // The week field supplies the year when countDate is only "9/4".
  const sortedRows = computed(() =>
    [...rows.value].sort((a, b) => {
      const aw = weekOrder(a.weekOfYear)
      const bw = weekOrder(b.weekOfYear)
      if (aw !== null && bw !== null && aw !== bw) return bw - aw
      const ad = dateOrder(a.countDate, a.weekOfYear)
      const bd = dateOrder(b.countDate, b.weekOfYear)
      if (ad !== null && bd !== null && ad !== bd) return bd - ad
      if (aw !== null && bw === null) return -1
      if (bw !== null && aw === null) return 1
      if (ad !== null && bd === null) return -1
      if (bd !== null && ad === null) return 1
      return 0
    }),
  )

  const latestRow = computed(() => sortedRows.value[0] ?? null)
  const previousRow = computed(() => sortedRows.value[1] ?? null)
  const distributionRows = computed(() =>
    BANDS.map((band) => {
      const field = activeTab.value === 'people' ? band.people : band.shares
      const current = toNumber(latestRow.value?.[field])
      const previous = toNumber(previousRow.value?.[field])
      const diff = current === null || previous === null ? null : current - previous
      const pct =
        diff === null || previous === null || previous === 0 ? null : (diff / previous) * 100
      return { label: band.label, current, previous, diff, pct }
    }),
  )

  function displayDate(date: unknown, week: unknown): string {
    const value = String(date ?? '').trim()
    const parsed = dateOrder(value, week)
    if (parsed !== null) {
      const d = new Date(parsed)
      return `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}`
    }
    return value || '—'
  }
  function formatNumber(value: number | null): string {
    return value === null ? '—' : value.toLocaleString('zh-TW', { maximumFractionDigits: 2 })
  }
  function formatSigned(value: number | null): string {
    return value === null ? '—' : `${value > 0 ? '+' : ''}${formatNumber(value)}`
  }
  function formatPct(value: number | null): string {
    return value === null ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(2)}%`
  }
  function changeClass(value: number | null): string {
    return value === null || value === 0 ? '' : value > 0 ? 'positive' : 'negative'
  }

  async function load(force = false): Promise<void> {
    const sequence = ++requestSequence
    const code = props.stockCode.trim()
    rows.value = []
    error.value = ''
    if (!code) {
      loading.value = false
      return
    }
    loading.value = true
    try {
      const result = await readShareholderStructure(code, force)
      if (sequence !== requestSequence) return
      rows.value = result
    } catch (e) {
      if (sequence !== requestSequence) return
      error.value = '持股分布資料讀取失敗'
      console.error('[ShareholderStructurePanel]', e)
    } finally {
      if (sequence === requestSequence) loading.value = false
    }
  }
  watch(
    () => props.stockCode,
    () => {
      void load()
    },
    { immediate: true },
  )
</script>

<style scoped>
  .shareholder-panel {
    display: flex;
    flex-direction: column;
    gap: 18px;
    color: #e5edf5;
  }
  .panel-header,
  .section-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }
  h2 {
    font-size: 22px;
    margin: 0 0 8px;
  }
  h3 {
    font-size: 17px;
    margin: 0 0 6px;
  }
  .muted,
  .note {
    color: #9aaebd;
    font-size: 13px;
    margin: 0;
  }
  .note {
    line-height: 1.6;
  }
  .refresh {
    background: #245242;
    border: 1px solid #3d7763;
    color: #d6f4e7;
    padding: 9px 15px;
    border-radius: 8px;
    cursor: pointer;
  }
  .refresh:disabled {
    opacity: 0.55;
    cursor: wait;
  }
  .state {
    padding: 25px 12px;
    color: #b0bfca;
  }
  .error {
    color: #f7a7a7;
  }
  .summary {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
  }
  .summary > div {
    background: #18242f;
    border: 1px solid #344450;
    border-radius: 10px;
    padding: 16px;
  }
  .summary span {
    display: block;
    color: #9eafbe;
    font-size: 12px;
    margin-bottom: 8px;
  }
  .summary strong {
    font-size: 19px;
  }
  .tabs {
    display: flex;
    background: #131d26;
    border: 1px solid #3b4b57;
    border-radius: 9px;
    padding: 3px;
    gap: 3px;
  }
  .tabs button {
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: #b3c4d1;
    padding: 9px 14px;
    font-size: 13px;
    cursor: pointer;
  }
  .tabs button.active {
    background: #245443;
    color: #a5f1cb;
    font-weight: 700;
  }
  .table-scroll {
    overflow-x: auto;
    border: 1px solid #33414d;
    border-radius: 10px;
  }
  .history-title {
    margin-top: 10px;
  }
  .history-scroll {
    max-height: 520px;
    overflow-y: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    min-width: 660px;
  }
  th,
  td {
    padding: 13px 14px;
    border-bottom: 1px solid #34424e;
    text-align: right;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  th:first-child,
  td:first-child {
    text-align: left;
  }
  th {
    position: sticky;
    top: 0;
    background: #25313b;
    color: #a5b9ca;
    font-size: 12px;
  }
  td {
    font-size: 13px;
  }
  tr:last-child td {
    border-bottom: 0;
  }
  .positive {
    color: #5fd5a0;
    font-weight: 600;
  }
  .negative {
    color: #ee9090;
    font-weight: 600;
  }
  @media (max-width: 900px) {
    .summary {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @media (max-width: 650px) {
    .panel-header,
    .section-heading {
      align-items: stretch;
      flex-direction: column;
    }
    .summary {
      grid-template-columns: 1fr 1fr;
    }
    .tabs {
      align-self: flex-start;
    }
  }
</style>
