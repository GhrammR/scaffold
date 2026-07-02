import { describe, expect, it } from 'vitest'
import { groupDiffTotalsByFile } from './diffFileGrouping'
import { diffScaffold } from './diffScaffold'
import type { GeneratedScaffold } from './types'

const base: GeneratedScaffold = {
  claudeMd: {
    projectSummary: 'A calculator app.',
    stackArchitecture: 'React + TypeScript.',
    hardInvariants: ['Divide by zero must show an error.'],
    softDecisions: [{ decision: 'Use SQLite.', reason: 'Might move to Postgres later.' }],
    knownForks: [],
    conventions: [],
  },
  slicePlan: { slices: [{ title: 'Basic arithmetic', description: 'Add, subtract, multiply, divide.' }] },
}

describe('groupDiffTotalsByFile', () => {
  it('reports zero totals for both files when nothing changed', () => {
    const groups = groupDiffTotalsByFile(diffScaffold(base, base))
    expect(groups).toEqual([
      { filename: 'CLAUDE.md', added: 0, removed: 0, modified: 0 },
      { filename: 'slice-plan.md', added: 0, removed: 0, modified: 0 },
    ])
  })

  it('attributes a hard invariant change to CLAUDE.md only', () => {
    const next: GeneratedScaffold = {
      ...base,
      claudeMd: { ...base.claudeMd, hardInvariants: ['Negative square root must show an error.'] },
    }
    const groups = groupDiffTotalsByFile(diffScaffold(base, next))
    const claudeMd = groups.find((g) => g.filename === 'CLAUDE.md')!
    const slicePlan = groups.find((g) => g.filename === 'slice-plan.md')!
    expect(claudeMd.added).toBe(1)
    expect(claudeMd.removed).toBe(1)
    expect(slicePlan).toEqual({ filename: 'slice-plan.md', added: 0, removed: 0, modified: 0 })
  })

  it('attributes a slice change to slice-plan.md only', () => {
    const next: GeneratedScaffold = {
      ...base,
      slicePlan: { slices: [{ title: 'Basic arithmetic', description: 'A different description now.' }] },
    }
    const groups = groupDiffTotalsByFile(diffScaffold(base, next))
    const claudeMd = groups.find((g) => g.filename === 'CLAUDE.md')!
    const slicePlan = groups.find((g) => g.filename === 'slice-plan.md')!
    expect(claudeMd).toEqual({ filename: 'CLAUDE.md', added: 0, removed: 0, modified: 0 })
    expect(slicePlan.modified).toBe(1)
  })

  it('counts a changed project summary as a modification to CLAUDE.md', () => {
    const next: GeneratedScaffold = { ...base, claudeMd: { ...base.claudeMd, projectSummary: 'A scientific calculator.' } }
    const groups = groupDiffTotalsByFile(diffScaffold(base, next))
    const claudeMd = groups.find((g) => g.filename === 'CLAUDE.md')!
    expect(claudeMd.modified).toBe(1)
  })
})
