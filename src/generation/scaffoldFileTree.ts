import type { GeneratedScaffold } from './types'
import { CLAUDE_MD_ENTRY, renderAgentsMd, renderSlicePlan } from './renderMarkdown'

export interface ScaffoldFileEntry {
  path: string
  content: string
}

export const AGENT_GOVERNANCE_README = `# .agent_governance/

This folder is the canonical, agent-agnostic governance store for this repo —
read by any agent (Claude Code, Codex, or otherwise) working here.

On startup, read every file in \`rules/\` — they are mandatory constraints, not
suggestions. Files prefixed \`provisional-\` are explicitly open to change; the
rest are hard invariants.

CLAUDE.md and AGENTS.md at the repo root are the entry points that point here.
`

// Derives a short, stable, human-legible slug from rule text. Deterministic and
// content-based (not LLM-assigned) so untouched items keep the same path across
// revisions, while a genuinely different rule gets a genuinely different path.
export function slugify(text: string): string {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
  const slug = words.join('-')
  return slug || 'rule'
}

function uniqueSlug(base: string, used: Map<string, number>): string {
  const count = used.get(base) ?? 0
  used.set(base, count + 1)
  return count === 0 ? base : `${base}-${count + 1}`
}

function renderHardInvariantFile(text: string): string {
  return `# Rule

${text}
`
}

function renderProvisionalFile(decision: string, reason: string): string {
  return `# Provisional Decision

STATUS: Provisional — may change.

${decision}

Why provisional: ${reason}
`
}

export function buildScaffoldFileTree(scaffold: GeneratedScaffold): ScaffoldFileEntry[] {
  const { claudeMd, slicePlan } = scaffold
  const entries: ScaffoldFileEntry[] = []

  entries.push({ path: '.agent_governance/README.md', content: AGENT_GOVERNANCE_README })

  // Separate counters — hard and provisional files never share a path
  // (the "provisional-" prefix already disambiguates them), so a hard
  // invariant and a soft decision that happen to slugify the same way
  // shouldn't force each other into a needless "-2" suffix.
  const usedHardSlugs = new Map<string, number>()
  const usedSoftSlugs = new Map<string, number>()

  for (const invariant of claudeMd.hardInvariants) {
    const slug = uniqueSlug(slugify(invariant), usedHardSlugs)
    entries.push({
      path: `.agent_governance/rules/${slug}.md`,
      content: renderHardInvariantFile(invariant),
    })
  }

  for (const soft of claudeMd.softDecisions) {
    const slug = uniqueSlug(slugify(soft.decision), usedSoftSlugs)
    entries.push({
      path: `.agent_governance/rules/provisional-${slug}.md`,
      content: renderProvisionalFile(soft.decision, soft.reason),
    })
  }

  entries.push({ path: 'CLAUDE.md', content: CLAUDE_MD_ENTRY })
  entries.push({ path: 'AGENTS.md', content: renderAgentsMd(claudeMd) })
  entries.push({ path: 'slice-plan.md', content: renderSlicePlan(slicePlan) })

  return entries
}
