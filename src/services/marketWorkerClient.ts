import { authTokenManager } from '@/services/authTokenManager'
import type { MarketEvent } from '@/types/market'
import type {
  PageToWorker,
  WorkerToPage,
  SharedMarketStatus,
} from '@/services/marketWorkerProtocol'

export interface MarketWorkerHandle {
  disconnect: () => void
  retry: () => void
}

/**
 * 每個分頁只連 SharedWorker 的 MessagePort，不自行建立 STOMP 連線。
 * localStorage 與 FCM 邏輯仍在 Vue 頁面執行。
 */
export function connectMarketWorker(
  onData: (event: MarketEvent) => void,
  onStatus: (status: SharedMarketStatus) => void,
): MarketWorkerHandle {
  const worker = new SharedWorker(new URL('../workers/market.shared-worker.ts', import.meta.url), {
    type: 'module',
    name: 'bigstock-market-shared-v1',
  })
  const port = worker.port
  let closed = false
  let authFingerprint = localStorage.getItem('authToken')

  const send = (message: PageToWorker): void => {
    if (!closed) port.postMessage(message)
  }

  const tokenRequests = new Map<number, true>()

  port.onmessage = (event) => {
    if (closed) return
    const message = event.data as WorkerToPage
    if (message.type === 'MARKET_EVENT') onData(message.event)
    else if (message.type === 'STATUS') onStatus(message.status)
    else if (message.type === 'TOKEN_REQUEST') {
      tokenRequests.set(message.requestId, true)
      void (async () => {
        try {
          const token = message.forceRefresh
            ? await authTokenManager.recoverRejectedToken(message.rejectedToken)
            : await authTokenManager.getValidToken()
          if (!closed && tokenRequests.has(message.requestId)) {
            send({ type: 'TOKEN_RESPONSE', requestId: message.requestId, token })
          }
        } catch (error) {
          if (!closed && tokenRequests.has(message.requestId)) {
            send({
              type: 'TOKEN_RESPONSE',
              requestId: message.requestId,
              error: error instanceof Error ? error.message : String(error),
            })
          }
        } finally {
          tokenRequests.delete(message.requestId)
          authFingerprint = localStorage.getItem('authToken')
        }
      })()
    }
  }
  port.start()
  send({ type: 'HELLO' })

  // Worker 用這個心跳辨識已關閉的分頁；不牽涉市場資料取樣。
  const heartbeat = setInterval(() => send({ type: 'PING' }), 20_000)

  const onStorage = (event: StorageEvent): void => {
    if (event.key === 'authToken' && event.newValue !== authFingerprint) {
      authFingerprint = event.newValue
      send({ type: 'AUTH_CHANGED' })
    }
  }
  window.addEventListener('storage', onStorage)

  // 同一分頁登入/登出時，storage event 不會觸發；以焦點事件補查。
  const onFocus = (): void => {
    const current = localStorage.getItem('authToken')
    if (current !== authFingerprint) {
      authFingerprint = current
      send({ type: 'AUTH_CHANGED' })
    }
  }
  window.addEventListener('focus', onFocus)

  return {
    retry: () => send({ type: 'RETRY' }),
    disconnect: () => {
      if (closed) return
      send({ type: 'LEAVE' })
      closed = true
      clearInterval(heartbeat)
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('focus', onFocus)
      tokenRequests.clear()
      port.onmessage = null
      port.close()
    },
  }
}
