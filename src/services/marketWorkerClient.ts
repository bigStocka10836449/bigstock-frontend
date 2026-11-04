import { authTokenManager } from '@/services/authTokenManager'
import type { MarketEvent } from '@/types/market'
import type { PageToWorker, WorkerToPage, SharedMarketStatus } from '@/services/marketWorkerProtocol'

export interface MarketWorkerHandle {
  disconnect: () => void
  retry: () => void
}

export function connectMarketWorker(
  onData: (event: MarketEvent) => void,
  onStatus: (status: SharedMarketStatus) => void,
): MarketWorkerHandle {
  const worker = new SharedWorker(new URL('../workers/market.shared-worker.ts', import.meta.url), {
    type: 'module',
    name: 'bigstock-market-turnstile-v3',
  })
  const port = worker.port
  let closed = false
  const outstanding = new Set<number>()
  const send = (message: PageToWorker): void => { if (!closed) port.postMessage(message) }

  port.onmessage = event => {
    if (closed) return
    const message = event.data as WorkerToPage
    if (message.type === 'MARKET_EVENT') onData(message.event)
    else if (message.type === 'STATUS') onStatus(message.status)
    else if (message.type === 'SESSION_REQUEST') {
      outstanding.add(message.requestId)
      void (async () => {
        let error: string | undefined
        try {
          if (message.forceRefresh) await authTokenManager.refreshToken()
          else await authTokenManager.ensureSession()
        } catch (e) { error = e instanceof Error ? e.message : String(e) }
        if (!closed && outstanding.has(message.requestId)) {
          send({ type: 'SESSION_RESPONSE', requestId: message.requestId, error })
        }
        outstanding.delete(message.requestId)
      })()
    }
  }
  port.start()
  send({ type: 'HELLO' })
  const heartbeat = setInterval(() => send({ type: 'PING' }), 20_000)
  return {
    retry: () => send({ type: 'RETRY' }),
    disconnect: () => {
      if (closed) return
      send({ type: 'LEAVE' })
      closed = true
      clearInterval(heartbeat)
      outstanding.clear()
      port.onmessage = null
      port.close()
    },
  }
}
