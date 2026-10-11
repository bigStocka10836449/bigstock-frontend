import { Client, type StompSubscription } from '@stomp/stompjs'
import SockJS from 'sockjs-client'

import { MARKET_TOPICS, type MarketEvent, type MarketTopic } from '@/types/market'
import { parseMarketMessage } from '@/services/marketParser'

/**
 * BigStock WebSocket 診斷版
 *
 * 目的：分辨「同一個 Service 自動重連」與「多個 Service / SockJS 同時存在」。
 * JWT 仍由外部 Provider 管理；保留六個 STOMP Topics 的訂閱功能。
 *
 * 診斷日誌只於 Vite Development 輸出。完成測試後可關閉 DEBUG_SOCKET。
 */
export type MarketJwtProvider = (
  forceRefresh?: boolean,
  rejectedJwt?: string,
) => Promise<string>

export type MarketSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

export interface MarketSocketHandle {
  disconnect: () => Promise<void>
}

const DEBUG_SOCKET = import.meta.env.DEV
const INITIAL_RECONNECT_DELAY = 5000
const MAX_RECONNECT_DELAY = 60000
const CONNECTION_TIMEOUT = 15000
const HEARTBEAT_INTERVAL = 10000

/** 同一個瀏覽器分頁／JavaScript Module 內共用的追蹤計數。 */
let nextInstanceId = 0
const activeInstances = new Set<number>()
const activeTransports = new Set<string>()

function normalizeJwt(token: string): string {
  return token.replace(/^Bearer\s+/i, '').trim()
}

function isAuthenticationError(message: string): boolean {
  return /\b401\b|\b403\b|unauthori[sz]ed|forbidden|expired|invalid[\s_-]*token|jwt|access[\s_-]*denied/i.test(message)
}

function diagnostics(): { activeInstanceIds: number[]; activeTransportIds: string[] } {
  return {
    activeInstanceIds: [...activeInstances],
    activeTransportIds: [...activeTransports],
  }
}

