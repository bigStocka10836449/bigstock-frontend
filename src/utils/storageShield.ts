import LZString from 'lz-string'
import CryptoJS from 'crypto-js'

const STORAGE_KEYS = {
  stockInfo: 'k0',
  tokenExp: 'k1',
  authToken: 'k2',
} as const

// 注意：這只是模糊化，不是真正安全
const STORAGE_SECRET = 'B1gSt0ck@2026_local_cache_mask'

function encode(data: unknown): string {
  const json = JSON.stringify(data)
  const compressed = LZString.compressToUTF16(json)
  return CryptoJS.AES.encrypt(compressed, STORAGE_SECRET).toString()
}

function decode<T>(value: string | null): T | null {
  if (!value) return null

  try {
    const bytes = CryptoJS.AES.decrypt(value, STORAGE_SECRET)
    const decrypted = bytes.toString(CryptoJS.enc.Utf8)
    if (!decrypted) return null

    const json = LZString.decompressFromUTF16(decrypted)
    if (!json) return null

    return JSON.parse(json) as T
  } catch (error) {
    console.warn('[storageShield] decode failed:', error)
    return null
  }
}

export const storageShield = {
  setStockInfo(data: unknown) {
    localStorage.setItem(STORAGE_KEYS.stockInfo, encode(data))
    localStorage.removeItem('bigstock:stock-info:v2')
  },

  getStockInfo<T>() {
    const current = localStorage.getItem(STORAGE_KEYS.stockInfo)
    if (current !== null) return decode<T>(current)
    const legacy = localStorage.getItem('bigstock:stock-info:v2')
    if (!legacy) return null
    try {
      const value = JSON.parse(legacy) as T
      this.setStockInfo(value)
      localStorage.removeItem('bigstock:stock-info:v2')
      return value
    } catch { return null }
  },

  removeStockInfo() {
    localStorage.removeItem(STORAGE_KEYS.stockInfo)
    localStorage.removeItem('bigstock:stock-info:v2')
  },

  setTokenExp(data: unknown) {
    localStorage.setItem(STORAGE_KEYS.tokenExp, encode(data))
    localStorage.removeItem('tokenExp')
  },

  getTokenExp<T>() {
    const current = localStorage.getItem(STORAGE_KEYS.tokenExp)
    if (current !== null) return decode<T>(current)
    const legacy = localStorage.getItem('tokenExp')
    if (legacy === null) return null
    const value = Number(legacy)
    if (!Number.isFinite(value) || value <= 0) return null
    this.setTokenExp(value)
    localStorage.removeItem('tokenExp')
    return value as T
  },

  removeTokenExp() {
    localStorage.removeItem(STORAGE_KEYS.tokenExp)
    localStorage.removeItem('tokenExp')
  },

  setAuthToken(token: string) {
    localStorage.setItem(STORAGE_KEYS.authToken, encode(token))
    localStorage.removeItem('authToken')
  },

  getAuthToken() {
    const current = localStorage.getItem(STORAGE_KEYS.authToken)
    if (current !== null) return decode<string>(current)
    const legacy = localStorage.getItem('authToken')
    if (!legacy) return null
    this.setAuthToken(legacy)
    localStorage.removeItem('authToken')
    return legacy
  },

  removeAuthToken() {
    localStorage.removeItem(STORAGE_KEYS.authToken)
    localStorage.removeItem('authToken')
  },

  // 只供同源跨分頁事件監聽；不要把密文當成 Token 使用。
  authTokenStorageKey: STORAGE_KEYS.authToken,
  getAuthTokenFingerprint() {
    return localStorage.getItem(STORAGE_KEYS.authToken)
  },

  clearAll() {
    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key))
      ;['authToken', 'tokenExp', 'bigstock:stock-info:v2'].forEach((key) => localStorage.removeItem(key))
  },
}
