const STORAGE_KEY = 'scaffold:apiKey'

let inMemoryKey: string | null = null

export function getStoredKey(): string | null {
  const persisted = window.localStorage.getItem(STORAGE_KEY)
  if (persisted) return persisted
  return inMemoryKey
}

export function setStoredKey(key: string, remember: boolean): void {
  if (remember) {
    window.localStorage.setItem(STORAGE_KEY, key)
    inMemoryKey = null
  } else {
    inMemoryKey = key
    window.localStorage.removeItem(STORAGE_KEY)
  }
}

export function clearStoredKey(): void {
  inMemoryKey = null
  window.localStorage.removeItem(STORAGE_KEY)
}
