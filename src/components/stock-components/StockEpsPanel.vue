<template>
  <section class="tile">
    <h3>EPS（季度財報）</h3>
    <p class="note">
      資料為當年度累計 EPS；單季 EPS = 本季累計 EPS − 前季累計 EPS（Q1 直接使用累計值）。
    </p>
    <p v-if="!market && marketStatus === 'loading'" class="muted">正在確認上市／上櫃市場…</p>
    <p v-else-if="!market && marketStatus === 'unsupported'" class="muted">
      興櫃股票暫無此季度財報資料。
    </p>
    <p v-else-if="!market" class="error">
      無法辨識股票市場別。請在上方選擇上市（TWSE）或上櫃（TPEX），選擇後會自動讀取 EPS。
    </p>
    <p v-else-if="loading" class="muted">正在讀取最近五期季度財報…</p>
    <p v-else-if="error" class="error">{{ error }}</p>
    <template v-else>
      <div class="scroll">
        <table>
          <thead>
            <tr>
              <th>季度</th>
              <th>累計 EPS</th>
              <th>單季 EPS</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in rows" :key="r.key">
              <td>{{ r.key }}</td>
              <td>{{ format(r.cumulative) }}</td>
              <td>{{ format(r.single) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="rows.length && rows.every((r) => r.cumulative === null)" class="muted">
        最近幾期在 Redis 中查無此股票的 EPS。
      </p>
    </template>
  </section>
</template>
<script setup lang="ts">
  import { ref, watch } from 'vue'
  import type { ExchangeMarket } from '@/api/stockFundamentalsApi'
  import { readQuarterlyStock } from '@/api/stockFundamentalsApi'
  const props = defineProps<{
    stockCode: string
    market: ExchangeMarket | null
    marketStatus?: 'loading' | 'resolved' | 'unresolved' | 'unsupported'
  }>()
  type Row = { key: string; cumulative: number | null; single: number | null }
  const rows = ref<Row[]>([]),
    loading = ref(false),
    error = ref('')
  let revision = 0
  const format = (v: number | null): string =>
    v === null ? '—' : v.toLocaleString('zh-TW', { maximumFractionDigits: 2 })
  function periods(count: number): { year: number; quarter: number }[] {
    const today = new Date()
    let year = today.getFullYear(),
      quarter = Math.floor(today.getMonth() / 3)
    if (quarter === 0) {
      year--
      quarter = 4
    }
    const result = []
    for (let i = 0; i < count; i++) {
      result.push({ year, quarter })
      if (--quarter === 0) {
        year--
        quarter = 4
      }
    }
    return result
  }
  watch(
    () => [props.stockCode, props.market] as const,
    async ([code, market]) => {
      const seq = ++revision
      rows.value = []
      error.value = ''
      loading.value = Boolean(code && market)
      if (!code || !market) return
      const timeline = periods(5)
      const results = await Promise.allSettled(
        timeline.map((p) => readQuarterlyStock(p.year, p.quarter, market, code)),
      )
      if (seq !== revision) return
      try {
        const eps = new Map<string, number | null>()
        timeline.forEach((p, i) => {
          const batch = results[i]
          const record = batch?.status === 'fulfilled' ? batch.value : undefined
          eps.set(
            `${p.year}Q${p.quarter}`,
            typeof record?.earningsPerShare === 'number' ? record.earningsPerShare : null,
          )
        })
        rows.value = timeline.slice(0, 4).map((p) => {
          const key = `${p.year}Q${p.quarter}`,
            cumulative = eps.get(key) ?? null
          const previous = p.quarter === 1 ? 0 : (eps.get(`${p.year}Q${p.quarter - 1}`) ?? null)
          return {
            key,
            cumulative,
            single:
              cumulative === null || previous === null
                ? null
                : Number((cumulative - previous).toFixed(4)),
          }
        })
        if (results.every((x) => x.status === 'rejected'))
          error.value = '季度財報讀取失敗，請確認 Redis 與 API。'
      } finally {
        if (seq === revision) loading.value = false
      }
    },
    { immediate: true },
  )
</script>
<style scoped>
  .tile {
    background: #1d252d;
    border: 1px solid #33414c;
    border-radius: 12px;
    padding: 18px;
    min-width: 0;
  }
  h3 {
    margin: 0 0 15px;
    font-size: 17px;
  }
  .muted,
  .note {
    color: #a0aebd;
    font-size: 13px;
    line-height: 1.6;
  }
  .error {
    color: #f2aaaa;
  }
  .scroll {
    overflow: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
    font-size: 13px;
  }
  td,
  th {
    padding: 10px;
    border-bottom: 1px solid #38444d;
  }
  th {
    color: #a6bac8;
  }
</style>
