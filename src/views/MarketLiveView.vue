<template>
  <section class="market-page">
    <header class="market-heading">
      <div>
        <div class="eyebrow">BIGSTOCK · MARKET LIVE</div>
        <h1>即時市場</h1>
        <p>六大市場行情追蹤，搭配歷史日 K 與成交量。</p>
      </div>
      <div class="connection" :class="connectionClass">
        <span class="dot"></span>
        {{ connectionText }}
      </div>
    </header>

    <!-- 選擇市場：桌面六格，手機響應式排列 -->
    <div class="market-grid" aria-label="選擇市場">
      <button
        v-for="market in MARKETS"
        :key="market.symbol"
        type="button"
        class="market-tile"
        :class="{ active: selected === market.symbol }"
        :aria-pressed="selected === market.symbol"
        @click="selected = market.symbol"
      >
        <div class="tile-top">
          <span>{{ market.region }}</span
          ><span>{{ market.symbol }}</span>
        </div>
        <h2>{{ market.label }}</h2>
        <div class="tile-price">{{ formatPrice(quote(market.symbol)?.price ?? null) }}</div>
        <div class="tile-change" :class="changeClass(quote(market.symbol)?.change ?? null)">
          {{
            formatChange(
              quote(market.symbol)?.change ?? null,
              quote(market.symbol)?.changePercent ?? null,
            )
          }}
        </div>
        <div class="tile-foot">
          {{ quote(market.symbol) ? 'WebSocket 即時報價' : '等待行情推播' }}
        </div>
      </button>
    </div>

    <div class="detail-panel">
      <div class="detail-title">
        <div>
          <div class="eyebrow">{{ selectedMarket.region }} · {{ selected }}</div>
          <h2>{{ selectedMarket.label }}</h2>
        </div>
        <div class="detail-actions">
          <span v-if="historyLoading" class="hint">載入歷史資料中…</span>
          <button type="button" :disabled="historyLoading" class="refresh" @click="refreshHistory">
            重新載入歷史 K 棒
          </button>
        </div>
      </div>
      <div class="metrics">
        <div class="metric">
          <span>最新即時報價</span><strong>{{ formatPrice(currentLive?.price ?? null) }}</strong>
        </div>
        <div class="metric">
          <span>即時漲跌</span
          ><strong :class="changeClass(currentLive?.change ?? null)">{{
            formatChange(currentLive?.change ?? null, currentLive?.changePercent ?? null)
          }}</strong>
        </div>
        <div class="metric">
          <span>歷史最後收盤</span><strong>{{ formatPrice(lastCandle?.close ?? null) }}</strong>
        </div>
        <div class="metric">
          <span>歷史 K 棒數</span><strong>{{ currentHistory?.candles.length ?? 0 }}</strong>
        </div>
      </div>

      <div v-if="historyError" role="alert" class="error">{{ historyError }}</div>
      <div class="chart-card">
        <MarketCandlestickChart
          :candles="currentHistory?.candles ?? []"
          :timezone="currentHistory?.timezone || defaultTimezone"
        />
      </div>
      <div class="status-bar">
        <span>歷史資料：REST API · 日 K</span>
        <span>即時報價：STOMP WebSocket</span>
        <span v-if="currentLive?.updatedAt">最後推播：{{ formatTime(currentLive.updatedAt) }}</span>
        <span v-else>尚未收到可辨識的即時價格推播</span>
      </div>
    </div>

    <p class="disclaimer">
      歷史日 K 與 WebSocket
      即時數值來自不同更新機制，可能存在時間差。部分市場為期貨商品，不等同現貨指數。
    </p>
  </section>
</template>

<script setup lang="ts">
  import { computed, onMounted, onBeforeUnmount } from 'vue'
  import { storeToRefs } from 'pinia'
  import MarketCandlestickChart from '@/components/market/MarketCandlestickChart.vue'
  import { MARKETS, useMarketStore, type MarketSymbol } from '@/stores/marketStore'

  const store = useMarketStore()
  const {
    selected,
    currentHistory,
    currentLive,
    historyLoading,
    historyError,
    socketStatus,
    live,
  } = storeToRefs(store)
  const selectedMarket = computed(
    () => MARKETS.find((m) => m.symbol === selected.value) ?? MARKETS[0],
  )
  const lastCandle = computed(
    () => currentHistory.value?.candles[currentHistory.value.candles.length - 1] ?? null,
  )
  const defaultTimezone = computed(() =>
    selected.value.startsWith('WTX') ? 'Asia/Taipei' : 'America/New_York',
  )
  const connectionText = computed(
    () =>
      ({
        connected: '即時連線正常',
        connecting: '正在連線',
        disconnected: '即時連線中斷',
        error: '連線異常',
      })[socketStatus.value] ?? socketStatus.value,
  )
  const connectionClass = computed(() =>
    socketStatus.value === 'connected'
      ? 'online'
      : socketStatus.value === 'error'
        ? 'offline'
        : 'waiting',
  )
  function quote(symbol: MarketSymbol) {
    return live.value[symbol] ?? null
  }
  function formatPrice(v: number | null) {
    return v == null
      ? '--'
      : v.toLocaleString('zh-TW', { maximumFractionDigits: 2, minimumFractionDigits: 2 })
  }
  function changeClass(v: number | null) {
    return v == null ? 'neutral' : v > 0 ? 'up' : v < 0 ? 'down' : 'neutral'
  }
  function formatChange(change: number | null, percent: number | null) {
    if (change === null) return '等待最新資料'
    const prefix = change > 0 ? '+' : ''
    return `${prefix}${formatPrice(change)}${percent == null ? '' : ` (${percent > 0 ? '+' : ''}${percent.toFixed(2)}%)`}`
  }
  function formatTime(t: number) {
    return new Date(t).toLocaleString('zh-TW', { hour12: false })
  }
  function refreshHistory() {
    void store.loadHistories(true)
  }
  onMounted(() => {
    store.mountSocket()
    void store.loadHistories()
  })
  onBeforeUnmount(() => {
    void store.unmountSocket()
  })
