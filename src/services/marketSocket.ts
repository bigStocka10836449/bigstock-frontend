
import {
  Client,
  type StompSubscription,
} from '@stomp/stompjs'

import SockJS from 'sockjs-client'

import {
  MARKET_TOPICS,
  type MarketEvent,
  type MarketTopic,
} from '@/types/market'

import {
  parseMarketMessage,
} from '@/services/marketParser'

/**
 * ============================================================
 * BigStock - Market WebSocket Service
 * ============================================================
 *
 * 功能：
 *
 * 1. 使用 SockJS 建立 WebSocket 連線
 * 2. 使用 STOMP 訂閱市場 Topics
 * 3. 接收並解析市場行情
 * 4. 每次連線前取得有效 JWT
 * 5. JWT 認證失敗時要求重新取得 Token
 * 6. WebSocket 斷線後自動重連
 * 7. 清理訂閱、Timer 和 STOMP Client
 *
 * JWT 管理：
 *
 * 不直接讀取 localStorage。
 * 不直接呼叫 /auth/tempToken。
 * 不自行處理 FCM 裝置驗證。
 *
 * JWT 的取得和更新全部交由外部 getJwt Provider。
 *
 * ============================================================
 */

/**
 * JWT Provider。
 *
 * forceRefresh = false：
 * 取得有效 JWT，必要時更新。
 *
 * forceRefresh = true：
 * 後端拒絕上一個 JWT，要求恢復認證。
 *
 * rejectedJwt：
 * 上一次建立 WebSocket 時使用的 JWT。
 *
 * 傳入 rejectedJwt 可以讓 Token Manager
 * 判斷其他 API 是否已經完成 Token 更新。
 */
export type MarketJwtProvider = (
  forceRefresh?: boolean,
  rejectedJwt?: string,
) => Promise<string>

/**
 * WebSocket 連線狀態。
 */
export type MarketSocketStatus =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error'

/**
 * Store 使用的 Socket Handle。
 */
export interface MarketSocketHandle {
  disconnect: () => Promise<void>
}

/**
 * 重連設定。
 *
 * 使用指數退避：
 *
 * 5 秒
 * 10 秒
 * 20 秒
 * 40 秒
 * 60 秒
 *
 * 成功建立 STOMP 連線後重置。
 */
const INITIAL_RECONNECT_DELAY = 5000
const MAX_RECONNECT_DELAY = 60000

/**
 * STOMP 連線逾時。
 */
const CONNECTION_TIMEOUT = 15000

/**
 * STOMP Heartbeat。
 */
const HEARTBEAT_INTERVAL = 10000

/**
 * 移除 JWT 前面的 Bearer。
 *
 * SockJS query parameter 只傳 JWT 本身。
 */
function normalizeJwt(token: string): string {
  return token.replace(/^Bearer\s+/i, '').trim()
}

/**
 * 判斷 STOMP 錯誤是否明確涉及授權。
 *
 * 注意：
 * 並不是所有 WebSocket 斷線都是 JWT 過期。
 */
function isAuthenticationError(
  value: string,
): boolean {
  return (
    /\b401\b|\b403\b|unauthori[sz]ed|forbidden|expired|invalid[\s_-]*token|jwt|access[\s_-]*denied/i
      .test(value)
  )
}

/**
 * ============================================================
 * 建立市場 WebSocket
 * ============================================================
 *
 * @param getJwt 由 Token Manager 提供 JWT
 * @param onData 接收市場行情
 * @param onStatus 回報連線狀態
 */
