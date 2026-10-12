<template>
  <section class="shareholder-tile">
    <div class="shareholder-head">
      <div>
        <h3>持股分布</h3>
        <p class="muted">集保股權分散資料 · 每週歷史紀錄</p>
      </div>
      <button type="button" :disabled="loading || !stockCode" @click="load(true)">
        {{ loading ? '載入中…' : loaded ? '重新整理' : '載入持股分布' }}
      </button>
    </div>

    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="!loaded && !loading && !error" class="muted">目前沒有持股分布資料。</p>
    <p v-if="loading" class="muted">正在讀取持股分布…</p>
    <p v-if="loaded && !history.length" class="muted">目前沒有可顯示的持股分布紀錄。</p>

    <template v-if="latest">
      <div class="metrics">
        <div>
          <span>資料日期</span><strong>{{ latest.countDate || '—' }}</strong>
        </div>
        <div>
          <span>股東總人數</span><strong>{{ display(latest.totalPeople) }}</strong>
        </div>
        <div>
          <span>股票總數（原始欄位）</span><strong>{{ display(latest.stockTotal) }}</strong>
        </div>
      </div>

      <h4>最新一期各持股級距</h4>
      <div class="scroll-table">
        <table>
          <thead>
            <tr>
              <th>持股級距（張）</th>
              <th>持有數量（原始值）</th>
              <th>股東人數</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="band in bands" :key="band.label">
              <td>{{ band.label }}</td>
              <td>{{ display(latest[band.holdings]) }}</td>
              <td>{{ display(latest[band.people]) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="muted small">
        後端級距數量欄位為 String，單位尚未確認，因此不擅自換算成百分比或股數。
      </p>

      <div class="history-title">
        <h4>每週持股變化</h4>
        <label
          >觀察級距
          <select v-model="selectedBand">
            <option v-for="band in bands" :key="band.label" :value="band.label">
              {{ band.label }}
            </option>
          </select>
        </label>
      </div>
      <div class="scroll-table">
        <table>
          <thead>
            <tr>
              <th>日期</th>
              <th>週次</th>
              <th>股東總人數</th>
              <th>{{ selectedBand }} 人數</th>
              <th>{{ selectedBand }} 持有量</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in history" :key="row.id || `${row.countDate}-${row.weekOfYear}`">
              <td>{{ row.countDate || '—' }}</td>
              <td>{{ row.weekOfYear || '—' }}</td>
              <td>{{ display(row.totalPeople) }}</td>
              <td>{{ display(row[activeBand.people]) }}</td>
              <td>{{ display(row[activeBand.holdings]) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="muted small">依資料日期由新到舊排列，最多顯示後端回傳的 200 筆紀錄。</p>
    </template>
  </section>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { readShareholderStructure } from '@/api/stockFundamentalsApi'
  import type { ShareholderStructure } from '@/types/shareholderStructure'

  type NumericField = keyof ShareholderStructure
  interface Band {
    label: string
    holdings: NumericField
    people: NumericField
  }
  const props = defineProps<{ stockCode: string }>()
  const bands: Band[] = [
    { label: '未滿 1 張', holdings: 'lessThanOneBoardLot', people: 'lessThanOneBoardLotPeople' },
    {
      label: '1–5 張',
      holdings: 'betweenOneAndFiveBoardLot',
      people: 'betweenOneAndFiveBoardLotPeople',
    },
    {
      label: '5–10 張',
      holdings: 'betweenFiveAndTenBoardLot',
      people: 'betweenFiveAndTenBoardLotPeople',
    },
    {
      label: '10–15 張',
      holdings: 'betweenTenAndFifteenBoardLot',
      people: 'betweenTenAndFifteenBoardLotPeople',
    },
    {
      label: '15–20 張',
      holdings: 'betweenFifteenAndTwentyBoardLot',
      people: 'betweenFifteenAndTwentyBoardLotPeople',
    },
    {
      label: '20–30 張',
      holdings: 'betweenTwentyAndThirtyBoardLot',
      people: 'betweenTwentyAndThirtyBoardLotPeople',
    },
    {
      label: '30–40 張',
      holdings: 'betweenThirtyAndFortyBoardLot',
      people: 'betweenThirtyAndFortyBoardLotPeople',
    },
    {
      label: '40–50 張',
      holdings: 'betweenFortyAndFiftyBoardLot',
      people: 'betweenFortyAndFiftyBoardLotPeople',
    },
    {
      label: '50–100 張',
      holdings: 'betweenFiftyAndOneHundredBoardLot',
      people: 'betweenFiftyAndOneHundredBoardLotPeople',
    },
    {
      label: '100–200 張',
      holdings: 'betweenOneHundredAndTwoHundredBoardLot',
      people: 'betweenOneHundredAndTwoHundredBoardLotPeople',
    },
    {
      label: '200–400 張',
      holdings: 'betweenTwoHundredAndFourHundredBoardLot',
      people: 'betweenTwoHundredAndFourHundredBoardLotPeople',
    },
    {
      label: '400–600 張',
      holdings: 'betweenFourHundredAndSixHundredBoardLot',
      people: 'betweenFourHundredAndSixHundredBoardLotPeople',
    },
    {
      label: '600–800 張',
      holdings: 'betweenSixHundredAndEightHundredBoardLot',
      people: 'betweenSixHundredAndEightHundredBoardLotPeople',
    },
    {
      label: '800–1000 張',
      holdings: 'betweenEightHundredAndOneThousandBoardLot',
      people: 'betweenEightHundredAndOneThousandBoardLotPeople',
    },
    {
      label: '超過 1000 張',
      holdings: 'overOneThousandBoardLot',
      people: 'overOneThousandBoardLotPeople',
    },
  ]
  const loading = ref(false)
  const loaded = ref(false)
  const error = ref('')
  const history = ref<ShareholderStructure[]>([])
  const selectedBand = ref('超過 1000 張')
  const latest = computed(() => history.value[0] ?? null)
  const activeBand = computed(
    () => bands.find((b) => b.label === selectedBand.value) ?? bands[bands.length - 1]!,
  )
  let revision = 0
  watch(
    () => props.stockCode,
    () => {
      revision++
      loading.value = false
      loaded.value = false
      error.value = ''
      history.value = []
      if (props.stockCode) void load()
    },
    { immediate: true },
  )
  function display(value: unknown): string {
    const text = String(value ?? '').trim()
    return text || '—'
  }
  async function load(force = false): Promise<void> {
    if (!props.stockCode || loading.value) return
    if (loaded.value && !force) return
    const seq = ++revision
    loading.value = true
    error.value = ''
    try {
      const result = await readShareholderStructure(props.stockCode, force)
      if (seq !== revision) return
      history.value = result
        .filter((row) => row && row.stockCode === props.stockCode)
        .sort((a, b) => (b.countDate ?? '').localeCompare(a.countDate ?? ''))
      loaded.value = true
    } catch (err) {
      if (seq !== revision) return
      console.error('[ShareholderStructure] failed', err)
      error.value = '持股分布讀取失敗，請稍後再試。'
    } finally {
      if (seq === revision) loading.value = false
    }
  }
</script>

<style scoped>
  .shareholder-tile {
    background: #1d252d;
    border: 1px solid #33414c;
    border-radius: 12px;
    padding: 18px;
    margin-bottom: 16px;
    min-width: 0;
    color: #e6edf4;
  }
  .shareholder-head,
  .history-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }
  .shareholder-head h3 {
    margin: 0;
    font-size: 17px;
  }
  .shareholder-head p {
    margin: 6px 0 0;
  }
  .shareholder-head button {
    color: #b1f2ce;
    background: #234438;
    border: 1px solid #3d735b;
    border-radius: 7px;
    padding: 8px 12px;
    cursor: pointer;
  }
  .shareholder-head button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .muted {
    color: #a0aebd;
    font-size: 13px;
    line-height: 1.6;
  }
  .error {
    color: #f4a3a3;
  }
  .small {
    font-size: 12px;
  }
  .metrics {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    margin: 18px 0;
  }
  .metrics > div {
    background: #151e25;
    padding: 12px;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    gap: 7px;
    min-width: 0;
  }
  .metrics span {
    font-size: 12px;
    color: #a0aebd;
  }
  .metrics strong {
    overflow-wrap: anywhere;
  }
  .scroll-table {
    overflow-x: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
    font-size: 13px;
  }
  th,
  td {
    padding: 10px;
    border-bottom: 1px solid #38444d;
    white-space: nowrap;
  }
  th {
    color: #a6bac8;
  }
  h4 {
    margin: 24px 0 10px;
  }
  .history-title label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
  }
  select {
    background: #151e25;
    border: 1px solid #415563;
    border-radius: 6px;
    color: #e6edf4;
    padding: 7px;
  }
  @media (max-width: 760px) {
    .metrics {
      grid-template-columns: 1fr;
    }
  }
</style>
