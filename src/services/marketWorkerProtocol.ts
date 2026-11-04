import type { MarketEvent } from '@/types/market'

export type SharedMarketStatus = 'connecting' | 'connected' | 'disconnected' | 'error' | 'replaced'
export type PageToWorker =
  | { type: 'HELLO' }
  | { type: 'PING' }
  | { type: 'LEAVE' }
  | { type: 'SESSION_RESPONSE'; requestId: number; error?: string }
  | { type: 'AUTH_CHANGED' }
  | { type: 'RETRY' }
export type WorkerToPage =
  | { type: 'STATUS'; status: SharedMarketStatus }
  | { type: 'MARKET_EVENT'; event: MarketEvent }
  | { type: 'SESSION_REQUEST'; requestId: number; forceRefresh: boolean }
  | { type: 'WORKER_READY'; clientCount: number }
