import axios from 'axios'

const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
})

// 判斷 token 是否即將過期（預設 15 分鐘內）
function isTokenExpiringSoon(bufferSeconds = 900): boolean {
  const expStr = localStorage.getItem('tokenExp');
  if (!expStr) return true;

  const exp = parseInt(expStr, 10);
  if (isNaN(exp)) return true;

  const now = Math.floor(Date.now() / 1000);
  return exp - now < bufferSeconds;
}

// 判斷是否為 GUEST
function isGuest(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    const role = payload?.role ?? payload?.roles?.[0]
    return role === 'GUEST'
  } catch {
    return false
  }
}

// 取得新的 GUEST token
async function fetchGuestToken(): Promise<string | null> {
  try {
    const resp = await axios.get('/api/guest-token')
    return `Bearer ${resp.data.token}`
  } catch {
    return null
  }
}

// 取得新的 USER token
async function refreshUserToken(token: string): Promise<string | null> {
  try {
    const resp = await axios.post(
      '/api/refresh-token',
      {},
      {
        headers: { Authorization: token },
      },
    )
    return `Bearer ${resp.data.accessToken}`
  } catch {
    return null
  }
}

// Request Interceptor：自動掛上 token，並檢查是否需要 refresh
apiClient.interceptors.request.use(
  async (config) => {
    if (config.url?.includes('/auth/login')) return config

    let token = localStorage.getItem('authToken')

    if (!token || isTokenExpiringSoon(900)) {
      // 需要刷新
      if (!token || isGuest(token)) {
        token = await fetchGuestToken()
      } else {
        token = await refreshUserToken(token)
      }

      if (token) localStorage.setItem('authToken', token)
    }

    if (token) {
      config.headers = config.headers || {}
      config.headers['Authorization'] = token
    }

    return config
  },
  (error) =>
    Promise.reject(error instanceof Error ? error : new Error(error?.message ?? 'Request error')),
)

// Response Interceptor：後端主動送 x-refreshed-token 時更新
apiClient.interceptors.response.use(
  (response) => {
    const refreshedToken = response.headers['x-refreshed-token']
    const exp = response.data?.exp
    if (refreshedToken) {
      localStorage.setItem('authToken', refreshedToken);
       if (exp) {
        localStorage.setItem('tokenExp', exp.toString());
      }
    }
    if (response.config.url?.includes('/auth/login') && response.data?.accessToken) {
      const loginToken = `Bearer ${response.data.accessToken}`
      localStorage.setItem('authToken', loginToken);
      if (exp) {
        localStorage.setItem('tokenExp', exp.toString())
      }
    }
    return response
  },
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(
        error instanceof Error ? error : new Error(error?.message ?? 'Unhandled request error'),
      )
    }

    originalRequest._retry = true
    let token = localStorage.getItem('authToken')

    if (!token || isGuest(token)) {
      token = await fetchGuestToken()
    } else {
      token = await refreshUserToken(token)
    }

    if (token) {
      localStorage.setItem('authToken', token)
      originalRequest.headers['Authorization'] = token
      return apiClient(originalRequest)
    }

    return Promise.reject(new Error('Token refresh failed'))
  },
)

export default apiClient
