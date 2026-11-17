<template>
  <section class="watchlist">
    <button
      type="button"
      class="watchlist-toggle"
      :aria-expanded="expanded"
      aria-controls="stock-watchlist"
      @click="togglePanel"
    >
      自選股
    </button>

    <div v-if="expanded" id="stock-watchlist" class="watchlist-body">
      <form class="watchlist-actions" @submit.prevent="addSelectedStock">
        <input
          v-model.trim="stockInput"
          type="text"
          aria-label="股票代號或名稱"
          placeholder="股票代號或名稱"
          :disabled="busy"
          autocomplete="off"
          @input="selectedStockCode = ''"
        />
        <button type="submit" :disabled="!selectedStockCode || busy">加入自選</button>
        <button
          v-if="activeStockCode && !stockCodes.includes(activeStockCode)"
          type="button"
          :disabled="busy"
          @click="changeStock(activeStockCode, true)"
        >
          加入目前個股 {{ activeStockCode }}
        </button>
      </form>

      <p v-if="directoryLoading" class="watchlist-status" role="status">載入股票名錄中…</p>
      <div v-else-if="directoryError" class="watchlist-actions">
        <p class="watchlist-error" role="alert">股票名錄載入失敗。</p>
        <button type="button" @click="loadDirectory">重試</button>
      </div>
      <ul v-else-if="searchResults.length" class="watchlist-stocks" aria-label="股票搜尋結果">
        <li v-for="stock in searchResults" :key="stock.stockCode">
          <button type="button" :disabled="busy" @click="selectResult(stock)">
            {{ stock.stockCode }} {{ stock.stockName }}
          </button>
        </li>
      </ul>
      <p v-else-if="stockInput && !selectedStockCode" class="watchlist-status">找不到符合的股票。</p>

      <p v-if="errorMessage" class="watchlist-error" role="alert">{{ errorMessage }}</p>
      <p v-if="statusMessage" class="watchlist-status" role="status">{{ statusMessage }}</p>
      <p v-if="loaded && !stockCodes.length" class="watchlist-status">目前沒有自選股。</p>

      <ul v-if="stockCodes.length" class="watchlist-stocks" aria-label="自選股清單">
        <li v-for="code in stockCodes" :key="code">
          <button type="button" @click="emit('select-stock', code)">
            {{ code }} {{ directory.get(code.toUpperCase())?.stockName }}
          </button>
          <button
            type="button"
            :aria-label="`移除自選股 ${code}`"
            :disabled="busy"
            @click="changeStock(code, false)"
          >
            ×
          </button>
        </li>
      </ul>

      <div class="watchlist-actions">
        <button type="button" :disabled="busy" @click="loadList">重新讀取</button>
        <button type="button" :disabled="busy || !stockCodes.length" @click="refreshList">
          保留清單 10 天
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { isAxiosError } from 'axios'
import { computed, ref } from 'vue'
import { getAllStockInfo } from '@/api/industryApi'
import { useMarketStore } from '@/stores/marketStore'
import type { StockInfo } from '@/types/industry'
import {
  changeWebQuoteSubscription,
  getWebQuoteSubscriptions,
  refreshWebQuoteSubscriptions,
} from '@/api/webQuoteSubscriptionsApi'

const props = defineProps<{ activeStock: string }>()
const marketStore = useMarketStore()
const emit = defineEmits<{ 'select-stock': [code: string] }>()

const expanded = ref(false)
const loaded = ref(false)
const busy = ref(false)
const stockInput = ref('')
const selectedStockCode = ref('')
const directory = ref(new Map<string, StockInfo>())
const directoryLoading = ref(false)
const directoryError = ref(false)
const activeStockCode = computed(() => directory.value.get(props.activeStock.trim().toUpperCase())?.stockCode ?? '')
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
  return run('載入自選清單中…', '無法載入自選清單，請重新讀取。', async () => {
    const result = await getWebQuoteSubscriptions()
    stockCodes.value = result.stockCodes
    loaded.value = true
    statusMessage.value = ''
  })
}

function togglePanel() {
  expanded.value = !expanded.value
  if (expanded.value) {
    void loadList()
    void loadDirectory()
  }
}

function changeStock(stock: string, subscribed: boolean) {
  return run('更新自選清單中…', '無法更新自選清單，請稍後再試。', async () => {
    try {
      const result = await changeWebQuoteSubscription(stock, subscribed)
      stockCodes.value = result.stockCodes
      loaded.value = true
      if (result.visitorCreated) marketStore.retryMarketSocket()
      statusMessage.value = subscribed ? '已加入自選股。' : '已移除自選股。'
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 404) {
        statusMessage.value = ''
        errorMessage.value = '找不到這檔股票，或訪客清單已到期。請確認代號後重試。'
        return
      }
      if (isAxiosError(error) && error.response?.status === 409) {
        statusMessage.value = ''
        errorMessage.value = '自選清單已達 100 檔，請先移除個股。'
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
      statusMessage.value = '自選清單已延長保留 10 天。'
    } catch (error) {
      if (!isAxiosError(error) || error.response?.status !== 404) throw error
      stockCodes.value = []
      statusMessage.value = ''
      errorMessage.value = '清單已到期，請重新加入自選股。'
    }
  })
}
</script>

<style scoped>
.watchlist {
  margin-bottom: 16px;
  color: #e8f2ef;
}
.watchlist-body {
  display: grid;
  gap: 12px;
  margin-top: 8px;
  padding: 12px;
  border: 1px solid #33414c;
  border-radius: 7px;
  background: #20282f;
}
.watchlist-actions,
.watchlist-stocks {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.watchlist input,
.watchlist button {
  max-width: 100%;
  min-height: 34px;
  padding: 6px 10px;
  border: 1px solid #4a5d69;
  border-radius: 5px;
  background: #151b20;
  color: inherit;
  font: inherit;
}
.watchlist input {
  width: min(100%, 13rem);
}
.watchlist button {
  cursor: pointer;
}
.watchlist button:hover:not(:disabled),
.watchlist button:focus-visible,
.watchlist input:focus-visible {
  border-color: #7ac884;
}
.watchlist button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.watchlist-toggle[aria-expanded='true'] {
  border-color: #4caf50;
}
.watchlist-stocks {
  padding: 0;
  margin: 0;
  list-style: none;
}
.watchlist-stocks li {
  display: inline-flex;
  gap: 2px;
}
.watchlist-status,
.watchlist-error {
  margin: 0;
  font-size: 14px;
}
.watchlist-status {
  color: #c5d2dc;
}
.watchlist-error {
  color: #ffaaa5;
}
</style>
