import bstockAxios from '@/router/bstockAxios'
import { ensureCsrfToken } from '@/services/csrfService'

interface WebQuoteSubscriptions {
  stockCodes: string[]
  visitorCreated?: boolean
}

interface WebQuoteSubscriptionLifetime {
  ttlSeconds: number
}

const SUBSCRIPTIONS_PATH = '/biz/marketQuotes/subscriptions/web'

async function writeSubscription<T>(write: () => Promise<T>): Promise<T> {
  const request = async () => {
    await ensureCsrfToken()
    return write()
  }
  // Serialize the first Cookie issuance across tabs on the same origin.
  if (navigator.locks) {
    return navigator.locks.request('bstock-web-quote-subscriptions', request)
  }
  return request()
}

export async function getWebQuoteSubscriptions(): Promise<WebQuoteSubscriptions> {
  const response = await bstockAxios.get<WebQuoteSubscriptions>(SUBSCRIPTIONS_PATH)
  return response.data
}

export function changeWebQuoteSubscription(
  stockCode: string,
  subscribed: boolean,
): Promise<WebQuoteSubscriptions> {
  return writeSubscription(async () => {
    const response = await bstockAxios.post<WebQuoteSubscriptions>(SUBSCRIPTIONS_PATH, {
      stock: stockCode,
      subscribed,
    })
    return response.data
  })
}

export function refreshWebQuoteSubscriptions(): Promise<WebQuoteSubscriptionLifetime> {
  return writeSubscription(async () => {
    const response = await bstockAxios.post<WebQuoteSubscriptionLifetime>(`${SUBSCRIPTIONS_PATH}/refresh`)
    return response.data
  })
}
