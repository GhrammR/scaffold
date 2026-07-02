import type { ClaudeMdContent, GeneratedScaffold, KnownForkEntry, SliceEntry, SoftDecisionEntry } from './types'

export interface ListDiff {
  added: string[]
  removed: string[]
}

export interface KeyedListDiff extends ListDiff {
  modified: string[]
}

export interface ScaffoldDiffSummary {
  projectSummaryChanged: boolean
  stackArchitectureChanged: boolean
  hardInvariants: ListDiff
  conventions: ListDiff
  softDecisions: KeyedListDiff
  knownForks: KeyedListDiff
  slices: KeyedListDiff
}

function diffStringList(previous: string[], next: string[]): ListDiff {
  const previousSet = new Set(previous)
  const nextSet = new Set(next)
  return {
    added: next.filter((item) => !previousSet.has(item)),
    removed: previous.filter((item) => !nextSet.has(item)),
  }
}

function diffKeyedList<T>(previous: T[], next: T[], keyOf: (item: T) => string, bodyOf: (item: T) => string): KeyedListDiff {
  const previousByKey = new Map(previous.map((item) => [keyOf(item), bodyOf(item)]))
  const nextByKey = new Map(next.map((item) => [keyOf(item), bodyOf(item)]))

  const added: string[] = []
  const modified: string[] = []
  for (const [key, body] of nextByKey) {
    if (!previousByKey.has(key)) {
      added.push(key)
    } else if (previousByKey.get(key) !== body) {
      modified.push(key)
    }
  }
  const removed = [...previousByKey.keys()].filter((key) => !nextByKey.has(key))

  return { added, removed, modified }
}

export function diffScaffold(previous: GeneratedScaffold, next: GeneratedScaffold): ScaffoldDiffSummary {
  const prevClaudeMd: ClaudeMdContent = previous.claudeMd
  const nextClaudeMd: ClaudeMdContent = next.claudeMd

  return {
    projectSummaryChanged: prevClaudeMd.projectSummary !== nextClaudeMd.projectSummary,
    stackArchitectureChanged: prevClaudeMd.stackArchitecture !== nextClaudeMd.stackArchitecture,
    hardInvariants: diffStringList(prevClaudeMd.hardInvariants, nextClaudeMd.hardInvariants),
    conventions: diffStringList(prevClaudeMd.conventions, nextClaudeMd.conventions),
    softDecisions: diffKeyedList<SoftDecisionEntry>(
      prevClaudeMd.softDecisions,
      nextClaudeMd.softDecisions,
      (d) => d.decision,
      (d) => d.reason,
    ),
    knownForks: diffKeyedList<KnownForkEntry>(
      prevClaudeMd.knownForks,
      nextClaudeMd.knownForks,
      (f) => f.fork,
      (f) => f.consideration,
    ),
    slices: diffKeyedList<SliceEntry>(
      previous.slicePlan.slices,
      next.slicePlan.slices,
      (s) => s.title,
      (s) => s.description,
    ),
  }
}

export interface DiffTotals {
  added: number
  removed: number
  modified: number
}

export function countDiffTotals(diff: ScaffoldDiffSummary): DiffTotals {
  let added = 0
  let removed = 0
  let modified = 0

  if (diff.projectSummaryChanged) modified += 1
  if (diff.stackArchitectureChanged) modified += 1

  for (const listDiff of [diff.hardInvariants, diff.conventions]) {
    added += listDiff.added.length
    removed += listDiff.removed.length
  }

  for (const keyedDiff of [diff.softDecisions, diff.knownForks, diff.slices]) {
    added += keyedDiff.added.length
    removed += keyedDiff.removed.length
    modified += keyedDiff.modified.length
  }

  return { added, removed, modified }
}

function describeListDiff(label: string, diff: ListDiff): string | null {
  const parts: string[] = []
  if (diff.added.length > 0) parts.push(`+${diff.added.length}: ${diff.added.join('; ')}`)
  if (diff.removed.length > 0) parts.push(`-${diff.removed.length}: ${diff.removed.join('; ')}`)
  if (parts.length === 0) return null
  return `${label} (${parts.join(', ')})`
}

function describeKeyedListDiff(label: string, diff: KeyedListDiff): string | null {
  const parts: string[] = []
  if (diff.added.length > 0) parts.push(`+${diff.added.length}: ${diff.added.join('; ')}`)
  if (diff.removed.length > 0) parts.push(`-${diff.removed.length}: ${diff.removed.join('; ')}`)
  if (diff.modified.length > 0) parts.push(`changed: ${diff.modified.join('; ')}`)
  if (parts.length === 0) return null
  return `${label} (${parts.join(', ')})`
}

export function summarizeDiff(diff: ScaffoldDiffSummary): string {
  const changed: string[] = []
  const unchanged: string[] = []

  if (diff.projectSummaryChanged) changed.push('project summary')
  else unchanged.push('project summary')

  if (diff.stackArchitectureChanged) changed.push('stack & architecture')
  else unchanged.push('stack & architecture')

  const hardDesc = describeListDiff('hard invariants', diff.hardInvariants)
  if (hardDesc) changed.push(hardDesc)
  else unchanged.push('hard invariants')

  const softDesc = describeKeyedListDiff('soft decisions', diff.softDecisions)
  if (softDesc) changed.push(softDesc)
  else unchanged.push('soft decisions')

  const forksDesc = describeKeyedListDiff('known forks', diff.knownForks)
  if (forksDesc) changed.push(forksDesc)
  else unchanged.push('known forks')

  const conventionsDesc = describeListDiff('conventions', diff.conventions)
  if (conventionsDesc) changed.push(conventionsDesc)
  else unchanged.push('conventions')

  const slicesDesc = describeKeyedListDiff('slice plan', diff.slices)
  if (slicesDesc) changed.push(slicesDesc)
  else unchanged.push('slice plan')

  if (changed.length === 0) return 'No changes.'

  const changedText = `Changed: ${changed.join('. ')}.`
  const unchangedText = unchanged.length > 0 ? ` Unchanged: ${unchanged.join(', ')}.` : ''
  return changedText + unchangedText
}
