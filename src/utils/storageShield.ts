import LZString from 'lz-string'

/**
 * BigStock Public Stock Data Cache
 *
 * JWT authentication is handled by HttpOnly Cookie.
 *
 * Do not store access tokens here.
 */

const STORAGE_KEYS = {
  stockInfo: 'k0',
} as const

function encode(data: unknown): string {
  return LZString.compressToUTF16(
    JSON.stringify(data),
  )
}

function decode<T>(value: string | null): T | null {
  if (!value) return null

  try {
    const json = LZString.decompressFromUTF16(value)

    if (!json) return null

    return JSON.parse(json) as T

  } catch {
    return null
  }
}

export const storageShield = {

  setStockInfo(data: unknown): void {
    localStorage.setItem(
      STORAGE_KEYS.stockInfo,
      encode(data),
    )

    localStorage.removeItem(
      'bigstock:stock-info:v2',
    )
  },

  getStockInfo<T>(): T | null {
    return decode<T>(
      localStorage.getItem(STORAGE_KEYS.stockInfo),
    )
  },

  removeStockInfo(): void {
    localStorage.removeItem(
      STORAGE_KEYS.stockInfo,
    )

    localStorage.removeItem(
      'bigstock:stock-info:v2',
    )
  },

  /**
   * Clear legacy JWT data.
   */
  clearLegacyAuth(): void {
    localStorage.removeItem('k1')
    localStorage.removeItem('k2')

    localStorage.removeItem('authToken')
    localStorage.removeItem('tokenExp')
  },
}