export function connectMarketSocket(
  getJwt: MarketJwtProvider,
  onData: (event: MarketEvent) => void,
  onStatus?: (status: MarketSocketStatus) => void,
): MarketSocketHandle {

  /**
   * ----------------------------------------------------------
   * 連線內部狀態
   * ----------------------------------------------------------
   */

  let stopped = false

  let client: Client | null = null

  let subscriptions: StompSubscription[] = []

  /**
   * 正在取得 JWT 的狀態。
   */
  let preparingConnection = false

  /**
   * 重連 Timer。
   */
  let reconnectTimer:
    ReturnType<typeof setTimeout> | null = null

  /**
   * 目前累積的重連次數。
   */
  let reconnectAttempts = 0

  /**
   * 上一次連線使用的 JWT。
   *
   * 只用於向 Token Manager 回報遭拒的 JWT，
   * 不負責儲存或更新全站 JWT。
   */
  let lastConnectionJwt = ''

  /**
   * 若後端明確回報認證失敗，
   * 下次連線要求 Token Manager 恢復 JWT。
   */
  let forceRefreshNext = false

  /**
   * 連線版本號。
   *
   * 避免較舊的非同步 JWT 請求
   * 或 WebSocket callback 影響新連線。
   */
  let connectionGeneration = 0

  /**
   * ----------------------------------------------------------
   * 更新連線狀態
   * ----------------------------------------------------------
   */
  function updateStatus(
    status: MarketSocketStatus,
  ): void {
    if (stopped) {
      return
    }

    onStatus?.(status)
  }

  /**
   * ----------------------------------------------------------
   * 清除重連 Timer
   * ----------------------------------------------------------
   */
  function clearReconnectTimer(): void {
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
  }

  /**
   * ----------------------------------------------------------
   * 解除 STOMP 訂閱
   * ----------------------------------------------------------
   */
  function clearSubscriptions(): void {
    for (const subscription of subscriptions) {
      try {
        subscription.unsubscribe()
      } catch (error: unknown) {
        console.warn(
          '[MarketSocket] 解除訂閱失敗',
          error,
        )
      }
    }

    subscriptions = []
  }

  /**
   * ----------------------------------------------------------
   * 排程重新連線
   * ----------------------------------------------------------
   *
   * 由本 Service 統一管理重連。
   *
   * STOMP 的 reconnectDelay 會設成 0，
   * 避免 STOMP 自己重連時沿用舊 JWT。
   */
  function scheduleReconnect(): void {
    if (
      stopped ||
      reconnectTimer !== null ||
      client !== null ||
      preparingConnection
    ) {
      return
    }

    const delay = Math.min(
      INITIAL_RECONNECT_DELAY *
        Math.pow(2, reconnectAttempts),
      MAX_RECONNECT_DELAY,
    )

    reconnectAttempts += 1

    updateStatus('disconnected')

    console.warn(
      `[MarketSocket] ${delay}ms 後重新連線`,
    )

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null

      void startConnection()
    }, delay)
  }

  /**
   * ----------------------------------------------------------
   * 建立市場連線
   * ----------------------------------------------------------
   *
   * 流程：
   *
   * startConnection()
   *      |
   *      v
   * getJwt()
   *      |
   *      v
   * SockJS /ws?token=...
   *      |
   *      v
   * STOMP CONNECT
   *      |
   *      v
   * 訂閱 MARKET_TOPICS
   */
  async function startConnection(): Promise<void> {
    if (
      stopped ||
      preparingConnection ||
      client !== null
    ) {
      return
    }

    preparingConnection = true

    const generation = ++connectionGeneration

    updateStatus('connecting')

    try {
      /**
       * ------------------------------------------------------
       * 每次連線都重新取得目前有效 JWT
       * ------------------------------------------------------
       *
       * 正常情況：
       * getJwt(false, ...)
       *
       * 後端認證拒絕：
       * getJwt(true, lastConnectionJwt)
       *
       * Token Manager 自行決定是否需要重新核發。
       */
      const jwt = normalizeJwt(
        await getJwt(
          forceRefreshNext,
          lastConnectionJwt || undefined,
        ),
      )

      /**
       * JWT 等待期間，
       * 頁面可能已經離開。
       */
      if (
        stopped ||
        generation !== connectionGeneration
      ) {
        return
      }

      if (!jwt) {
        throw new Error(
          '尚未取得有效的 BigStock JWT',
        )
      }

      /**
       * 紀錄本次握手使用的 JWT。
       */
      lastConnectionJwt = jwt

      /**
       * 已取得新 JWT，
       * 清除下一次強制更新標記。
       */
      forceRefreshNext = false

      /**
       * ------------------------------------------------------
       * 建立新的 STOMP Client
       * ------------------------------------------------------
       *
       * 每次重連都建立新 Client。
       *
       * 不再讓 STOMP 自行重用舊 JWT。
       */
      const newClient = new Client({
        webSocketFactory: () => {
          return new SockJS(
            `/ws?token=${encodeURIComponent(jwt)}`,
          )
        },

        /**
         * 關閉 STOMP 自動重連。
         *
         * 由 scheduleReconnect()
         * 和 startConnection() 控制。
         */
        reconnectDelay: 0,

        heartbeatIncoming: HEARTBEAT_INTERVAL,
        heartbeatOutgoing: HEARTBEAT_INTERVAL,

        connectionTimeout: CONNECTION_TIMEOUT,

        /**
         * ----------------------------------------------------
         * STOMP 連線成功
         * ----------------------------------------------------
         */
        onConnect: () => {
          if (
            stopped ||
            generation !== connectionGeneration ||
            client !== newClient
          ) {
            return
          }

          /**
           * 重置重連次數。
           */
          reconnectAttempts = 0

          updateStatus('connected')

          console.info(
            '[MarketSocket] STOMP 連線成功',
          )

          /**
           * 每次建立新的 STOMP 連線，
           * 都重新建立市場訂閱。
           */
          clearSubscriptions()

          for (const topic of MARKET_TOPICS) {
            const marketTopic = topic as MarketTopic

            const subscription =
              newClient.subscribe(
                marketTopic,

                (message): void => {
                  if (
                    stopped ||
                    generation !== connectionGeneration ||
                    client !== newClient
                  ) {
                    return
                  }

                  try {
                    /**
                     * 使用現有 marketParser。
                     */
                    const event: MarketEvent =
                      parseMarketMessage(
                        marketTopic,
                        message.body,
                      )

                    /**
                     * 通知 Market Store。
                     */
                    onData(event)
                  } catch (error: unknown) {
                    console.error(
                      '[MarketSocket] 訊息解析失敗',
                      marketTopic,
                      error,
                    )
                  }
                },
              )

            subscriptions.push(subscription)
          }
        },

        /**
         * ----------------------------------------------------
         * STOMP ERROR
         * ----------------------------------------------------
         *
         * 如果明確包含 401 / 403 / expired / JWT，
         * 下次連線向 Token Manager 要求恢復認證。
         */
        onStompError: (frame): void => {
          if (
            stopped ||
            generation !== connectionGeneration ||
            client !== newClient
          ) {
            return
          }

          const description = [
            frame.headers.message ?? '',
            frame.body ?? '',
          ].join(' ')

          console.error(
            '[MarketSocket] STOMP ERROR',
            description,
          )

          if (isAuthenticationError(description)) {
            forceRefreshNext = true

            console.warn(
              '[MarketSocket] JWT 可能失效，下次連線將要求更新',
            )
          }

          updateStatus('error')

          /**
           * STOMP ERROR 不一定會讓底層 Socket 關閉。
           *
           * 主動停用 Client。
           *
           * 關閉完成後統一排程重新連線。
           */
          void newClient.deactivate().finally(() => {
            finishConnection(
              generation,
              newClient,
            )
          })
        },

        /**
         * ----------------------------------------------------
         * WebSocket 錯誤
         * ----------------------------------------------------
         *
         * onWebSocketError 不一定表示 JWT 過期。
         *
         * 網路中斷、Proxy、SockJS 握手問題，
         * 都可能觸發這個事件。
         */
        onWebSocketError: (error): void => {
          if (
            stopped ||
            generation !== connectionGeneration ||
            client !== newClient
          ) {
            return
          }

          console.error(
            '[MarketSocket] WebSocket 錯誤',
            error,
          )

          updateStatus('error')
        },

        /**
         * ----------------------------------------------------
         * WebSocket 關閉
         * ----------------------------------------------------
         *
         * 關閉後不重用目前 STOMP Client。
         *
         * 下次重連：
         * 重新取得 JWT → 建立新 SockJS。
         */
        onWebSocketClose: (event): void => {
          if (
            stopped ||
            generation !== connectionGeneration ||
            client !== newClient
          ) {
            return
          }

          console.warn(
            '[MarketSocket] WebSocket 已關閉',
            event.code,
            event.reason,
          )

          /**
           * 若收到明確的認證拒絕訊息，
           * 下一次重新取得 JWT。
           *
           * 1008 是 Policy Violation，
           * 不一定代表 JWT 失效，
           * 因此不單憑 1008 判斷。
           */
          if (
            isAuthenticationError(event.reason ?? '')
          ) {
            forceRefreshNext = true
          }

          finishConnection(
            generation,
            newClient,
          )
        },
      })

      /**
       * 將建立好的 Client 設為目前連線。
       */
      client = newClient

      /**
       * 啟動 STOMP Client。
       *
       * 後續成功／失敗透過 Callback 處理。
       */
      newClient.activate()

    } catch (error: unknown) {
      if (
        stopped ||
        generation !== connectionGeneration
      ) {
        return
      }

      console.error(
        '[MarketSocket] 連線準備失敗',
        error,
      )

      updateStatus('error')

    } finally {
      preparingConnection = false

      /**
       * 若連線準備階段失敗，
       * 沒有建立 Client，
       * 則排程重試。
       */
      if (!stopped && client === null) {
        scheduleReconnect()
      }
    }
  }

  /**
   * ----------------------------------------------------------
   * 完成一次連線的清理
   * ----------------------------------------------------------
   *
   * 防止 onStompError 和 onWebSocketClose
   * 同時觸發重複重連。
   */
  function finishConnection(
    generation: number,
    currentClient: Client,
  ): void {
    if (
      stopped ||
      generation !== connectionGeneration ||
      client !== currentClient
    ) {
      return
    }

    /**
     * 先移除 Client 引用，
     * 避免新連線被舊 Client 阻擋。
     */
    client = null

    clearSubscriptions()

    /**
     * 確保舊 Client 不再活動。
     */
    void currentClient.deactivate().catch(
      (error: unknown) => {
        console.warn(
          '[MarketSocket] 舊 STOMP Client 清理失敗',
          error,
        )
      },
    )

    /**
     * 等下一次重連時再向 Token Manager
     * 取得有效 JWT。
     */
    scheduleReconnect()
  }

  /**
   * ----------------------------------------------------------
   * 初次連線
   * ----------------------------------------------------------
   */
  void startConnection()

  /**
   * ==========================================================
   * 回傳 Socket Handle
   * ==========================================================
   */
  return {
    disconnect: async (): Promise<void> => {
      /**
       * 標記永久停止。
       *
       * 不再自動重連。
       */
      stopped = true

      /**
       * 讓所有未完成的 async callback 失效。
       */
      ++connectionGeneration

      /**
       * 清除重連 Timer。
       */
      clearReconnectTimer()

      /**
       * 保留目前 Client 的引用，
       * 再從 Service 狀態移除。
       */
      const currentClient = client

      client = null

      /**
       * 移除所有市場訂閱。
       */
      clearSubscriptions()

      /**
       * 關閉 WebSocket / STOMP。
       */
      if (currentClient) {
        try {
          await currentClient.deactivate()
        } catch (error: unknown) {
          console.error(
            '[MarketSocket] 斷線失敗',
            error,
          )
        }
      }

      console.info(
        '[MarketSocket] 已停止市場 WebSocket',
      )
    },
  }
}
