import type { ClaudeMdContent, SlicePlanContent } from './types'

function bulletList(items: string[]): string {
  if (items.length === 0) return '_None established._'
  return items.map((item) => `- ${item}`).join('\n')
}

export const CLAUDE_MD_ENTRY = `# CLAUDE.md

@AGENTS.md

This is the entry point for Claude Code. The canonical governance lives in
\`.agent_governance/\` and AGENTS.md — read those on startup.
`

export function renderAgentsMd(content: ClaudeMdContent): string {
  const forksSection =
    content.knownForks.length === 0
      ? '_None surfaced._'
      : content.knownForks.map((f) => `- **${f.fork}**\n  Consideration: ${f.consideration}`).join('\n')

  const hasHardInvariants = content.hardInvariants.length > 0
  const hasSoftDecisions = content.softDecisions.length > 0

  return `# AGENTS.md

## Project Summary

${content.projectSummary}

## Stack & Architecture

${content.stackArchitecture}

## Non-Negotiable Invariants

${hasHardInvariants ? 'See `.agent_governance/rules/` for the full list — each hard invariant is its own rule file.' : '_None established._'}

## Soft / Provisional Decisions

${hasSoftDecisions ? 'See the `provisional-*.md` files under `.agent_governance/rules/` — each names why it is still changeable.' : '_None established._'}

## Known Forks / Weak Spots

${forksSection}

## Conventions

${bulletList(content.conventions)}

## Governance Layout

- \`.agent_governance/README.md\` — bootstrap, read first
- \`.agent_governance/rules/\` — hard invariants and provisional decisions (read all on startup)

See slice-plan.md for the build sequence.
`
}

export function renderSlicePlan(content: SlicePlanContent): string {
  if (content.slices.length === 0) {
    return '# Slice Plan\n\n_No slices established._\n'
  }
  const items = content.slices
    .map((s, i) => `${i + 1}. **${s.title}**\n   ${s.description}`)
    .join('\n\n')
  return `# Slice Plan\n\n${items}\n`
}
