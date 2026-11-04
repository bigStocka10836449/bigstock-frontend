/// <reference lib="webworker" />
import { Client, type StompSubscription } from '@stomp/stompjs'
import { MARKET_TOPICS, type MarketTopic } from '@/types/market'
import { parseMarketMessage } from '@/services/marketParser'
import type { PageToWorker, WorkerToPage, SharedMarketStatus } from '@/services/marketWorkerProtocol'

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
let nextRequestId = 0
let pendingSession: {
  id: number
  requester: MessagePort
  resolve: () => void
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
    try { sub.unsubscribe() } catch { /* already closed */ }
  }
  subscriptions = []
}

function askPageForSession(refresh: boolean): Promise<void> {
  const requester = ports.keys().next().value as MessagePort | undefined
  if (!requester) return Promise.reject(new Error('No active BigStock page'))
  if (pendingSession) return Promise.reject(new Error('Session request already pending'))
  return new Promise<void>((resolve, reject) => {
    const id = ++nextRequestId
    const timer = setTimeout(() => {
      pendingSession = null
      reject(new Error('Web session preparation timed out'))
    }, 60_000) // Account for user interaction with Turnstile.
    pendingSession = { id, requester, resolve, reject, timer }
    try { requester.postMessage({ type: 'SESSION_REQUEST', requestId: id, forceRefresh: refresh } satisfies WorkerToPage) }
    catch (e) {
      clearTimeout(timer)
      pendingSession = null
      reject(e instanceof Error ? e : new Error(String(e)))
    }
  })
}

function wsUrl(): string {
  const protocol = scope.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${scope.location.host}/ws/websocket`
}
function scheduleReconnect(): void {
  if (replaced || ports.size === 0 || client || initializing || stoppingClient || reconnectTimer) return
  const delay = Math.min(5_000 * (2 ** Math.min(attempts, 5)), 60_000)
  attempts++
  setStatus('disconnected')
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
  catch (e) { if (DEBUG) console.warn('[SharedMarket] deactivate failed', e) }
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
    await askPageForSession(forceRefresh)
    if (seq !== generation || ports.size === 0 || replaced) return
    forceRefresh = false
    const stomp = new Client({
      webSocketFactory: () => new WebSocket(wsUrl()),
      reconnectDelay: 0,
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
          catch (e) { console.error('[SharedMarket] parse failed', topic, e) }
        }))
      },
      onStompError: frame => {
        if (client !== stomp || seq !== generation) return
        const msg = `${frame.headers.message ?? ''} ${frame.body ?? ''}`
        if (/\b401\b|jwt|expired|unauthorized|invalid.token/i.test(msg)) forceRefresh = true
        setStatus('error')
        void cleanup(stomp, seq)
      },
      onWebSocketClose: event => {
        if (client !== stomp || seq !== generation) return
        if (DEBUG) console.warn('[SharedMarket] WS close', event.code, event.reason)
        if (event.code === 4001 || event.reason === 'SESSION_REPLACED') {
          replaced = true
          setStatus('replaced')
        } else if (/jwt|expired|unauthorized|invalid.token/i.test(event.reason)) {
          forceRefresh = true
        }
        void cleanup(stomp, seq)
      },
      onWebSocketError: () => {
        if (client !== stomp || seq !== generation) return
        setStatus('error')
      },
    })
    client = stomp
    stomp.activate()
  } catch (e) {
    if (seq === generation && ports.size > 0) {
      console.warn('[SharedMarket] connect failed', e)
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
  if (current) { try { await current.deactivate() } catch { /* closing */ } }
  setStatus('disconnected')
}
function removePage(port: MessagePort): void {
  ports.delete(port)
  if (pendingSession?.requester === port) {
    clearTimeout(pendingSession.timer)
    pendingSession.reject(new Error('Session requester page closed'))
    pendingSession = null
  }
  if (ports.size === 0) void stop()
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
  if (message.type === 'SESSION_RESPONSE') {
    const pending = pendingSession
    if (!pending || pending.id !== message.requestId || pending.requester !== port) return
    clearTimeout(pending.timer)
    pendingSession = null
    if (message.error) pending.reject(new Error(message.error))
    else pending.resolve()
    return
  }
  if (message.type === 'AUTH_CHANGED' || message.type === 'RETRY') {
    replaced = false
    forceRefresh = false
    attempts = 0
    void stop().then(() => { if (ports.size > 0) void connect() })
  }
}
scope.onconnect = event => {
  const port = event.ports[0]
  if (!port) return
  port.onmessage = event => processMessage(port, event.data as PageToWorker)
  port.onmessageerror = () => removePage(port)
  port.start()
}
setInterval(() => {
  const now = Date.now()
  for (const [port, seen] of ports) {
    if (now - seen > PORT_TTL) removePage(port)
  }
}, 30_000)
