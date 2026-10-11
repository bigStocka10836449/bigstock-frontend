<template>
  <section class="market-page">
    <header class="market-heading">
      <div>
        <div class="eyebrow">BIGSTOCK · MARKET LIVE</div>

        <h1>即時市場</h1>

        <p>六大市場歷史日 K 縮圖；點選商品查看上方歷史日 K 與下方即時走勢。</p>
      </div>

      <div class="connection" :class="connectionClass">
        <span class="dot"></span>{{ connectionText }}
      </div>
    </header>

    <!-- 六張卡片保留歷史日 K 縮圖，不受 WebSocket 連線狀態影響。 -->

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
          <span>{{ market.region }}</span>

          <span>{{ market.symbol }}</span>
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

        <MarketSparkline :candles="histories[market.symbol]?.candles ?? []" :history-points="28" />

        <div class="tile-foot">
          {{
            quote(market.symbol) ? '最新即時報價 · 縮圖為歷史日 K' : '縮圖為歷史日 K · 等待即時報價'
          }}
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

      <!-- 上方：REST API 完整歷史日 K 棒，永遠顯示，不依 WebSocket 狀態變更。 -->

      <section class="detail-section history-detail" aria-label="歷史日 K 棒">
        <div class="section-heading">
          <div>
            <div class="section-eyebrow">HISTORY · REST API</div>

            <h3>歷史日 K 棒與成交量</h3>
          </div>

          <span class="history-count">{{ currentHistory?.candles.length ?? 0 }} 根</span>
        </div>

        <div class="history-metrics">
          <span>歷史最後收盤</span>

          <strong>{{ formatPrice(lastCandle?.close ?? null) }}</strong>
        </div>

        <div v-if="historyError" role="alert" class="error">{{ historyError }}</div>

        <div class="chart-card">
          <MarketCandlestickChart
            :candles="currentHistory?.candles ?? []"
            :timezone="currentHistory?.timezone || defaultTimezone"
          />
        </div>
      </section>

      <!-- 下方：只取 WebSocket 真正提供的資料繪圖，不用時間表猜開休市。 -->

      <section class="detail-section live-detail" aria-label="WebSocket 即時行情">
        <div class="section-heading">
          <div>
            <div class="section-eyebrow">REAL-TIME · STOMP</div>

            <h3>WebSocket 即時行情</h3>
          </div>

          <span class="session-indicator" :class="hasLiveData ? 'is-open' : 'is-closed'">
            {{ hasLiveData ? '已收到行情' : '等待行情' }}
          </span>
        </div>

        <div class="live-metrics">
          <div class="live-metric">
            <span>最新報價</span>

            <strong>{{ formatPrice(currentLive?.price ?? null) }}</strong>
          </div>

          <div class="live-metric">
            <span>漲跌／漲跌幅</span>

            <strong :class="changeClass(currentLive?.change ?? null)">
              {{ formatChange(currentLive?.change ?? null, currentLive?.changePercent ?? null) }}
            </strong>
          </div>

          <div class="live-metric">
            <span>累積有效變價點</span>

            <strong>{{ currentLiveSeries.length }}</strong>
          </div>
        </div>

        <!-- 元件本身會處理沒有點位時的等待畫面。 -->

        <MarketRealtimeChart :points="currentLiveSeries" />

        <p v-if="socketStatus !== 'connected'" class="live-note">
          WebSocket {{ connectionText }}；已收到的圖表資料暫時保留。
        </p>

        <p v-else-if="!hasLiveData" class="live-note">連線正常，目前還沒有可辨識的有效即時價格。</p>

        <p v-else class="live-note">
          最近收到有效報價：{{ currentLiveReceivedAt ? formatTime(currentLiveReceivedAt) : '--' }}

          <template v-if="currentLive?.updatedAt">
            · 行情標記時間：{{ formatTime(currentLive.updatedAt) }}
          </template>
        </p>
      </section>

      <div class="status-bar">
        <span>六張市場卡片：最新即時報價</span>

        <span>上方：完整歷史日 K / 成交量</span>

        <span>下方：WebSocket 有效價格變動走勢</span>

        <span>未收到資料 ≠ 確認休市</span>
      </div>
    </div>

    <p class="disclaimer">
      歷史日 K 與 WebSocket 即時數值來自不同更新機制，可能存在時間差。
      下方即時圖只記錄目前前端連線期間收到的有效價格變動；相同價格的重複推播不會額外畫點。
      沒有推播可能是休市、網路中斷或行情來源暫停，不能直接判定尚未開盤。
      部分市場為期貨商品，不等同現貨指數。
    </p>
  </section>
</template>

