import { ref, onUnmounted } from 'vue'

export function useLocalStorageWithTTL<T>(key: string, defaultValue: T, ttlMs: number = 2 * 60 * 60 * 1000) {
  const now = Date.now()
  const raw = localStorage.getItem(key)
  const data = ref<T>(defaultValue)
  const isExpired = ref(false)

  function parseStorage() {
    try {
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed.value && parsed.expires) {
          if (now < parsed.expires) {
            data.value = parsed.value
            isExpired.value = false
          } else {
            isExpired.value = true
            localStorage.removeItem(key)
          }
        }
      }
    } catch {
      localStorage.removeItem(key)
    }
  }

  parseStorage()

  function save(newValue: T) {
    const wrapped = {
      value: newValue,
      expires: Date.now() + ttlMs,
    }
    localStorage.setItem(key, JSON.stringify(wrapped))
    data.value = newValue
    isExpired.value = false
  }

  function clear() {
    localStorage.removeItem(key)
    data.value = defaultValue
    isExpired.value = true
  }

  //定時檢查是否過期
  const interval = setInterval(() => {
    const stored = localStorage.getItem(key)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (parsed.expires && Date.now() > parsed.expires) {
          clear() // 自動過期清除
        }
      } catch {
        localStorage.removeItem(key)
      }
    }
  }, 10000) // 每 10 秒檢查一次

  onUnmounted(() => {
    clearInterval(interval)
  })

  return {
    data,
    isExpired,
    save,
    clear,
  }
}
