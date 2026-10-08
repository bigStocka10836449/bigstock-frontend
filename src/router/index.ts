import {
  createRouter,
  createWebHistory,
} from 'vue-router'

// 原本已完成的 K 線圖頁面
import Candlestick from '@/views/BstockCandlestick.vue'

const router = createRouter({

  history: createWebHistory(import.meta.env.BASE_URL),

  routes: [

    /**
    * BigStock 首頁
    */
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
    },

    /**
     * K 線圖與股票篩選
     *
     * 保留原本已完成的功能。
     */
    {
      path: '/candlestick',
      name: 'candlestick',
      component: Candlestick,
    },

    /**
     * 個股基本資訊
     *
     * 範例：
     * /stock/2330
     */
    {
      path: '/stock/:stockCode',
      name: 'stock-detail',
      component: () => import('@/views/StockBasicInfoView.vue'),
      props: true,
    },

    /**
     * 產業分類清單
     */
    {
      path: '/industries',
      name: 'industries',
      component: () => import('@/views/IndustryView.vue'),
    },

    /**
     * 指定產業底下的股票
     *
     * 範例：
     * /industries/半導體業
     */
    {
      path: '/industries/:tag',
      name: 'industry-detail',
      component: () => import('@/views/IndustryDetailView.vue'),
      props: true,
    },

    /**
     * 財經行事曆
     */
    {
      path: '/calendar',
      name: 'calendar',
      component: () => import('@/views/CalendarView.vue'),
    },

    /**
     * 即時市場資訊
     *
     * WebSocket / STOMP
     */
    {
      path: '/market-live',
      name: 'market-live',
      component: () => import('@/views/MarketLiveView.vue'),
    },

    /**
     * 及時快訊
     */
    {
      path: '/news',
      name: 'news',
      component: () => import('@/views/NewsView.vue'),
    },
  ],

})

export default router
