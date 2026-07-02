import type { LLMMessage } from '../llm/LLMProvider'
import type { CoverageStatus, Decision } from '../interview/types'
import type { GeneratedScaffold } from '../generation/types'
import type { RevisionHistoryEntry } from '../generation/useGeneration'

const STORAGE_KEY = 'scaffold:interviewSession'

export interface PersistedSession {
  messages: LLMMessage[]
  coverage: CoverageStatus[]
  decisions: Decision[]
  readyToGenerate: boolean
  doneWarning?: string
  generatedScaffold?: GeneratedScaffold
  revisionMessages?: LLMMessage[]
  revisionHistory?: RevisionHistoryEntry[]
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
