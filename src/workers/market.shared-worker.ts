/// <reference lib="webworker" />

import {
  Client,
  type StompSubscription,
} from '@stomp/stompjs'

import {
  MARKET_TOPICS,
  type MarketTopic,
} from '@/types/market'

import { parseMarketMessage } from '@/services/marketParser'

import type {
  PageToWorker,
  WorkerToPage,
  SharedMarketStatus,
} from '@/services/marketWorkerProtocol'

/**
 * ============================================================
 * BigStock Shared Market Worker
 * ============================================================
 *
 * Authentication:
 * HttpOnly Cookie
 *
 * The Worker never receives JWT.
 */

const scope =
  self as unknown as SharedWorkerGlobalScope

const DEBUG = import.meta.env.DEV

const ports = new Map<MessagePort, number>()

const PORT_TTL = 120_000
const HEARTBEAT = 10_000

let status: SharedMarketStatus = 'disconnected'

let client: Client | null = null

let subscriptions: StompSubscription[] = []

let reconnectTimer:
  ReturnType<typeof setTimeout> | null = null

let attempts = 0

let generation = 0

let initializing = false
let stoppingClient = false
let replaced = false
let forceRefresh = false

let nextSessionRequest = 0

let pendingSession: {
  id: number
  resolve: () => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
} | null = null

/**
 * Broadcast message to all browser tabs.
 */
function broadcast(message: WorkerToPage): void {

  for (const port of [...ports.keys()]) {

    try {

      port.postMessage(message)

    } catch {

      ports.delete(port)
    }
  }
}

/**
 * Update and broadcast connection status.
 */
function setStatus(value: SharedMarketStatus): void {

  status = value

  broadcast({
    type: 'STATUS',
    status: value,
  })
}

/**
 * Clear reconnect timer.
 */
function clearReconnect(): void {

  if (reconnectTimer !== null) {
    clearTimeout(reconnectTimer)
  }

  reconnectTimer = null
}

/**
 * Remove previous subscriptions.
 */
function closeSubscriptions(): void {

  for (const subscription of subscriptions) {

    try {
      subscription.unsubscribe()
    } catch {
      // Socket may already be closed.
    }
  }

  subscriptions = []
}

/**
 * Ask a Vue page to prepare Cookie session.
 *
 * No JWT is transferred.
 */
function askPageForSession(
  refresh: boolean,
): Promise<void> {

  const page =
    ports.keys().next().value as MessagePort | undefined

  if (!page) {

    return Promise.reject(
      new Error('No available BigStock browser page'),
    )
  }

  if (pendingSession) {

    return Promise.reject(
      new Error('Session preparation already pending'),
    )
  }

  return new Promise<void>((resolve, reject) => {

    const requestId = ++nextSessionRequest

    const timer = setTimeout(() => {

      pendingSession = null

      reject(
        new Error('Session preparation timeout'),
      )

    }, 30000)

    pendingSession = {
      id: requestId,
      resolve,
      reject,
      timer,
    }

    try {

      page.postMessage({
        type: 'SESSION_REQUEST',
        requestId,
        forceRefresh: refresh,
      } satisfies WorkerToPage)

    } catch (error: unknown) {

      clearTimeout(timer)

      pendingSession = null

      reject(
        error instanceof Error
          ? error
          : new Error(String(error)),
      )
    }
  })
}

/**
 * Native WebSocket URL.
 *
 * No JWT query parameter.
 */
function wsUrl(): string {

  const protocol =
    scope.location.protocol === 'https:'
      ? 'wss:'
      : 'ws:'

  return (
    `${protocol}//${scope.location.host}` +
    '/ws/websocket'
  )
}

/**
 * Schedule WebSocket reconnect.
 */
