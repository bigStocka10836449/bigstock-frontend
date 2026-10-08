
<template>
  <!--
    ============================================================
    財經行事曆頁面
    ============================================================

    使用自然高度，不強制固定 100vh。

    當事件數量超過瀏覽器高度時，
    由整個網頁負責垂直捲動。

    避免事件列表被裁切。
  -->
  <section class="calendar-view">
    <!-- 頁面標題 -->
    <h1>財經行事曆</h1>

    <!--
      ========================================================
      篩選工具列
      ========================================================

      桌面版水平排列。
      手機版空間不足時自動換行。
    -->
    <div class="calendar-toolbar">
      <label class="filter-field">
        <span>月份</span>

        <input
          v-model="month"
          type="month"
          aria-label="選擇財經行事曆月份"
        />
      </label>

      <label class="filter-field">
        <span>分類</span>

        <select
          v-model="category"
          aria-label="選擇財經事件分類"
        >
          <option value="">全部</option>

          <option
            v-for="name in categories"
            :key="name"
            :value="name"
          >
            {{ name }}
          </option>
        </select>
      </label>
    </div>

    <!--
      ========================================================
      資料狀態
      ========================================================

      載入、錯誤、空資料各自顯示。
    -->
    <p v-if="loading" class="status-message">
      載入中…
    </p>

    <p
      v-else-if="error"
      class="status-message error-message"
      role="alert"
    >
      {{ error }}
    </p>

    <p
      v-else-if="visible.length === 0"
      class="status-message"
    >
      這個月份沒有符合條件的事件。
    </p>

    <!--
      ========================================================
      財經事件列表
      ========================================================

      不設定固定高度或 max-height。

      事件越多，列表自然向下延伸，
      再由瀏覽器進行整頁捲動。
    -->
    <div
      v-if="!loading && !error && visible.length > 0"
      class="calendar-events"
    >
      <div class="results-summary">
        共 {{ visible.length }} 筆財經事件
      </div>

      <ul class="event-list">
        <li
          v-for="event in visible"
          :key="event.id"
          class="event-item"
        >
          <!-- 日期 -->
          <time class="event-date">
            {{ toDateKey(event.eventDate) }}
          </time>

          <!-- 事件標題 -->
          <strong class="event-title">
            {{ event.title }}
          </strong>

          <!-- 事件分類 -->
          <small class="event-category">
            {{ event.dataTypeName || event.dataType || '未分類' }}
          </small>

          <!--
            安全的外部連結。

            只允許 HTTP / HTTPS URL，
            避免不安全的 JavaScript URL。
          -->
          <a
            v-if="safeLink(event.hyperLink)"
            class="event-link"
            :href="safeLink(event.hyperLink)!"
            target="_blank"
            rel="noopener noreferrer"
          >
            相關連結
          </a>
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import { getFinancialCalendar } from '@/api/calendarApi'
import type { FinancialCalendar } from '@/types/calendar'

/*
 * ============================================================
 * 財經事件資料
 * ============================================================
 */
const items = ref<FinancialCalendar[]>([])

const loading = ref(false)
const error = ref('')

/*
 * ============================================================
 * 日期篩選
 * ============================================================
 *
 * 日期使用本地年/月，避免 UTC ISO 日期造成月份偏移。
 *
 * 保留你原本的日期計算方式。
 */
const today = new Date()

const month = ref(
  `${today.getFullYear()}-${String(
    today.getMonth() + 1
  ).padStart(2, '0')}`
)

/*
 * 事件分類。
 *
 * 空字串代表全部。
 */
const category = ref('')

/*
 * ============================================================
 * 日期轉換
 * ============================================================
 *
 * 支援：
 * 1. Unix 毫秒時間戳記
 * 2. YYYY-MM-DD 字串
 * 3. 可由 JavaScript Date 解析的日期字串
 *
 * 使用本地日期，避免 UTC 格式直接轉換
 * 導致日期或月份偏移。
 */
function toDateKey(
  raw: string | number | null
): string {
  if (raw == null) {
    return ''
  }

  if (
    typeof raw === 'string' &&
    /^\d{4}-\d{2}-\d{2}/.test(raw)
  ) {
    return raw.slice(0, 10)
  }

  const date = new Date(raw)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return (
    `${date.getFullYear()}-` +
    `${String(date.getMonth() + 1).padStart(2, '0')}-` +
    `${String(date.getDate()).padStart(2, '0')}`
  )
}

/*
 * ============================================================
 * 外部連結安全檢查
 * ============================================================
 *
 * 只接受 HTTP 與 HTTPS URL。
 *
 * 防止不安全的 URL 協定直接出現在 href。
 */
function safeLink(value: string | null): string | null {
  if (!value) {
    return null
  }

  try {
    const url = new URL(value)

    return ['https:', 'http:'].includes(url.protocol)
      ? url.href
      : null
  } catch {
    return null
  }
}

/*
 * ============================================================
 * 事件分類清單
 * ============================================================
 *
 * 從 API 回傳資料取得所有不同分類。
 *
 * 使用 Set 去除重複分類，
 * 再依文字排序。
 */
const categories = computed(() =>
  [
    ...new Set(
      items.value
        .map((item) => item.dataTypeName)
        .filter(
          (name): name is string => !!name
        )
    ),
  ].sort()
)

/*
 * ============================================================
 * 財經事件篩選與排序
 * ============================================================
 *
 * 第一層：篩選目前月份。
 * 第二層：篩選目前分類。
 * 第三層：依事件日期由早到晚排序。
 *
 * 保留你原本的資料處理流程。
 */
const visible = computed(() =>
  items.value
    .filter((item) =>
      toDateKey(item.eventDate).startsWith(month.value)
    )
    .filter(
      (item) =>
        !category.value ||
        item.dataTypeName === category.value
    )
    .sort((a, b) =>
      toDateKey(a.eventDate).localeCompare(
        toDateKey(b.eventDate)
      )
    )
)