<script setup lang="ts">
  import { computed, onMounted } from 'vue'

  import { storeToRefs } from 'pinia'

  import MarketCandlestickChart from '@/components/market/MarketCandlestickChart.vue'

  import MarketSparkline from '@/components/market/MarketSparkline.vue'

  import MarketRealtimeChart from '@/components/market/MarketRealtimeChart.vue'

  import { MARKETS, useMarketStore, type MarketSymbol } from '@/stores/marketStore'

  const store = useMarketStore()

  const {
    selected,

    currentHistory,

    currentLive,

    currentLiveSeries,

    currentLiveReceivedAt,

    historyLoading,

    historyError,

    socketStatus,

    live,

    histories,
  } = storeToRefs(store)

  const selectedMarket = computed(
    () => MARKETS.find((m) => m.symbol === selected.value) ?? MARKETS[0]!,
  )

  const lastCandle = computed(() => {
    const candles = currentHistory.value?.candles

    return candles?.[candles.length - 1] ?? null
  })

  const hasLiveData = computed(() => currentLiveSeries.value.length > 0)

  const defaultTimezone = computed(() =>
    selected.value.startsWith('WTX') ? 'Asia/Taipei' : 'America/New_York',
  )

  /** SharedWorker 支援 replaced（被其他裝置／瀏覽器的 Session 取代）。 */
  const connectionText = computed<string>(() => {
    const labels: Record<string, string> = {
      connected: '即時連線正常',
      connecting: '正在連線',
      disconnected: '即時連線中斷',
      error: '連線異常',
      replaced: '連線已由其他分頁或裝置取代',
    }
    return labels[socketStatus.value] ?? '未知連線狀態'
  })

  const connectionClass = computed<string>(() => {
    switch (socketStatus.value) {
      case 'connected':
        return 'online'
      case 'connecting':
        return 'waiting'
      case 'disconnected':
      case 'error':
      case 'replaced':
      default:
        return 'offline'
    }
  })

  function quote(symbol: MarketSymbol) {
    return live.value[symbol] ?? null
  }

  function formatPrice(value: number | null): string {
    return value === null
      ? '--'
      : value.toLocaleString('zh-TW', { maximumFractionDigits: 2, minimumFractionDigits: 2 })
  }

  function changeClass(value: number | null): string {
    return value === null ? 'neutral' : value > 0 ? 'up' : value < 0 ? 'down' : 'neutral'
  }

  function formatChange(change: number | null, percent: number | null): string {
    if (change === null) return '等待最新資料'

    return `${change > 0 ? '+' : ''}${formatPrice(change)}${percent === null ? '' : ` (${percent > 0 ? '+' : ''}${percent.toFixed(2)}%)`}`
  }

  function formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleString('zh-TW', { hour12: false })
  }

  function refreshHistory(): void {
    void store.loadHistories(true)
  }

  /** Socket 生命週期交由 App.vue 管理，此頁只取得歷史 K 棒。 */
  onMounted(() => {
    void store.loadHistories()
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
    display: flex;

    flex-direction: column;

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

    margin: 4px 0 0;

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

    margin-top: 8px;
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

  /* 選取市場後的兩個獨立圖表畫面 */

  .detail-charts {
    display: flex;

    flex-direction: column;

    gap: 14px;
  }

  .detail-section {
    display: flex;

    flex-direction: column;

    min-width: 0;

    border: 1px solid #303c46;

    border-radius: 12px;

    background: #151d24;

    padding: 16px;
  }

  .section-heading {
    display: flex;

    justify-content: space-between;

    align-items: center;

    gap: 10px;

    flex-wrap: wrap;

    margin-bottom: 16px;
  }

  .section-heading h3 {
    margin: 4px 0 0;

    font-size: 19px;
  }

  .section-eyebrow {
    color: #8fa8bc;

    font-size: 10px;

    letter-spacing: 0.12em;

    font-weight: 650;
  }

  .session-indicator,
  .history-count {
    font-size: 11px;

    border-radius: 999px;

    padding: 6px 10px;

    border: 1px solid #394956;

    color: #a7bac9;
  }

  .session-indicator.is-open {
    border-color: #37644f;

    color: #7de0ae;
  }

  .session-indicator.is-closed {
    border-color: #646050;

    color: #e5bf7f;
  }

  .market-closed {
    flex: 1;

    min-height: 220px;

    display: flex;

    flex-direction: column;

    justify-content: center;

    align-items: center;

    gap: 12px;

    text-align: center;

    padding: 20px;

    border-radius: 10px;

    border: 1px dashed #43505a;

    background: #19222a;
  }

  .market-closed strong {
    font-size: 24px;
  }

  .market-closed p {
    color: #99aab9;

    font-size: 13px;

    line-height: 1.7;

    max-width: 330px;

    margin: 0;
  }

  .closed-icon {
    font-size: 34px;

    color: #e3b66b;
  }

  .live-metrics {
    display: flex;

    gap: 14px;

    flex-wrap: wrap;

    margin-bottom: 14px;
  }

  .live-metric {
    display: flex;

    flex: 1 1 150px;

    flex-direction: column;

    gap: 6px;
  }

  .live-metric span,
  .history-metrics span {
    color: #92a7b7;

    font-size: 12px;
  }

  .live-metric strong {
    font-size: 23px;

    font-variant-numeric: tabular-nums;

    overflow-wrap: anywhere;
  }

  .live-note {
    color: #8fa2b3;

    font-size: 11px;

    margin: 9px 0 0;
  }

  .history-metrics {
    display: flex;

    align-items: center;

    gap: 12px;

    margin-bottom: 12px;
  }

  .history-metrics strong {
    font-size: 17px;

    font-variant-numeric: tabular-nums;
  }

  .history-detail .chart-card {
    flex: 1;

    padding: 8px;
  }

  @media (max-width: 1150px) {
    .detail-charts {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 600px) {
    .detail-section {
      padding: 12px;
    }

    .market-closed {
      min-height: 160px;
    }
  }

  /* 歷史 K 在上、即時走勢在下。 */

  .detail-section + .detail-section {
    margin-top: 18px;
  }

  .live-detail {
    min-height: 380px;
  }

  .live-metrics {
    display: grid;

    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .live-metric {
    min-width: 0;
  }

  @media (max-width: 600px) {
    .live-metrics {
      grid-template-columns: 1fr 1fr;
    }
  }
</style>
