<template>
  <section class="tile">
    <div class="panel-header">
      <h3>每月營收</h3>
      <label class="range-picker">
        <span>查詢期間</span>
        <select v-model.number="monthCount" aria-label="選擇月營收查詢期間">
          <option :value="6">最近 6 個月</option>
          <option :value="12">最近 12 個月</option>
          <option :value="18">最近 18 個月</option>
          <option :value="24">最近 24 個月</option>
          <option :value="36">最近 36 個月</option>
        </select>
      </label>
    </div>

    <p class="note">預設顯示最近 6 個完整月份。選擇較長期間後，才會補充查詢更早的月份。</p>
    <p v-if="loading" class="muted" role="status">
      正在查詢月營收（{{ completed }}/{{ missingCount }} 個月份）…
    </p>
    <p v-if="error" class="error" role="alert">{{ error }}</p>

    <div class="scroll">
      <table>
        <thead>
          <tr>
            <th scope="col">年月</th>
            <th scope="col">營收</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="month in displayMonths" :key="month">
            <td>{{ month }}</td>
            <td>
              <span v-if="loadingMonths.has(month)" class="muted">載入中…</span>
              <span v-else-if="!monthResults.has(month) && monthFailures.has(month)" class="error"
                >讀取失敗</span
              >
              <template v-else>{{ formatRevenue(monthResults.get(month)) }}</template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p
      v-if="
        !loading && displayMonths.every((m) => monthResults.has(m) && monthResults.get(m) === null)
      "
      class="muted"
    >
      所選期間查無此股票的月營收資料。
    </p>
    <p v-if="monthFailures.size" class="muted">
      部分月份未成功取得。
      <button class="retry" type="button" :disabled="loading" @click="loadMonths">
        重新查詢失敗月份
      </button>
    </p>
  </section>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { readMonthly } from '@/api/stockFundamentalsApi'

  const props = defineProps<{ stockCode: string }>()

  const monthCount = ref(6)
  const monthResults = ref(new Map<string, number | null>())
  const monthFailures = ref(new Set<string>())
  const loadingMonths = ref(new Set<string>())
  const loading = ref(false)
  const completed = ref(0)
  const missingCount = ref(0)
  const error = ref('')
  let generation = 0

  function previousMonths(count: number): string[] {
    const now = new Date()
    return Array.from({ length: count }, (_, index) => {
      const day = new Date(now.getFullYear(), now.getMonth() - 1 - index, 1)
      return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}`
    })
  }

  const displayMonths = computed(() => previousMonths(monthCount.value))

  function formatRevenue(value: number | null | undefined): string {
    return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('zh-TW') : '—'
  }

  async function loadMonths(): Promise<void> {
    const code = props.stockCode.trim()
    const seq = ++generation
    if (!code) return

    const pending = displayMonths.value.filter((month) => !monthResults.value.has(month))
    missingCount.value = pending.length
    completed.value = 0
    error.value = ''
    loading.value = pending.length > 0
    loadingMonths.value = new Set(pending)
    monthFailures.value = new Set()

    // 每一批最多同時查三個月份，避免一次發送數十個 POST。
    for (let start = 0; start < pending.length; start += 3) {
      if (seq !== generation) return
      const batch = pending.slice(start, start + 3)
      const results = await Promise.allSettled(batch.map((month) => readMonthly(month)))
      if (seq !== generation) return

      results.forEach((result, index) => {
        const month = batch[index]!
        const nextLoading = new Set(loadingMonths.value)
        nextLoading.delete(month)
        loadingMonths.value = nextLoading

        if (result.status === 'fulfilled') {
          // 每個月份 API 回傳全市場名錄；只把目前股票的營收放在畫面狀態。
          const record = result.value.find((row) => row.stockId === code)
          const numberValue = record?.revenue
          const next = new Map(monthResults.value)
          next.set(
            month,
            typeof numberValue === 'number' && Number.isFinite(numberValue) ? numberValue : null,
          )
          monthResults.value = next
        } else {
          console.error(`[MonthlyRevenue] ${month}`, result.reason)
          monthFailures.value = new Set([...monthFailures.value, month])
        }
        completed.value++
      })
    }

    if (seq !== generation) return
    loading.value = false
    if (monthFailures.value.size)
      error.value = `${monthFailures.value.size} 個月份讀取失敗，可按下方按鈕重試。`
  }

  watch(
    () => props.stockCode,
    () => {
      ++generation
      monthResults.value = new Map()
      monthFailures.value = new Set()
      loadingMonths.value = new Set()
      loading.value = false
      void loadMonths()
    },
    { immediate: true },
  )

  watch(monthCount, () => {
    void loadMonths()
  })
</script>

<style scoped>
  .tile {
    background: #1d252d;
    border: 1px solid #33414c;
    border-radius: 12px;
    padding: 18px;
    min-width: 0;
  }
  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
  }
  h3 {
    margin: 0;
    font-size: 17px;
  }
  .range-picker {
    display: flex;
    gap: 8px;
    align-items: center;
    font-size: 13px;
    color: #a0aebd;
  }
  .range-picker select {
    background: #14202a;
    border: 1px solid #455766;
    color: #e9f0f6;
    padding: 8px 10px;
    border-radius: 7px;
  }
  .note,
  .muted {
    color: #a0aebd;
    font-size: 13px;
    line-height: 1.6;
  }
  .error {
    color: #f2aaaa;
    font-size: 13px;
  }
  .scroll {
    max-height: 480px;
    overflow: auto;
    margin-top: 12px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
    font-size: 13px;
  }
  th,
  td {
    padding: 12px;
    border-bottom: 1px solid #38444d;
  }
  th {
    color: #a6bac8;
    position: sticky;
    top: 0;
    background: #1d252d;
  }
  .retry {
    color: #8addb5;
    background: transparent;
    border: 1px solid #496956;
    border-radius: 6px;
    padding: 5px 9px;
    cursor: pointer;
  }
  .retry:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
