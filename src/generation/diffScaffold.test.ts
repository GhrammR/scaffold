import { describe, expect, it } from 'vitest'
import { countDiffTotals, diffScaffold, summarizeDiff } from './diffScaffold'
import type { GeneratedScaffold } from './types'

const base: GeneratedScaffold = {
  claudeMd: {
    projectSummary: 'A calculator app.',
    stackArchitecture: 'React + TypeScript.',
    hardInvariants: ['Divide by zero must show an error.'],
    softDecisions: [{ decision: 'Use SQLite.', reason: 'Might move to Postgres later.' }],
    knownForks: [{ fork: 'Scientific mode toggle.', consideration: 'Keyboard support must cover it too.' }],
    conventions: ['Use Prettier defaults.'],
  },
  slicePlan: { slices: [{ title: 'Basic arithmetic', description: 'Add, subtract, multiply, divide.' }] },
}

describe('diffScaffold', () => {
  it('reports no changes when nothing differs', () => {
    const diff = diffScaffold(base, base)
    expect(diff.projectSummaryChanged).toBe(false)
    expect(diff.stackArchitectureChanged).toBe(false)
    expect(diff.hardInvariants).toEqual({ added: [], removed: [] })
    expect(diff.conventions).toEqual({ added: [], removed: [] })
    expect(diff.softDecisions).toEqual({ added: [], removed: [], modified: [] })
    expect(diff.knownForks).toEqual({ added: [], removed: [], modified: [] })
    expect(diff.slices).toEqual({ added: [], removed: [], modified: [] })
  })

  it('detects an added hard invariant without flagging unrelated fields', () => {
    const next: GeneratedScaffold = {
      ...base,
      claudeMd: {
        ...base.claudeMd,
        hardInvariants: [...base.claudeMd.hardInvariants, 'Tests run before every commit.'],
      },
    }
    const diff = diffScaffold(base, next)
    expect(diff.hardInvariants).toEqual({ added: ['Tests run before every commit.'], removed: [] })
    expect(diff.projectSummaryChanged).toBe(false)
    expect(diff.conventions).toEqual({ added: [], removed: [] })
  })

  it('detects a removed hard invariant', () => {
    const next: GeneratedScaffold = { ...base, claudeMd: { ...base.claudeMd, hardInvariants: [] } }
    const diff = diffScaffold(base, next)
    expect(diff.hardInvariants).toEqual({ added: [], removed: ['Divide by zero must show an error.'] })
  })

  it('detects a soft decision moved to hard (removed from soft, added to hard) by key', () => {
    const next: GeneratedScaffold = {
      ...base,
      claudeMd: {
        ...base.claudeMd,
        hardInvariants: [...base.claudeMd.hardInvariants, 'Use SQLite.'],
        softDecisions: [],
      },
    }
    const diff = diffScaffold(base, next)
    expect(diff.hardInvariants.added).toContain('Use SQLite.')
    expect(diff.softDecisions.removed).toEqual(['Use SQLite.'])
  })

  it('detects a modified entry (same key, different body) in a keyed list', () => {
    const next: GeneratedScaffold = {
      ...base,
      claudeMd: {
        ...base.claudeMd,
        softDecisions: [{ decision: 'Use SQLite.', reason: 'A different reason now.' }],
      },
    }
    const diff = diffScaffold(base, next)
    expect(diff.softDecisions).toEqual({ added: [], removed: [], modified: ['Use SQLite.'] })
  })

  it('detects a changed project summary', () => {
    const next: GeneratedScaffold = { ...base, claudeMd: { ...base.claudeMd, projectSummary: 'A scientific calculator.' } }
    const diff = diffScaffold(base, next)
    expect(diff.projectSummaryChanged).toBe(true)
    expect(diff.stackArchitectureChanged).toBe(false)
  })
})

describe('summarizeDiff', () => {
  it('reports "No changes." when nothing differs', () => {
    expect(summarizeDiff(diffScaffold(base, base))).toBe('No changes.')
  })

  it('names the added invariant and lists unchanged sections', () => {
    const next: GeneratedScaffold = {
      ...base,
      claudeMd: {
        ...base.claudeMd,
        hardInvariants: [...base.claudeMd.hardInvariants, 'Tests run before every commit.'],
      },
    }
    const summary = summarizeDiff(diffScaffold(base, next))
    expect(summary).toContain('Tests run before every commit.')
    expect(summary).toContain('Unchanged:')
    expect(summary).toContain('soft decisions')
  })
})

describe('countDiffTotals', () => {
  it('reports all zeros when nothing differs', () => {
    expect(countDiffTotals(diffScaffold(base, base))).toEqual({ added: 0, removed: 0, modified: 0 })
  })

  it('counts added and removed items across plain string list fields', () => {
    const next: GeneratedScaffold = {
      ...base,
      claudeMd: {
        ...base.claudeMd,
        hardInvariants: ['Tests run before every commit.'],
        conventions: [...base.claudeMd.conventions, 'Use 2-space indentation.'],
      },
    }
    const totals = countDiffTotals(diffScaffold(base, next))
    // hardInvariants: -1 (old invariant) +1 (new invariant); conventions: +1
    expect(totals).toEqual({ added: 2, removed: 1, modified: 0 })
  })

  it('counts modified entries in keyed list fields separately from added/removed', () => {
    const next: GeneratedScaffold = {
      ...base,
      claudeMd: {
        ...base.claudeMd,
        softDecisions: [{ decision: 'Use SQLite.', reason: 'A different reason now.' }],
      },
    }
    const totals = countDiffTotals(diffScaffold(base, next))
    expect(totals).toEqual({ added: 0, removed: 0, modified: 1 })
  })

  it('counts a changed prose field as one modification', () => {
    const next: GeneratedScaffold = {
      ...base,
      claudeMd: { ...base.claudeMd, projectSummary: 'A scientific calculator.', stackArchitecture: 'Vue instead.' },
    }
    const totals = countDiffTotals(diffScaffold(base, next))
    expect(totals).toEqual({ added: 0, removed: 0, modified: 2 })
  })
})
