import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { connectMarketSocket, type MarketSocketHandle } from '@/services/marketSocket'

import { getUSMarketHistory } from '@/api/marketHistoryApi'

import { parseAllMarketHistories, type MarketHistory } from '@/utils/marketHistoryParser'

import { adaptMarketEvent, type LiveQuote } from '@/utils/marketEventAdapter'

import { authTokenManager } from '@/services/authTokenManager'

import type { MarketEvent } from '@/types/market'

/**
 * ============================================================
 * BigStock - Market Store
 * ============================================================
 *
 * 功能：
 *
 * 1. 管理六個市場的歷史日 K 棒
 * 2. 管理 WebSocket 即時市場行情
 * 3. 管理目前選擇的市場
 * 4. 管理 WebSocket 連線狀態
 * 5. 管理歷史資料載入、快取與錯誤狀態
 * 6. 共用 WebSocket，避免重複建立連線
 *
 * 資料來源：
 *
 * REST API：
 * GET /market/USHistory
 *
 * 實際請求 URL 由 bstockAxios.ts
 * 的 baseURL 與 Proxy 設定決定。
 *
 * WebSocket：
 * 使用既有 connectMarketSocket()
 *
 * JWT：
 * 統一交由 authTokenManager 管理。
 *
 * Market Store 不負責：
 * - 直接存取 localStorage.authToken
 * - JWT exp 檢查
 * - FCM 裝置驗證
 * - /auth/tempToken
 * - JWT 自動刷新
 *
 * ------------------------------------------------------------
 * 認證流程：
 *
 * marketStore
 *      |
 *      v
 * authTokenManager
 *      |
 *      +-- 有效 JWT -> 直接使用
 *      |
 *      +-- 即將過期 -> 更新 Guest JWT
 *      |
 *      +-- 後端拒絕 -> 重新取得 JWT
 *
 * ------------------------------------------------------------
 * 歷史行情：
 *
 * marketStore
 *      |
 *      v
 * marketHistoryApi
 *      |
 *      v
 * bstockAxios Request Interceptor
 *      |
 *      v
 * authTokenManager
 *
 * ------------------------------------------------------------
 * 即時行情：
 *
 * marketStore
 *      |
 *      v
 * marketSocket
 *      |
 *      v
 * authTokenManager
 *      |
 *      v
 * SockJS / STOMP
 * ============================================================
 */

/**
 * ============================================================
 * 支援的六個市場
 * ============================================================
 *
 * 這些代碼與後端 USHistoryResponse 的
 * Map<String, String> Key 保持一致。
 */
export const MARKETS = [
  {
    symbol: 'WTX00',
    label: '台指期現貨',
    region: '台灣',
  },
  {
    symbol: 'WTX&',
    label: '台指期',
    region: '台灣',
  },
  {
    symbol: '^SOX',
    label: '費城半導體',
    region: '美國',
  },
  {
    symbol: 'MES=F',
    label: '微型標普 500 期貨',
    region: '美國',
  },
  {
    symbol: 'MYM=F',
    label: '微型道瓊期貨',
    region: '美國',
  },
  {
    symbol: 'MNQ=F',
    label: '微型那斯達克 100 期貨',
    region: '美國',
  },
] as const

/**
 * 市場代碼聯合型別。
 *
 * 'WTX00'
 * | 'WTX&'
 * | '^SOX'
 * | 'MES=F'
 * | 'MYM=F'
 * | 'MNQ=F'
 */
export type MarketSymbol = (typeof MARKETS)[number]['symbol']

/**
 * WebSocket 連線狀態。
 *
 * 對應 MarketLiveView.vue 中的
 * connectionText / connectionClass。
 */
export type MarketSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

/**
 * ============================================================
 * Market Pinia Store
 * ============================================================
 */
