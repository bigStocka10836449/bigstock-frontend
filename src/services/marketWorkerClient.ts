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
 * ============================================================
 * BigStock SharedWorker Client
 * ============================================================
 *
 * Each browser tab communicates with one SharedWorker.
 *
 * JWT is never transferred through MessagePort.
 */

export function connectMarketWorker(
  onData: (event: MarketEvent) => void,
  onStatus: (status: SharedMarketStatus) => void,
): MarketWorkerHandle {

  const worker = new SharedWorker(
    new URL(
      '../workers/market.shared-worker.ts',
      import.meta.url,
    ),
    {
      type: 'module',

      // Prevent mixing the old JWT protocol with
      // the new Cookie session protocol.
      name: 'bigstock-market-shared-v2',
    },
  )

  const port = worker.port

  let closed = false

  const sessionRequests = new Set<number>()

  function send(message: PageToWorker): void {
    if (!closed) {
      port.postMessage(message)
    }
  }

  /**
   * Messages from SharedWorker.
   */
  port.onmessage = event => {

    if (closed) return

    const message = event.data as WorkerToPage

    // ========================================================
    // 1. Market Event
    // ========================================================

    if (message.type === 'MARKET_EVENT') {

      onData(message.event)

      return
    }

    // ========================================================
    // 2. Socket Status
    // ========================================================

    if (message.type === 'STATUS') {

      onStatus(message.status)

      return
    }

    // ========================================================
    // 3. Prepare Cookie Session
    // ========================================================

    if (message.type === 'SESSION_REQUEST') {

      const requestId = message.requestId

      sessionRequests.add(requestId)

      void (async () => {

        try {

          if (message.forceRefresh) {

            /**
             * WebSocket authentication was rejected.
             *
             * Re-run original FCM verification.
             */
            await authTokenManager.refreshToken()

          } else {

            /**
             * Existing Cookie may still be valid.
             */
            await authTokenManager.ensureSession()
          }

          if (
            !closed &&
            sessionRequests.has(requestId)
          ) {

            send({
              type: 'SESSION_RESPONSE',
              requestId,
            })
          }

        } catch (error: unknown) {

          if (
            !closed &&
            sessionRequests.has(requestId)
          ) {

            send({
              type: 'SESSION_RESPONSE',
              requestId,

              error:
                error instanceof Error
                  ? error.message
                  : String(error),
            })
          }

        } finally {

          sessionRequests.delete(requestId)
        }
      })()
    }
  }

  port.start()

  send({
    type: 'HELLO',
  })

  /**
   * Keep the SharedWorker port alive.
   */
  const heartbeat = setInterval(() => {

    send({
      type: 'PING',
    })

  }, 20_000)

  return {

    retry(): void {

      send({
        type: 'RETRY',
      })
    },

    disconnect(): void {

      if (closed) return

      send({
        type: 'LEAVE',
      })

      closed = true

      clearInterval(heartbeat)

      sessionRequests.clear()

      port.onmessage = null

      port.close()
    },
  }
}
