import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useGeneration } from './useGeneration'
import type { LLMProvider, LLMResponse } from '../llm/LLMProvider'
import { LLMProviderError } from '../llm/LLMProvider'
import { SCAFFOLD_TOOL_NAME } from './scaffoldTool'
import type { GeneratedScaffold } from './types'
import type { Decision } from '../interview/types'

function fakeProvider(
  responses: (GeneratedScaffold | Error | { malformed: true } | { textOnly: string })[],
): LLMProvider {
  let call = 0
  return {
    complete: vi.fn(async (): Promise<LLMResponse> => {
      const next = responses[Math.min(call, responses.length - 1)]
      call += 1
      if (next instanceof Error) throw next
      if ('malformed' in next) {
        return { toolUse: { name: SCAFFOLD_TOOL_NAME, input: { nonsense: true } } }
      }
      if ('textOnly' in next) {
        return { text: next.textOnly }
      }
      return { toolUse: { name: SCAFFOLD_TOOL_NAME, input: next } }
    }),
  }
}

const goodScaffold = (overrides: Partial<GeneratedScaffold['claudeMd']> = {}): GeneratedScaffold => ({
  claudeMd: {
    projectSummary: 'A recipe app.',
    stackArchitecture: 'React + TypeScript.',
    hardInvariants: ['Never store payment details.'],
    softDecisions: [{ decision: 'Use SQLite.', reason: 'Might move to Postgres later.' }],
    knownForks: [],
    conventions: [],
    ...overrides,
  },
  slicePlan: { slices: [{ title: 'Slice 1', description: 'Build the thing.' }] },
})

const hardDecision: Decision = { id: '1', area: 'security', summary: 'Never store payment details.', kind: 'hard' }

describe('useGeneration', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('generates and renders both files from a valid scripted response', async () => {
    const provider = fakeProvider([goodScaffold()])
    const { result } = renderHook(() => useGeneration(provider, [{ role: 'user', content: 'hi' }], [], [hardDecision]))

    act(() => result.current.generate())
    await waitFor(() => expect(result.current.state.status).toBe('done'))

    expect(result.current.state.claudeMdText).toContain('A recipe app.')
    expect(result.current.state.slicePlanText).toContain('Slice 1')
  })

  it('always ends the request message list on a user turn, even when the interview transcript ends on the AI turn', async () => {
    const provider = fakeProvider([goodScaffold()])
    const transcriptEndingOnAssistant = [
      { role: 'user' as const, content: 'A recipe app' },
      { role: 'assistant' as const, content: 'I think I have enough — ready to generate?' },
    ]
    const { result } = renderHook(() => useGeneration(provider, transcriptEndingOnAssistant, [], [hardDecision]))

    act(() => result.current.generate())
    await waitFor(() => expect(result.current.state.status).toBe('done'))

    const sentMessages = (provider.complete as ReturnType<typeof vi.fn>).mock.calls[0][0].messages
    expect(sentMessages.at(-1).role).toBe('user')
  })

  it('retries once with a corrective message when hardInvariants is missing, then succeeds', async () => {
    const provider = fakeProvider([goodScaffold({ hardInvariants: [] }), goodScaffold()])
    const { result } = renderHook(() => useGeneration(provider, [{ role: 'user', content: 'hi' }], [], [hardDecision]))

    act(() => result.current.generate())
    await waitFor(() => expect(result.current.state.status).toBe('done'))

    expect(provider.complete).toHaveBeenCalledTimes(2)
    const secondCallMessages = (provider.complete as ReturnType<typeof vi.fn>).mock.calls[1][0].messages
    expect(secondCallMessages.at(-1).content).toContain('hardInvariants is empty')
  })

  it('surfaces an error after a second failed validation attempt', async () => {
    const provider = fakeProvider([goodScaffold({ hardInvariants: [] }), goodScaffold({ hardInvariants: [] })])
    const { result } = renderHook(() => useGeneration(provider, [{ role: 'user', content: 'hi' }], [], [hardDecision]))

    act(() => result.current.generate())
    await waitFor(() => expect(result.current.state.status).toBe('error'))
    expect(result.current.state.errorMessage).toContain('hardInvariants is empty')
  })

  it('surfaces a shape-mismatch-specific error after a second malformed-shape attempt', async () => {
    const provider = fakeProvider([{ malformed: true }, { malformed: true }])
    const { result } = renderHook(() => useGeneration(provider, [{ role: 'user', content: 'hi' }], [], []))

    act(() => result.current.generate())
    await waitFor(() => expect(result.current.state.status).toBe('error'))
    expect(result.current.state.errorMessage).toContain('did not match the expected shape')
  })

  it('surfaces a distinct error when the model returns text instead of calling the tool', async () => {
    const provider = fakeProvider([{ textOnly: 'Sure, here is your scaffold...' }, { textOnly: 'Still just text.' }])
    const { result } = renderHook(() => useGeneration(provider, [{ role: 'user', content: 'hi' }], [], []))

    act(() => result.current.generate())
    await waitFor(() => expect(result.current.state.status).toBe('error'))
    expect(result.current.state.errorMessage).toContain('returned plain text instead of calling generate_scaffold')
  })

  it('surfaces a provider error message', async () => {
    const provider = fakeProvider([new LLMProviderError('rate_limit', 'Rate limited. Try again.')])
    const { result } = renderHook(() => useGeneration(provider, [{ role: 'user', content: 'hi' }], [], []))

    act(() => result.current.generate())
    await waitFor(() => expect(result.current.state.status).toBe('error'))
    expect(result.current.state.errorMessage).toBe('Rate limited. Try again.')
  })

  it('restores a persisted generated scaffold on a fresh hook instance (simulated refresh)', async () => {
    const provider = fakeProvider([goodScaffold()])
    const { result } = renderHook(() => useGeneration(provider, [{ role: 'user', content: 'hi' }], [], [hardDecision]))

    act(() => result.current.generate())
    await waitFor(() => expect(result.current.state.status).toBe('done'))

    const { result: restored } = renderHook(() => useGeneration(provider, [], [], []))
    expect(restored.current.state.status).toBe('done')
    expect(restored.current.state.claudeMdText).toContain('A recipe app.')
  })
})
