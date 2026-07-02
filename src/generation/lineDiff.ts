export type LineDiffOp =
  | { type: 'unchanged'; line: string }
  | { type: 'removed'; line: string }
  | { type: 'added'; line: string }

// Standard LCS-based line diff (Hunt-McIlroy style). O(n*m) — fine for the
// short markdown files Scaffold generates.
export function diffLines(previous: string, next: string): LineDiffOp[] {
  const a = previous.split('\n')
  const b = next.split('\n')
  const n = a.length
  const m = b.length

  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }

  const ops: LineDiffOp[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ type: 'unchanged', line: a[i] })
      i++
      j++
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      ops.push({ type: 'removed', line: a[i] })
      i++
    } else {
      ops.push({ type: 'added', line: b[j] })
      j++
    }
  }
  while (i < n) {
    ops.push({ type: 'removed', line: a[i] })
    i++
  }
  while (j < m) {
    ops.push({ type: 'added', line: b[j] })
    j++
  }
  return ops
}

export function countLineDiff(ops: LineDiffOp[]): { added: number; removed: number } {
  let added = 0
  let removed = 0
  for (const op of ops) {
    if (op.type === 'added') added++
    else if (op.type === 'removed') removed++
  }
  return { added, removed }
}
