import { describe, expect, it } from 'vitest'
import { renderClaudeMd, renderSlicePlan } from './renderMarkdown'
import type { ClaudeMdContent, SlicePlanContent } from './types'

const fullContent: ClaudeMdContent = {
  projectSummary: 'A recipe app for meal planning.',
  stackArchitecture: 'React + TypeScript, client-side only.',
  hardInvariants: ['Never store payment details.'],
  softDecisions: [{ decision: 'Use SQLite for storage.', reason: 'User said "might switch to Postgres later".' }],
  knownForks: [{ fork: 'How recipes are shared between users.', consideration: 'Could be link-based or account-based.' }],
  conventions: ['Use Prettier defaults.'],
}

describe('renderClaudeMd', () => {
  it('renders all 7 sections with numbered headings', () => {
    const md = renderClaudeMd(fullContent)
    expect(md).toContain('## 1. Project Summary')
    expect(md).toContain('## 2. Stack & Architecture')
    expect(md).toContain('## 3. Hard Invariants (Never Break)')
    expect(md).toContain('## 4. Soft / Provisional Decisions (Flagged Changeable)')
    expect(md).toContain('## 5. Slice Plan')
    expect(md).toContain('## 6. Known Forks / Weak Spots')
    expect(md).toContain('## 7. Conventions')
  })

  it('includes soft decision reasons inline, distinct from hard invariants', () => {
    const md = renderClaudeMd(fullContent)
    expect(md).toContain('Never store payment details.')
    expect(md).toContain('Use SQLite for storage.')
    expect(md).toContain('Why provisional: User said "might switch to Postgres later".')
  })

  it('renders a fallback message for empty sections instead of a blank heading', () => {
    const empty: ClaudeMdContent = {
      projectSummary: 'X',
      stackArchitecture: 'Y',
      hardInvariants: [],
      softDecisions: [],
      knownForks: [],
      conventions: [],
    }
    const md = renderClaudeMd(empty)
    expect(md).toContain('_None established._')
    expect(md).toContain('_None surfaced._')
  })
})

describe('renderSlicePlan', () => {
  it('renders an ordered numbered list of slices', () => {
    const content: SlicePlanContent = {
      slices: [
        { title: 'The interview', description: 'Conversation design.' },
        { title: 'Generate the scaffold', description: 'Render CLAUDE.md and slice-plan.md.' },
      ],
    }
    const md = renderSlicePlan(content)
    expect(md).toContain('1. **The interview**')
    expect(md).toContain('2. **Generate the scaffold**')
  })

  it('renders a fallback for no slices', () => {
    expect(renderSlicePlan({ slices: [] })).toContain('_No slices established._')
  })
})
