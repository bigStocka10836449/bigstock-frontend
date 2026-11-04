import axios from 'axios'
import { httpClientConfig } from './httpClientConfig'

const csrfClient = axios.create(httpClientConfig)
let inFlight: Promise<void> | null = null

/** Do not cache successful initialization forever: cookies can expire or be deleted. */
export function ensureCsrfToken(): Promise<void> {
  if (inFlight) return inFlight
  const task = csrfClient.get('/auth/csrf', {
    headers: { 'Cache-Control': 'no-cache' },
  }).then(() => undefined)
  inFlight = task
  void task.finally(() => {
    if (inFlight === task) inFlight = null
  }).catch(() => undefined)
  return task
}
