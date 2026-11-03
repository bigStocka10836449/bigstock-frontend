import type { MarketEvent } from '@/types/market'

/**
 * SharedWorker connection status.
 */
export type SharedMarketStatus =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error'
  | 'replaced'

/**
 * Vue Page -> SharedWorker
 */
export type PageToWorker =
  | {
    type: 'HELLO'
  }
  | {
    type: 'PING'
  }
  | {
    type: 'LEAVE'
  }
  | {
    type: 'SESSION_RESPONSE'
    requestId: number
    error?: string
  }
  | {
    type: 'AUTH_CHANGED'
  }
  | {
    type: 'RETRY'
  }

/**
 * SharedWorker -> Vue Page
 */
export type WorkerToPage =
  | {
    type: 'STATUS'
    status: SharedMarketStatus
  }
  | {
    type: 'MARKET_EVENT'
    event: MarketEvent
  }
  | {
    type: 'SESSION_REQUEST'
    requestId: number
    forceRefresh: boolean
  }
  | {
    type: 'WORKER_READY'
    clientCount: number
  }
