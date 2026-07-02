import type { ClaudeMdContent, SlicePlanContent } from './types'

function bulletList(items: string[]): string {
  if (items.length === 0) return '_None established._'
  return items.map((item) => `- ${item}`).join('\n')
}

export function renderClaudeMd(content: ClaudeMdContent): string {
  const softSection =
    content.softDecisions.length === 0
      ? '_None established._'
      : content.softDecisions
          .map((d) => `- **${d.decision}**\n  Why provisional: ${d.reason}`)
          .join('\n')

  const forksSection =
    content.knownForks.length === 0
      ? '_None surfaced._'
      : content.knownForks.map((f) => `- **${f.fork}**\n  Consideration: ${f.consideration}`).join('\n')

  return `# CLAUDE.md

## 1. Project Summary

${content.projectSummary}

## 2. Stack & Architecture

${content.stackArchitecture}

## 3. Hard Invariants (Never Break)

${bulletList(content.hardInvariants)}

## 4. Soft / Provisional Decisions (Flagged Changeable)

${softSection}

## 5. Slice Plan

See slice-plan.md.

## 6. Known Forks / Weak Spots

${forksSection}

## 7. Conventions

${bulletList(content.conventions)}
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
