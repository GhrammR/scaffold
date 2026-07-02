import { describe, expect, it } from 'vitest'
import { computeNamedFileDiffs, namedFileDiffsFromTrees } from './revisionFileDiffs'

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

  it('treats a wholly new file (empty previous) as fully added, with no spurious blank-line artifact', () => {
    const result = computeNamedFileDiffs([
      { filename: '.agent_governance/rules/new-rule.md', previous: '', next: '# Rule\n\nNever do X.' },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].ops).toEqual([
      { type: 'added', line: '# Rule' },
      { type: 'added', line: '' },
      { type: 'added', line: 'Never do X.' },
    ])
    expect(result[0].removed).toBe(0)
  })

  it('treats a wholly removed file (empty next) as fully removed, with no spurious blank-line artifact', () => {
    const result = computeNamedFileDiffs([
      { filename: '.agent_governance/rules/old-rule.md', previous: '# Rule\n\nNever do X.', next: '' },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].ops).toEqual([
      { type: 'removed', line: '# Rule' },
      { type: 'removed', line: '' },
      { type: 'removed', line: 'Never do X.' },
    ])
    expect(result[0].added).toBe(0)
  })

  it('a file that is empty on both sides is not reported as changed', () => {
    const result = computeNamedFileDiffs([{ filename: 'x.md', previous: '', next: '' }])
    expect(result).toEqual([])
  })
})

describe('namedFileDiffsFromTrees', () => {
  it('diffs the union of paths across two file trees', () => {
    const previous = { 'CLAUDE.md': 'old claude content', 'AGENTS.md': 'same' }
    const next = { 'CLAUDE.md': 'new claude content', 'AGENTS.md': 'same' }
    const result = namedFileDiffsFromTrees(previous, next)
    expect(result).toHaveLength(1)
    expect(result[0].filename).toBe('CLAUDE.md')
  })

  it('reports a path present only in the next tree as wholly added', () => {
    const previous = { 'AGENTS.md': 'same' }
    const next = { 'AGENTS.md': 'same', '.agent_governance/rules/new-rule.md': 'Never do X.' }
    const result = namedFileDiffsFromTrees(previous, next)
    expect(result).toHaveLength(1)
    expect(result[0].filename).toBe('.agent_governance/rules/new-rule.md')
    expect(result[0].added).toBe(1)
    expect(result[0].removed).toBe(0)
  })

  it('reports a path present only in the previous tree as wholly removed', () => {
    const previous = { 'AGENTS.md': 'same', '.agent_governance/rules/old-rule.md': 'Never do X.' }
    const next = { 'AGENTS.md': 'same' }
    const result = namedFileDiffsFromTrees(previous, next)
    expect(result).toHaveLength(1)
    expect(result[0].filename).toBe('.agent_governance/rules/old-rule.md')
    expect(result[0].removed).toBe(1)
    expect(result[0].added).toBe(0)
  })

  it('returns nothing when both trees are identical', () => {
    const tree = { 'CLAUDE.md': 'x', 'AGENTS.md': 'y' }
    expect(namedFileDiffsFromTrees(tree, tree)).toEqual([])
  })
})
