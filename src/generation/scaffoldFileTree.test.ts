import { describe, expect, it } from 'vitest'
import { buildScaffoldFileTree, slugify } from './scaffoldFileTree'
import type { GeneratedScaffold } from './types'

const scaffold: GeneratedScaffold = {
  claudeMd: {
    projectSummary: 'A recipe app for meal planning.',
    stackArchitecture: 'React + TypeScript, client-side only.',
    hardInvariants: ['Never store payment details.', 'Divide by zero must show an error.'],
    softDecisions: [{ decision: 'Use SQLite for storage.', reason: 'Might switch to Postgres later.' }],
    knownForks: [{ fork: 'How recipes are shared.', consideration: 'Link-based or account-based.' }],
    conventions: ['Use Prettier defaults.'],
  },
  slicePlan: { slices: [{ title: 'Slice 1', description: 'Build the thing.' }] },
}

describe('slugify', () => {
  it('lowercases, hyphenates, and caps at 6 words', () => {
    expect(slugify('Never store payment details in plaintext, ever')).toBe('never-store-payment-details-in-plaintext')
  })

  it('falls back to "rule" for text with no alphanumeric content', () => {
    expect(slugify('!!!')).toBe('rule')
  })
})

describe('buildScaffoldFileTree', () => {
  it('includes the static README, one file per hard invariant, one provisional file per soft decision, and the three root files', () => {
    const files = buildScaffoldFileTree(scaffold)
    const paths = files.map((f) => f.path)

    expect(paths).toContain('.agent_governance/README.md')
    expect(paths).toContain('CLAUDE.md')
    expect(paths).toContain('AGENTS.md')
    expect(paths).toContain('slice-plan.md')

    const ruleFiles = paths.filter((p) => p.startsWith('.agent_governance/rules/') && !p.includes('provisional-'))
    const provisionalFiles = paths.filter((p) => p.includes('.agent_governance/rules/provisional-'))
    expect(ruleFiles).toHaveLength(2) // 2 hard invariants
    expect(provisionalFiles).toHaveLength(1) // 1 soft decision
  })

  it('names hard invariant files from content, without a provisional prefix', () => {
    const files = buildScaffoldFileTree(scaffold)
    const paths = files.map((f) => f.path)
    expect(paths).toContain('.agent_governance/rules/never-store-payment-details.md')
    expect(paths).toContain('.agent_governance/rules/divide-by-zero-must-show-an.md')
  })

  it('names soft decision files with the provisional- prefix and marks them clearly as changeable', () => {
    const files = buildScaffoldFileTree(scaffold)
    const provisional = files.find((f) => f.path === '.agent_governance/rules/provisional-use-sqlite-for-storage.md')
    expect(provisional).toBeDefined()
    expect(provisional!.content).toContain('STATUS: Provisional — may change.')
    expect(provisional!.content).toContain('Might switch to Postgres later.')
  })

  it('CLAUDE.md is thin — no project-specific content', () => {
    const files = buildScaffoldFileTree(scaffold)
    const claudeMd = files.find((f) => f.path === 'CLAUDE.md')!
    expect(claudeMd.content).toContain('@AGENTS.md')
    expect(claudeMd.content).not.toContain('recipe app')
    expect(claudeMd.content).not.toContain('Never store payment details.')
  })

  it('AGENTS.md holds the substance and points to the rules folder', () => {
    const files = buildScaffoldFileTree(scaffold)
    const agentsMd = files.find((f) => f.path === 'AGENTS.md')!
    expect(agentsMd.content).toContain('A recipe app for meal planning.')
    expect(agentsMd.content).toContain('.agent_governance/rules/')
    expect(agentsMd.content).not.toContain('Never store payment details.')
  })

  it('slugs collide deterministically with a -2, -3 suffix by array order, within their own namespace', () => {
    const collidingScaffold: GeneratedScaffold = {
      ...scaffold,
      claudeMd: {
        ...scaffold.claudeMd,
        hardInvariants: [
          'Always validate every input before storing anywhere.',
          'Always validate every input before storing forever.',
          'Always validate every input before storing twice.',
        ],
      },
    }
    const files = buildScaffoldFileTree(collidingScaffold)
    const paths = files.map((f) => f.path).filter((p) => p.startsWith('.agent_governance/rules/always-validate-every-input'))
    expect(paths).toEqual([
      '.agent_governance/rules/always-validate-every-input-before-storing.md',
      '.agent_governance/rules/always-validate-every-input-before-storing-2.md',
      '.agent_governance/rules/always-validate-every-input-before-storing-3.md',
    ])
  })

  it('a hard invariant and a soft decision that slugify the same do not force a needless -2 suffix on each other', () => {
    const overlapping: GeneratedScaffold = {
      ...scaffold,
      claudeMd: {
        ...scaffold.claudeMd,
        hardInvariants: ['Use SQLite for storage.'],
        softDecisions: [{ decision: 'Use SQLite for storage.', reason: 'Might revisit.' }],
      },
    }
    const files = buildScaffoldFileTree(overlapping)
    const paths = files.map((f) => f.path)
    expect(paths).toContain('.agent_governance/rules/use-sqlite-for-storage.md')
    expect(paths).toContain('.agent_governance/rules/provisional-use-sqlite-for-storage.md')
  })

  it('slice-plan.md content is unchanged from before this slice', () => {
    const files = buildScaffoldFileTree(scaffold)
    const slicePlan = files.find((f) => f.path === 'slice-plan.md')!
    expect(slicePlan.content).toContain('Slice 1')
    expect(slicePlan.content).toContain('Build the thing.')
  })

  it('README.md is static and present regardless of scaffold content', () => {
    const files = buildScaffoldFileTree(scaffold)
    const readme = files.find((f) => f.path === '.agent_governance/README.md')!
    expect(readme.content).toContain('any agent')
    expect(readme.content).toContain('rules/')
  })
})
