/// <reference lib="webworker" />

import { Client, type StompSubscription } from '@stomp/stompjs'
import { MARKET_TOPICS, type MarketTopic } from '@/types/market'
import { parseMarketMessage } from '@/services/marketParser'
import type { PageToWorker, WorkerToPage, SharedMarketStatus } from '@/services/marketWorkerProtocol'

/**
 * BigStock 共用行情 Worker：同源、同一瀏覽器儲存區中的分頁共享一條連線。
 *
 * 重要：SharedWorker 不支援 localStorage，也不使用 sockjs-client（需要 DOM）。
 * Spring .withSockJS() 可提供 /ws/websocket 的原生 WebSocket 傳輸端點。
 * JWT 仍由分頁中的 authTokenManager 取得；Worker 不儲存 JWT 到持久媒介。
 */
const scope = self as unknown as SharedWorkerGlobalScope
const DEBUG = import.meta.env.DEV
const ports = new Map<MessagePort, number>()
const PORT_TTL = 120_000
const HEARTBEAT = 10_000
let status: SharedMarketStatus = 'disconnected'
let client: Client | null = null
let subscriptions: StompSubscription[] = []
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let attempts = 0
let generation = 0
let initializing = false
let stoppingClient = false
let replaced = false
let forceRefresh = false
let lastJwt = ''
let nextTokenRequest = 0
let pendingToken: {
  id: number
  resolve: (token: string) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
} | null = null

function broadcast(message: WorkerToPage): void {
  for (const port of [...ports.keys()]) {
    try { port.postMessage(message) }
    catch { ports.delete(port) }
  }
}

function setStatus(value: SharedMarketStatus): void {
  status = value
  broadcast({ type: 'STATUS', status: value })
}

function clearReconnect(): void {
  if (reconnectTimer !== null) clearTimeout(reconnectTimer)
  reconnectTimer = null
}

function closeSubscriptions(): void {
  for (const sub of subscriptions) {
    try { sub.unsubscribe() } catch { /* transport might already be closed */ }
  }
  subscriptions = []
}

/** 只向一個活躍分頁要求 Token，避免同時觸發多次 FCM 驗證。 */
function askPageForToken(refresh: boolean): Promise<string> {
  const page = ports.keys().next().value as MessagePort | undefined
  if (!page) return Promise.reject(new Error('沒有可用的 BigStock 分頁'))
  if (pendingToken) return Promise.reject(new Error('已有 JWT 請求正在處理'))
  return new Promise<string>((resolve, reject) => {
    const id = ++nextTokenRequest
    const timer = setTimeout(() => {
      pendingToken = null
      reject(new Error('等待分頁取得 JWT 逾時'))
    }, 30_000)
    pendingToken = { id, resolve, reject, timer }
    try {
      page.postMessage({
        type: 'TOKEN_REQUEST', requestId: id, forceRefresh: refresh,
        rejectedToken: refresh ? lastJwt : undefined,
      } satisfies WorkerToPage)
    } catch (error) {
      clearTimeout(timer)
      pendingToken = null
      reject(error instanceof Error ? error : new Error(String(error)))
    }
  })
}

function wsUrl(token: string): string {
  const protocol = scope.location.protocol === 'https:' ? 'wss:' : 'ws:'
  // 原生 SockJS WebSocket 傳輸端點，不是 SockJS JS Client 的 /ws/info。
  return `${protocol}//${scope.location.host}/ws/websocket?token=${encodeURIComponent(token)}`
}

function scheduleReconnect(): void {
  if (replaced || ports.size === 0 || client || initializing || stoppingClient || reconnectTimer) return
  const delay = Math.min(5000 * 2 ** attempts, 60_000)
  attempts += 1
  setStatus('disconnected')
  if (DEBUG) console.info('[SharedMarket] reconnect after', delay)
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    void connect()
  }, delay)
}

async function cleanup(current: Client, seq: number): Promise<void> {
  if (client !== current || seq !== generation) return
  client = null
  stoppingClient = true
  closeSubscriptions()
  try { await current.deactivate() }
  catch (error) { console.warn('[SharedMarket] deactivate failed', error) }
  finally {
    stoppingClient = false
    if (seq === generation) scheduleReconnect()
  }
}

