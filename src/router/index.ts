import { createRouter, createWebHistory } from 'vue-router'

// 個股查詢頁，沿用原本的 K 線頁面與 URL
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
     * 個股查詢：技術分析、基本資訊、EPS、月營收、持股分布、相關產業
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
      redirect: to => ({ name: 'candlestick', query: { stockCode: String(to.params.stockCode ?? '') } }),
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
      meta: {
        title: '即時市場',
      },
    },

    /**
     * 及時快訊
     */
    {
      path: '/news',
      name: 'news',
      component: () => import('@/views/NewsView.vue'),
    },
    /**
     * 漲跌幅排行
     */
    {
      path: '/ranking',
      name: 'stock-ranking',
      component: () => import('@/views/StockRankingView.vue'),
    },
  ],
})

export default router
