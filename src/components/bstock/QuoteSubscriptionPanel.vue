<template>
  <div v-show="open" id="quote-subscriptions" class="subscription-panel">
    <form class="subscription-actions" @submit.prevent="addSelectedStock">
      <input
        v-model.trim="stockInput"
        type="text"
        aria-label="股票代號或名稱"
        placeholder="股票代號或名稱"
        :disabled="busy"
        autocomplete="off"
        @input="selectedStockCode = ''"
      />
      <button type="submit" :disabled="!selectedStockCode || busy">訂閱報價</button>
    </form>

    <p v-if="directoryLoading" class="subscription-status" role="status">載入股票名錄中…</p>
    <div v-else-if="directoryError" class="subscription-actions">
      <p class="subscription-error" role="alert">股票名錄載入失敗。</p>
      <button type="button" @click="loadDirectory">重試</button>
    </div>
    <ul v-else-if="searchResults.length" class="subscription-stocks" aria-label="股票搜尋結果">
      <li v-for="stock in searchResults" :key="stock.stockCode">
        <button type="button" :disabled="busy" @click="selectResult(stock)">
          {{ stock.stockCode }} {{ stock.stockName }}
        </button>
      </li>
    </ul>
    <p v-else-if="stockInput && !selectedStockCode" class="subscription-status">找不到符合的股票。</p>

    <p v-if="errorMessage" class="subscription-error" role="alert">{{ errorMessage }}</p>
    <p v-if="statusMessage" class="subscription-status" role="status">{{ statusMessage }}</p>
    <p v-if="loaded && !stockCodes.length" class="subscription-status">尚未訂閱個股，首頁會顯示預設五檔。</p>

    <ul v-if="stockCodes.length" class="subscription-stocks" aria-label="報價訂閱清單">
      <li v-for="code in stockCodes" :key="code">
        <span>{{ code }} {{ directory.get(code.toUpperCase())?.stockName }}</span>
        <button
          type="button"
          :aria-label="`取消訂閱 ${code}`"
          :disabled="busy"
          @click="changeStock(code, false)"
        >
          ×
        </button>
      </li>
    </ul>

    <div class="subscription-actions">
      <button type="button" :disabled="busy" @click="loadList">重新讀取</button>
      <button type="button" :disabled="busy || !stockCodes.length" @click="refreshList">
        保留清單 10 天
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { isAxiosError } from 'axios'
import { computed, ref, watch } from 'vue'
import { getAllStockInfo } from '@/api/industryApi'
import { useMarketStore } from '@/stores/marketStore'
import type { StockInfo } from '@/types/industry'
import {
  changeWebQuoteSubscription,
  getWebQuoteSubscriptions,
  refreshWebQuoteSubscriptions,
} from '@/api/webQuoteSubscriptionsApi'

const props = defineProps<{ open: boolean }>()
const marketStore = useMarketStore()
const loaded = ref(false)
const busy = ref(false)
const stockInput = ref('')
const selectedStockCode = ref('')
const directory = ref(new Map<string, StockInfo>())
const directoryLoading = ref(false)
const directoryError = ref(false)
const searchResults = computed(() => {
  const query = searchText(stockInput.value)
  if (!query || selectedStockCode.value) return []

  const exact: StockInfo[] = []
  const prefix: StockInfo[] = []
  const matches: StockInfo[] = []
  for (const stock of directory.value.values()) {
    const code = searchText(stock.stockCode)
    const name = searchText(stock.stockName)
    if (code === query || name === query) exact.push(stock)
    else if (code.startsWith(query) || name.startsWith(query)) prefix.push(stock)
    else if (code.includes(query) || name.includes(query)) matches.push(stock)
  }
  return [...exact, ...prefix, ...matches].slice(0, 12)
})

function searchText(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/\s+/g, '')
}

function selectResult(stock: StockInfo) {
  selectedStockCode.value = stock.stockCode
  stockInput.value = `${stock.stockCode} ${stock.stockName}`.trim()
}

