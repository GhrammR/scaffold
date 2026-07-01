import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useInterview } from './useInterview'
import type { LLMProvider, LLMResponse } from '../llm/LLMProvider'
import { LLMProviderError } from '../llm/LLMProvider'
import { INTERVIEW_TOOL_NAME } from './interviewTool'
import type { InterviewTurn } from './types'

function fakeProvider(responses: (InterviewTurn | Error)[]): LLMProvider {
  let call = 0
  return {
    complete: vi.fn(async (): Promise<LLMResponse> => {
      const next = responses[Math.min(call, responses.length - 1)]
      call += 1
      if (next instanceof Error) throw next
      return { toolUse: { name: INTERVIEW_TOOL_NAME, input: next } }
    }),
  }
}

const turn = (overrides: Partial<InterviewTurn> = {}): InterviewTurn => ({
  message: 'What are you building?',
  coverage: [{ areaId: 'project-summary', label: 'Project summary', status: 'open' }],
  decisions: [],
  readyToGenerate: false,
  ...overrides,
})

describe('useInterview', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('starts an interview and grows the message history from a scripted response', async () => {
    const provider = fakeProvider([turn()])
    const { result } = renderHook(() => useInterview(provider))

    act(() => {
      result.current.start('A recipe app')
    })

    await waitFor(() => expect(result.current.state.status).toBe('idle'))

    expect(result.current.state.messages).toEqual([
      { role: 'user', content: 'A recipe app' },
      { role: 'assistant', content: 'What are you building?' },
    ])
    expect(result.current.state.coverage[0].status).toBe('open')
  })

  it('replaces the coverage snapshot each turn rather than merging', async () => {
    const provider = fakeProvider([
      turn({ coverage: [{ areaId: 'project-summary', label: 'Project summary', status: 'open' }] }),
      turn({ coverage: [{ areaId: 'project-summary', label: 'Project summary', status: 'covered' }] }),
    ])
    const { result } = renderHook(() => useInterview(provider))

    act(() => result.current.start('A recipe app'))
    await waitFor(() => expect(result.current.state.status).toBe('idle'))

    act(() => result.current.sendMessage('It has meal planning and shopping lists'))
    await waitFor(() => expect(result.current.state.coverage[0].status).toBe('covered'))

    expect(result.current.state.coverage).toHaveLength(1)
  })

  it('flips readyToGenerate when the model signals completion', async () => {
    const provider = fakeProvider([turn({ readyToGenerate: true, message: 'Ready to generate?' })])
    const { result } = renderHook(() => useInterview(provider))

    act(() => result.current.start('A recipe app'))
    await waitFor(() => expect(result.current.state.readyToGenerate).toBe(true))
  })

  it('surfaces a doneWarning without setting readyToGenerate on an early stop with gaps', async () => {
    const provider = fakeProvider([
      turn(),
      turn({ readyToGenerate: false, doneWarning: 'Stack & architecture is still unresolved.' }),
    ])
    const { result } = renderHook(() => useInterview(provider))

    act(() => result.current.start('A recipe app'))
    await waitFor(() => expect(result.current.state.status).toBe('idle'))

    act(() => result.current.requestStopEarly())
    await waitFor(() => expect(result.current.state.doneWarning).toBe('Stack & architecture is still unresolved.'))
    expect(result.current.state.readyToGenerate).toBe(false)
  })

  it('surfaces the provider error message and preserves the pending user message', async () => {
    const provider = fakeProvider([turn(), new LLMProviderError('rate_limit', 'Rate limited. Try again.')])
    const { result } = renderHook(() => useInterview(provider))

    act(() => result.current.start('A recipe app'))
    await waitFor(() => expect(result.current.state.status).toBe('idle'))

    act(() => result.current.sendMessage('More detail here'))
    await waitFor(() => expect(result.current.state.status).toBe('error'))

    expect(result.current.state.errorMessage).toBe('Rate limited. Try again.')
    expect(result.current.state.messages.at(-1)).toEqual({ role: 'user', content: 'More detail here' })
  })

  it('persists and restores session state across a fresh hook instance (simulated refresh)', async () => {
    const provider = fakeProvider([turn({ coverage: [{ areaId: 'project-summary', label: 'Project summary', status: 'covered' }] })])
    const { result } = renderHook(() => useInterview(provider))

    act(() => result.current.start('A recipe app'))
    await waitFor(() => expect(result.current.state.status).toBe('idle'))

    const { result: restored } = renderHook(() => useInterview(provider))
    expect(restored.current.state.messages.length).toBe(2)
    expect(restored.current.state.coverage[0].status).toBe('covered')
    expect(restored.current.state.started).toBe(true)
  })

  it('startOver clears persisted state', async () => {
    const provider = fakeProvider([turn()])
    const { result } = renderHook(() => useInterview(provider))

    act(() => result.current.start('A recipe app'))
    await waitFor(() => expect(result.current.state.status).toBe('idle'))

    act(() => result.current.startOver())

    expect(result.current.state.messages).toEqual([])
    expect(result.current.state.started).toBe(false)
    expect(window.localStorage.getItem('scaffold:interviewSession')).toBeNull()
  })
})
