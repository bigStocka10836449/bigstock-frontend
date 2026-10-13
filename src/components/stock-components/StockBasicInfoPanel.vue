<template>
  <section class="tile">
    <h3>個股基本資訊</h3>
    <p v-if="loading" class="muted">正在載入基本資訊…</p>
    <p v-else-if="error" class="error">{{ error }}</p>
    <dl v-else-if="info" class="facts">
      <template v-for="field in fields" :key="field.label">
        <dt>{{ field.label }}</dt>
        <dd>{{ field.value }}</dd>
      </template>
    </dl>
    <p v-else class="muted">目前沒有基本資訊。</p>
  </section>
</template>
<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { getStockBasicInfo } from '@/api/stockFundamentalsApi'
  import type { ExchangeMarket } from '@/api/stockFundamentalsApi'
  import type { StockBasicInfoResponse } from '@/types/stockFundamentals'
  const props = defineProps<{ stockCode: string; market: ExchangeMarket | null }>()
  const info = ref<StockBasicInfoResponse | null>(null)
  const loading = ref(false),
    error = ref('')
  let revision = 0
  const display = (v: unknown): string =>
    v === null || v === undefined || v === ''
      ? '—'
      : typeof v === 'number'
        ? v.toLocaleString('zh-TW', { maximumFractionDigits: 2 })
        : String(v)
  const fields = computed(() => {
    const v = info.value
    if (!v) return []
    return [
      { label: '公司名稱', value: display(v.stockName) },
      { label: '主要業務', value: display(v.mainBusiness) },
      { label: '產業類別', value: display(v.industryCategory) },
      { label: '次產業類別', value: display(v.subIndustryCategory) },
      { label: '上市日期', value: display(v.listingDate) },
      { label: '股本', value: display(v.capitalStock) },
      { label: '每股淨值', value: display(v.netAssetValuePerShare) },
      { label: '最新 EPS（基本資訊）', value: display(v.earningsPerShare) },
      { label: '本益比', value: display(v.peRatio) },
      { label: '市值', value: display(v.marketCap) },
    ]
  })
  // 只有 stockCode 和 market 都確定後才呼叫 API，避免缺少 market 造成錯誤。
  // 股票或市場變化後會重新載入，revision 保證舊回應不會覆蓋新股票。
  watch(
    () => [props.stockCode, props.market] as const,
    async ([code, market]) => {
      const seq = ++revision
      info.value = null
      error.value = ''
      loading.value = Boolean(code && market)
      if (!code) return
      if (!market) {
        error.value = '尚未辨識股票市場別，請確認 stockInfo 的 stockType。'
        loading.value = false
        return
      }
      try {
        const data = await getStockBasicInfo(code, market)
        if (seq === revision) info.value = data
      } catch (e) {
        if (seq === revision) {
          console.error('[StockBasicInfo]', e)
          error.value = '基本資訊取得失敗。'
        }
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
  .muted {
    color: #a0aebd;
    font-size: 13px;
  }
  .error {
    color: #f2aaaa;
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
</style>