export function connectMarketSocket(
  getJwt: MarketJwtProvider,
  onData: (event: MarketEvent) => void,
  onStatus?: (status: MarketSocketStatus) => void,
): MarketSocketHandle {
  const instanceId = ++nextInstanceId
  activeInstances.add(instanceId)

  let stopped = false
  let client: Client | null = null
  let subscriptions: StompSubscription[] = []
  let preparingConnection = false
  let cleaningConnection = false
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let reconnectAttempts = 0
  let generation = 0
  let connectedAt: number | null = null
  let lastConnectionJwt = ''
  let forceRefreshNext = false

  if (DEBUG_SOCKET) {
    console.warn('[MarketSocket TEST] NEW SERVICE INSTANCE', {
      instanceId,
      ...diagnostics(),
      at: new Date().toISOString(),
    })
    console.trace('[MarketSocket TEST] connectMarketSocket() 呼叫來源')
  }

  function setStatus(status: MarketSocketStatus): void {
    if (!stopped) onStatus?.(status)
  }

  function clearReconnectTimer(): void {
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
  }

  function clearSubscriptions(): void {
    const previous = subscriptions
    subscriptions = []
    for (const subscription of previous) {
      try {
        subscription.unsubscribe()
      } catch (error: unknown) {
        if (DEBUG_SOCKET) console.warn('[MarketSocket TEST] unsubscribe 失敗', error)
      }
    }
  }

  async function deactivateClient(
    target: Client,
    reason: 'stomp-error' | 'after-remote-close' | 'page-disconnect',
  ): Promise<void> {
    if (DEBUG_SOCKET) {
      console.warn('[MarketSocket TEST] FRONTEND deactivate()', {
        instanceId,
        generation,
        reason,
        active: target.active,
        at: new Date().toISOString(),
      })
      console.trace('[MarketSocket TEST] deactivate() 呼叫堆疊')
    }
    try {
      await target.deactivate()
    } catch (error: unknown) {
      console.warn('[MarketSocket TEST] deactivate 失敗', { instanceId, reason, error })
    }
  }

  function scheduleReconnect(): void {
    if (stopped || reconnectTimer !== null || preparingConnection || cleaningConnection || client !== null) return
    const delay = Math.min(
      INITIAL_RECONNECT_DELAY * 2 ** reconnectAttempts,
      MAX_RECONNECT_DELAY,
    )
    reconnectAttempts += 1
    setStatus('disconnected')
    if (DEBUG_SOCKET) {
      console.warn('[MarketSocket TEST] RECONNECT SCHEDULED', {
        instanceId,
        nextGeneration: generation + 1,
        delayMs: delay,
        ...diagnostics(),
      })
    }
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      void startConnection()
    }, delay)
  }

  function finishConnection(
    currentGeneration: number,
    target: Client,
    reason: 'stomp-error' | 'after-remote-close',
  ): void {
    if (stopped || generation !== currentGeneration || client !== target || cleaningConnection) return
    cleaningConnection = true
    const transportId = `${instanceId}:${currentGeneration}`
    if (DEBUG_SOCKET) {
      console.info('[MarketSocket TEST] FINISH CONNECTION', {
        instanceId,
        generation: currentGeneration,
        reason,
        connectedForSeconds: connectedAt === null
          ? null
          : Math.round((Date.now() - connectedAt) / 1000),
      })
    }
    client = null
    connectedAt = null
    clearSubscriptions()
    void deactivateClient(target, reason).finally(() => {
      activeTransports.delete(transportId)
      cleaningConnection = false
      if (DEBUG_SOCKET) {
        console.info('[MarketSocket TEST] TRANSPORT RELEASED', {
          instanceId,
          transportId,
          ...diagnostics(),
        })
      }
      if (!stopped && generation === currentGeneration) scheduleReconnect()
    })
  }

  async function startConnection(): Promise<void> {
    if (stopped || preparingConnection || cleaningConnection || client !== null) {
      if (DEBUG_SOCKET) console.debug('[MarketSocket TEST] CONNECT SKIPPED', {
        instanceId, stopped, preparingConnection, cleaningConnection, hasClient: client !== null,
      })
      return
    }
    preparingConnection = true
    const currentGeneration = ++generation
    const transportId = `${instanceId}:${currentGeneration}`
    setStatus('connecting')
    if (DEBUG_SOCKET) {
      console.info('[MarketSocket TEST] START CONNECTION', {
        instanceId,
        generation: currentGeneration,
        transportId,
        ...diagnostics(),
      })
    }

    try {
      const jwt = normalizeJwt(await getJwt(forceRefreshNext, lastConnectionJwt || undefined))
      if (stopped || currentGeneration !== generation) return
      if (!jwt) throw new Error('無法取得有效的 BigStock JWT')
      lastConnectionJwt = jwt
      forceRefreshNext = false

      const newClient = new Client({
        webSocketFactory: () => {
          const transport = new SockJS(`/ws?token=${encodeURIComponent(jwt)}`)
          if (DEBUG_SOCKET) {
            console.info('[MarketSocket TEST] SOCKJS CREATED', {
              instanceId,
              generation: currentGeneration,
              transportId,
              // 不輸出 JWT 或帶 Token 的 URL。
            })
          }
          return transport
        },
        reconnectDelay: 0, // 僅使用本服務的重連流程
        heartbeatIncoming: HEARTBEAT_INTERVAL,
        heartbeatOutgoing: HEARTBEAT_INTERVAL,
        connectionTimeout: CONNECTION_TIMEOUT,

        onConnect: () => {
          if (stopped || currentGeneration !== generation || client !== newClient) return
          connectedAt = Date.now()
          reconnectAttempts = 0
          setStatus('connected')
          console.info('[MarketSocket TEST] STOMP CONNECTED', {
            instanceId,
            generation: currentGeneration,
            transportId,
            at: new Date(connectedAt).toISOString(),
            ...diagnostics(),
          })
          clearSubscriptions()
          for (const topic of MARKET_TOPICS) {
            const marketTopic: MarketTopic = topic
            const sub = newClient.subscribe(marketTopic, message => {
              if (stopped || currentGeneration !== generation || client !== newClient) return
              try {
                onData(parseMarketMessage(marketTopic, message.body))
              } catch (error: unknown) {
                console.error('[MarketSocket TEST] 訊息解析失敗', marketTopic, error)
              }
            })
            subscriptions.push(sub)
          }
        },

        onStompError: frame => {
          if (stopped || currentGeneration !== generation || client !== newClient) return
          const description = `${frame.headers.message ?? ''} ${frame.body ?? ''}`
          console.error('[MarketSocket TEST] STOMP ERROR', { instanceId, currentGeneration, description })
          if (isAuthenticationError(description)) forceRefreshNext = true
          setStatus('error')
          finishConnection(currentGeneration, newClient, 'stomp-error')
        },

        onWebSocketError: error => {
          if (stopped || currentGeneration !== generation || client !== newClient) return
          console.error('[MarketSocket TEST] WS TRANSPORT ERROR', { instanceId, currentGeneration, error })
          setStatus('error')
        },

        onWebSocketClose: event => {
          if (stopped || currentGeneration !== generation || client !== newClient) return
          console.warn('[MarketSocket TEST] WS CLOSE (before cleanup)', {
            instanceId,
            generation: currentGeneration,
            transportId,
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
            connectedForSeconds: connectedAt === null
              ? null
              : Math.round((Date.now() - connectedAt) / 1000),
            ...diagnostics(),
          })
          if (isAuthenticationError(event.reason ?? '')) forceRefreshNext = true
          // 3000 Go away! 不能直接判斷為 JWT 過期或其他裝置踢線。
          finishConnection(currentGeneration, newClient, 'after-remote-close')
        },
      })

      client = newClient
      activeTransports.add(transportId)
      if (DEBUG_SOCKET) {
        console.warn('[MarketSocket TEST] CLIENT ACTIVATED', {
          instanceId,
          generation: currentGeneration,
          transportId,
          ...diagnostics(),
        })
      }
      newClient.activate()
    } catch (error: unknown) {
      if (stopped || currentGeneration !== generation) return
      console.error('[MarketSocket TEST] 連線初始化失敗', { instanceId, currentGeneration, error })
      setStatus('error')
    } finally {
      preparingConnection = false
      if (!stopped && client === null && !cleaningConnection) scheduleReconnect()
    }
  }

  void startConnection()

  return {
    disconnect: async (): Promise<void> => {
      if (stopped) return
      if (DEBUG_SOCKET) {
        console.warn('[MarketSocket TEST] DISCONNECT CALLED', {
          instanceId,
          generation,
          ...diagnostics(),
        })
        console.trace('[MarketSocket TEST] disconnect() 呼叫堆疊')
      }
      stopped = true
      ++generation
      clearReconnectTimer()
      const current = client
      client = null
      connectedAt = null
      clearSubscriptions()
      // 只清理這個 Instance 的 Transport，不會誤刪其他 Instance。
      for (const key of [...activeTransports]) {
        if (key.startsWith(`${instanceId}:`)) activeTransports.delete(key)
      }
      if (current) await deactivateClient(current, 'page-disconnect')
      activeInstances.delete(instanceId)
      if (DEBUG_SOCKET) {
        console.info('[MarketSocket TEST] SERVICE STOPPED', { instanceId, ...diagnostics() })
      }
    },
  }
}
