import type { MarketEvent } from '@/types/market'
import type { WebStockQuote } from '@/types/webStockQuotes'
import type { DefaultStockQuotes } from '@/types/defaultStockQuotes'

export type SharedMarketStatus = 'connecting' | 'connected' | 'disconnected' | 'error' | 'replaced'
export type QuoteFeed = 'web' | 'default' | 'none'
export type PageToWorker =
  | { type: 'HELLO' }
  | { type: 'PING' }
  | { type: 'LEAVE' }
  | { type: 'SESSION_RESPONSE'; requestId: number; error?: string; quoteFeed: QuoteFeed }
  | { type: 'AUTH_CHANGED' }
  | { type: 'RETRY' }
export type WorkerToPage =
  | { type: 'STATUS'; status: SharedMarketStatus }
  | { type: 'MARKET_EVENT'; event: MarketEvent }
  | { type: 'DEFAULT_STOCK_QUOTES'; quotes: DefaultStockQuotes }
  | { type: 'WEB_STOCK_QUOTES'; quotes: WebStockQuote[] | null }
  | { type: 'SESSION_REQUEST'; requestId: number; forceRefresh: boolean }
  | { type: 'WORKER_READY'; clientCount: number }
