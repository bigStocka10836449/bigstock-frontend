const SESSION_KEY = 'sessionData'
const DEFAULT_TTL = 10 * 60 * 1000 // 預設 TTL：10 分鐘

export const socketIoSessionManager = {
  set(sessionId: string, ttl = DEFAULT_TTL) {
    const expiresAt = Date.now() + ttl
    const data = { sessionId, expiresAt }
    localStorage.setItem(SESSION_KEY, JSON.stringify(data))
  },

  get() {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null

    try {
      const parsed = JSON.parse(raw)
      if (parsed.expiresAt > Date.now()) {
        return parsed.sessionId
      }
      this.clear()
      return null
    } catch (e) {
      console.warn('Session data parse error:', e)
      this.clear()
      return null
    }
  },

  clear() {
    localStorage.removeItem(SESSION_KEY)
  },
}
