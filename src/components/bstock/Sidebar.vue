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
      <!-- 日條件 -->
      <div class="filter-section">
        <h3 @click="toggleSection('daily')">
          日條件
          <span :class="['toggle-indicator', { rotated: collapsedSections.daily }]">▼</span>
        </h3>
        <transition name="slide">
          <div v-if="!collapsedSections.daily">
            <!-- KD條件 -->
            <div class="sub-group">
              <h4 class="sub-group-title" @click="toggleSubGroup('dailyKD')">KD條件</h4>
              <transition name="slide">
                <div v-if="!collapsedSubGroups.dailyKD">
                  <label>
                    <input type="radio" name="dailyKDFilter" value="20" :checked="filters.daily.kd === '20'" @click="toggleDailyKD('20')" />
                    日KD連續 {{ dailyKDdays || 'N' }} 天處於 20 以下
                  </label>
                  <label>
                    <input type="radio" name="dailyKDFilter" value="80" :checked="filters.daily.kd === '80'" @click="toggleDailyKD('80')" />
                    日KD連續 {{ dailyKDdays || 'N' }} 天處於 80 以上
                  </label>

                  <label>
                    天數：<input type="number" v-model.number="dailyKDdays" min="1" />
                  </label>
                </div>
              </transition>
            </div>

            <!-- 其他條件 -->
            <div class="sub-group">
              <h4 class="sub-group-title"  @click="toggleSubGroup('dailyOther')">其他查詢條件</h4>
              <transition name="slide">
                <div v-if="!collapsedSubGroups.dailyOther">
                  <label>
                    <input type="checkbox" v-model="filters.daily.priceRise" />
                    連續 {{ dailyRiseDays || 'N' }} 天漲幅超過 {{ dailyRisePercentage || 'X' }}%
                  </label>
                  <label>
                    天數：<input type="number" v-model.number="dailyRiseDays" min="1" />
                  </label>
                  <label>
                    百分比：<input type="number" v-model.number="dailyRisePercentage" step="0.1" />
                  </label>
                  <label>
                    <input type="checkbox" v-model="filters.daily.limitUp" /> 今日是否漲停
                  </label>
                </div>
              </transition>
            </div>

            <!-- MA條件 -->
            <div class="sub-group">
              <h4 class="sub-group-title"  @click="toggleSubGroup('dailyMA')">MA趨勢</h4>
              <transition name="slide">
                <div v-if="!collapsedSubGroups.dailyMA">
                  <div v-for="(trend, key) in movingAverageFilters.daily" :key="key">
                    <h5>{{ key }}</h5>
                    <label>
                      <input type="radio" :name="'trend-daily-' + key" value="up" :checked="trend.trend === 'up'" @click="toggleDailyMA(key, 'up')" />
                      趨勢往上
                    </label>
                    <label>
                      <input type="radio" :name="'trend-daily-' + key" value="flat" :checked="trend.trend === 'flat'" @click="toggleDailyMA(key, 'flat')" />
                      趨勢持平
                    </label>
                    <label>
                      <input type="radio" :name="'trend-daily-' + key" value="down" :checked="trend.trend === 'down'" @click="toggleDailyMA(key, 'down')" />
                      趨勢往下
                    </label>
                    <label>
                      天數：<input type="number" v-model.number="trend.days" min="1" />
                    </label>
                  </div>
                </div>
              </transition>
            </div>
          </div>
        </transition>
      </div>

      <!-- 周條件 -->
      <div class="filter-section">
        <h3  @click="toggleSection('weekly')">
          周條件
          <span :class="['toggle-indicator', { rotated: collapsedSections.weekly }]">▼</span>
        </h3>
        <transition name="slide">
          <div v-if="!collapsedSections.weekly">
            <!-- KD條件 -->
            <div class="sub-group">
              <h4 class="sub-group-title"  @click="toggleSubGroup('weeklyKD')">KD條件</h4>
              <transition name="slide">
                <div v-if="!collapsedSubGroups.weeklyKD">
                  <label>
                    <input type="radio" name="weeklyKDFilter" value="20" :checked="filters.weekly.kd === '20'" @click="toggleWeeklyKD('20')" />
                    周KD連續 {{ weeklyKDdays || 'N' }} 周處於 20 以下
                  </label>
                  <label>
                    <input type="radio" name="weeklyKDFilter" value="80" :checked="filters.weekly.kd === '80'" @click="toggleWeeklyKD('80')" />
                    周KD連續 {{ weeklyKDdays || 'N' }} 周處於 80 以上
                  </label>
                  <label>
                    周數：<input type="number" v-model.number="weeklyKDdays" min="1" />
                  </label>
                </div>
              </transition>
            </div>

            <!-- MA條件 -->
            <div class="sub-group">
              <h4 class="sub-group-title"  @click="toggleSubGroup('weeklyMA')">MA趨勢</h4>
              <transition name="slide">
                <div v-if="!collapsedSubGroups.weeklyMA">
                  <div v-for="(trend, key) in movingAverageFilters.weekly" :key="key">
                    <h5>{{ key }}</h5>
                    <label>
                      <input type="radio" :name="'trend-weekly-' + key" value="up" :checked="trend.trend === 'up'" @click="toggleWeeklyMA(key, 'up')" />
                      趨勢往上
                    </label>
                    <label>
                      <input type="radio" :name="'trend-weekly-' + key" value="flat" :checked="trend.trend === 'flat'" @click="toggleWeeklyMA(key, 'flat')" />
                      趨勢持平
                    </label>
                    <label>
                      <input type="radio" :name="'trend-weekly-' + key" value="down" :checked="trend.trend === 'down'" @click="toggleWeeklyMA(key, 'down')" />
                      趨勢往下
                    </label>
                    <label>
                      周數：<input type="number" v-model.number="trend.days" min="1" />
                    </label>
                  </div>
                </div>
              </transition>
            </div>
          </div>
        </transition>
      </div>

      <!-- 月條件 -->
      <div class="filter-section">
        <h3 @click="toggleSection('monthly')">
          月條件
          <span :class="['toggle-indicator', { rotated: collapsedSections.monthly }]">▼</span>
        </h3>
        <transition name="slide">
          <div v-if="!collapsedSections.monthly">
            <!-- KD條件 -->
            <div class="sub-group">
              <h4 class="sub-group-title"  @click="toggleSubGroup('monthlyKD')">KD條件</h4>
              <transition name="slide">
                <div v-if="!collapsedSubGroups.monthlyKD">
                  <label>
                    <input type="radio" name="monthlyKDFilter" value="20" :checked="filters.monthly.kd === '20'" @click="toggleMonthlyKD('20')" />
                    月KD連續 {{ monthlyKDdays || 'N' }} 月處於 20 以下
                  </label>
                  <label>
                    <input type="radio" name="monthlyKDFilter" value="80" :checked="filters.monthly.kd === '80'" @click="toggleMonthlyKD('80')" />
                    月KD連續 {{ monthlyKDdays || 'N' }} 月處於 80 以上
                  </label>

                  <label>
                    月數：<input type="number" v-model.number="monthlyKDdays" min="1" />
                  </label>

                </div>
              </transition>
            </div>

            <!-- MA條件 -->
            <div class="sub-group">
              <h4 class="sub-group-title"  @click="toggleSubGroup('monthlyMA')">MA趨勢</h4>
              <transition name="slide">
                <div v-if="!collapsedSubGroups.monthlyMA">
                  <div v-for="(trend, key) in movingAverageFilters.monthly" :key="key">
                    <h5>{{ key }}</h5>
                    <label>
                      <input type="radio" :name="'trend-monthly-' + key" value="up" :checked="trend.trend === 'up'" @click="toggleMonthlyMA(key, 'up')" />
                      趨勢往上
                    </label>
                    <label>
                      <input type="radio" :name="'trend-monthly-' + key" value="flat" :checked="trend.trend === 'flat'" @click="toggleMonthlyMA(key, 'flat')" />
                      趨勢持平
                    </label>
                    <label>
                      <input type="radio" :name="'trend-monthly-' + key" value="down" :checked="trend.trend === 'down'" @click="toggleMonthlyMA(key, 'down')" />
                      趨勢往下
                    </label>
                    <label>
                      月數：<input type="number" v-model.number="trend.days" min="1" />
                    </label>
                  </div>
                </div>
              </transition>
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
      dailyKDdays: null,
      dailyRiseDays: null,
      dailyRisePercentage: null,
      weeklyKDdays: null,
      monthlyKDdays: null,
      movingAverageFilters: {
        daily: {
          "5日均線": { trend: null, days: null },
          "10日均線": { trend: null, days: null },
          "20日均線": { trend: null, days: null },
          "60日均線": { trend: null, days: null },
        },
        weekly: {
          "5周均線": { trend: null, days: null },
          "10周均線": { trend: null, days: null },
          "20周均線": { trend: null, days: null },
        },
        monthly: {
          "5月均線": { trend: null, days: null },
          "10月均線": { trend: null, days: null },
        },
      },
      filters: {
        daily: {
          kd: null,
          priceRise: false,
          limitUp: false,
        },
        weekly: {
          kd: null,
        },
        monthly: {
          kd: null,
        },
      },
      collapsedSections: {
        daily: true,
        weekly: true,
        monthly: true,
      },
      collapsedSubGroups: {
        dailyKD: true,
        dailyOther: true,
        dailyMA: true,
        weeklyKD: true,
        weeklyMA: true,
        monthlyKD: true,
        monthlyMA: true,
      },
    };
  },
  methods: {
    toggleSidebar() {
      this.isCollapsed = !this.isCollapsed;
    },
    toggleSection(section) {
      this.collapsedSections[section] = !this.collapsedSections[section];
    },
    toggleSubGroup(subGroup) {
      this.collapsedSubGroups[subGroup] = !this.collapsedSubGroups[subGroup];
    },
    toggleDailyKD(type) {
      this.filters.daily.kd = this.filters.daily.kd === type ? null : type;
    },
    toggleWeeklyKD(type) {
      this.filters.weekly.kd = this.filters.weekly.kd === type ? null : type;
    },
    toggleMonthlyKD(type) {
      this.filters.monthly.kd = this.filters.monthly.kd === type ? null : type;
    },
    toggleDailyMA(key, trend) {
      const ma = this.movingAverageFilters.daily[key];
      ma.trend = ma.trend === trend ? null : trend;
    },
    toggleWeeklyMA(key, trend) {
      const ma = this.movingAverageFilters.weekly[key];
      ma.trend = ma.trend === trend ? null : trend;
    },
    toggleMonthlyMA(key, trend) {
      const ma = this.movingAverageFilters.monthly[key];
      ma.trend = ma.trend === trend ? null : trend;
    },
    applyFilters() {
      const allFilters = {
        daily: this.filters.daily,
        weekly: this.filters.weekly,
        monthly: this.filters.monthly,
        movingAverage: this.movingAverageFilters,
      };
      console.log("Applied Filters:", allFilters);
      this.$emit("apply-filters", allFilters);
    },
  },
};
</script>


