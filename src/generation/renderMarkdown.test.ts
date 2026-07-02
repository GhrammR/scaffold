import { describe, expect, it } from 'vitest'
import { CLAUDE_MD_ENTRY, renderAgentsMd, renderSlicePlan } from './renderMarkdown'
import type { ClaudeMdContent, SlicePlanContent } from './types'

const fullContent: ClaudeMdContent = {
  projectSummary: 'A recipe app for meal planning.',
  stackArchitecture: 'React + TypeScript, client-side only.',
  hardInvariants: ['Never store payment details.'],
  softDecisions: [{ decision: 'Use SQLite for storage.', reason: 'User said "might switch to Postgres later".' }],
  knownForks: [{ fork: 'How recipes are shared between users.', consideration: 'Could be link-based or account-based.' }],
  conventions: ['Use Prettier defaults.'],
}

describe('CLAUDE_MD_ENTRY', () => {
  it('is a thin entry point that imports AGENTS.md and duplicates no project content', () => {
    expect(CLAUDE_MD_ENTRY).toContain('@AGENTS.md')
    expect(CLAUDE_MD_ENTRY).not.toContain('A recipe app')
    expect(CLAUDE_MD_ENTRY).not.toContain('Never store payment details.')
  })
})

describe('renderAgentsMd', () => {
  it('renders the substantive sections', () => {
    const md = renderAgentsMd(fullContent)
    expect(md).toContain('## Project Summary')
    expect(md).toContain('## Stack & Architecture')
    expect(md).toContain('## Non-Negotiable Invariants')
    expect(md).toContain('## Soft / Provisional Decisions')
    expect(md).toContain('## Known Forks / Weak Spots')
    expect(md).toContain('## Conventions')
    expect(md).toContain('## Governance Layout')
  })

  it('includes the project summary and stack, but points to rules/ rather than inlining hard/soft content', () => {
    const md = renderAgentsMd(fullContent)
    expect(md).toContain('A recipe app for meal planning.')
    expect(md).toContain('React + TypeScript, client-side only.')
    expect(md).not.toContain('Never store payment details.')
    expect(md).not.toContain('Use SQLite for storage.')
    expect(md).toContain('.agent_governance/rules/')
    expect(md).toContain('provisional-*.md')
  })

  it('still inlines known forks and conventions directly', () => {
    const md = renderAgentsMd(fullContent)
    expect(md).toContain('How recipes are shared between users.')
    expect(md).toContain('Use Prettier defaults.')
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
    const md = renderAgentsMd(empty)
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
