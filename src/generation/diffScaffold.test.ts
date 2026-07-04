import { describe, expect, it } from 'vitest'
import { countDiffTotals, diffScaffold, summarizeDiff } from './diffScaffold'
import type { GeneratedScaffold } from './types'

const base: GeneratedScaffold = {
  claudeMd: {
    projectSummary: 'A calculator app.',
    stackArchitecture: 'React + TypeScript.',
    hardInvariants: [{ title: 'Divide By Zero', content: 'Divide by zero must show an error.' }],
    softDecisions: [{ title: 'Database Choice', decision: 'Use SQLite.', reason: 'Might move to Postgres later.' }],
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
    expect(diff.hardInvariants).toEqual({ added: [], removed: [], modified: [] })
    expect(diff.conventions).toEqual({ added: [], removed: [] })
    expect(diff.softDecisions).toEqual({ added: [], removed: [], modified: [] })
    expect(diff.knownForks).toEqual({ added: [], removed: [], modified: [] })
    expect(diff.slices).toEqual({ added: [], removed: [], modified: [] })
  })

  it('detects an added hard invariant (by title) without flagging unrelated fields', () => {
    const next: GeneratedScaffold = {
      ...base,
      claudeMd: {
        ...base.claudeMd,
        hardInvariants: [...base.claudeMd.hardInvariants, { title: 'Commit Discipline', content: 'Tests run before every commit.' }],
      },
    }
    const diff = diffScaffold(base, next)
    expect(diff.hardInvariants).toEqual({ added: ['Commit Discipline'], removed: [], modified: [] })
    expect(diff.projectSummaryChanged).toBe(false)
    expect(diff.conventions).toEqual({ added: [], removed: [] })
  })

  it('detects a removed hard invariant (by title)', () => {
    const next: GeneratedScaffold = { ...base, claudeMd: { ...base.claudeMd, hardInvariants: [] } }
    const diff = diffScaffold(base, next)
    expect(diff.hardInvariants).toEqual({ added: [], removed: ['Divide By Zero'], modified: [] })
  })

  it('a wording-only edit (same title, different content) reports a MODIFICATION, not a remove+add', () => {
    const next: GeneratedScaffold = {
      ...base,
      claudeMd: {
        ...base.claudeMd,
        hardInvariants: [{ title: 'Divide By Zero', content: 'Divide by zero must show a clear error message.' }],
      },
    }
    const diff = diffScaffold(base, next)
    expect(diff.hardInvariants).toEqual({ added: [], removed: [], modified: ['Divide By Zero'] })
  })

  it('a topic change ("swap this rule for an unrelated one") reports BOTH the removal and the addition, keyed by title', () => {
    // Regression coverage for a reported issue: a "replace X with Y" revision
    // must surface both sides of the swap in the diff, not just the removal.
    const next: GeneratedScaffold = {
      ...base,
      claudeMd: { ...base.claudeMd, hardInvariants: [{ title: 'Card Security', content: 'Never store payment details.' }] },
    }
    const diff = diffScaffold(base, next)
    expect(diff.hardInvariants.removed).toEqual(['Divide By Zero'])
    expect(diff.hardInvariants.added).toEqual(['Card Security'])
  })

  it('a topic-change swap within a MULTI-item list still reports both sides, leaving untouched items out of the diff', () => {
    const multiItemBase: GeneratedScaffold = {
      ...base,
      claudeMd: {
        ...base.claudeMd,
        hardInvariants: [
          { title: 'Divide By Zero', content: 'Divide by zero must show an error.' },
          { title: 'Log Domain', content: 'Log of a non-positive number must show an error.' },
        ],
      },
    }
    const next: GeneratedScaffold = {
      ...multiItemBase,
      claudeMd: {
        ...multiItemBase.claudeMd,
        hardInvariants: [
          { title: 'Card Security', content: 'Never store payment details.' },
          { title: 'Log Domain', content: 'Log of a non-positive number must show an error.' },
        ],
      },
    }
    const diff = diffScaffold(multiItemBase, next)
    expect(diff.hardInvariants.removed).toEqual(['Divide By Zero'])
    expect(diff.hardInvariants.added).toEqual(['Card Security'])
  })

  it('detects a soft decision moved to hard (removed from soft, added to hard) by title', () => {
    const next: GeneratedScaffold = {
      ...base,
      claudeMd: {
        ...base.claudeMd,
        hardInvariants: [...base.claudeMd.hardInvariants, { title: 'Database Choice', content: 'Use SQLite.' }],
        softDecisions: [],
      },
    }
    const diff = diffScaffold(base, next)
    expect(diff.hardInvariants.added).toContain('Database Choice')
    expect(diff.softDecisions.removed).toEqual(['Database Choice'])
  })

  it('detects a modified soft decision entry (same title, different reason) in a keyed list', () => {
    const next: GeneratedScaffold = {
      ...base,
      claudeMd: {
        ...base.claudeMd,
        softDecisions: [{ title: 'Database Choice', decision: 'Use SQLite.', reason: 'A different reason now.' }],
      },
    }
    const diff = diffScaffold(base, next)
    expect(diff.softDecisions).toEqual({ added: [], removed: [], modified: ['Database Choice'] })
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

  it('names the added invariant title and lists unchanged sections', () => {
    const next: GeneratedScaffold = {
      ...base,
      claudeMd: {
        ...base.claudeMd,
        hardInvariants: [...base.claudeMd.hardInvariants, { title: 'Commit Discipline', content: 'Tests run before every commit.' }],
      },
    }
    const summary = summarizeDiff(diffScaffold(base, next))
    expect(summary).toContain('Commit Discipline')
    expect(summary).toContain('Unchanged:')
    expect(summary).toContain('soft decisions')
  })
})

describe('countDiffTotals', () => {
  it('reports all zeros when nothing differs', () => {
    expect(countDiffTotals(diffScaffold(base, base))).toEqual({ added: 0, removed: 0, modified: 0 })
  })

  it('counts added and removed items across hard invariants (keyed) and conventions (plain list)', () => {
    const next: GeneratedScaffold = {
      ...base,
      claudeMd: {
        ...base.claudeMd,
        hardInvariants: [{ title: 'Commit Discipline', content: 'Tests run before every commit.' }],
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
        softDecisions: [{ title: 'Database Choice', decision: 'Use SQLite.', reason: 'A different reason now.' }],
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
