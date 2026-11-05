import apiClient from '@/router/bstockAxios'

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

export interface NewsStreamRecord {
  id: string
  data?: {
    title?: string
    content?: string
    source?: string
    timestamp?: string
  }
}

export interface NewsItem {
  id: string
  time: string
  title: string
  content: string
  source: string
  url: string
  important: boolean
}

const STREAM_ID_PATTERN = /^\d+-\d+$/

export function compareStreamIds(a: string, b: string): number {
  const [aTime = '0', aSequence = '0'] = a.split('-')
  const [bTime = '0', bSequence = '0'] = b.split('-')
  const timeDiff = BigInt(aTime) - BigInt(bTime)
  if (timeDiff !== 0n) return timeDiff > 0n ? 1 : -1
  const sequenceDiff = BigInt(aSequence) - BigInt(bSequence)
  return sequenceDiff === 0n ? 0 : sequenceDiff > 0n ? 1 : -1
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export function normalizeNews(value: unknown, fallbackSource = ''): NewsItem | null {
  if (!isObject(value) || !isObject(value.data)) return null
  const body = value.data
  const id = asString(value.id)
  if (!id) return null
  const title = asString(body.title)
  const content = asString(body.content)
  if (!title && !content) return null
  return {
    id,
    time: asString(value.time) || [asString(value.date), asString(value.hms)].filter(Boolean).join(' '),
    title,
    content,
    source: asString(body.source) || fallbackSource,
    url: asString(body.source_link),
    important: value.important === true || value.important === 1,
  }
}

export function sortAndDeduplicateNews(items: NewsItem[]): NewsItem[] {
  const unique = new Map<string, NewsItem>()
  for (const item of items) if (!unique.has(item.id)) unique.set(item.id, item)
  return [...unique.values()].sort((a, b) => {
    const byTime = b.time.localeCompare(a.time)
    return byTime !== 0 ? byTime : b.id.localeCompare(a.id)
  })
}

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
    if (isObject(parsed) && 'data' in parsed) {
      parsed = parsed.data
      continue
    }
    break
  }
  return []
}

export function parseNewsRecords(records: NewsStreamRecord[]): NewsItem[] {
  const items: NewsItem[] = []
  for (const record of records) {
    for (const value of parseNewsValue(record.data?.content)) {
      const item = normalizeNews(value, record.data?.source ?? '')
      if (item) items.push(item)
    }
  }
  return sortAndDeduplicateNews(items)
}

function validateRecords(value: unknown): NewsStreamRecord[] {
  if (!Array.isArray(value)) throw new Error('Unexpected news API response: expected an array')
  return value.map((entry): NewsStreamRecord => {
    if (!isObject(entry) || typeof entry.id !== 'string' || !STREAM_ID_PATTERN.test(entry.id)) {
      throw new Error('Unexpected Redis Stream record ID')
    }
    if (entry.data !== undefined && !isObject(entry.data)) {
      throw new Error('Unexpected Redis Stream record data')
    }
    return entry as unknown as NewsStreamRecord
  })
}

/** /allNews: backend returns up to the most recent 31 Stream records. */
export async function getInitialNewsRecords(): Promise<NewsStreamRecord[]> {
  const response = await apiClient.get<unknown>('/biz/allNews')
  return validateRecords(response.data)
}

/** /newsSince: backend must return records with ID > afterId, oldest first, max 31 per response. */
export async function getNewsSince(afterId: string): Promise<NewsStreamRecord[]> {
  const response = await apiClient.get<unknown>('/biz/newsSince', {
    params: { afterId },
  })
  return validateRecords(response.data)
}

/** Convenience wrapper for any older consumer of getLatestNews(). */
export async function getLatestNews(_limit = 31): Promise<NewsItem[]> {
  return parseNewsRecords(await getInitialNewsRecords())
}
