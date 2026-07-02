import { describe, expect, it } from 'vitest'
import { computeNamedFileDiffs } from './revisionFileDiffs'

describe('computeNamedFileDiffs', () => {
  it('only returns files that actually changed', () => {
    const result = computeNamedFileDiffs([
      { filename: 'CLAUDE.md', previous: 'a\nb', next: 'a\nX' },
      { filename: 'slice-plan.md', previous: 'same content', next: 'same content' },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].filename).toBe('CLAUDE.md')
  })

  it('returns no entries when nothing changed in any file', () => {
    const result = computeNamedFileDiffs([
      { filename: 'CLAUDE.md', previous: 'same', next: 'same' },
      { filename: 'slice-plan.md', previous: 'also same', next: 'also same' },
    ])
    expect(result).toEqual([])
  })

  it('includes the correct line-diff ops and counts for a changed file', () => {
    const result = computeNamedFileDiffs([{ filename: 'CLAUDE.md', previous: 'header\nold line\nfooter', next: 'header\nnew line\nfooter' }])
    expect(result).toHaveLength(1)
    expect(result[0].added).toBe(1)
    expect(result[0].removed).toBe(1)
    expect(result[0].ops).toEqual([
      { type: 'unchanged', line: 'header' },
      { type: 'removed', line: 'old line' },
      { type: 'added', line: 'new line' },
      { type: 'unchanged', line: 'footer' },
    ])
  })

  it('returns changed files in the order given, when multiple files changed', () => {
    const result = computeNamedFileDiffs([
      { filename: 'CLAUDE.md', previous: 'a', next: 'b' },
      { filename: 'slice-plan.md', previous: 'c', next: 'd' },
    ])
    expect(result.map((f) => f.filename)).toEqual(['CLAUDE.md', 'slice-plan.md'])
  })
})