/*
 * ============================================================
 * 初始化財經行事曆
 * ============================================================
 *
 * 頁面掛載後取得財經事件。
 *
 * 沿用既有 calendarApi.ts，
 * 不修改後端 API。
 */
onMounted(async () => {
  loading.value = true
  error.value = ''

  try {
    items.value = await getFinancialCalendar()
  } catch (e) {
    console.error('財經行事曆載入失敗:', e)

    error.value = '財經行事曆載入失敗'
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
/*
 * ============================================================
 * 財經行事曆根容器
 * ============================================================
 *
 * 不再使用 min-height: 100vh。
 *
 * App.vue 已經負責整個畫面的高度，
 * CalendarView 不需要重複佔滿一個視窗。
 *
 * height: auto：
 * 內容越多，高度自然增加。
 *
 * overflow: visible：
 * 不裁切超出高度的事件。
 */
.calendar-view {
  box-sizing: border-box;

  width: 100%;
  min-width: 0;
  min-height: 0;

  height: auto;

  padding: 24px;

  color: #eee;
  background: #151515;

  overflow: visible;
}

/*
 * ============================================================
 * 頁面標題
 * ============================================================
 */
.calendar-view h1 {
  margin: 0 0 16px;

  font-size: 22px;
  font-weight: 600;
}

/*
 * ============================================================
 * 篩選工具列
 * ============================================================
 *
 * flex-wrap: wrap：
 * 當視窗變窄時，自動換行。
 */
.calendar-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;

  gap: 12px 24px;

  width: 100%;
  min-width: 0;

  margin-bottom: 18px;
}

/*
 * 月份與分類欄位。
 */
.filter-field {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;

  gap: 10px;

  min-width: 0;

  font-size: 14px;
}

.filter-field span {
  white-space: nowrap;
}

/*
 * ============================================================
 * 輸入框與選單
 * ============================================================
 */
input,
select {
  box-sizing: border-box;

  min-width: 0;
  max-width: 100%;

  margin: 0;
  padding: 9px 12px;

  border: 1px solid #444;
  border-radius: 6px;

  background-color: #242424;
  color: #f1f1f1;

  font-size: 14px;
}

input:focus-visible,
select:focus-visible {
  outline: 2px solid #4caf50;
  outline-offset: 2px;
}

/*
 * ============================================================
 * 載入、錯誤與空資料狀態
 * ============================================================
 */
.status-message {
  margin: 24px 0;

  color: #aaa;
  font-size: 14px;
}

.error-message {
  color: #ff8585;
}

/*
 * ============================================================
 * 事件列表外層
 * ============================================================
 *
 * 不設定 max-height 或固定高度。
 *
 * 讓所有事件正常向下排列。
 */
.calendar-events {
  width: 100%;
  min-width: 0;

  height: auto;
  max-height: none;

  overflow: visible;
}

/*
 * 查詢結果筆數。
 */
.results-summary {
  padding: 6px 2px 12px;

  font-size: 13px;
  color: #999;
}

/*
 * ============================================================
 * 事件 UL
 * ============================================================
 *
 * 保留列表結構，
 * 移除瀏覽器預設項目符號。
 */
.event-list {
  display: flex;
  flex-direction: column;

  width: 100%;
  min-width: 0;

  margin: 0;
  padding: 0;

  list-style: none;
}

/*
 * ============================================================
 * 每筆財經事件
 * ============================================================
 *
 * 允許內容換行，
 * 避免事件標題過長造成水平溢出。
 */
.event-item {
  display: flex;
  align-items: center;
  flex-wrap: wrap;

  gap: 8px 16px;

  width: 100%;
  min-width: 0;

  padding: 14px 4px;

  border-bottom: 1px solid #444;
}

/*
 * 事件日期。
 *
 * 保留固定格式，避免日期被換行。
 */
.event-date {
  flex-shrink: 0;

  color: #aaa;
  font-size: 14px;

  white-space: nowrap;
}

/*
 * 事件標題。
 *
 * min-width: 0：
 * 允許 Flex 子元素縮小。
 *
 * overflow-wrap：
 * 當文字過長時允許換行。
 */
.event-title {
  min-width: 0;

  overflow-wrap: anywhere;

  font-size: 14px;
  font-weight: 500;
  line-height: 1.6;
}

/*
 * 事件分類。
 */
.event-category {
  color: #aaa;
  font-size: 12px;

  white-space: nowrap;
}

/*
 * 相關連結。
 */
.event-link {
  color: #86c5ff;

  font-size: 13px;
  text-decoration: none;

  white-space: nowrap;
}

.event-link:hover {
  text-decoration: underline;
}

/*
 * ============================================================
 * 平板與手機版
 * ============================================================
 *
 * 小螢幕適當減少 Padding，
 * 並讓較長的事件標題自然換行。
 */
@media (max-width: 768px) {
  .calendar-view {
    padding: 16px;
  }

  .calendar-view h1 {
    font-size: 20px;
  }

  .calendar-toolbar {
    align-items: flex-start;
    gap: 12px;
  }

  .filter-field {
    width: 100%;
    justify-content: space-between;
  }

  .event-item {
    align-items: flex-start;
    gap: 6px 10px;
  }

  .event-title {
    flex: 1 1 100%;
    order: 2;
  }

  .event-category {
    order: 3;
  }

  .event-link {
    order: 4;
  }
}

/*
 * ============================================================
 * 極小螢幕
 * ============================================================
 */
@media (max-width: 400px) {
  .filter-field {
    align-items: stretch;
  }

  input,
  select {
    max-width: 75%;
  }
}
</style>