<style scoped>
/**** 滾軸樣式 ****/
.steps {
  max-height: calc(100vh - 150px); /* 動態高度 */
  overflow-y: auto; /* 超過時啟用滾動 */
}

.steps::-webkit-scrollbar {
  width: 8px; /* 滾軸寬度 */
}
.steps::-webkit-scrollbar-track {
  background: #383838; /* 滾軌背景顏色 */
  border-radius: 4px; /* 滾軌圓角 */
}

.steps::-webkit-scrollbar-thumb {
  background-color: #4caf50; /* 滾軸顏色 */
  border-radius: 4px; /* 滾軸圓角 */
  border: 2px solid #383838; /* 滾軸邊框 */
}

.steps::-webkit-scrollbar-thumb:hover {
  background-color: #66bb6a; /* 滾軸懸停顏色 */
}

/**** 區塊樣式 ****/
.filter-section {
  margin-bottom: 20px; /* 區塊間距 */
  padding: 10px; /* 區塊內部填充 */
  transition: transform 0.3s ease, box-shadow 0.3s ease; /* 過渡效果 */
  background-color: rgba(44, 44, 44, 0.9); /* 背景顏色 */
  border-radius: 8px; /* 圓角 */
}

/* 滑鼠懸停區塊特效 */
.filter-section:hover {
  transform: translateY(-3px); /* 懸浮效果 */
  box-shadow: 0 4px 10px rgba(76, 175, 80, 0.5); /* 綠色陰影效果 */
}

