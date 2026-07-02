import { useCallback, useState } from 'react'
import type { LLMMessage, LLMProvider } from '../llm/LLMProvider'
import { LLMProviderError } from '../llm/LLMProvider'
import { INTERVIEW_TOOL, INTERVIEW_TOOL_NAME } from './interviewTool'
import { buildSystemPrompt } from './systemPrompt'
import type { CoverageStatus, Decision, InterviewTurn } from './types'
import { clearSession, loadSession, saveSession } from '../storage/sessionPersistence'

function persistInterviewFields(
  next: Pick<UseInterviewState, 'messages' | 'coverage' | 'decisions' | 'readyToGenerate' | 'doneWarning'>,
): void {
  const existing = loadSession()
  saveSession({ ...existing, ...next })
}

export type InterviewStatus = 'idle' | 'loading' | 'error'

export interface UseInterviewState {
  messages: LLMMessage[]
  coverage: CoverageStatus[]
  decisions: Decision[]
  readyToGenerate: boolean
  doneWarning?: string
  status: InterviewStatus
  errorMessage?: string
  started: boolean
}

function isInterviewTurn(input: unknown): input is InterviewTurn {
  if (typeof input !== 'object' || input === null) return false
  const candidate = input as Record<string, unknown>
  return (
    typeof candidate.message === 'string' &&
    Array.isArray(candidate.coverage) &&
    Array.isArray(candidate.decisions) &&
    typeof candidate.readyToGenerate === 'boolean'
  )
}

function initialState(): UseInterviewState {
  const persisted = loadSession()
  if (persisted) {
    return {
      messages: persisted.messages,
      coverage: persisted.coverage,
      decisions: persisted.decisions,
      readyToGenerate: persisted.readyToGenerate,
      doneWarning: persisted.doneWarning,
      status: 'idle',
      started: persisted.messages.length > 0,
    }
  }
  return {
    messages: [],
    coverage: [],
    decisions: [],
    readyToGenerate: false,
    status: 'idle',
    started: false,
  }
}

export function useInterview(provider: LLMProvider) {
  const [state, setState] = useState<UseInterviewState>(initialState)

  const persist = useCallback(persistInterviewFields, [])

  const runTurn = useCallback(
    async (nextMessages: LLMMessage[], attempt = 0): Promise<void> => {
      setState((prev) => ({ ...prev, status: 'loading', errorMessage: undefined }))
      try {
        const response = await provider.complete({
          system: buildSystemPrompt(),
          messages: nextMessages,
          tools: [INTERVIEW_TOOL],
          toolChoice: { type: 'tool', name: INTERVIEW_TOOL_NAME },
        })

        if (!response.toolUse || !isInterviewTurn(response.toolUse.input)) {
          if (attempt === 0) {
            await runTurn(nextMessages, 1)
            return
          }
          setState((prev) => ({
            ...prev,
            status: 'error',
            errorMessage: 'The model returned an unexpected response. Please try again.',
          }))
          return
        }

        const turn = response.toolUse.input
        const updatedMessages: LLMMessage[] = [...nextMessages, { role: 'assistant', content: turn.message }]

        const nextState = {
          messages: updatedMessages,
          coverage: turn.coverage,
          decisions: turn.decisions,
          readyToGenerate: turn.readyToGenerate,
          doneWarning: turn.doneWarning,
        }
        persist(nextState)
        setState((prev) => ({
          ...prev,
          ...nextState,
          status: 'idle',
          started: true,
        }))
      } catch (error) {
        const message =
          error instanceof LLMProviderError ? error.message : 'Something went wrong. Please try again.'
        setState((prev) => ({ ...prev, status: 'error', errorMessage: message }))
      }
    },
    [provider, persist],
  )

  const start = useCallback(
    (description: string) => {
      const nextMessages: LLMMessage[] = [{ role: 'user', content: description }]
      setState((prev) => ({ ...prev, messages: nextMessages, started: true }))
      void runTurn(nextMessages)
    },
    [runTurn],
  )

  const sendMessage = useCallback(
    (text: string) => {
      const nextMessages: LLMMessage[] = [...state.messages, { role: 'user', content: text }]
      setState((prev) => ({ ...prev, messages: nextMessages }))
      void runTurn(nextMessages)
    },
    [state.messages, runTurn],
  )

  const requestStopEarly = useCallback(() => {
    sendMessage("I'd like to stop here and generate now.")
  }, [sendMessage])

  const dismissError = useCallback(() => {
    setState((prev) => ({ ...prev, status: 'idle', errorMessage: undefined }))
  }, [])

  const retry = useCallback(() => {
    void runTurn(state.messages)
  }, [state.messages, runTurn])

  const startOver = useCallback(() => {
    clearSession()
    setState(initialState())
  }, [])

  return { state, start, sendMessage, requestStopEarly, dismissError, retry, startOver }
}
