<template>
  <transition name="slide">
    <div v-if="shouldShow" class="filter-results">
      <div class="header" @click="toggleExpand">
        <span class="arrow" :class="{ rotated: isExpanded }">▶</span>
        <span class="title" v-if="isExpanded">查詢結果</span>
      </div>
      <transition name="slide">
        <div v-if="isExpanded" class="content">
          <div
            v-for="(result, index) in results"
            :key="index"
            class="result-item"
            @mousedown="addPressedEffect($event)"
            @mouseup="removePressedEffect($event)"
            @mouseleave="removePressedEffect($event)"
            @click="selectStock(result.stockCode)"
          >
            {{ result.stockName }} - {{ result.stockCode }}
          </div>
          <p v-if="results.length === 0" class="no-results">無查詢結果</p>
        </div>
      </transition>
    </div>
  </transition>
</template>

<script>
export default {
  name: 'FilterResults',
  props: {
    results: {
      type: Array,
      default: () => [],
    },
    shouldShow: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      isExpanded: false, // 控制展開/摺疊
    }
  },
  methods: {
    toggleExpand() {
      this.isExpanded = !this.isExpanded
    },
    selectStock(stockCode) {
      // 向父組件發送事件，並傳遞選中的 stockCode
      this.$emit('select-stock', stockCode)
    },
    addPressedEffect(event) {
      event.target.classList.add('pressed')
    },
    removePressedEffect(event) {
      event.target.classList.remove('pressed')
    },
  },
}
</script>
select-stock

<style scoped>
.filter-results {
  background-color: #2c2c2c;
  color: #fff;
  padding: 10px;
  border-left: 1px solid #444;
  border-radius: 10px; /* 邊角圓弧 */
  box-shadow: 6px 0 15px rgba(0, 0, 0, 0.4); /* 右側陰影 */
  overflow: hidden; /* 確保內容被裁切 */
}
.header {
  display: flex;
  align-items: center;
  cursor: pointer;
}
.arrow {
  margin-right: 10px;
  transition: transform 0.3s ease;
}
.arrow.rotated {
  transform: rotate(90deg); /* 展開時旋轉 90 度 */
}
.title {
  font-weight: bold;
  font-size: 16px;
}
.content {
  padding-left: 20px; /* 內縮內容 */
  margin-top: 10px;
  max-height: calc(100vh - 150px); /* 視窗高度減去 150px */
  overflow-y: auto; /* 超過高度時顯示滾軸 */
}
/* 滾軸樣式（Chrome 和 WebKit 瀏覽器專用） */
.content::-webkit-scrollbar {
  width: 8px; /* 滾軸寬度 */
}
.content::-webkit-scrollbar-track {
  background: #383838; /* 滾軌背景顏色 */
  border-radius: 4px; /* 滾軌圓角 */
}

.content::-webkit-scrollbar-thumb {
  background-color: #a0aec0; /* 滾軸顏色 */
  border-radius: 4px; /* 滾軸圓角 */
  border: 2px solid #383838; /* 滾軸邊框 */
}

.content::-webkit-scrollbar-thumb:hover {
  background-color: #cbd5e0; /* 懸停時滾軸顏色 */
}

.no-results {
  color: #aaa;
  font-style: italic;
  margin-top: 5px;
}
.result-item {
  cursor: pointer;
  padding: 10px;
  margin: 5px 0;
  border-radius: 5px;
  background-color: #383838;
  transition:
    background-color 0.2s,
    transform 0.1s;
  color: #fff;
}
.result-item:hover {
  background-color: #4caf50;
}
.result-item.pressed {
  background-color: #2e7d32;
  transform: scale(0.95);
}

/* Slide animation */
.slide-enter-active,
.slide-leave-active {
  transition:
    max-height 0.3s ease,
    opacity 0.3s ease;
}
.slide-enter-from,
.slide-leave-to {
  max-height: 0;
  opacity: 0;
}
.slide-enter-to,
.slide-leave-from {
  max-height: 500px; /* 足夠大的值來適應內容 */
  opacity: 1;
}
</style>