</script>

<style scoped>
  .market-page {
    min-height: 100%;
    width: 100%;
    min-width: 0;
    padding: 26px clamp(16px, 3vw, 46px) 38px;
    background: #12161b;
    color: #eaf1f6;
  }
  .market-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 18px;
    margin-bottom: 25px;
  }
  .eyebrow {
    color: #5dca95;
    letter-spacing: 0.13em;
    font-size: 11px;
    font-weight: 700;
  }
  h1 {
    font-size: 30px;
    letter-spacing: -0.04em;
    margin: 5px 0;
  }
  h2 {
    margin: 0;
  }
  .market-heading p {
    margin: 4px 0 0;
    color: #9aa6b3;
    font-size: 14px;
  }
  .connection {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    padding: 9px 13px;
    background: #222b33;
    border: 1px solid #35434e;
    border-radius: 30px;
    font-size: 12px;
    color: #adbcc8;
  }
  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #e8b567;
  }
  .online .dot {
    background: #55cd9b;
    box-shadow: 0 0 8px #55cd9b80;
  }
  .offline .dot {
    background: #e56e71;
  }
  .market-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 22px;
  }
  .market-tile {
    text-align: left;
    min-width: 0;
    border: 1px solid #303c46;
    border-radius: 13px;
    background: #1c242b;
    color: inherit;
    padding: 17px 18px;
    cursor: pointer;
    transition:
      transform 0.15s,
      border-color 0.15s,
      background 0.15s;
  }
  .market-tile:hover {
    transform: translateY(-2px);
    border-color: #62768a;
  }
  .market-tile.active {
    background: #22352f;
    border-color: #5dca95;
    box-shadow: inset 0 0 0 1px #5dca9540;
  }
  .tile-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: #91a0ae;
    font-size: 11px;
    gap: 8px;
  }
  .market-tile h2 {
    font-size: 15px;
    font-weight: 650;
    margin: 14px 0 6px;
    overflow-wrap: anywhere;
  }
  .tile-price {
    font-size: 24px;
    font-weight: 750;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.03em;
  }
  .tile-change {
    font-size: 13px;
    margin: 4px 0 11px;
    font-variant-numeric: tabular-nums;
  }
  .up {
    color: #ee8388;
  }
  .down {
    color: #54cca0;
  }
  .neutral {
    color: #93a3b2;
  }
  .tile-foot {
    color: #7d8f9e;
    font-size: 11px;
  }
  .detail-panel {
    border: 1px solid #303d47;
    border-radius: 15px;
    background: #192129;
    padding: 22px;
    min-width: 0;
  }
  .detail-title {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 14px;
    margin-bottom: 19px;
  }
  .detail-title h2 {
    margin: 5px 0 0;
    font-size: 23px;
  }
  .detail-actions {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  .hint {
    color: #a9b9c6;
    font-size: 12px;
  }
  .refresh {
    border: 1px solid #4e6d63;
    background: #264036;
    padding: 9px 13px;
    color: #a8f0c9;
    border-radius: 8px;
    cursor: pointer;
  }
  .refresh:disabled {
    opacity: 0.5;
    cursor: wait;
  }
  .metrics {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
    margin-bottom: 18px;
  }
  .metric {
    border: 1px solid #303c46;
    background: #161d24;
    border-radius: 10px;
    padding: 14px 15px;
    min-width: 0;
  }
  .metric span {
    display: block;
    color: #99a8b5;
    font-size: 12px;
    margin-bottom: 8px;
  }
  .metric strong {
    display: block;
    font-size: 19px;
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }
  .chart-card {
    min-width: 0;
    background: #151d24;
    padding: 16px;
    border: 1px solid #293540;
    border-radius: 10px;
  }
  .status-bar {
    display: flex;
    gap: 12px 24px;
    flex-wrap: wrap;
    margin-top: 17px;
    font-size: 11px;
    color: #95a7b5;
  }
  .disclaimer {
    color: #8496a4;
    font-size: 12px;
    line-height: 1.7;
    margin-top: 18px;
  }
  .error {
    padding: 12px 14px;
    border: 1px solid #854445;
    background: #472528;
    color: #ffd6d6;
    border-radius: 8px;
    margin-bottom: 14px;
  }
  @media (max-width: 1050px) {
    .market-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .metrics {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @media (max-width: 600px) {
    .market-grid {
      grid-template-columns: 1fr;
    }
    .metrics {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .market-page {
      padding: 18px 12px 30px;
    }
    .detail-panel {
      padding: 12px;
    }
    .chart-card {
      padding: 6px;
    }
    .metric {
      padding: 10px;
    }
    .metric strong {
      font-size: 16px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .market-tile {
      transition: none;
    }
  }
</style>
