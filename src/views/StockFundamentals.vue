<template>
  <section class="fundamentals" :key="stockCode">
    <header class="headline">
      <h2>個股資訊與財務分析</h2>
      <small>{{ stockCode }}</small>
    </header>

    <div class="two-cols">
      <section class="tile">
        <h3>個股基本資訊</h3>
        <p v-if="loadingInfo" class="muted">載入中…</p>
        <p v-else-if="infoError" class="muted">{{ infoError }}</p>
        <dl v-else-if="basicInfo" class="facts">
          <dt>公司名稱</dt>
          <dd>{{ basicInfo.stockName || '—' }}</dd>
          <dt>主要業務</dt>
          <dd>{{ basicInfo.mainBusiness || '—' }}</dd>
          <dt>產業類別</dt>
          <dd>{{ basicInfo.industryCategory || '—' }}</dd>
          <dt>次產業類別</dt>
          <dd>{{ basicInfo.subIndustryCategory || '—' }}</dd>
          <dt>上市日期</dt>
          <dd>{{ basicInfo.listingDate || '—' }}</dd>
          <dt>股本</dt>
          <dd>{{ formatNumber(basicInfo.capitalStock) }}</dd>
          <dt>每股淨值</dt>
          <dd>{{ formatNumber(basicInfo.netAssetValuePerShare) }}</dd>
          <dt>最新 EPS（基本資訊）</dt>
          <dd>{{ formatNumber(basicInfo.earningsPerShare) }}</dd>
          <dt>本益比</dt>
          <dd>{{ formatNumber(basicInfo.peRatio) }}</dd>
          <dt>市值</dt>
          <dd>{{ formatNumber(basicInfo.marketCap) }}</dd>
        </dl>
        <p v-else class="muted">沒有基本資訊。</p>
      </section>
      <section class="tile">
        <h3>相關產業別</h3>
        <p v-if="loadingTags" class="muted">載入中…</p>
        <p v-else-if="tagError" class="muted">{{ tagError }}</p>
        <p v-else-if="!industries.length" class="muted">尚無可辨識的產業分類。</p>
        <div v-else class="tag-list">
          <button
            v-for="item in industries"
            :key="item.tag"
            type="button"
            class="industry-tag"
            @click="goToIndustry(item.tag)"
          >
            {{ item.name }} <span>↗</span>
          </button>
        </div>
        <p class="note">點擊產業別，可回到產業分類頁面。</p>
      </section>
    </div>

    <div class="two-cols">
      <section class="tile">
        <div class="section-head">
          <h3>EPS（季度財報）</h3>
          <button type="button" :disabled="loadingQuarterly || !market" @click="loadQuarterly">
            {{ loadingQuarterly ? '載入中…' : '載入 EPS' }}
          </button>
        </div>
        <p class="note">
          季度 API 的 earningsPerShare 是當年累計 EPS。單季 EPS = 本季累計 − 前一季累計；Q1
          直接等於單季。缺少前一季時不推估。
        </p>
        <p v-if="!market" class="muted">尚未確認上市／上櫃市場，無法查詢季度財報。</p>
        <p v-else-if="quarterlyError" class="muted">{{ quarterlyError }}</p>
        <p v-else-if="!quarterlyLoaded" class="muted">按「載入 EPS」取得最近四季資料。</p>
        <div v-else class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>季度</th>
                <th>累計 EPS</th>
                <th>單季 EPS</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in quarterRows" :key="row.key">
                <td>{{ row.key }}</td>
                <td>{{ formatNumber(row.cumulative) }}</td>
                <td>{{ formatNumber(row.standalone) }}</td>
              </tr>
            </tbody>
          </table>
          <p v-if="quarterRows.every((x) => x.cumulative === null)" class="muted">
            目前查無這檔股票最近四季的財報。
          </p>
        </div>
      </section>
      <section class="tile">
        <div class="section-head">
          <h3>每月營收</h3>
          <button type="button" :disabled="loadingMonthly" @click="loadMonthly">
            {{ loadingMonthly ? '載入中…' : '載入月營收' }}
          </button>
        </div>
        <p class="note">
          從 Redis 讀取最近六個月；只顯示 API 實際存在的資料，不自動觸發抓取／寫入。
        </p>
        <p v-if="monthlyError" class="muted">{{ monthlyError }}</p>
        <p v-else-if="!monthlyLoaded" class="muted">按「載入月營收」取得資料。</p>
        <div v-else class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>年月</th>
                <th>營收</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in monthlyRows" :key="row.month">
                <td>{{ row.month }}</td>
                <td>{{ formatNumber(row.revenue) }}</td>
              </tr>
            </tbody>
          </table>
          <p v-if="monthlyRows.every((x) => x.revenue === null)" class="muted">
            最近六個月暫無資料。
          </p>
        </div>
      </section>
    </div>

    <ShareholderStructurePanel :stock-code="stockCode" />
  </section>
</template>

