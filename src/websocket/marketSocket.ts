import { Client, type StompSubscription } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { MARKET_TOPICS, type MarketEvent, type MarketTopic } from '@/types/market'
import { parseMarketMessage } from '@/services/marketParser'

export interface MarketSocketHandle {
  disconnect: () => Promise<void>
}

/**
 * JWT 是 BigStock /auth/tempToken 核發的 JWT，不是 Firebase FCM token。
 * 使用 SockJS query parameter 是配合現有 JwtHandshakeInterceptor；
 * 此做法會將 JWT 放入 URL，正式環境建議改為短效 ticket / CONNECT 驗證。
 * 需實際確認 SockJS /ws/info 及各 transport 的握手是否通過。
 */
export function connectMarketSocket(
  getJwt: () => Promise<string>,
  onData: (event: MarketEvent) => void,
  onStatus?: (status: string) => void,
): MarketSocketHandle {
  let stopped = false
  let subscriptions: StompSubscription[] = []
  let client: Client | null = null
  let currentJwt = ''

  // 每次重連都重新讀取 JWT，避免使用過期的 Token
  const createClient = () => new Client({
    webSocketFactory: () => {
      const raw = currentJwt.replace(/^Bearer\s+/i, '').trim()
      if (!raw) throw new Error('尚未取得 BigStock Guest JWT')
      return new SockJS(`/ws?token=${encodeURIComponent(raw)}`)
    },
    reconnectDelay: 5000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    onConnect: () => {
      onStatus?.('connected')
      // reconnect 時重訂閱，以免訂閱遺失
      subscriptions = MARKET_TOPICS.map((topic: MarketTopic) =>
        client!.subscribe(topic, message => {
          try { onData(parseMarketMessage(topic, message.body)) }
          catch (error) { console.error('[MarketSocket] 訊息解析失敗', topic, error) }
        }),
      )
    },
    onWebSocketClose: () => { subscriptions = []; onStatus?.('disconnected') },
    onStompError: frame => { console.error('[MarketSocket] STOMP 錯誤', frame); onStatus?.('error') },
  })

  // FCM 驗證與 temp JWT 取得應由現有驗證流程完成，這裡不再實作另一套流程
  void getJwt().then(jwt => {
    if (stopped) return
    if (!jwt?.trim()) throw new Error('取得的 Guest JWT 為空')
    currentJwt = jwt
    client = createClient()
    client.activate()
  }).catch(error => { console.error('[MarketSocket] 初始化失敗', error); onStatus?.('error') })

  return {
    disconnect: async () => {
      stopped = true
      subscriptions.forEach(sub => sub.unsubscribe())
      subscriptions = []
      await client?.deactivate()
    },
  }
}
