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

// Which ScaffoldDiffSummary fields live in which generated file. Extend this
// when a new generated file gains tracked fields in ScaffoldDiffSummary.
export function groupDiffTotalsByFile(diff: ScaffoldDiffSummary): FileGroupTotals[] {
  const proseChanges = (diff.projectSummaryChanged ? 1 : 0) + (diff.stackArchitectureChanged ? 1 : 0)
  const claudeMdLists = sumListDiffs([diff.hardInvariants, diff.conventions])
  const claudeMdKeyed = sumKeyedListDiffs([diff.softDecisions, diff.knownForks])
  const slicePlanKeyed = sumKeyedListDiffs([diff.slices])

  return [
    {
      filename: 'CLAUDE.md',
      added: claudeMdLists.added + claudeMdKeyed.added,
      removed: claudeMdLists.removed + claudeMdKeyed.removed,
      modified: proseChanges + claudeMdKeyed.modified,
    },
    {
      filename: 'slice-plan.md',
      added: slicePlanKeyed.added,
      removed: slicePlanKeyed.removed,
      modified: slicePlanKeyed.modified,
    },
  ]
}