export const useMarketStore = defineStore('market', () => {
  /**
   * --------------------------------------------------------
   * 歷史日 K 棒
   * --------------------------------------------------------
   *
   * Key：
   * 市場代碼，例如 'MES=F'
   *
   * Value：
   * 市場歷史資料與 MarketCandle[]
   *
   * 使用 Record 儲存六個市場，
   * 切換市場時不用重新呼叫 REST API。
   */
  const histories = ref<Record<string, MarketHistory>>({})

  /**
   * --------------------------------------------------------
   * WebSocket 即時行情
   * --------------------------------------------------------
   *
   * Key：
   * 市場代碼
   *
   * Value：
   * 最新 LiveQuote
   *
   * 每次收到市場推播時，
   * 只更新對應的市場資料。
   */
  const live = ref<Record<string, LiveQuote>>({})

  /**
   * --------------------------------------------------------
   * 歷史資料載入狀態
   * --------------------------------------------------------
   */
  const historyLoading = ref<boolean>(false)

  const historyLoaded = ref<boolean>(false)

  const historyError = ref<string>('')

  /**
   * --------------------------------------------------------
   * WebSocket 連線狀態
   * --------------------------------------------------------
   */
  const socketStatus = ref<MarketSocketStatus>('disconnected')

  /**
   * --------------------------------------------------------
   * 目前選擇的市場
   * --------------------------------------------------------
   *
   * 預設：
   * WTX00
   */
  const selected = ref<MarketSymbol>('WTX00')

  /**
   * --------------------------------------------------------
   * Computed：目前市場的歷史 K 棒
   * --------------------------------------------------------
   *
   * MarketLiveView 只需要讀取
   * currentHistory，不需要自己從 histories
   * 查找市場代碼。
   */
  const currentHistory = computed<MarketHistory | null>(() => {
    return histories.value[selected.value] ?? null
  })

  /**
   * --------------------------------------------------------
   * Computed：目前市場的即時行情
   * --------------------------------------------------------
   */
  const currentLive = computed<LiveQuote | null>(() => {
    return live.value[selected.value] ?? null
  })

  /**
   * ========================================================
   * 非響應式內部狀態
   * ========================================================
   *
   * Promise / Socket Handle
   * 不需要讓 Vue 進行深度響應式追蹤。
   */

  /**
   * 正在執行的歷史資料載入工作。
   *
   * 避免多個元件同時呼叫 API。
   */
  let loadPromise: Promise<void> | null = null

  /**
   * 目前使用中的 WebSocket Handle。
   */
  let socket: MarketSocketHandle | null = null

  /**
   * WebSocket 使用者數量。
   *
   * 多個元件若同時使用市場資料，
   * 可以共用同一條連線。
   */
  let users = 0

  /**
   * WebSocket 版本號。
   *
   * 避免舊連線的 callback
   * 更新新連線的市場狀態。
   */
  let socketGeneration = 0

  /**
   * ========================================================
   * 載入市場歷史日 K 棒
   * ========================================================
   *
   * force = false：
   * 已成功載入時使用既有快取。
   *
   * force = true：
   * 強制重新呼叫後端 API。
   *
   * 多個元件同時要求載入時，
   * 共用同一個 Promise。
   *
   * --------------------------------------------------------
   * JWT：
   *
   * 不在 Store 呼叫 getValidToken()。
   *
   * 因為 marketHistoryApi.ts 使用的
   * bstockAxios.ts 已經具備 Request Interceptor。
   *
   * 每次 REST API Request，
   * Axios 都會向 authTokenManager
   * 取得有效 JWT。
   * ========================================================
   */
  async function loadHistories(force: boolean = false): Promise<void> {
    /**
     * 已有載入工作正在執行，
     * 直接共用。
     */
    if (loadPromise) {
      return loadPromise
    }

    /**
     * 已載入成功且不要求強制更新，
     * 不再重複呼叫 REST API。
     */
    if (historyLoaded.value && !force) {
      return
    }

    historyLoading.value = true
    historyError.value = ''

    const task = (async (): Promise<void> => {
      try {
        /**
         * --------------------------------------------------
         * 呼叫後端取得六個市場歷史資料
         * --------------------------------------------------
         *
         * JWT 由 Axios 自動處理。
         *
         * 不再：
         * await getExistingJwt()
         */
        const response = await getUSMarketHistory()

        /**
         * --------------------------------------------------
         * 將後端原始 JSON 統一轉換
         * --------------------------------------------------
         *
         * 支援：
         * - Yahoo chart.result[0]
         * - WTX00 陣列 chart
         * - JSON 字串包裝
         *
         * 輸出：
         * Record<string, MarketHistory>
         */
        const parsed = parseAllMarketHistories(response.usHistory ?? {})

        /**
         * 更新所有市場的歷史 K 棒。
         */
        histories.value = parsed

        /**
         * 紀錄已成功執行 API 及解析流程。
         */
        historyLoaded.value = true

        console.info('[Market] 歷史行情載入完成', Object.keys(parsed))
      } catch (error: unknown) {
        console.error('[Market] 歷史行情載入失敗', error)

        /**
         * 強制刷新失敗時，
         * 不清空舊資料。
         *
         * 使用者仍可查看之前成功載入的 K 棒。
         */
        historyError.value = '歷史日 K 資料讀取失敗，請檢查網路、JWT 與 API 路徑。'
      } finally {
        historyLoading.value = false
      }
    })()

    loadPromise = task

    try {
      await task
    } finally {
      if (loadPromise === task) {
        loadPromise = null
      }
    }
  }

  /**
   * ========================================================
   * 啟動市場 WebSocket
   * ========================================================
   *
   * 使用：
   *
   * connectMarketSocket(
   *   getJwt,
   *   onData,
   *   onStatus,
   * )
   *
   * --------------------------------------------------------
   * JWT 統一管理：
   *
   * 正常連線：
   * authTokenManager.getValidToken()
   *
   * 認證失敗：
   * authTokenManager.recoverRejectedToken()
   *
   * --------------------------------------------------------
   * Market Store 不再：
   *
   * - 讀取 localStorage.authToken
   * - 檢查 JWT exp
   * - 等待 80 次 JWT
   * - 呼叫 /auth/tempToken
   *
   * JWT 的重新取得與有效期限檢查
   * 全部交給 authTokenManager。
   * ========================================================
   */
  function mountSocket(): void {
    /**
     * 增加目前使用 Socket 的元件數量。
     */
    users += 1

    /**
     * 已有 WebSocket：
     * 直接共用，不重複建立。
     */
    if (socket) {
      return
    }

    socketStatus.value = 'connecting'

    /**
     * 每次新建 Socket，
     * 產生新的 generation。
     */
    const generation = ++socketGeneration

    /**
     * ------------------------------------------------------
     * 建立市場 WebSocket
     * ------------------------------------------------------
     */
    socket = connectMarketSocket(
      /**
       * 所有 JWT 都透過統一的
       * authTokenManager 管理。
       */
      (forceRefresh: boolean = false, rejectedJwt?: string): Promise<string> => {
        if (forceRefresh) {
          return authTokenManager.recoverRejectedToken(rejectedJwt)
        }

        return authTokenManager.getValidToken()
      },

      /**
       * 收到即時市場行情。
       */
      (event: MarketEvent): void => {
        if (generation !== socketGeneration) {
          return
        }

        try {
          const quote: LiveQuote | null = adaptMarketEvent(event)

          if (quote) {
            live.value[quote.symbol] = quote
          }
        } catch (error: unknown) {
          console.error('[Market] 即時行情處理失敗', error)
        }
      },

      /**
       * 接收 WebSocket 狀態。
       */
      (status: string): void => {
        if (generation !== socketGeneration) {
          return
        }

        if (
          status === 'connecting' ||
          status === 'connected' ||
          status === 'disconnected' ||
          status === 'error'
        ) {
          socketStatus.value = status
        }
      },
    )
  }

  /**
   * ========================================================
   * 解除市場 WebSocket
   * ========================================================
   *
   * 每個使用者離開頁面時，
   * users 減一。
   *
   * 只有最後一個使用者離開，
   * 才真正關閉 WebSocket。
   *
   * --------------------------------------------------------
   * 避免：
   *
   * - 切換頁面時重複建立連線
   * - 舊 Socket callback 覆蓋新資料
   * - 舊 STOMP 訂閱持續存在
   * ========================================================
   */
  async function unmountSocket(): Promise<void> {
    /**
     * 避免 users 出現負數。
     */
    users = Math.max(0, users - 1)

    /**
     * 還有其他使用者，
     * 保留 WebSocket。
     */
    if (users > 0) {
      return
    }

    /**
     * 沒有 WebSocket 可關閉。
     */
    if (!socket) {
      socketStatus.value = 'disconnected'
      return
    }

    /**
     * 取得目前 Socket。
     */
    const currentSocket = socket

    /**
     * 先清空引用。
     *
     * 如果新的頁面在舊連線關閉期間掛載，
     * 可以建立新的 WebSocket。
     */
    socket = null

    /**
     * 讓目前 Socket 版本失效。
     *
     * 即使舊連線後續收到 callback，
     * 也不能影響新 Socket。
     */
    ++socketGeneration

    socketStatus.value = 'disconnected'

    try {
      /**
       * 解除 STOMP 訂閱，
       * 並停用 WebSocket。
       */
      await currentSocket.disconnect()
    } catch (error: unknown) {
      console.error('[Market] WebSocket 關閉失敗', error)
    }
  }

  /**
   * ========================================================
   * Store 對外介面
   * ========================================================
   *
   * MarketLiveView.vue 可以使用：
   *
   * const store = useMarketStore()
   *
   * const {
   *   selected,
   *   currentHistory,
   *   currentLive,
   *   historyLoading,
   *   historyError,
   *   socketStatus,
   * } = storeToRefs(store)
   *
   * store.mountSocket()
   * store.loadHistories()
   * store.unmountSocket()
   * ========================================================
   */
  return {
    /**
     * 所有市場歷史資料。
     */
    histories,

    /**
     * 所有市場即時行情。
     */
    live,

    /**
     * 目前選擇的市場。
     */
    selected,

    /**
     * 選取市場的歷史資料。
     */
    currentHistory,

    /**
     * 選取市場的即時行情。
     */
    currentLive,

    /**
     * 歷史資料載入狀態。
     */
    historyLoading,

    historyLoaded,

    historyError,

    /**
     * WebSocket 連線狀態。
     */
    socketStatus,

    /**
     * 載入或刷新歷史 K 棒。
     */
    loadHistories,

    /**
     * 啟動／共用 WebSocket。
     */
    mountSocket,

    /**
     * 解除 WebSocket 使用。
     */
    unmountSocket,
  }
})