async function connect(): Promise<void> {
  if (replaced || ports.size === 0 || client || initializing || stoppingClient) return
  initializing = true
  const seq = ++generation
  setStatus('connecting')
  try {
    const jwt = (await askPageForToken(forceRefresh)).replace(/^Bearer\s+/i, '').trim()
    if (seq !== generation || ports.size === 0 || replaced) return
    if (!jwt) throw new Error('JWT 為空')
    lastJwt = jwt
    forceRefresh = false
    const stomp = new Client({
      webSocketFactory: () => new WebSocket(wsUrl(jwt)),
      reconnectDelay: 0, // 重連前必須重新向分頁檢查 JWT
      heartbeatIncoming: HEARTBEAT,
      heartbeatOutgoing: HEARTBEAT,
      connectionTimeout: 15_000,
      onConnect: () => {
        if (client !== stomp || seq !== generation) return
        attempts = 0
        setStatus('connected')
        closeSubscriptions()
        subscriptions = MARKET_TOPICS.map((topic: MarketTopic) => stomp.subscribe(topic, message => {
          try { broadcast({ type: 'MARKET_EVENT', event: parseMarketMessage(topic, message.body) }) }
          catch (error) { console.error('[SharedMarket] parse failed', topic, error) }
        }))
        if (DEBUG) console.info('[SharedMarket] CONNECTED; tabs=', ports.size)
      },
      onStompError: frame => {
        if (client !== stomp || seq !== generation) return
        const message = `${frame.headers.message ?? ''} ${frame.body ?? ''}`
        if (/\b401\b|\b403\b|jwt|expired|unauthorized|invalid.token/i.test(message)) forceRefresh = true
        setStatus('error')
        void cleanup(stomp, seq)
      },
      onWebSocketClose: event => {
        if (client !== stomp || seq !== generation) return
        if (DEBUG) console.warn('[SharedMarket] WS CLOSE', event.code, event.reason)
        if (event.code === 4001 || event.reason === 'SESSION_REPLACED') {
          // 後端明確表示其他裝置/瀏覽器取代，此 Worker 不再搶回 Session。
          replaced = true
          setStatus('replaced')
        } else if (/jwt|expired|unauthorized|invalid.token/i.test(event.reason)) {
          forceRefresh = true
        }
        void cleanup(stomp, seq)
      },
      onWebSocketError: event => {
        if (client !== stomp || seq !== generation) return
        console.warn('[SharedMarket] transport error', event)
        setStatus('error')
      },
    })
    client = stomp
    stomp.activate()
  } catch (error) {
    if (seq === generation && ports.size > 0) {
      console.warn('[SharedMarket] CONNECT failed', error)
      setStatus('error')
    }
  } finally {
    initializing = false
    if (seq === generation) scheduleReconnect()
  }
}

async function stop(): Promise<void> {
  clearReconnect()
  ++generation
  const current = client
  client = null
  closeSubscriptions()
  if (current) {
    try { await current.deactivate() } catch { /* closing */ }
  }
  setStatus('disconnected')
}

function removePage(port: MessagePort): void {
  ports.delete(port)
  if (ports.size === 0) {
    if (pendingToken) {
      clearTimeout(pendingToken.timer)
      pendingToken.reject(new Error('所有分頁都已離開'))
      pendingToken = null
    }
    void stop()
  }
}

function processMessage(port: MessagePort, message: PageToWorker): void {
  if (!message || typeof message !== 'object') return
  if (message.type === 'HELLO' || message.type === 'PING') {
    ports.set(port, Date.now())
    if (message.type === 'HELLO') {
      port.postMessage({ type: 'WORKER_READY', clientCount: ports.size } satisfies WorkerToPage)
      port.postMessage({ type: 'STATUS', status } satisfies WorkerToPage)
      if (!replaced) void connect()
    }
    return
  }
  if (message.type === 'LEAVE') { removePage(port); return }
  if (!ports.has(port)) return
  if (message.type === 'TOKEN_RESPONSE') {
    const pending = pendingToken
    if (!pending || pending.id !== message.requestId) return
    clearTimeout(pending.timer)
    pendingToken = null
    if (message.error || !message.token) pending.reject(new Error(message.error ?? 'JWT 不存在'))
    else pending.resolve(message.token)
    return
  }
  if (message.type === 'AUTH_CHANGED') {
    // 會員切換身份：放棄舊連線並重新握手。
    replaced = false
    forceRefresh = false
    attempts = 0
    void stop().then(() => { if (ports.size) void connect() })
    return
  }
  if (message.type === 'RETRY') {
    replaced = false
    forceRefresh = false
    attempts = 0
    void stop().then(() => { if (ports.size) void connect() })
  }
}

scope.onconnect = event => {
  const port = event.ports[0]
  if (!port) return
  port.onmessage = e => processMessage(port, e.data as PageToWorker)
  port.onmessageerror = () => removePage(port)
  port.start()
}

// 只移除已長時間沒有分頁心跳的 MessagePort。
setInterval(() => {
  const now = Date.now()
  for (const [port, lastSeen] of ports) {
    if (now - lastSeen > PORT_TTL) removePage(port)
  }
}, 30_000)
