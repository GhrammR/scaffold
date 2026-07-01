import type { LLMMessage } from '../llm/LLMProvider'
import type { CoverageStatus, Decision } from '../interview/types'

const STORAGE_KEY = 'scaffold:interviewSession'

export interface PersistedSession {
  messages: LLMMessage[]
  coverage: CoverageStatus[]
  decisions: Decision[]
  readyToGenerate: boolean
  doneWarning?: string
}

export function loadSession(): PersistedSession | null {
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as PersistedSession
  } catch {
    return null
  }
}

export function saveSession(session: PersistedSession): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

export function clearSession(): void {
  window.localStorage.removeItem(STORAGE_KEY)
}
