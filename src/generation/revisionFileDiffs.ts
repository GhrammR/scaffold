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

// Only returns files that actually changed — a revision to one file shouldn't
// list every generated file, just the ones it touched.
export function computeNamedFileDiffs(files: NamedFileInput[]): NamedFileDiff[] {
  return files
    .map((file) => {
      const ops = diffLines(file.previous, file.next)
      const { added, removed } = countLineDiff(ops)
      return { filename: file.filename, ops, added, removed }
    })
    .filter((file) => file.added > 0 || file.removed > 0)
}
