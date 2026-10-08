<template>
  <section class="market-view">
    <h1>即時市場行情</h1>
    <p>WebSocket 狀態：{{ status }}</p>
    <p v-if="status === 'error'">請檢查 JWT、SockJS 握手與 Nginx /ws 路由。</p>
    <ul>
      <li v-for="topic in MARKET_TOPICS" :key="topic">
        <strong>{{ topic.replace('/topic/', '') }}</strong>
        <template v-if="latest[topic]">
          <span>更新：{{ new Date(latest[topic]!.receivedAt).toLocaleTimeString() }}</span>
          <details>
            <summary>檢視原始行情內容</summary>
            <pre>{{ JSON.stringify(latest[topic]!.rawMarketData, null, 2) }}</pre>
          </details>
        </template>
        <span v-else>尚未收到資料</span>
      </li>
    </ul>
  </section>
</template>
<script setup lang="ts">
  import { onMounted, onUnmounted, reactive, ref } from 'vue'
  import { connectMarketSocket, type MarketSocketHandle } from '@/websocket/marketSocket'
  import { MARKET_TOPICS, type MarketEvent, type MarketTopic } from '@/types/market'
  const latest = reactive({} as Partial<Record<MarketTopic, MarketEvent>>)
  const status = ref('connecting')
  let socket: MarketSocketHandle | null = null
  onMounted(() => {
    socket = connectMarketSocket(
      async () => {
        // 目前透過既有 FCM Startup / Axios 更新 authToken；此畫面不自行換發 JWT
        const jwt = localStorage.getItem('authToken') ?? ''
        if (!jwt.trim()) throw new Error('尚未取得 Guest JWT，請先完成 FCM 驗證')
        return jwt
      },
      (event) => {
        latest[event.topic] = event
      },
      (value) => {
        status.value = value
      },
    )
  })
  onUnmounted(() => {
    void socket?.disconnect()
  })
</script>
<style scoped>
  .market-view {
    padding: 24px;
    min-height: 100vh;
    color: #eee;
    background: #151515;
  }
  ul {
    list-style: none;
    padding: 0;
  }
  li {
    padding: 14px 0;
    border-bottom: 1px solid #444;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 16px;
  }
  pre {
    max-height: 240px;
    overflow: auto;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
</style>
