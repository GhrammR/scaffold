import { beforeEach, describe, expect, it } from 'vitest'
import { clearStoredKey, getStoredKey, setStoredKey } from './keyStorage'

describe('keyStorage', () => {
  beforeEach(() => {
    clearStoredKey()
  })

  it('returns null when nothing is stored', () => {
    expect(getStoredKey()).toBeNull()
  })

  it('persists to localStorage when remember is true', () => {
    setStoredKey('sk-ant-remember', true)
    expect(window.localStorage.getItem('scaffold:apiKey')).toBe('sk-ant-remember')
    expect(getStoredKey()).toBe('sk-ant-remember')
  })

  it('keeps the key in memory only when remember is false', () => {
    setStoredKey('sk-ant-session', false)
    expect(window.localStorage.getItem('scaffold:apiKey')).toBeNull()
    expect(getStoredKey()).toBe('sk-ant-session')
  })

  it('clearStoredKey removes both localStorage and in-memory key', () => {
    setStoredKey('sk-ant-remember', true)
    clearStoredKey()
    expect(getStoredKey()).toBeNull()

    setStoredKey('sk-ant-session', false)
    clearStoredKey()
    expect(getStoredKey()).toBeNull()
  })

  it('prefers a persisted key over an in-memory one', () => {
    setStoredKey('sk-ant-session', false)
    setStoredKey('sk-ant-remember', true)
    expect(getStoredKey()).toBe('sk-ant-remember')
  })
})
