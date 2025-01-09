<template>
  <div :class="['sidebar', { collapsed: isCollapsed }]">
    <button class="toggle-btn" @click="toggleSidebar">
      <svg
        :class="['arrow', { rotated: isCollapsed }]"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="white"
      >
        <path
          d="M9.29 16.29a1 1 0 001.42 0l4-4a1 1 0 000-1.42l-4-4a1 1 0 00-1.42 1.42L12.59 12l-3.3 3.29a1 1 0 000 1.42z"
        />
      </svg>
    </button>
    <div v-if="!isCollapsed" class="steps">
      <!-- 日KD過濾條件 -->
      <div class="filter-section">
        <h3 @click="toggleSection('kd')">
          日KD條件
          <span :class="['toggle-indicator', { rotated: collapsedSections.kd }]">
            ▼
          </span>
        </h3>
        <transition name="slide">
          <div v-if="!collapsedSections.kd">
            <label>
              <input
                type="radio"
                name="kdFilter"
                value="20"
                :checked="filters.kd === '20'"
                @click="toggleKD('20')"
              />
              日KD連續 {{ kdDays || 'N' }} 天處於 20 以下
            </label>
            <label>
              <input
                type="radio"
                name="kdFilter"
                value="80"
                :checked="filters.kd === '80'"
                @click="toggleKD('80')"
              />
              日KD連續 {{ kdDays || 'N' }} 天處於 80 以上
            </label>
            <label>
              天數：
              <input type="number" v-model.number="kdDays" min="1" />
            </label>
          </div>
        </transition>
      </div>

      <!-- 其他過濾條件 -->
      <div class="filter-section">
        <h3 @click="toggleSection('others')">
          其他條件
          <span :class="['toggle-indicator', { rotated: collapsedSections.others }]">
            ▼
          </span>
        </h3>
        <transition name="slide">
          <div v-if="!collapsedSections.others">
            <label>
              <input type="checkbox" v-model="filters.priceRise" />
              連續 {{ riseDays || 'N' }} 天，涨幅超過 {{ risePercentage || 'X' }}%
            </label>
            <label>
              天數：
              <input type="number" v-model.number="riseDays" min="1" />
            </label>
            <label>
              百分比：
              <input type="number" v-model.number="risePercentage" step="0.1" />
            </label>

            <label>
              <input type="checkbox" v-model="filters.limitUp" />
              今日是否漲停
            </label>
          </div>
        </transition>
      </div>

      <!-- 均線趨勢條件 -->
      <div class="filter-section">
        <h3 @click="toggleSection('movingAverage')">
          均線趨勢
          <span
            :class="['toggle-indicator', { rotated: collapsedSections.movingAverage }]"
          >
            ▼
          </span>
        </h3>
        <transition name="slide">
          <div v-if="!collapsedSections.movingAverage">
            <div v-for="(trend, key) in movingAverageFilters" :key="key">
              <h4>{{ key }}</h4>
              <label>
                <input
                  type="radio"
                  :name="'trend-' + key"
                  value="up"
                  :checked="trend.trend === 'up'"
                  @click="toggleMovingAverage(key, 'up')"
                />
                趨勢往上
              </label>
              <label>
                <input
                  type="radio"
                  :name="'trend-' + key"
                  value="flat"
                  :checked="trend.trend === 'flat'"
                  @click="toggleMovingAverage(key, 'flat')"
                />
                趨勢持平
              </label>
              <label>
                <input
                  type="radio"
                  :name="'trend-' + key"
                  value="down"
                  :checked="trend.trend === 'down'"
                  @click="toggleMovingAverage(key, 'down')"
                />
                趨勢往下
              </label>
              <label>
                天數：
                <input
                  type="number"
                  v-model.number="movingAverageFilters[key].days"
                  min="1"
                />
              </label>
            </div>
          </div>
        </transition>
      </div>

      <!-- 執行篩選 -->
      <button @click="applyFilters">執行篩選</button>
    </div>
  </div>
</template>

<script>
export default {
  name: "Sidebar",
  data() {
    return {
      isCollapsed: false,
      kdDays: null,
      riseDays: null,
      risePercentage: null,
      movingAverageFilters: {
        "5日均線": { trend: null, days: null },
        "10日均線": { trend: null, days: null },
        "20日均線": { trend: null, days: null },
        "60日均線": { trend: null, days: null },
        "120日均線": { trend: null, days: null },
        "240日均線": { trend: null, days: null },
      },
      filters: {
        kd: null,
        priceRise: false,
        limitUp: false,
      },
      collapsedSections: {
        kd: true, // 初始为收起
        others: true, // 初始为收起
        movingAverage: true, // 初始为收起
      },
    };
  },
  methods: {
    toggleSidebar() {
      this.isCollapsed = !this.isCollapsed;
    },
    toggleKD(type) {
      if (this.filters.kd === type) {
        this.filters.kd = null;
      } else {
        this.filters.kd = type;
      }
    },
    toggleMovingAverage(key, trend) {
      if (this.movingAverageFilters[key].trend === trend) {
        this.movingAverageFilters[key].trend = null;
      } else {
        this.movingAverageFilters[key].trend = trend;
      }
    },
    toggleSection(section) {
      this.collapsedSections[section] = !this.collapsedSections[section];
    },
    applyFilters() {
      const allFilters = {
        kd: this.filters.kd,
        kdDays: this.kdDays,
        priceRise: this.filters.priceRise,
        riseDays: this.riseDays,
        risePercentage: this.risePercentage,
        limitUp: this.filters.limitUp,
        movingAverage: this.movingAverageFilters,
      };
      console.log("Applied Filters:", allFilters);
      this.$emit("apply-filters", allFilters);
    },
  },
};
</script>

<style scoped>
/* Sidebar styles */
.filter-section h3 {
  margin-bottom: 10px;
  color: #ffffff;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.filter-section h3:hover {
  color: #4caf50;
}
.toggle-indicator {
  transition: transform 0.3s;
}
.toggle-indicator.rotated {
  transform: rotate(180deg);
}
/* Slide animation */
.slide-enter-active,
.slide-leave-active {
  transition: max-height 0.3s ease, opacity 0.3s ease;
}
.slide-enter-from,
.slide-leave-to {
  max-height: 0;
  opacity: 0;
}
.slide-enter-to,
.slide-leave-from {
  max-height: 1000px; /* 足够大的值适应内容 */
  opacity: 1;
}
</style>
