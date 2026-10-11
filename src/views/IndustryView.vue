<template>
  <main class="industry-page">
    <header class="page-header">
      <div>
        <p class="eyebrow">BIGSTOCK · INDUSTRIES</p>

        <h1>產業分類</h1>

        <p class="subtitle">搜尋個股，自動展開相關產業，查看同產業其他股票。</p>
      </div>
    </header>

    <div class="search-panel">
      <label for="global-stock-search">搜尋個股名稱或代號</label>

      <div class="search-controls">
        <input
          id="global-stock-search"
          v-model.trim="stockQuery"
          type="search"
          placeholder="例如：台積電、2330"
          autocomplete="off"
          @keydown.enter.prevent="pickFirstResult"
        />

        <button type="button" :disabled="!stockQuery" @click="clearSearch">清除</button>
      </div>

      <p v-if="loadingDirectory" class="hint">正在載入股票名錄…</p>

      <p v-else-if="directoryError" role="alert" class="error">{{ directoryError }}</p>

      <div v-else-if="stockQuery" class="suggestions" role="listbox" aria-label="搜尋結果">
        <p v-if="!searchResults.length" class="hint">找不到符合的個股。</p>

        <button
          v-for="stock in searchResults"
          :key="stock.stockCode"
          type="button"
          role="option"
          :aria-selected="searchedStock?.stockCode === stock.stockCode"
          class="suggestion"
          @click="chooseStock(stock)"
        >
          <strong>{{ stock.stockCode }}</strong
          ><span>{{ stock.stockName }}</span>
        </button>

        <p v-if="hasMoreSearchResults" class="hint">僅顯示前 20 筆，請輸入更完整的關鍵字。</p>
      </div>

      <p v-if="searchingTags" class="hint">正在查詢所屬產業…</p>

      <p v-if="searchError" role="alert" class="error">{{ searchError }}</p>
    </div>

    <div class="layout">
      <aside class="categories" aria-label="產業分類">
        <div class="panel-header">
          <h2>產業分類</h2>

          <span class="muted">{{ groups.length }} 類</span>
        </div>

        <input
          v-model.trim="categoryQuery"
          type="search"
          aria-label="搜尋產業分類"
          placeholder="搜尋分類，例如金融、銀行"
        />

        <div class="toolbar">
          <button
            type="button"
            :disabled="!!categoryQuery"
            @click="expanded = groups.map((group) => group.name)"
          >
            全部展開
          </button>

          <button type="button" :disabled="!!categoryQuery" @click="expanded = []">全部收合</button>
        </div>

        <p v-if="loadingGroups" class="hint">分類載入中…</p>

        <p v-else-if="groupsError" class="error">{{ groupsError }}</p>

        <p v-else-if="!visibleGroups.length" class="hint">沒有符合的分類。</p>

        <nav v-else>
          <section v-for="group in visibleGroups" :key="group.name" class="group">
            <button
              type="button"
              class="group-title"
              :aria-expanded="isOpen(group.name)"
              @click="toggle(group.name)"
            >
              <span class="chevron" :class="{ opened: isOpen(group.name) }">▸</span>

              <strong>{{ group.name }}</strong>

              <span class="muted">{{ group.children.length }}</span>
            </button>

            <div v-if="isOpen(group.name)" class="group-children">
              <button
                v-for="child in group.children"
                :key="child.tag"
                type="button"
                class="category"
                :class="{
                  active: selectedTag === child.tag,

                  related: matchedTags.includes(child.tag),
                }"
                @click="selectCategory(child)"
              >
                <span>{{ child.label }}</span>

                <span
                  v-if="matchedTags.includes(child.tag)"
                  class="matching-dot"
                  title="搜尋個股所屬分類"
                ></span>
              </button>
            </div>
          </section>
        </nav>
      </aside>

      <section class="stocks-panel" aria-label="同產業個股清單">
        <div class="panel-header stocks-header">
          <div>
            <p class="breadcrumb">{{ selectedCategoryBreadcrumb }}</p>

            <h2>{{ selectedCategory?.label ?? '同產業個股' }}</h2>

            <p v-if="searchedStock" class="focus-stock">
              查詢個股：<strong>{{ searchedStock.stockCode }} {{ searchedStock.stockName }}</strong>
            </p>
          </div>

          <span v-if="selectedCategory" class="muted"
            >{{ filteredStocks.length }} / {{ stocks.length }} 檔</span
          >
        </div>

        <div v-if="selectedCategory" class="list-tools">
          <input
            v-model.trim="listQuery"
            type="search"
            aria-label="篩選同產業個股"
            placeholder="在本產業搜尋代號或名稱"
          />

          <select v-model="sortOrder" aria-label="股票排序">
            <option value="codeAsc">代號由小到大</option>

            <option value="codeDesc">代號由大到小</option>

            <option value="nameAsc">名稱排序</option>
          </select>
        </div>

        <p v-if="loadingStocks" class="placeholder">載入個股清單中…</p>

        <p v-else-if="stocksError" class="error placeholder">
          {{ stocksError }}

          <button type="button" @click="reloadStocks">重新載入</button>
        </p>

        <p v-else-if="!selectedCategory" class="placeholder">
          搜尋個股後會自動展開所屬分類，也可以直接點選左側分類。
        </p>

        <p v-else-if="!filteredStocks.length" class="placeholder">此分類目前沒有符合的股票。</p>

        <div v-else class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>股票代號</th>

                <th>股票名稱</th>
              </tr>
            </thead>

            <tbody>
              <tr
                v-for="stock in filteredStocks"
                :key="stock.stockCode"
                :class="{ highlighted: searchedStock?.stockCode === stock.stockCode }"
                class="clickable-stock"
                tabindex="0"
                role="link"
                :aria-label="`查看 ${stock.stockCode} ${stock.stockName} 的 K 線與基本面`"
                @click="goToStock(stock)"
                @keydown.enter.prevent="goToStock(stock)"
                @keydown.space.prevent="goToStock(stock)"
              >
                <td>
                  <strong>{{ stock.stockCode }}</strong>
                </td>

                <td>
                  {{ stock.stockName }}

                  <span v-if="searchedStock?.stockCode === stock.stockCode" class="you-searched"
                    >查詢個股</span
                  >
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p class="list-note">點擊個股整列即可進入 K 線與基本面分析；本頁不顯示漲跌幅或市場別。</p>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue'
  import { useRouter, useRoute } from 'vue-router'

  import {
    getAllStockInfo,
    getIndustryMappings,
    getIndustryStocks,
    getStockTags,
  } from '@/api/industryApi'

  import type { StockInfo, TagStocks, TagsMapping } from '@/types/industry'

  const router = useRouter()
  const route = useRoute()

  type Category = { tag: string; parent: string; label: string; fullName: string }

  type CategoryGroup = { name: string; children: Category[] }

  type Stock = { stockCode: string; stockName: string }

  const groups = ref<CategoryGroup[]>([])

  const directory = ref<Stock[]>([])

  const stockQuery = ref('')

  const categoryQuery = ref('')

  const listQuery = ref('')

  const sortOrder = ref<'codeAsc' | 'codeDesc' | 'nameAsc'>('codeAsc')

  const searchedStock = ref<Stock | null>(null)

  const matchedTags = ref<string[]>([])

  const expanded = ref<string[]>([])

  const selectedTag = ref('')

  const stocks = ref<Stock[]>([])

  const loadingGroups = ref(false)

  const loadingDirectory = ref(false)

  const loadingStocks = ref(false)

  const searchingTags = ref(false)

  const groupsError = ref('')

  const directoryError = ref('')

  const stocksError = ref('')

  const searchError = ref('')

  let listSeq = 0

  let searchSeq = 0

  const allCategories = computed(() => groups.value.flatMap((g) => g.children))

  const selectedCategory = computed(
    () => allCategories.value.find((c) => c.tag === selectedTag.value) ?? null,
  )

  /** 避免模板直接存取可能為 null 的 selectedCategory。 */
  const selectedCategoryBreadcrumb = computed<string>(() => {
    const category = selectedCategory.value
    return category ? `${category.parent} ／ ${category.label}` : '請選擇產業分類'
  })

  const visibleGroups = computed(() => {
    const query = categoryQuery.value.toLocaleLowerCase().trim()

    if (!query) return groups.value

    return groups.value

      .map((group) => ({
        name: group.name,

        children: group.name.toLocaleLowerCase().includes(query)
          ? group.children
          : group.children.filter(
              (child) =>
                child.label.toLocaleLowerCase().includes(query) ||
                child.fullName.toLocaleLowerCase().includes(query),
            ),
      }))

      .filter((group) => group.children.length)
  })

  const allSearchResults = computed(() => {
    const query = stockQuery.value.toLocaleLowerCase().trim()

    if (!query) return []

    return directory.value.filter(
      (s) =>
        s.stockCode.toLocaleLowerCase().includes(query) ||
        s.stockName.toLocaleLowerCase().includes(query),
    )
  })

  const searchResults = computed(() => allSearchResults.value.slice(0, 20))

  const hasMoreSearchResults = computed(() => allSearchResults.value.length > 20)

  const filteredStocks = computed(() => {
    const query = listQuery.value.toLocaleLowerCase().trim()

    const list = stocks.value.filter(
      (s) =>
        !query ||
        s.stockCode.toLocaleLowerCase().includes(query) ||
        s.stockName.toLocaleLowerCase().includes(query),
    )

    return list.sort((a, b) =>
      sortOrder.value === 'nameAsc'
        ? a.stockName.localeCompare(b.stockName, 'zh-Hant')
        : (sortOrder.value === 'codeDesc' ? -1 : 1) *
          a.stockCode.localeCompare(b.stockCode, undefined, { numeric: true }),
    )
  })

  function buildGroups(mapping: TagsMapping): CategoryGroup[] {
    const map = new Map<string, Category[]>()

    for (const [tag, rawName] of Object.entries(mapping)) {
      if (typeof rawName !== 'string' || !rawName.trim()) continue

      const fullName = rawName.trim()

      const sep = fullName.search(/[-－]/)

      const parent = sep < 0 ? fullName : fullName.slice(0, sep).trim()

      const label = sep < 0 ? fullName : fullName.slice(sep + 1).trim()

      if (!parent || !label) continue

      if (!map.has(parent)) map.set(parent, [])

      map.get(parent)!.push({ tag, parent, label, fullName })
    }

    return [...map.entries()]

      .map(([name, children]) => ({
        name,

        children: children.sort((a, b) => a.label.localeCompare(b.label, 'zh-Hant')),
      }))

      .sort((a, b) =>
        a.name === '金融' ? -1 : b.name === '金融' ? 1 : a.name.localeCompare(b.name, 'zh-Hant'),
      )
  }

  function isOpen(name: string): boolean {
    return Boolean(categoryQuery.value) || expanded.value.includes(name)
  }

  function toggle(name: string): void {
    if (categoryQuery.value) return

    expanded.value = expanded.value.includes(name)
      ? expanded.value.filter((n) => n !== name)
      : [...expanded.value, name]
  }

  // 同一張頁面的暫存僅為防止重複請求，不使用 localStorage、IndexedDB 或每日漲幅快取。

  const listCache = new Map<string, Stock[]>()

  const pendingLists = new Map<string, Promise<Stock[]>>()

  async function loadList(tag: string, force = false): Promise<Stock[]> {
    if (!force && listCache.has(tag)) return listCache.get(tag)!

    if (!force && pendingLists.has(tag)) return pendingLists.get(tag)!

    const task = (async () => {
      const response: TagStocks = await getIndustryStocks(tag)

      if (!response || typeof response !== 'object' || Array.isArray(response))
        throw new Error('tagStocks 格式錯誤')

      const items = Object.entries(response)

        .map(([stockCode, stockName]) => ({
          stockCode: stockCode.trim(),

          stockName: typeof stockName === 'string' ? stockName.trim() : '',
        }))

        .filter((s) => !!s.stockCode)

      listCache.set(tag, items)

      return items
    })()

    pendingLists.set(tag, task)

    try {
      return await task
    } finally {
      if (pendingLists.get(tag) === task) pendingLists.delete(tag)
    }
  }

  async function fetchCategory(tag: string, force = false): Promise<void> {
    const seq = ++listSeq

    loadingStocks.value = true

    stocksError.value = ''

    stocks.value = []

    try {
      const items = await loadList(tag, force)

      if (seq !== listSeq || selectedTag.value !== tag) return

      stocks.value = items
    } catch (error) {
      if (seq !== listSeq) return

      console.error('[Industry] 載入分類個股失敗', error)

      stocksError.value = '個股清單讀取失敗。'
    } finally {
      if (seq === listSeq) loadingStocks.value = false
    }
  }

  function selectCategory(category: Category): void {
    selectedTag.value = category.tag

    if (!expanded.value.includes(category.parent)) expanded.value.push(category.parent)

    listQuery.value = ''

    void fetchCategory(category.tag)
  }

  function goToStock(stock: Stock): void {
    void router.push({ name: 'candlestick', query: { stockCode: stock.stockCode } })
  }

  function reloadStocks(): void {
    if (selectedTag.value) void fetchCategory(selectedTag.value, true)
  }

  // getStockTags 的實際回傳格式尚未完全確定：只辨認能與 tagsMapping 對上的代號或名稱。

  function parseTags(raw: unknown): string[] {
    const byCode = new Map(allCategories.value.map((c) => [c.tag, c.tag]))

    const byName = new Map(allCategories.value.map((c) => [c.fullName, c.tag]))

    const found = new Set<string>()

    function visit(value: unknown, depth: number): void {
      if (depth > 6) return

      if (typeof value === 'string') {
        const tag = byCode.get(value) ?? byName.get(value)

        if (tag) found.add(tag)
        else if (/[,，;；]/.test(value))
          value.split(/[,，;；]/).forEach((v) => visit(v.trim(), depth + 1))
      } else if (Array.isArray(value)) value.forEach((v) => visit(v, depth + 1))
      else if (value && typeof value === 'object') {
        Object.entries(value).forEach(([key, val]) => {
          visit(key, depth + 1)

          visit(val, depth + 1)
        })
      }
    }

    visit(raw, 0)

    return [...found]
  }

  async function chooseStock(stock: Stock): Promise<void> {
    const seq = ++searchSeq

    searchedStock.value = stock

    stockQuery.value = stock.stockCode

    matchedTags.value = []

    searchError.value = ''

    searchingTags.value = true

    try {
      const tags = parseTags(await getStockTags(stock.stockCode))

      if (seq !== searchSeq) return

      matchedTags.value = tags

      if (!tags.length) {
        searchError.value = '已找到個股，但目前無法辨識所屬產業。'

        return
      }

      const matches = allCategories.value.filter((c) => tags.includes(c.tag))

      expanded.value = [...new Set([...expanded.value, ...matches.map((c) => c.parent)])]

      categoryQuery.value = ''

      const first = matches[0]

      if (first) selectCategory(first)
    } catch (error) {
      if (seq !== searchSeq) return

      console.error('[Industry] 個股分類查詢失敗', error)

      searchError.value = '取得個股所屬產業失敗。'
    } finally {
      if (seq === searchSeq) searchingTags.value = false
    }
  }

  function pickFirstResult(): void {
    const first = searchResults.value[0]

    if (first) void chooseStock(first)
  }

  function clearSearch(): void {
    ++searchSeq

    stockQuery.value = ''

    searchedStock.value = null

    matchedTags.value = []

    searchError.value = ''

    searchingTags.value = false
  }

  async function init(): Promise<void> {
    loadingGroups.value = true

    loadingDirectory.value = true

    try {
      const [mappingResult, directoryResult] = await Promise.allSettled([
        getIndustryMappings(),

        getAllStockInfo(),
      ])

      if (mappingResult.status === 'fulfilled') {
        groups.value = buildGroups(mappingResult.value)

        const initial = groups.value.find((g) => g.name === '金融') ?? groups.value[0]

        if (initial) expanded.value = [initial.name]
        const queryTag = typeof route.query.tag === 'string' ? route.query.tag : ''
        const requested = allCategories.value.find((category) => category.tag === queryTag)
        if (requested) selectCategory(requested)
      } else {
        groupsError.value = '產業分類載入失敗。'

        console.error(mappingResult.reason)
      }

      if (directoryResult.status === 'fulfilled') {
        const records: StockInfo[] = directoryResult.value

        if (!Array.isArray(records)) throw new Error('stockInfo 回傳格式不是陣列')

        directory.value = records

          .filter((s) => s && typeof s.stockCode === 'string')

          .map((s) => ({
            stockCode: s.stockCode.trim(),

            stockName: typeof s.stockName === 'string' ? s.stockName.trim() : '',
          }))

          .filter((s) => s.stockCode)
      } else {
        directoryError.value = '股票名錄載入失敗，請檢查 stockInfo API 路徑。'

        console.error(directoryResult.reason)
      }
    } catch (error) {
      console.error('[Industry] 初始化失敗', error)

      directoryError.value = '無法載入股票名錄。'
    } finally {
      loadingGroups.value = false

      loadingDirectory.value = false
    }
  }

  onMounted(() => {
    void init()
  })