<script setup lang="ts">
  import { ref, watch, computed } from 'vue'
  import ShareholderStructurePanel from './ShareholderStructurePanel.vue'
  import { useRouter } from 'vue-router'
  import { getAllStockInfo, getIndustryMappings, getStockTags } from '@/api/industryApi'
  import {
    getStockBasicInfo,
    normalizeMarket,
    readMonthly,
    readQuarterly,
  } from '@/api/stockFundamentalsApi'
  import type { ExchangeMarket } from '@/api/stockFundamentalsApi'
  import type { StockBasicInfoResponse } from '@/types/stockFundamentals'

  const props = defineProps<{ stockCode: string }>()
  const router = useRouter()
  const basicInfo = ref<StockBasicInfoResponse | null>(null)
  const market = ref<ExchangeMarket | null>(null)
  const loadingInfo = ref(false)
  const infoError = ref('')
  const loadingTags = ref(false)
  const tagError = ref('')
  const industries = ref<{ tag: string; name: string }[]>([])
  const loadingQuarterly = ref(false)
  const quarterlyError = ref('')
  const quarterlyLoaded = ref(false)
  const quarterRows = ref<{ key: string; cumulative: number | null; standalone: number | null }[]>(
    [],
  )
  const loadingMonthly = ref(false)
  const monthlyError = ref('')
  const monthlyLoaded = ref(false)
  const monthlyRows = ref<{ month: string; revenue: number | null }[]>([])
  let revision = 0
  const stockCode = computed(() => props.stockCode.trim())
  function formatNumber(value: number | null | undefined): string {
    return typeof value === 'number' && Number.isFinite(value)
      ? value.toLocaleString('zh-TW', { maximumFractionDigits: 2 })
      : '—'
  }
  function parseTags(raw: unknown, mapping: Record<string, string>): string[] {
    const byName = new Map(Object.entries(mapping).map(([tag, name]) => [name, tag]))
    const found = new Set<string>()
    const visit = (value: unknown, depth = 0): void => {
      if (depth > 6) return
      if (typeof value === 'string') {
        const token = value.trim()
        if (mapping[token]) found.add(token)
        else if (byName.has(token)) found.add(byName.get(token)!)
        else if (/[,，;；]/.test(token)) token.split(/[,，;；]/).forEach((v) => visit(v, depth + 1))
      } else if (Array.isArray(value)) value.forEach((v) => visit(v, depth + 1))
      else if (value && typeof value === 'object')
        Object.entries(value).forEach(([k, v]) => {
          visit(k, depth + 1)
          visit(v, depth + 1)
        })
    }
    visit(raw)
    return [...found]
  }
  async function loadIdentity(code: string, seq: number): Promise<void> {
    loadingInfo.value = true
    loadingTags.value = true
    const identity = await Promise.allSettled([
      getAllStockInfo(),
      getIndustryMappings(),
      getStockTags(code),
    ])
    if (seq !== revision) return
    const [directoryResult, mappingsResult, tagsResult] = identity
    if (directoryResult.status === 'fulfilled') {
      const item = directoryResult.value.find((v) => v.stockCode === code)
      market.value = normalizeMarket(item?.stockType)
    }
    if (mappingsResult.status === 'fulfilled' && tagsResult.status === 'fulfilled') {
      const mapping = mappingsResult.value
      industries.value = parseTags(tagsResult.value, mapping)
        .map((tag) => ({ tag, name: mapping[tag] }))
        .filter((v) => Boolean(v.name))
    } else tagError.value = '相關產業讀取失敗。'
    loadingTags.value = false
    try {
      const data = await getStockBasicInfo(code, market.value)
      if (seq !== revision) return
      basicInfo.value = data
      if (!market.value) market.value = normalizeMarket(data.market)
    } catch (err) {
      if (seq !== revision) return
      console.error('[StockFundamentals] basic-info failed', err)
      infoError.value = '個股基本資訊讀取失敗或尚未建檔。'
    } finally {
      if (seq === revision) loadingInfo.value = false
    }
  }
  watch(
    stockCode,
    (code) => {
      const seq = ++revision
      basicInfo.value = null
      market.value = null
      industries.value = []
      infoError.value = ''
      tagError.value = ''
      quarterlyLoaded.value = false
      quarterlyError.value = ''
      quarterRows.value = []
      monthlyLoaded.value = false
      monthlyError.value = ''
      monthlyRows.value = []
      loadingQuarterly.value = false
      loadingMonthly.value = false
      if (code) void loadIdentity(code, seq)
      else {
        loadingInfo.value = false
        loadingTags.value = false
      }
    },
    { immediate: true },
  )
  function goToIndustry(tag: string): void {
    void router.push({ name: 'industries', query: { tag } })
  }
  function recentQuarters(count: number): { year: number; quarter: number }[] {
    const now = new Date()
    // 不預設本季已發布：由上季開始列出，缺的顯示 —。
    let year = now.getFullYear()
    let quarter = Math.floor(now.getMonth() / 3) // current quarter - 1
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
  async function loadQuarterly(): Promise<void> {
    const code = stockCode.value,
      selectedMarket = market.value,
      seq = revision
    if (!code || !selectedMarket || loadingQuarterly.value) return
    loadingQuarterly.value = true
    quarterlyError.value = ''
    const periods = recentQuarters(5)
    try {
      const batches = await Promise.allSettled(
        periods.map((p) => readQuarterly(p.year, p.quarter, selectedMarket)),
      )
      if (revision !== seq) return
      const epsByQuarter = new Map<string, number | null>()
      periods.forEach((p, i) => {
        const periodKey = `${p.year}Q${p.quarter}`
        const result = batches[i]
        const entry =
          result?.status === 'fulfilled' ? result.value.find((v) => v.stockId === code) : undefined
        epsByQuarter.set(
          periodKey,
          typeof entry?.earningsPerShare === 'number' ? entry.earningsPerShare : null,
        )
      })
      quarterRows.value = periods.slice(0, 4).map((p) => {
        const key = `${p.year}Q${p.quarter}`
        const cumulative = epsByQuarter.get(key) ?? null
        const prior = p.quarter === 1 ? 0 : (epsByQuarter.get(`${p.year}Q${p.quarter - 1}`) ?? null)
        const standalone =
          cumulative === null || prior === null ? null : Number((cumulative - prior).toFixed(4))
        return { key, cumulative, standalone }
      })
      if (batches.every((v) => v.status === 'rejected'))
        quarterlyError.value = '季度財報請求失敗，請確認 Redis 已有資料。'
      quarterlyLoaded.value = true
    } finally {
      if (seq === revision) loadingQuarterly.value = false
    }
  }
  function recentMonths(count: number): string[] {
    const now = new Date(),
      months: string[] = []
    // 當月通常尚未發布完整月營收，從上個月開始
    for (let i = 1; i <= count; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }
    return months
  }
  async function loadMonthly(): Promise<void> {
    const code = stockCode.value,
      seq = revision
    if (!code || loadingMonthly.value) return
    loadingMonthly.value = true
    monthlyError.value = ''
    const months = recentMonths(6)
    try {
      const batches = await Promise.allSettled(months.map(readMonthly))
      if (revision !== seq) return
      monthlyRows.value = months.map((month, i) => {
        const result = batches[i]
        const entry =
          result?.status === 'fulfilled' ? result.value.find((v) => v.stockId === code) : undefined
        return { month, revenue: typeof entry?.revenue === 'number' ? entry.revenue : null }
      })
      if (batches.every((v) => v.status === 'rejected'))
        monthlyError.value = '月營收讀取失敗，請確認 Redis 已有資料。'
      monthlyLoaded.value = true
    } finally {
      if (revision === seq) loadingMonthly.value = false
    }
  }
</script>

<style scoped>
  .fundamentals {
    margin-top: 28px;
    color: #e6edf4;
  }
  .headline,
  .section-head {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
  }
  .headline h2 {
    font-size: 23px;
    margin: 0 0 15px;
  }
  .headline small,
  .muted,
  .note {
    color: #a0aebd;
  }
  .two-cols {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
    margin: 0 0 16px;
  }
  .tile {
    background: #1d252d;
    border: 1px solid #33414c;
    border-radius: 12px;
    padding: 18px;
    margin-bottom: 16px;
    min-width: 0;
  }
  .two-cols .tile {
    margin-bottom: 0;
  }
  .tile h3 {
    margin: 0 0 15px;
    font-size: 17px;
  }
  .section-head h3 {
    margin-bottom: 12px;
  }
  .section-head button {
    color: #b1f2ce;
    background: #234438;
    border: 1px solid #3d735b;
    border-radius: 7px;
    padding: 8px 12px;
    cursor: pointer;
  }
  .section-head button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .facts {
    display: grid;
    grid-template-columns: minmax(105px, 35%) minmax(0, 1fr);
    gap: 12px;
    margin: 0;
    font-size: 14px;
  }
  .facts dt {
    color: #a5b8c6;
  }
  .facts dd {
    margin: 0;
    word-break: break-word;
  }
  .tag-list {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .industry-tag {
    padding: 8px 10px;
    border: 1px solid #3f6d5a;
    color: #9fe3c1;
    background: #254337;
    border-radius: 8px;
    cursor: pointer;
  }
  .note {
    font-size: 12px;
    line-height: 1.6;
  }
  .muted {
    font-size: 13px;
    line-height: 1.7;
  }
  .table-wrap {
    overflow-x: auto;
  }
  .table-wrap table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
    font-size: 13px;
  }
  .table-wrap th,
  .table-wrap td {
    padding: 10px;
    border-bottom: 1px solid #38444d;
  }
  .table-wrap th {
    color: #a6bac8;
  }
  @media (max-width: 1000px) {
    .two-cols {
      grid-template-columns: 1fr;
    }
  }
</style>
