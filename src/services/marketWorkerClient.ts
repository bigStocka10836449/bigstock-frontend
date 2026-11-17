import { authTokenManager } from '@/services/authTokenManager'
import type { MarketEvent } from '@/types/market'
import { DEFAULT_STOCK_QUOTE_TOPIC, type DefaultStockQuotes } from '@/types/defaultStockQuotes'
import { ensureCsrfToken } from '@/services/csrfService'
import apiClient from '@/router/bstockAxios'
import type { PageToWorker, WorkerToPage, SharedMarketStatus } from '@/services/marketWorkerProtocol'

export interface MarketWorkerHandle {
  disconnect: () => void
  retry: () => void
}

export function connectMarketWorker(
  onData: (event: MarketEvent) => void,
  onStatus: (status: SharedMarketStatus) => void,
  onDefaultStockQuotes: (quotes: DefaultStockQuotes) => void,
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
    else if (message.type === 'DEFAULT_STOCK_QUOTES') onDefaultStockQuotes(message.quotes)
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
          const defaultQuotesAvailable = !error && await supportsDefaultStockQuotes()
          send({ type: 'SESSION_RESPONSE', requestId: message.requestId, error, defaultQuotesAvailable })
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

async function supportsDefaultStockQuotes(): Promise<boolean> {
  try {
    await ensureCsrfToken()
    const { data } = await apiClient.post<{ destination?: string }>(
      '/biz/marketQuotes/subscriptions',
      {},
      { timeout: 2500, skipAuthRefresh: true },
    )
    return data?.destination === DEFAULT_STOCK_QUOTE_TOPIC
  } catch {
    // An older Biz can reject the new topic and close the shared market connection.
    return false
  }
}
