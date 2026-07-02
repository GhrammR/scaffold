import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useGeneration } from './useGeneration'
import type { LLMProvider, LLMResponse } from '../llm/LLMProvider'
import { LLMProviderError } from '../llm/LLMProvider'
import { SCAFFOLD_TOOL_NAME } from './scaffoldTool'
import type { GeneratedScaffold } from './types'
import type { Decision } from '../interview/types'

function fakeProvider(
  responses: (GeneratedScaffold | Error | { malformed: true } | { textOnly: string } | { rawInput: unknown })[],
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
      if ('rawInput' in next) {
        return { toolUse: { name: SCAFFOLD_TOOL_NAME, input: next.rawInput } }
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

  it('recovers when the model stringifies claudeMd as escaped JSON instead of a structured object', async () => {
    const scaffold = goodScaffold()
    const stringifiedInput = { claudeMd: JSON.stringify(scaffold.claudeMd), slicePlan: scaffold.slicePlan }
    const provider = fakeProvider([{ rawInput: stringifiedInput }])
    const { result } = renderHook(() => useGeneration(provider, [{ role: 'user', content: 'hi' }], [], [hardDecision]))

    act(() => result.current.generate())
    await waitFor(() => expect(result.current.state.status).toBe('done'))

    // Recovered on the first attempt — no retry needed for a well-formed
    // scaffold that was merely stringified.
    expect(provider.complete).toHaveBeenCalledTimes(1)
    expect(result.current.state.claudeMdText).toContain('A recipe app.')
  })

  it('recovers when the model stringifies slicePlan as escaped JSON instead of a structured object', async () => {
    const scaffold = goodScaffold()
    const stringifiedInput = { claudeMd: scaffold.claudeMd, slicePlan: JSON.stringify(scaffold.slicePlan) }
    const provider = fakeProvider([{ rawInput: stringifiedInput }])
    const { result } = renderHook(() => useGeneration(provider, [{ role: 'user', content: 'hi' }], [], [hardDecision]))

    act(() => result.current.generate())
    await waitFor(() => expect(result.current.state.status).toBe('done'))

    expect(provider.complete).toHaveBeenCalledTimes(1)
    expect(result.current.state.slicePlanText).toContain('Slice 1')
  })

  it('still surfaces a shape error if the stringified field is not valid JSON', async () => {
    const provider = fakeProvider([{ rawInput: { claudeMd: 'not valid json {', slicePlan: { slices: [] } } }])
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

describe('useGeneration revision', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  async function generateThenRevise(
    revisedScaffolds: (GeneratedScaffold | Error | { malformed: true } | { rawInput: unknown })[],
  ) {
    const provider = fakeProvider([goodScaffold(), ...revisedScaffolds])
    const { result } = renderHook(() => useGeneration(provider, [{ role: 'user', content: 'hi' }], [], [hardDecision]))

    act(() => result.current.generate())
    await waitFor(() => expect(result.current.state.status).toBe('done'))

    return { provider, result }
  }

  it('skips the hard/soft cross-check during revision, even though the interview decisions log has a hard entry', async () => {
    const { result } = await generateThenRevise([goodScaffold({ hardInvariants: [] })])

    act(() => result.current.revise('Actually, drop the payment-details rule entirely.'))
    await waitFor(() => expect(result.current.state.status).toBe('done'))

    // A single call, not the retry-with-correction loop that would fire if the
    // hard/soft cross-check against the interview's decisions log still ran.
    expect(result.current.state.claudeMdText).not.toContain('Never store payment details.')
  })

  it('recovers a stringified claudeMd during revision too, not just first generation', async () => {
    const revised = goodScaffold({ conventions: ['Use tabs.'] })
    const stringifiedInput = { claudeMd: JSON.stringify(revised.claudeMd), slicePlan: revised.slicePlan }
    const { provider, result } = await generateThenRevise([{ rawInput: stringifiedInput }])

    act(() => result.current.revise('Add a convention: use tabs.'))
    await waitFor(() => expect(result.current.state.status).toBe('done'))

    expect(provider.complete).toHaveBeenCalledTimes(2) // 1 generate + 1 revise, no retry needed
    expect(result.current.state.claudeMdText).toContain('Use tabs.')
  })

  it('updates rendered text in place and appends the request plus a computed confirmation to revisionMessages', async () => {
    const revised = goodScaffold({ hardInvariants: ['Never store payment details.', 'Tests run before every commit.'] })
    const { result } = await generateThenRevise([revised])

    act(() => result.current.revise('Add a hard rule that tests run before every commit.'))
    await waitFor(() => expect(result.current.state.status).toBe('done'))

    expect(result.current.state.claudeMdText).toContain('Tests run before every commit.')
    expect(result.current.state.lastDiffSummary).toContain('Tests run before every commit.')

    const userTurns = result.current.state.revisionMessages.filter((m) => m.role === 'user')
    const assistantTurns = result.current.state.revisionMessages.filter((m) => m.role === 'assistant')
    expect(userTurns).toHaveLength(1)
    expect(userTurns[0].content).toBe('Add a hard rule that tests run before every commit.')
    expect(assistantTurns).toHaveLength(1)
    expect(assistantTurns[0].content).toBe(result.current.state.lastDiffSummary)
  })

  it('sends a revision request ending on a user turn, without an extra trailing instruction appended', async () => {
    const revised = goodScaffold()
    const { provider, result } = await generateThenRevise([revised])

    act(() => result.current.revise('Make the styling decision hard, not soft.'))
    await waitFor(() => expect(result.current.state.status).toBe('done'))

    const revisionCall = (provider.complete as ReturnType<typeof vi.fn>).mock.calls[1][0]
    expect(revisionCall.messages.at(-1)).toEqual({
      role: 'user',
      content: 'Make the styling decision hard, not soft.',
    })
  })

  it('surfaces the same staged error messages on a revision failure', async () => {
    const { result } = await generateThenRevise([{ malformed: true }, { malformed: true }])

    act(() => result.current.revise('Add something invalid.'))
    await waitFor(() => expect(result.current.state.status).toBe('error'))
    expect(result.current.state.errorMessage).toContain('did not match the expected shape')
  })

  it('resets revisionMessages when generate() (Regenerate) runs again', async () => {
    const { result } = await generateThenRevise([goodScaffold()])

    act(() => result.current.revise('A small tweak.'))
    await waitFor(() => expect(result.current.state.revisionMessages.length).toBeGreaterThan(0))

    act(() => result.current.generate())
    await waitFor(() => expect(result.current.state.status).toBe('done'))
    expect(result.current.state.revisionMessages).toEqual([])
  })

  it('persists revisionMessages across a simulated refresh', async () => {
    const { provider, result } = await generateThenRevise([goodScaffold()])

    act(() => result.current.revise('A small tweak.'))
    await waitFor(() => expect(result.current.state.status).toBe('done'))

    const { result: restored } = renderHook(() => useGeneration(provider, [], [], []))
    expect(restored.current.state.revisionMessages.some((m) => m.content === 'A small tweak.')).toBe(true)
  })
})