function scheduleReconnect(): void {

  if (
    replaced ||
    ports.size === 0 ||
    client !== null ||
    initializing ||
    stoppingClient ||
    reconnectTimer !== null
  ) {
    return
  }

  const delay = Math.min(
    5000 * 2 ** attempts,
    60000,
  )

  attempts++

  setStatus('disconnected')

  if (DEBUG) {

    console.info(
      '[SharedMarket] Reconnect scheduled',
      delay,
    )
  }

  reconnectTimer = setTimeout(() => {

    reconnectTimer = null

    void connect()

  }, delay)
}

/**
 * Cleanup a disconnected STOMP client.
 */
async function cleanup(
  current: Client,
  seq: number,
): Promise<void> {

  if (
    client !== current ||
    seq !== generation
  ) {
    return
  }

  client = null
  stoppingClient = true

  closeSubscriptions()

  try {

    await current.deactivate()

  } catch (error: unknown) {

    console.warn(
      '[SharedMarket] Deactivate failed',
      error,
    )

  } finally {

    stoppingClient = false

    if (seq === generation) {

      scheduleReconnect()
    }
  }
}

/**
 * Establish STOMP connection.
 */
async function connect(): Promise<void> {

  if (
    replaced ||
    ports.size === 0 ||
    client !== null ||
    initializing ||
    stoppingClient
  ) {
    return
  }

  initializing = true

  const seq = ++generation

  setStatus('connecting')

  try {

    // ========================================================
    // 1. Prepare Cookie Session
    // ========================================================

    await askPageForSession(forceRefresh)

    if (
      seq !== generation ||
      ports.size === 0 ||
      replaced
    ) {
      return
    }

    forceRefresh = false

    // ========================================================
    // 2. Create STOMP Client
    // ========================================================

    const stomp = new Client({

      webSocketFactory: () =>
        new WebSocket(wsUrl()),

      reconnectDelay: 0,

      heartbeatIncoming: HEARTBEAT,

      heartbeatOutgoing: HEARTBEAT,

      connectionTimeout: 15000,

      // ======================================================
      // CONNECTED
      // ======================================================

      onConnect: () => {

        if (
          client !== stomp ||
          seq !== generation
        ) {
          return
        }

        attempts = 0

        setStatus('connected')

        closeSubscriptions()

        subscriptions = MARKET_TOPICS.map(
          (topic: MarketTopic) =>

            stomp.subscribe(topic, message => {

              try {

                const marketEvent =
                  parseMarketMessage(
                    topic,
                    message.body,
                  )

                broadcast({
                  type: 'MARKET_EVENT',
                  event: marketEvent,
                })

              } catch (error: unknown) {

                console.error(
                  '[SharedMarket] Message parse failed',
                  topic,
                  error,
                )
              }
            }),
        )

        if (DEBUG) {

          console.info(
            '[SharedMarket] STOMP connected',
            {
              tabs: ports.size,
            },
          )
        }
      },

      // ======================================================
      // STOMP ERROR
      // ======================================================

      onStompError: frame => {

        if (
          client !== stomp ||
          seq !== generation
        ) {
          return
        }

        const description =
          `${frame.headers.message ?? ''} ${frame.body ?? ''}`

        if (
          /\b401\b|\b403\b|jwt|expired|unauthorized|invalid.token/i
            .test(description)
        ) {

          forceRefresh = true
        }

        setStatus('error')

        void cleanup(stomp, seq)
      },

      // ======================================================
      // WEBSOCKET CLOSE
      // ======================================================

      onWebSocketClose: event => {

        if (
          client !== stomp ||
          seq !== generation
        ) {
          return
        }

        if (DEBUG) {

          console.warn(
            '[SharedMarket] WebSocket closed',
            {
              code: event.code,
              reason: event.reason,
            },
          )
        }

        if (
          event.code === 4001 ||
          event.reason === 'SESSION_REPLACED'
        ) {

          replaced = true

          setStatus('replaced')

        } else if (
          /jwt|expired|unauthorized|invalid.token/i
            .test(event.reason)
        ) {

          forceRefresh = true
        }

        void cleanup(stomp, seq)
      },

      // ======================================================
      // WEBSOCKET ERROR
      // ======================================================

      onWebSocketError: event => {

        if (
          client !== stomp ||
          seq !== generation
        ) {
          return
        }

        console.warn(
          '[SharedMarket] WebSocket transport error',
          event,
        )

        setStatus('error')
      },
    })

    client = stomp

    stomp.activate()

  } catch (error: unknown) {

    if (
      seq === generation &&
      ports.size > 0
    ) {

      console.warn(
        '[SharedMarket] Connection failed',
        error,
      )

      setStatus('error')
    }

  } finally {

    initializing = false

    if (seq === generation) {

      scheduleReconnect()
    }
  }
}