/**** 標題樣式 ****/
.section-title {
  font-family: "Georgia", serif; /* 字體 */
  font-size: 18px; /* 字體大小 */
  margin: 0; /* 無外距 */
  color: #ffffff; /* 字體顏色 */
  display: flex; /* 使用 Flex 布局 */
  justify-content: space-between; /* 左右對齊 */
  align-items: center; /* 垂直居中 */
  cursor: pointer; /* 滑鼠指標為手形 */
  transition: color 0.3s ease, background-color 0.3s ease; /* 過渡效果 */
}

.section-title:hover {
  color: #4caf50; /* 滑鼠懸停時的文字顏色 */
  background-color: rgba(76, 175, 80, 0.1); /* 背景變化 */
  padding: 5px; /* 增加間距 */
  border-radius: 5px; /* 圓角效果 */
}

.toggle-indicator {
  transition: transform 0.3s ease; /* 過渡效果 */
}

.toggle-indicator.rotated {
  transform: rotate(180deg); /* 展開狀態旋轉 180 度 */
}

/* 清楚分隔每個條件的樣式 */
label {
  display: flex; /* 使用 Flex 布局 */
  align-items: center; /* 垂直居中 */
  margin-bottom: 10px; /* 每個條件之間的間距 */
}

label input[type="radio"],
label input[type="checkbox"] {
  margin-right: 8px; /* 與文字的間距 */
}

