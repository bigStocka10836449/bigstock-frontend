import type { MarketEvent } from '@/types/market'

/** 分頁與 SharedWorker 的訊息契約；不經由 localStorage 傳遞即時行情。 */
export type SharedMarketStatus = 'connecting' | 'connected' | 'disconnected' | 'error' | 'replaced'

export type PageToWorker =
  | { type: 'HELLO' }
  | { type: 'PING' }
  | { type: 'LEAVE' }
  | { type: 'TOKEN_RESPONSE'; requestId: number; token?: string; error?: string }
  | { type: 'AUTH_CHANGED' }
  | { type: 'RETRY' }

export type WorkerToPage =
  | { type: 'STATUS'; status: SharedMarketStatus }
  | { type: 'MARKET_EVENT'; event: MarketEvent }
  | { type: 'TOKEN_REQUEST'; requestId: number; forceRefresh: boolean; rejectedToken?: string }
  | { type: 'WORKER_READY'; clientCount: number }