/**
 * Stop current connection.
 */
async function stop(): Promise<void> {

  clearReconnect()

  ++generation

  const current = client

  client = null

  closeSubscriptions()

  if (current) {

    try {
      await current.deactivate()
    } catch {
      // Connection already closed.
    }
  }

  setStatus('disconnected')
}

/**
 * Remove disconnected browser page.
 */
function removePage(port: MessagePort): void {

  ports.delete(port)

  if (ports.size === 0) {

    if (pendingSession) {

      clearTimeout(pendingSession.timer)

      pendingSession.reject(
        new Error('No active browser page'),
      )

      pendingSession = null
    }

    void stop()
  }
}

/**
 * Process Vue page messages.
 */
function processMessage(
  port: MessagePort,
  message: PageToWorker,
): void {

  if (
    !message ||
    typeof message !== 'object'
  ) {
    return
  }

  // ==========================================================
  // HELLO / PING
  // ==========================================================

  if (
    message.type === 'HELLO' ||
    message.type === 'PING'
  ) {

    ports.set(port, Date.now())

    if (message.type === 'HELLO') {

      port.postMessage({
        type: 'WORKER_READY',
        clientCount: ports.size,
      } satisfies WorkerToPage)

      port.postMessage({
        type: 'STATUS',
        status,
      } satisfies WorkerToPage)

      if (!replaced) {

        void connect()
      }
    }

    return
  }

  // ==========================================================
  // LEAVE
  // ==========================================================

  if (message.type === 'LEAVE') {

    removePage(port)

    return
  }

  if (!ports.has(port)) {
    return
  }

  // ==========================================================
  // SESSION RESPONSE
  // ==========================================================

  if (message.type === 'SESSION_RESPONSE') {

    const pending = pendingSession

    if (
      !pending ||
      pending.id !== message.requestId
    ) {
      return
    }

    clearTimeout(pending.timer)

    pendingSession = null

    if (message.error) {

      pending.reject(
        new Error(message.error),
      )

    } else {

      pending.resolve()
    }

    return
  }

  // ==========================================================
  // AUTH CHANGED
  // ==========================================================

  if (message.type === 'AUTH_CHANGED') {

    replaced = false

    forceRefresh = false

    attempts = 0

    void stop().then(() => {

      if (ports.size > 0) {
        void connect()
      }
    })

    return
  }

  // ==========================================================
  // RETRY
  // ==========================================================

  if (message.type === 'RETRY') {

    replaced = false

    forceRefresh = false

    attempts = 0

    void stop().then(() => {

      if (ports.size > 0) {
        void connect()
      }
    })
  }
}

/**
 * SharedWorker connection entry point.
 */
scope.onconnect = event => {

  const port = event.ports[0]

  if (!port) return

  port.onmessage = event => {

    processMessage(
      port,
      event.data as PageToWorker,
    )
  }

  port.onmessageerror = () => {

    removePage(port)
  }

  port.start()
}

/**
 * Remove inactive browser ports.
 */
setInterval(() => {

  const now = Date.now()

  for (const [port, lastSeen] of ports) {

    if (now - lastSeen > PORT_TTL) {

      removePage(port)
    }
  }

}, 30000)