async function loadDirectory() {
  if (directoryLoading.value || directory.value.size) return
  directoryLoading.value = true
  directoryError.value = false
  try {
    const stocks = await getAllStockInfo()
    for (const stock of stocks) {
      const code = stock.stockCode.trim()
      if (code) directory.value.set(code.toUpperCase(), { ...stock, stockCode: code })
    }
  } catch {
    directoryError.value = true
  } finally {
    directoryLoading.value = false
  }
}
const stockCodes = ref<string[]>([])
const errorMessage = ref('')
const statusMessage = ref('')

async function run(message: string, fallback: string, work: () => Promise<void>) {
  if (busy.value) return
  busy.value = true
  errorMessage.value = ''
  statusMessage.value = message
  try {
    await work()
  } catch (error) {
    statusMessage.value = ''
    errorMessage.value = isAxiosError(error) && error.response?.status === 401
      ? '訪客驗證未完成，請稍後再試。'
      : fallback
  } finally {
    busy.value = false
  }
}

function loadList() {
  return run('載入報價訂閱清單中…', '無法載入報價訂閱清單，請重新讀取。', async () => {
    const result = await getWebQuoteSubscriptions()
    stockCodes.value = result.stockCodes
    loaded.value = true
    statusMessage.value = ''
  })
}

watch(() => props.open, (open) => {
  if (!open) return
  void loadList()
  void loadDirectory()
}, { immediate: true })

function changeStock(stock: string, subscribed: boolean) {
  return run('更新報價訂閱清單中…', '無法更新報價訂閱清單，請稍後再試。', async () => {
    try {
      const result = await changeWebQuoteSubscription(stock, subscribed)
      stockCodes.value = result.stockCodes
      loaded.value = true
      if (result.visitorCreated) marketStore.retryMarketSocket()
      statusMessage.value = subscribed ? '已訂閱報價。' : '已取消訂閱。'
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 404) {
        statusMessage.value = ''
        errorMessage.value = '找不到這檔股票，或訪客清單已到期。請確認代號後重試。'
        return
      }
      if (isAxiosError(error) && error.response?.status === 409) {
        statusMessage.value = ''
        errorMessage.value = '報價訂閱清單已達 100 檔，請先移除個股。'
        return
      }
      throw error
    }
  })
}

async function addSelectedStock() {
  const code = selectedStockCode.value
  if (!code || busy.value) return
  await changeStock(code, true)
  if (!errorMessage.value) {
    stockInput.value = ''
    selectedStockCode.value = ''
  }
}

function refreshList() {
  return run('延長保留期限中…', '無法延長保留期限，請稍後再試。', async () => {
    try {
      await refreshWebQuoteSubscriptions()
      statusMessage.value = '報價訂閱清單已延長保留 10 天。'
    } catch (error) {
      if (!isAxiosError(error) || error.response?.status !== 404) throw error
      stockCodes.value = []
      statusMessage.value = ''
      errorMessage.value = '清單已到期，請重新訂閱報價。'
    }
  })
}
</script>

<style scoped>
.subscription-panel {
  color: #e8f2ef;
  display: grid;
  gap: 12px;
  margin-top: 8px;
  padding: 12px;
  border: 1px solid #33414c;
  border-radius: 7px;
  background: #20282f;
}
.subscription-actions,
.subscription-stocks {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.subscription-panel input,
.subscription-panel button {
  max-width: 100%;
  min-height: 34px;
  padding: 6px 10px;
  border: 1px solid #4a5d69;
  border-radius: 5px;
  background: #151b20;
  color: inherit;
  font: inherit;
}
.subscription-panel input {
  width: min(100%, 13rem);
}
.subscription-panel button {
  cursor: pointer;
}
.subscription-panel button:hover:not(:disabled),
.subscription-panel button:focus-visible,
.subscription-panel input:focus-visible {
  border-color: #7ac884;
}
.subscription-panel button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.subscription-stocks {
  padding: 0;
  margin: 0;
  list-style: none;
}
.subscription-stocks li {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding-inline-start: 8px;
  border: 1px solid #4a5d69;
  border-radius: 5px;
}
.subscription-status,
.subscription-error {
  margin: 0;
  font-size: 14px;
}
.subscription-status {
  color: #c5d2dc;
}
.subscription-error {
  color: #ffaaa5;
}
</style>
