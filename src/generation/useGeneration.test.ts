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

// Hard invariants / soft decisions each get their own rule file under
// .agent_governance/rules/, so tests that just need "is this text present
// somewhere in the generated output" search across every file's content
// rather than hand-computing a specific slug/path.
function anyFileContains(fileTree: Record<string, string> | undefined, text: string): boolean {
  return Object.values(fileTree ?? {}).some((content) => content.includes(text))
}

describe('useGeneration', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('generates and renders both files from a valid scripted response', async () => {
    const provider = fakeProvider([goodScaffold()])
    const { result } = renderHook(() => useGeneration(provider, [{ role: 'user', content: 'hi' }], [], [hardDecision]))

    act(() => result.current.generate())
    await waitFor(() => expect(result.current.state.status).toBe('done'))

    expect(result.current.state.fileTree?.['AGENTS.md']).toContain('A recipe app.')
    expect(result.current.state.fileTree?.['slice-plan.md']).toContain('Slice 1')
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
    expect(result.current.state.fileTree?.['AGENTS.md']).toContain('A recipe app.')
  })

  it('recovers when the model stringifies slicePlan as escaped JSON instead of a structured object', async () => {
    const scaffold = goodScaffold()
    const stringifiedInput = { claudeMd: scaffold.claudeMd, slicePlan: JSON.stringify(scaffold.slicePlan) }
    const provider = fakeProvider([{ rawInput: stringifiedInput }])
    const { result } = renderHook(() => useGeneration(provider, [{ role: 'user', content: 'hi' }], [], [hardDecision]))

    act(() => result.current.generate())
    await waitFor(() => expect(result.current.state.status).toBe('done'))

    expect(provider.complete).toHaveBeenCalledTimes(1)
    expect(result.current.state.fileTree?.['slice-plan.md']).toContain('Slice 1')
  })

  it('recovers when the ENTIRE tool input arrives as a JSON string instead of an object', async () => {
    const scaffold = goodScaffold()
    const stringifiedWholeInput = JSON.stringify(scaffold)
    const provider = fakeProvider([{ rawInput: stringifiedWholeInput }])
    const { result } = renderHook(() => useGeneration(provider, [{ role: 'user', content: 'hi' }], [], [hardDecision]))

    act(() => result.current.generate())
    await waitFor(() => expect(result.current.state.status).toBe('done'))

    expect(provider.complete).toHaveBeenCalledTimes(1)
    expect(result.current.state.fileTree?.['AGENTS.md']).toContain('A recipe app.')
  })

  it('recovers when a nested field (hardInvariants) arrives as a JSON string instead of an array', async () => {
    const scaffold = goodScaffold()
    const stringifiedInput = {
      claudeMd: { ...scaffold.claudeMd, hardInvariants: JSON.stringify(scaffold.claudeMd.hardInvariants) },
      slicePlan: scaffold.slicePlan,
    }
    const provider = fakeProvider([{ rawInput: stringifiedInput }])
    const { result } = renderHook(() => useGeneration(provider, [{ role: 'user', content: 'hi' }], [], [hardDecision]))

    act(() => result.current.generate())
    await waitFor(() => expect(result.current.state.status).toBe('done'))

    expect(provider.complete).toHaveBeenCalledTimes(1)
    expect(anyFileContains(result.current.state.fileTree, 'Never store payment details.')).toBe(true)
  })

  it('recovers when claudeMd is stringified AND a nested field inside it is also stringified', async () => {
    const scaffold = goodScaffold()
    const doublyNestedClaudeMd = JSON.stringify({
      ...scaffold.claudeMd,
      conventions: JSON.stringify(['Use Prettier defaults.']),
    })
    const stringifiedInput = { claudeMd: doublyNestedClaudeMd, slicePlan: scaffold.slicePlan }
    const provider = fakeProvider([{ rawInput: stringifiedInput }])
    const { result } = renderHook(() => useGeneration(provider, [{ role: 'user', content: 'hi' }], [], [hardDecision]))

    act(() => result.current.generate())
    await waitFor(() => expect(result.current.state.status).toBe('done'))

    expect(provider.complete).toHaveBeenCalledTimes(1)
    expect(result.current.state.fileTree?.['AGENTS.md']).toContain('Use Prettier defaults.')
  })

  it('recovers when slicePlan is misplaced INSIDE a stringified claudeMd instead of a top-level sibling', async () => {
    // Exact shape reported from a real run: the tool input has only one
    // top-level key, "claudeMd", whose value is a stringified JSON blob that
    // itself contains both the claudeMd fields AND a nested "slicePlan" key.
    const scaffold = goodScaffold()
    const claudeMdWithNestedSlicePlan = JSON.stringify({
      ...scaffold.claudeMd,
      slicePlan: scaffold.slicePlan,
    })
    const rawInput = { claudeMd: claudeMdWithNestedSlicePlan }
    const provider = fakeProvider([{ rawInput }])
    const { result } = renderHook(() => useGeneration(provider, [{ role: 'user', content: 'hi' }], [], [hardDecision]))

    act(() => result.current.generate())
    await waitFor(() => expect(result.current.state.status).toBe('done'))

    // Recovered on the first attempt — no retry needed.
    expect(provider.complete).toHaveBeenCalledTimes(1)
    expect(result.current.state.fileTree?.['AGENTS.md']).toContain('A recipe app.')
    expect(result.current.state.fileTree?.['slice-plan.md']).toContain('Slice 1')

    // slicePlan must be lifted to the top level and removed from inside claudeMd.
    const recoveredScaffold = result.current.state.scaffold
    expect(recoveredScaffold?.slicePlan.slices).toEqual(scaffold.slicePlan.slices)
    expect(recoveredScaffold?.claudeMd).not.toHaveProperty('slicePlan')
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
    expect(restored.current.state.fileTree?.['AGENTS.md']).toContain('A recipe app.')
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
    expect(anyFileContains(result.current.state.fileTree, 'Never store payment details.')).toBe(false)
  })

  it('recovers a stringified claudeMd during revision too, not just first generation', async () => {
    const revised = goodScaffold({ conventions: ['Use tabs.'] })
    const stringifiedInput = { claudeMd: JSON.stringify(revised.claudeMd), slicePlan: revised.slicePlan }
    const { provider, result } = await generateThenRevise([{ rawInput: stringifiedInput }])

    act(() => result.current.revise('Add a convention: use tabs.'))
    await waitFor(() => expect(result.current.state.status).toBe('done'))

    expect(provider.complete).toHaveBeenCalledTimes(2) // 1 generate + 1 revise, no retry needed
    expect(result.current.state.fileTree?.['AGENTS.md']).toContain('Use tabs.')
  })

  it('updates rendered text in place and appends the request plus a computed confirmation to revisionMessages', async () => {
    const revised = goodScaffold({ hardInvariants: ['Never store payment details.', 'Tests run before every commit.'] })
    const { result } = await generateThenRevise([revised])

    act(() => result.current.revise('Add a hard rule that tests run before every commit.'))
    await waitFor(() => expect(result.current.state.status).toBe('done'))

    expect(anyFileContains(result.current.state.fileTree, 'Tests run before every commit.')).toBe(true)
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

  it('generate() (plain Regenerate) hard-resets: wipes revisionMessages, openRevisions, AND any closed lineages', async () => {
    // Plain Regenerate is a clean slate — the lineage/history feature is
    // exclusive to regenerateWithRevisions(). Build up some history first
    // (a revision, then a regenerate-with-revisions that closes a lineage),
    // then confirm plain Regenerate wipes all of it, not just the open group.
    const provider = fakeProvider([
      goodScaffold(),
      goodScaffold({ hardInvariants: ['Never store payment details.', 'Tests run before every commit.'] }),
      goodScaffold({ hardInvariants: ['Never store payment details.', 'Tests run before every commit.'] }), // regenerate-with-revisions
      goodScaffold(), // plain Regenerate
    ])
    const { result } = renderHook(() => useGeneration(provider, [{ role: 'user', content: 'hi' }], [], [hardDecision]))

    act(() => result.current.generate())
    await waitFor(() => expect(result.current.state.status).toBe('done'))

    act(() => result.current.revise('A small tweak.'))
    await waitFor(() => expect(result.current.state.openRevisions).toHaveLength(1))

    act(() => result.current.regenerateWithRevisions())
    await waitFor(() => expect(result.current.state.lineages).toHaveLength(1))

    act(() => result.current.generate())
    await waitFor(() => expect(result.current.state.status).toBe('done'))

    expect(result.current.state.revisionMessages).toEqual([])
    expect(result.current.state.openRevisions).toEqual([])
    expect(result.current.state.lineages).toEqual([])
  })

  it('does not create a lineage entry for the very first generation (nothing to diff against)', async () => {
    const { result } = await generateThenRevise([])
    expect(result.current.state.lineages).toEqual([])
  })

  it('persists revisionMessages and openRevisions across a simulated refresh', async () => {
    const { provider, result } = await generateThenRevise([goodScaffold()])

    act(() => result.current.revise('A small tweak.'))
    await waitFor(() => expect(result.current.state.status).toBe('done'))

    const { result: restored } = renderHook(() => useGeneration(provider, [], [], []))
    expect(restored.current.state.revisionMessages.some((m) => m.content === 'A small tweak.')).toBe(true)
    expect(restored.current.state.openRevisions.some((entry) => entry.request === 'A small tweak.')).toBe(true)
  })

  it('appends a structured entry (request + diff) to revisionHistory on each successful revision', async () => {
    const revised = goodScaffold({ hardInvariants: ['Never store payment details.', 'Tests run before every commit.'] })
    const { result } = await generateThenRevise([revised])

    act(() => result.current.revise('Add a hard rule that tests run before every commit.'))
    await waitFor(() => expect(result.current.state.status).toBe('done'))

    expect(result.current.state.openRevisions).toHaveLength(1)
    expect(result.current.state.openRevisions[0].request).toBe('Add a hard rule that tests run before every commit.')
    expect(result.current.state.openRevisions[0].diff.hardInvariants.added).toContain('Tests run before every commit.')
  })

  it('captures the before/after rendered text for each revision, for the inline line-level diff', async () => {
    const revised = goodScaffold({ hardInvariants: ['Never store payment details.', 'Tests run before every commit.'] })
    const { result } = await generateThenRevise([revised])

    const fileTreeBefore = result.current.state.fileTree
    act(() => result.current.revise('Add a hard rule that tests run before every commit.'))
    await waitFor(() => expect(result.current.state.status).toBe('done'))

    const entry = result.current.state.openRevisions[0]
    expect(entry.previousFileTree).toEqual(fileTreeBefore)
    expect(anyFileContains(entry.nextFileTree, 'Tests run before every commit.')).toBe(true)
    expect(entry.nextFileTree).not.toEqual(entry.previousFileTree)
  })

  it('regression: a revision that genuinely changes wording produces a non-empty diff, not "no changes"', async () => {
    // Mirrors the real scenario that regressed: replacing one hard invariant's
    // wording (divide-by-zero -> negative-sqrt) must show up as a real diff,
    // not report identical before/after because of a stale capture.
    const revised = goodScaffold({ hardInvariants: ['Negative square root must show an error.'] })
    const { result } = await generateThenRevise([revised])

    const fileTreeBefore = result.current.state.fileTree
    act(() => result.current.revise('Replace the divide-by-zero rule with a rule about negative square roots.'))
    await waitFor(() => expect(result.current.state.status).toBe('done'))

    const entry = result.current.state.openRevisions[0]

    // The core regression: before/after text must genuinely differ.
    expect(entry.previousFileTree).toEqual(fileTreeBefore)
    expect(entry.nextFileTree).not.toEqual(entry.previousFileTree)

    // The field-level diff must reflect the swap, not report empty lists.
    expect(entry.diff.hardInvariants.removed).toContain('Never store payment details.')
    expect(entry.diff.hardInvariants.added).toContain('Negative square root must show an error.')
    const totalChanges =
      entry.diff.hardInvariants.added.length +
      entry.diff.hardInvariants.removed.length +
      entry.diff.softDecisions.added.length +
      entry.diff.softDecisions.removed.length +
      entry.diff.softDecisions.modified.length
    expect(totalChanges).toBeGreaterThan(0)
  })

  it('sets noOpWarning when the model returns an unchanged scaffold for a revision request', async () => {
    // The model returns the exact same content as the current scaffold (a
    // genuine no-op) — this should surface a clear notice, not a silent
    // empty "No changes" with nothing explaining why.
    const { result } = await generateThenRevise([goodScaffold()])

    act(() => result.current.revise('Make it better somehow.'))
    await waitFor(() => expect(result.current.state.status).toBe('done'))

    expect(result.current.state.noOpWarning).toBe('The model returned no changes for that request — try rephrasing.')
    expect(result.current.state.openRevisions[0].nextFileTree).toEqual(
      result.current.state.openRevisions[0].previousFileTree,
    )
  })

  it('clears noOpWarning once a subsequent revision genuinely changes something', async () => {
    const changed = goodScaffold({ conventions: ['Use tabs.'] })
    const { result } = await generateThenRevise([goodScaffold(), changed])

    act(() => result.current.revise('Make it better somehow.'))
    await waitFor(() => expect(result.current.state.noOpWarning).toBeTruthy())

    act(() => result.current.revise('Add a convention: use tabs.'))
    await waitFor(() => expect(result.current.state.status).toBe('done'))
    expect(result.current.state.noOpWarning).toBeUndefined()
  })

  it('clears noOpWarning on a fresh generate() (Regenerate)', async () => {
    const { result } = await generateThenRevise([goodScaffold()])

    act(() => result.current.revise('Make it better somehow.'))
    await waitFor(() => expect(result.current.state.noOpWarning).toBeTruthy())

    act(() => result.current.generate())
    await waitFor(() => expect(result.current.state.status).toBe('done'))
    expect(result.current.state.noOpWarning).toBeUndefined()
  })
})

describe('useGeneration regenerateWithRevisions', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  async function generateReviseTwice(freshScaffold: GeneratedScaffold) {
    const provider = fakeProvider([
      goodScaffold(),
      goodScaffold({ hardInvariants: ['Never store payment details.', 'Tests run before every commit.'] }),
      goodScaffold({
        hardInvariants: ['Never store payment details.', 'Tests run before every commit.'],
        conventions: ['Use tabs.'],
      }),
      freshScaffold,
    ])
    const { result } = renderHook(() => useGeneration(provider, [{ role: 'user', content: 'hi' }], [], [hardDecision]))

    act(() => result.current.generate())
    await waitFor(() => expect(result.current.state.status).toBe('done'))

    act(() => result.current.revise('Add a hard rule that tests run before every commit.'))
    await waitFor(() => expect(result.current.state.openRevisions).toHaveLength(1))

    act(() => result.current.revise('Add a convention: use tabs.'))
    await waitFor(() => expect(result.current.state.openRevisions).toHaveLength(2))

    return { provider, result }
  }

  it('feeds every accumulated revision request into the system prompt for a single generation call', async () => {
    const { provider, result } = await generateReviseTwice(goodScaffold({ conventions: ['Use tabs.'] }))

    act(() => result.current.regenerateWithRevisions())
    await waitFor(() => expect(result.current.state.status).toBe('done'))

    // 3 prior calls (generate + 2 revise) + 1 regenerate-with-revisions call.
    expect(provider.complete).toHaveBeenCalledTimes(4)
    const call = (provider.complete as ReturnType<typeof vi.fn>).mock.calls[3][0]
    expect(call.system).toContain('Add a hard rule that tests run before every commit.')
    expect(call.system).toContain('Add a convention: use tabs.')
    expect(call.system).toContain('FULL REGENERATION')
  })

  it('sends messages built from the interview transcript, not the revisionMessages thread', async () => {
    const { provider, result } = await generateReviseTwice(goodScaffold())

    act(() => result.current.regenerateWithRevisions())
    await waitFor(() => expect(result.current.state.status).toBe('done'))

    const call = (provider.complete as ReturnType<typeof vi.fn>).mock.calls[3][0]
    expect(call.messages[0]).toEqual({ role: 'user', content: 'hi' })
    expect(call.messages.at(-1)).toEqual({ role: 'user', content: 'Generate the scaffold now based on our conversation.' })
  })

  it('closes the open revisions into a "with-revisions" lineage and clears the open group', async () => {
    const fresh = goodScaffold({ projectSummary: 'A rebuilt recipe app.' })
    const { result } = await generateReviseTwice(fresh)

    act(() => result.current.regenerateWithRevisions())
    await waitFor(() => expect(result.current.state.status).toBe('done'))

    expect(result.current.state.openRevisions).toEqual([])
    expect(result.current.state.lineages).toHaveLength(1)
    expect(result.current.state.lineages[0].regeneration.kind).toBe('with-revisions')
    expect(result.current.state.lineages[0].revisions.map((r) => r.request)).toEqual([
      'Add a hard rule that tests run before every commit.',
      'Add a convention: use tabs.',
    ])
    expect(result.current.state.fileTree?.['AGENTS.md']).toContain('A rebuilt recipe app.')
  })

  it('resets revisionMessages so a later revision targets the new scaffold with a fresh thread', async () => {
    const { result } = await generateReviseTwice(goodScaffold())

    act(() => result.current.regenerateWithRevisions())
    await waitFor(() => expect(result.current.state.status).toBe('done'))

    expect(result.current.state.revisionMessages).toEqual([])
  })

  it('includes requests from an already-closed lineage on a second regenerate-with-revisions, not just the open group', async () => {
    const provider = fakeProvider([
      goodScaffold(),
      goodScaffold({ hardInvariants: ['Never store payment details.', 'Tests run before every commit.'] }),
      goodScaffold({ hardInvariants: ['Never store payment details.', 'Tests run before every commit.'] }), // 1st regenerate-with-revisions
      goodScaffold({
        hardInvariants: ['Never store payment details.', 'Tests run before every commit.'],
        conventions: ['Use tabs.'],
      }),
      goodScaffold({ conventions: ['Use tabs.'] }), // 2nd regenerate-with-revisions
    ])
    const { result } = renderHook(() => useGeneration(provider, [{ role: 'user', content: 'hi' }], [], [hardDecision]))

    act(() => result.current.generate())
    await waitFor(() => expect(result.current.state.status).toBe('done'))

    act(() => result.current.revise('Add a hard rule that tests run before every commit.'))
    await waitFor(() => expect(result.current.state.openRevisions).toHaveLength(1))

    act(() => result.current.regenerateWithRevisions())
    await waitFor(() => expect(result.current.state.lineages).toHaveLength(1))

    act(() => result.current.revise('Add a convention: use tabs.'))
    await waitFor(() => expect(result.current.state.openRevisions).toHaveLength(1))

    act(() => result.current.regenerateWithRevisions())
    await waitFor(() => expect(result.current.state.lineages).toHaveLength(2))

    const secondRegenCall = (provider.complete as ReturnType<typeof vi.fn>).mock.calls[4][0]
    expect(secondRegenCall.system).toContain('Add a hard rule that tests run before every commit.')
    expect(secondRegenCall.system).toContain('Add a convention: use tabs.')
  })

  it('persists lineages and openRevisions across a simulated refresh', async () => {
    const { provider, result } = await generateReviseTwice(goodScaffold())

    act(() => result.current.regenerateWithRevisions())
    await waitFor(() => expect(result.current.state.status).toBe('done'))

    const { result: restored } = renderHook(() => useGeneration(provider, [], [], []))
    expect(restored.current.state.lineages).toHaveLength(1)
    expect(restored.current.state.lineages[0].regeneration.kind).toBe('with-revisions')
    expect(restored.current.state.lineages[0].revisions).toHaveLength(2)
    expect(restored.current.state.openRevisions).toEqual([])
  })
})
