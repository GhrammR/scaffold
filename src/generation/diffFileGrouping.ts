import type { KeyedListDiff, ListDiff, ScaffoldDiffSummary } from './diffScaffold'

export interface FileGroupTotals {
  filename: string
  added: number
  removed: number
  modified: number
}

function sumListDiffs(diffs: ListDiff[]): { added: number; removed: number } {
  return diffs.reduce(
    (acc, d) => ({ added: acc.added + d.added.length, removed: acc.removed + d.removed.length }),
    { added: 0, removed: 0 },
  )
}

function sumKeyedListDiffs(diffs: KeyedListDiff[]): { added: number; removed: number; modified: number } {
  return diffs.reduce(
    (acc, d) => ({
      added: acc.added + d.added.length,
      removed: acc.removed + d.removed.length,
      modified: acc.modified + d.modified.length,
    }),
    { added: 0, removed: 0, modified: 0 },
  )
}

// Which ScaffoldDiffSummary fields live in which generated file. Hard
// invariants and soft decisions are deliberately excluded: as of the
// .agent_governance/ folder structure, each one is its own rule file with its
// own Level 1/2 diff already — a separate field-level rollup for them here
// would be redundant. What remains (prose + known forks + conventions) lives
// in AGENTS.md; slices still live in slice-plan.md.
export function groupDiffTotalsByFile(diff: ScaffoldDiffSummary): FileGroupTotals[] {
  const proseChanges = (diff.projectSummaryChanged ? 1 : 0) + (diff.stackArchitectureChanged ? 1 : 0)
  const agentsMdLists = sumListDiffs([diff.conventions])
  const agentsMdKeyed = sumKeyedListDiffs([diff.knownForks])
  const slicePlanKeyed = sumKeyedListDiffs([diff.slices])

  return [
    {
      filename: 'AGENTS.md',
      added: agentsMdLists.added + agentsMdKeyed.added,
      removed: agentsMdLists.removed + agentsMdKeyed.removed,
      modified: proseChanges + agentsMdKeyed.modified,
    },
    {
      filename: 'slice-plan.md',
      added: slicePlanKeyed.added,
      removed: slicePlanKeyed.removed,
      modified: slicePlanKeyed.modified,
    },
  ]
}
