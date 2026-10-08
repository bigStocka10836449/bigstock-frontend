<template>
  <!-- 查詢結果有資料或查詢完成時，由父元件控制面板顯示 -->
  <Transition name="panel-fade">
    <aside v-if="shouldShow" class="filter-results" :class="{ collapsed: !isExpanded }">
      <!-- 標題永遠可操作；收合狀態不會裁切按鈕 -->
      <button
        type="button"
        class="results-header"
        :aria-expanded="isExpanded"
        aria-label="展開或收合股票篩選結果"
        @click="toggleExpand"
      >
        <span class="arrow" :class="{ rotated: isExpanded }">▶</span>
        <span v-if="isExpanded" class="title">查詢結果</span>
        <span v-if="isExpanded" class="count">{{ safeResults.length }}</span>
      </button>

      <!-- 使用 v-show 保留滾動位置；內部容器自行負責大量資料捲動 -->
      <div v-show="isExpanded" class="results-body">
        <div class="results-scroll">
          <button
            v-for="(result, index) in safeResults"
            :key="result.stockCode || index"
            type="button"
            class="result-item"
            @click="selectStock(result.stockCode)"
          >
            <span class="stock-name">{{ result.stockName || '未知股票' }}</span>
            <span class="stock-code">{{ result.stockCode }}</span>
          </button>
          <p v-if="safeResults.length === 0" class="no-results">無查詢結果</p>
        </div>
        <footer class="results-footer">共 {{ safeResults.length }} 筆結果</footer>
      </div>
    </aside>
  </Transition>
</template>

<script>
export default {
  name: 'FilterResults',
  props: {
    results: { type: Array, default: () => [] },
    shouldShow: { type: Boolean, default: false },
  },
  emits: ['select-stock'],
  data() {
    return {
      isExpanded: false, // 控制展開/摺疊
    }
  },
  computed: {
    // 父層查詢初始值可能為 null，避免 results.length 出錯
    safeResults() {
      return Array.isArray(this.results) ? this.results : []
    },
  },
  watch: {
    // 每次重新顯示結果面板時自動展開，讓使用者立刻看到查詢結果
    shouldShow(next, previous) {
      if (next && !previous) this.isExpanded = true
      if (!next) this.isExpanded = false
    },
  },
  methods: {
    toggleExpand() {
      this.isExpanded = !this.isExpanded
    },
    selectStock(stockCode) {
      if (stockCode) this.$emit('select-stock', stockCode)
    },
  },
}
</script>

<style scoped>
/* 結果面板與 Sidebar 平行排列，寬度固定，內容捲動而非推擠圖表 */
.filter-results {
  position: sticky;
  top: var(--bigstock-header-height, 110px);
  align-self: flex-start;
  display: flex;
  flex-direction: column;
  flex: 0 0 250px;
  width: 250px;
  min-width: 0;
  max-height: calc(100dvh - var(--bigstock-header-height, 110px));
  padding: 10px;
  background: #2c2c2c;
  color: white;
  border-left: 1px solid #444;
  border-radius: 10px;
  box-shadow: 6px 0 15px rgba(0, 0, 0, .4);
}
.filter-results.collapsed { width: 48px; flex-basis: 48px; padding: 8px 4px; }
.results-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  width: 100%;
  min-height: 38px;
  padding: 6px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: white;
  cursor: pointer;
  text-align: left;
}
.results-header:hover { background: rgba(255,255,255,.08); }
.results-header:focus-visible { outline: 2px solid #4caf50; outline-offset: 2px; }
.arrow { display: inline-block; transition: transform .25s ease; }
.arrow.rotated { transform: rotate(90deg); }
.title { font-weight: bold; white-space: nowrap; }
.count { margin-left: auto; padding: 2px 6px; border-radius: 10px; background: #245c42; font-size: 12px; }
/* 注意 min-height:0：否則 flex 內容可能撐開面板而不能捲動 */
.results-body { display: flex; flex-direction: column; min-width: 0; min-height: 0; flex: 1 1 auto; overflow: hidden; }
.results-scroll {
  min-height: 0;
  min-width: 0;
  flex: 1 1 auto;
  max-height: min(60dvh, 650px);
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior-y: contain;
  scrollbar-width: thin;
  scrollbar-color: #a0aec0 #383838;
  padding: 4px;
}
.results-scroll::-webkit-scrollbar { width: 8px; }
.results-scroll::-webkit-scrollbar-track { background: #383838; border-radius: 4px; }
.results-scroll::-webkit-scrollbar-thumb { background: #a0aec0; border: 2px solid #383838; border-radius: 4px; }
.result-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  width: 100%;
  min-width: 0;
  margin: 5px 0;
  padding: 10px;
  border: 0;
  border-radius: 5px;
  background: #383838;
  color: white;
  text-align: left;
  cursor: pointer;
  transition: background .2s, transform .1s;
}
.result-item:hover { background: #4caf50; }
.result-item:active { background: #2e7d32; transform: scale(.98); }
.stock-name { width: 100%; overflow-wrap: anywhere; font-size: 13px; }
.stock-code { color: #cbd5e1; font-size: 12px; }
.results-footer { flex-shrink: 0; padding: 9px 4px 3px; border-top: 1px solid #444; color: #aaa; text-align: center; font-size: 11px; }
.no-results { padding: 16px 4px; color: #aaa; text-align: center; font-style: italic; }
.panel-fade-enter-active,.panel-fade-leave-active { transition: opacity .2s ease, transform .2s ease; }
.panel-fade-enter-from,.panel-fade-leave-to { opacity: 0; transform: translateX(-10px); }
/* 窄螢幕：兩個側邊模組改為全寬直向排列，避免擠壓圖表 */
@media (max-width: 900px) {
  .filter-results,.filter-results.collapsed {
    position: relative;
    top: auto;
    align-self: stretch;
    flex: 0 0 auto;
    width: 100%;
    max-height: none;
  }
  .results-scroll { max-height: 45dvh; }
}
@media (prefers-reduced-motion: reduce) {
  .panel-fade-enter-active,.panel-fade-leave-active,.arrow { transition: none; }
}
</style>
