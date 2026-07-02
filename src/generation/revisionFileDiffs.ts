import { countLineDiff, diffLines, type LineDiffOp } from './lineDiff'

export interface NamedFileInput {
  filename: string
  previous: string
  next: string
}

export interface NamedFileDiff {
  filename: string
  ops: LineDiffOp[]
  added: number
  removed: number
}

// A file that doesn't exist on one side is represented as ''. Running that
// through line-by-line LCS produces a spurious "removed: (blank line)" or
// "added: (blank line)" artifact, because ''.split('\n') is [''], not [].
// Treat an empty side as "the whole file is new/gone" instead.
function diffFileText(previous: string, next: string): LineDiffOp[] {
  if (previous === '' && next !== '') {
    return next.split('\n').map((line) => ({ type: 'added', line }))
  }
  if (next === '' && previous !== '') {
    return previous.split('\n').map((line) => ({ type: 'removed', line }))
  }
  return diffLines(previous, next)
}

// Only returns files that actually changed — a revision to one file shouldn't
// list every generated file, just the ones it touched.
export function computeNamedFileDiffs(files: NamedFileInput[]): NamedFileDiff[] {
  return files
    .map((file) => {
      const ops = diffFileText(file.previous, file.next)
      const { added, removed } = countLineDiff(ops)
      return { filename: file.filename, ops, added, removed }
    })
    .filter((file) => file.added > 0 || file.removed > 0)
}

// For an arbitrary-sized file tree (path -> content): diffs every path present
// in either tree, treating a path missing from one side as "" (whole-file
// added/removed, per diffFileText above).
export function namedFileDiffsFromTrees(
  previousTree: Record<string, string>,
  nextTree: Record<string, string>,
): NamedFileDiff[] {
  const paths = [...new Set([...Object.keys(previousTree), ...Object.keys(nextTree)])].sort()
  const files: NamedFileInput[] = paths.map((path) => ({
    filename: path,
    previous: previousTree[path] ?? '',
    next: nextTree[path] ?? '',
  }))
  return computeNamedFileDiffs(files)
}
