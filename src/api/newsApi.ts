import apiClient from '@/router/bstockAxios'

/** 新聞網站原始的單則訊息，其他未使用欄位不需要額外宣告。 */
export interface NewsDataInfo {
  id?: string
  time?: string
  date?: string
  hms?: string
  important?: boolean | number
  data?: {
    title?: string
    content?: string
    source?: string
    source_link?: string
    pic?: string
  }
}

/** Redis Stream 事件：data.content 通常是 JSON 陣列字串。 */
export interface NewsStreamRecord {
  id?: string
  data?: {
    title?: string
    content?: string
    source?: string
    timestamp?: string
  }
}

/** 頁面與 Store 共用的已正規化新聞。 */
export interface NewsItem {
  id: string
  time: string
  title: string
  content: string
  source: string
  url: string
  important: boolean
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/**
 * 整理單則新聞，不猜測缺少的新聞 ID。
 * time 優先採用原始新聞發佈時間；若只有 date + hms，才合併兩者。
 */
export function normalizeNews(value: unknown, fallbackSource = ''): NewsItem | null {
  if (!isObject(value) || !isObject(value.data)) return null
  const body = value.data
  const id = asString(value.id)
  if (!id) return null

  const title = asString(body.title)
  const content = asString(body.content)
  if (!title && !content) return null

  const time = asString(value.time) || [asString(value.date), asString(value.hms)].filter(Boolean).join(' ')
  return {
    id,
    time,
    title,
    content,
    source: asString(body.source) || fallbackSource,
    url: asString(body.source_link),
    important: value.important === true || value.important === 1,
  }
}

/**
 * 前端自行排序、去重。
 * 原始格式 yyyy-MM-dd HH:mm:ss 使用字串排序即可得到正確時間順序。
 * 時間缺失時使用新聞 ID 做穩定的次排序，不偽造新聞時間。
 */
export function sortAndDeduplicateNews(items: NewsItem[]): NewsItem[] {
  const unique = new Map<string, NewsItem>()
  for (const item of items) {
    if (!unique.has(item.id)) unique.set(item.id, item)
  }
  return [...unique.values()].sort((a, b) => {
    const byTime = b.time.localeCompare(a.time)
    return byTime !== 0 ? byTime : b.id.localeCompare(a.id)
  })
}

/** 將字串、物件或陣列解析成原始新聞陣列。 */
export function parseNewsValue(value: unknown): NewsDataInfo[] {
  let parsed = value
  for (let depth = 0; depth < 4; depth++) {
    if (typeof parsed === 'string') {
      try { parsed = JSON.parse(parsed) } catch { return [] }
      continue
    }
    if (Array.isArray(parsed)) return parsed.filter(isObject) as NewsDataInfo[]
    if (isObject(parsed) && typeof parsed.id === 'string' && isObject(parsed.data)) {
      return [parsed as NewsDataInfo]
    }
    // 相容既有可能傳入的 Snapshot { data: '...' } 包裝。
    if (isObject(parsed) && 'data' in parsed) {
      parsed = parsed.data
      continue
    }
    break
  }
  return []
}

/** 解析歷史 Redis Stream 記錄。 */
export function parseNewsRecords(records: unknown): NewsItem[] {
  if (!Array.isArray(records)) return []
  const result: NewsItem[] = []
  for (const record of records as NewsStreamRecord[]) {
    const source = record.data?.source ?? ''
    for (const entry of parseNewsValue(record.data?.content)) {
      const item = normalizeNews(entry, source)
      if (item) result.push(item)
    }
  }
  return sortAndDeduplicateNews(result)
}

/**
 * 歷史新聞走 REST，不處理即時推播。
 * 注意：實際參數名稱與 Axios baseURL 須依目前後端設定核對。
 */
export async function getLatestNews(limit = 100): Promise<NewsItem[]> {
  const response = await apiClient.get<unknown>('/biz/allNews', { params: { limit } })
  return parseNewsRecords(response.data)
}
