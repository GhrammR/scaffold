import { describe, expect, it } from 'vitest'
import { validateScaffold } from './validateScaffold'
import type { GeneratedScaffold } from './types'
import type { Decision } from '../interview/types'

const baseScaffold: GeneratedScaffold = {
  claudeMd: {
    projectSummary: 'A recipe app.',
    stackArchitecture: 'React + TypeScript.',
    hardInvariants: [],
    softDecisions: [],
    knownForks: [],
    conventions: [],
  },
  slicePlan: { slices: [{ title: 'Slice 1', description: 'Do the thing.' }] },
}

describe('validateScaffold', () => {
  it('passes for a well-formed scaffold with no decisions to cross-check', () => {
    expect(validateScaffold(baseScaffold, [])).toEqual([])
  })

  it('flags empty projectSummary or stackArchitecture', () => {
    const problems = validateScaffold(
      { ...baseScaffold, claudeMd: { ...baseScaffold.claudeMd, projectSummary: '', stackArchitecture: '' } },
      [],
    )
    expect(problems).toContain('projectSummary is empty.')
    expect(problems).toContain('stackArchitecture is empty.')
  })

  it('flags hardInvariants empty when hard decisions exist', () => {
    const decisions: Decision[] = [{ id: '1', area: 'security', summary: 'Never log secrets.', kind: 'hard' }]
    const problems = validateScaffold(baseScaffold, decisions)
    expect(problems.some((p) => p.includes('hardInvariants is empty'))).toBe(true)
    expect(problems.some((p) => p.includes('Never log secrets.'))).toBe(true)
  })

  it('flags softDecisions empty when soft decisions exist', () => {
    const decisions: Decision[] = [{ id: '1', area: 'stack', summary: 'Maybe Postgres later.', kind: 'soft' }]
    const problems = validateScaffold(baseScaffold, decisions)
    expect(problems.some((p) => p.includes('softDecisions is empty'))).toBe(true)
  })

  it('does not flag hard/soft when the scaffold already accounts for them', () => {
    const decisions: Decision[] = [
      { id: '1', area: 'security', summary: 'Never log secrets.', kind: 'hard' },
      { id: '2', area: 'stack', summary: 'Maybe Postgres later.', kind: 'soft' },
    ]
    const scaffold: GeneratedScaffold = {
      ...baseScaffold,
      claudeMd: {
        ...baseScaffold.claudeMd,
        hardInvariants: ['Never log secrets.'],
        softDecisions: [{ decision: 'Use SQLite for now.', reason: 'Might move to Postgres later.' }],
      },
    }
    expect(validateScaffold(scaffold, decisions)).toEqual([])
  })

  it('flags a soft decision entry missing a reason', () => {
    const scaffold: GeneratedScaffold = {
      ...baseScaffold,
      claudeMd: { ...baseScaffold.claudeMd, softDecisions: [{ decision: 'Use SQLite.', reason: '' }] },
    }
    const problems = validateScaffold(scaffold, [])
    expect(problems).toContain('At least one softDecisions entry is missing a reason.')
  })

  it('flags an empty slice plan', () => {
    const problems = validateScaffold({ ...baseScaffold, slicePlan: { slices: [] } }, [])
    expect(problems).toContain('slicePlan has no slices.')
  })
})
