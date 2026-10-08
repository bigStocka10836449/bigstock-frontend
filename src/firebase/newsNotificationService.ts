import type { MessagePayload } from 'firebase/messaging'
import { listenForForegroundMessages } from '@/firebase/fcm'
import { normalizeNews, parseNewsValue, type NewsItem } from '@/api/newsApi'

/**
 * 僅處理 FCM NEWS 訊息，忽略 DEVICE_VERIFY 等驗證訊息。
 * 不建立 Firebase App、不發送 Token、不額外建立 WebSocket。
 *
 * 實際訊息格式以現有後端 FCM payload.data 為準；
 * 對常見的 data JSON 字串及 Snapshot.data 內層 JSON 做相容解析。
 */
export function parseFcmNews(payload: MessagePayload): NewsItem[] {
  const message = payload.data
  if (message?.type !== 'NEWS') return []
  const source = message.source ?? ''
  // 推播 JSON 實際所在欄位需以瀏覽器收到的 payload 驗證。
  const raw = message.data
  return parseNewsValue(raw)
    .map(item => normalizeNews(item, source))
    .filter((item): item is NewsItem => item !== null)
}

/** 統一建立一條 NEWS 前景監聽；裝置驗證監聽仍交由既有流程管理。 */
export async function listenForNewsNotifications(
  onNews: (item: NewsItem) => void,
): Promise<() => void> {
  return listenForForegroundMessages((payload: MessagePayload) => {
    for (const item of parseFcmNews(payload)) onNews(item)
  })
}