</script>

<style scoped>
  .industry-page {
    min-height: calc(100vh - 100px);

    background: #14181e;

    color: #edf3f8;

    padding: 28px clamp(14px, 3vw, 48px) 50px;
  }

  .page-header {
    margin-bottom: 22px;
  }

  .eyebrow {
    color: #5bcc96;

    font-size: 11px;

    letter-spacing: 0.15em;

    font-weight: 700;

    margin: 0 0 9px;
  }

  h1 {
    margin: 0 0 9px;

    font-size: 32px;
  }

  .subtitle {
    margin: 0;

    color: #98a9bb;

    font-size: 14px;
  }

  .search-panel,
  .categories,
  .stocks-panel {
    background: #1d252d;

    border: 1px solid #34414c;

    border-radius: 13px;

    padding: 20px;

    min-width: 0;
  }

  .search-panel {
    margin-bottom: 19px;
  }

  .search-panel label {
    display: block;

    font-size: 13px;

    font-weight: 700;

    margin-bottom: 9px;
  }

  .search-controls {
    display: flex;

    gap: 10px;
  }

  input,
  select {
    background: #111a22;

    border: 1px solid #3b4a59;

    border-radius: 8px;

    color: #edf3f8;

    padding: 11px 12px;

    font-size: 14px;

    min-width: 0;
  }

  input:focus,
  select:focus {
    outline: 2px solid #388e70;

    outline-offset: 1px;
  }

  .search-controls input {
    flex: 1;

    max-width: 520px;
  }

  button {
    font: inherit;

    cursor: pointer;
  }

  .search-controls button,
  .toolbar button,
  .placeholder button {
    border: 1px solid #415563;

    border-radius: 8px;

    padding: 9px 13px;

    background: #293641;

    color: #cde2dc;
  }

  .search-controls button:disabled,
  .toolbar button:disabled {
    opacity: 0.4;

    cursor: not-allowed;
  }

  .suggestions {
    display: flex;

    flex-direction: column;

    margin-top: 12px;

    max-width: 520px;

    max-height: 260px;

    overflow-y: auto;

    border: 1px solid #32404c;

    border-radius: 9px;
  }

  .suggestion {
    display: flex;

    gap: 15px;

    text-align: left;

    border: 0;

    border-bottom: 1px solid #2c3944;

    background: #19232b;

    padding: 10px 12px;

    color: #dce9f1;
  }

  .suggestion:hover {
    background: #293c42;
  }

  .suggestion strong {
    color: #69d7ab;

    min-width: 70px;
  }

  .hint {
    color: #93a6b9;

    font-size: 12px;

    margin: 10px 0;
  }

  .error {
    color: #f4a3a3;

    font-size: 13px;

    margin: 12px 0;
  }

  .layout {
    display: grid;

    grid-template-columns: minmax(250px, 310px) minmax(0, 1fr);

    gap: 18px;

    align-items: start;
  }

  .panel-header {
    display: flex;

    align-items: center;

    justify-content: space-between;

    gap: 14px;

    margin-bottom: 16px;
  }

  h2 {
    margin: 0;

    font-size: 19px;
  }

  .muted,
  .breadcrumb {
    font-size: 12px;

    color: #92a4b4;
  }

  .categories > input {
    width: 100%;

    box-sizing: border-box;
  }

  .toolbar {
    display: flex;

    gap: 8px;

    padding: 12px 0;
  }

  .toolbar button {
    padding: 7px 10px;

    font-size: 12px;
  }

  .categories nav {
    max-height: 65vh;

    overflow: auto;
  }

  .group {
    border-top: 1px solid #32404a;
  }

  .group-title {
    border: 0;

    background: transparent;

    display: flex;

    width: 100%;

    padding: 12px 5px;

    color: #eaf2f8;

    align-items: center;

    text-align: left;

    gap: 10px;
  }

  .group-title strong {
    flex: 1;
  }

  .group-title:hover {
    background: #293540;
  }

  .chevron {
    color: #8da0af;

    transition: transform 0.15s;
  }

  .chevron.opened {
    transform: rotate(90deg);
  }

  .group-children {
    display: flex;

    flex-direction: column;

    padding: 0 0 10px 19px;

    gap: 2px;
  }

  .category {
    display: flex;

    align-items: center;

    justify-content: space-between;

    border: 0;

    border-radius: 7px;

    background: transparent;

    color: #bac7d2;

    text-align: left;

    padding: 9px 12px;
  }

  .category:hover {
    background: #293743;
  }

  .category.active {
    background: #234338;

    color: #8ae7be;

    font-weight: 700;
  }

  .category.related:not(.active) {
    color: #6ad7ad;
  }

  .matching-dot {
    width: 7px;

    height: 7px;

    background: #62d5a4;

    border-radius: 50%;

    flex-shrink: 0;
  }

  .stocks-panel {
    min-height: 430px;
  }

  .stocks-header {
    align-items: flex-start;
  }

  .stocks-header h2 {
    font-size: 23px;
  }

  .breadcrumb {
    margin: 0 0 6px;
  }

  .focus-stock {
    font-size: 12px;

    color: #a6baaa;

    margin: 10px 0 0;
  }

  .list-tools {
    display: flex;

    gap: 10px;

    margin: 0 0 15px;

    flex-wrap: wrap;
  }

  .list-tools input {
    flex: 1;

    min-width: 180px;
  }

  .table-scroll {
    overflow: auto;
  }

  table {
    width: 100%;

    border-collapse: collapse;
  }

  th {
    text-align: left;

    font-size: 12px;

    color: #9dafbf;

    background: #26313b;

    padding: 12px 14px;
  }

  td {
    padding: 12px 14px;

    border-bottom: 1px solid #33404a;

    font-size: 14px;
  }

  td strong {
    color: #70ddac;
  }

  tr.highlighted td {
    background: #253c34;
  }

  .you-searched {
    display: inline-block;

    margin-left: 9px;

    font-size: 11px;

    color: #7be1af;
  }

  .clickable-stock {
    cursor: pointer;
  }
  .clickable-stock:hover td,
  .clickable-stock:focus-visible td {
    background: #293b3b;
  }
  .clickable-stock:focus-visible {
    outline: 2px solid #6cd7aa;
    outline-offset: -2px;
  }
  .table-scroll .stock-select {
    background: transparent;
    border: 1px solid #415563;
    border-radius: 7px;
    padding: 7px 10px;
    cursor: pointer;

    color: #9cc9f2;

    text-decoration: none;
  }

  .table-scroll .stock-select:hover {
    background: #293c42;

    text-decoration: underline;
  }

  .placeholder {
    padding: 42px 12px;

    text-align: center;

    color: #9eafbe;
  }

  .list-note {
    font-size: 11px;

    color: #8193a2;

    margin: 18px 0 0;

    line-height: 1.7;
  }

  @media (max-width: 800px) {
    .layout {
      grid-template-columns: 1fr;
    }

    .categories nav {
      max-height: 360px;
    }

    .industry-page {
      padding: 18px 12px 32px;
    }

    .search-controls input {
      max-width: none;
    }
  }
</style>