label input[type="number"] {
  margin-left: 10px; /* 與標籤的間距 */
  margin-top: 5px; /* 增加輸入框上方間距 */
  width: 60px; /* 控制數字框的寬度 */
}


/**** 輸入框樣式 ****/
/* 文藝風格的單選框與勾選框 */
input[type="radio"],
input[type="checkbox"] {
  appearance: none; /* 移除預設樣式 */
  width: 18px; /* 寬度 */
  height: 18px; /* 高度 */
  margin-right: 8px; /* 與文字的間距 */
  border: 2px solid #4caf50; /* 邊框顏色 */
  border-radius: 50%; /* 圓角效果 */
  background-color: transparent; /* 背景透明 */
  transition: all 0.3s ease; /* 過渡效果 */
}

input[type="radio"]:checked,
input[type="checkbox"]:checked {
  background-color: #4caf50; /* 選中時的背景色 */
  border-color: #66bb6a; /* 選中時的邊框色 */
}

input[type="radio"]:hover,
input[type="checkbox"]:hover {
  border-color: #66bb6a; /* 滑鼠懸停時的邊框顏色 */
}

/**** 輸入框數字 ****/
input[type="number"] {
  width: 50px; /* 寬度 */
  padding: 4px 6px; /* 內部填充 */
  font-size: 14px; /* 字體大小 */
  border: 2px solid #4caf50; /* 邊框顏色 */
  border-radius: 5px; /* 圓角 */
  background-color: #2c2c2c; /* 背景色 */
  color: #ffffff; /* 字體顏色 */
  transition: border-color 0.3s ease, box-shadow 0.3s ease; /* 過渡效果 */
}

/* 統一輸入框與按鈕樣式 */
input[type="number"],
input[type="radio"],
input[type="checkbox"] {
  transition: all 0.2s ease-in-out;
}

input[type="number"]:focus {
  outline: none;
  border: 2px solid #66bb6a;
  box-shadow: 0 0 5px #66bb6a;
}

/**** 滑鼠懸停與文字 ****/
label:hover input[type="radio"],
label:hover input[type="checkbox"] {
  border-color: #66bb6a; /* 懸停時邊框顏色 */
}

label:hover {
  color: #66bb6a; /* 懸停時文字顏色 */
}

.input-group label {
  font-family: "Arial", sans-serif; /* 字體 */
  color: #ffffff; /* 字體顏色 */
  margin-right: 5px; /* 間距 */
}

/**** 篩選按鈕 ****/
.filter-button {
  display: block;
  width: 100%;
  padding: 10px 15px;
  background-color: #4caf50; /* 背景色 */
  color: #ffffff; /* 字體顏色 */
  border: none;
  border-radius: 5px; /* 圓角 */
  font-size: 16px; /* 字體大小 */
  font-family: "Arial", sans-serif;
  cursor: pointer; /* 滑鼠指標 */
  transition: background-color 0.3s ease, transform 0.3s ease;
}

.filter-button:hover {
  background-color: #66bb6a; /* 滑鼠懸停時背景色 */
  transform: translateY(-2px); /* 浮起效果 */
}

.filter-button:active {
  transform: translateY(0); /* 點擊時效果 */
  background-color: #4caf50; /* 恢復原背景色 */
}

.sub-group {
  margin-bottom: 20px; /* 子群組之間的間距 */
}

.sub-group > label {
  margin-left: 15px; /* 內部條件的縮排 */
}

.sub-group-title {
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  color: #ffffff;
  padding: 5px 10px;
  border-radius: 5px;
  transition: all 0.3s ease;
}

.sub-group-title:hover,
.sub-group-title:focus {
  background-color: rgba(76, 175, 80, 0.2);
  color: #4caf50;
  outline: none;
  box-shadow: 0 0 10px rgba(76, 175, 80, 0.5);
}

.sub-group-title.rotated {
  transform: rotate(180deg);
}
</style>
