import { describe, expect, it } from 'vitest'
import { buildFileTreeHierarchy } from './fileTreeHierarchy'

describe('buildFileTreeHierarchy', () => {
  it('parses nested paths into a real folder hierarchy, not flattened names', () => {
    const paths = [
      '.agent_governance/README.md',
      '.agent_governance/rules/no-payment-storage.md',
      '.agent_governance/rules/provisional-use-sqlite.md',
      'CLAUDE.md',
      'AGENTS.md',
      'slice-plan.md',
    ]
    const tree = buildFileTreeHierarchy(paths)

    // Folders sort before files, alphabetically within each group.
    expect(tree.map((n) => n.name)).toEqual(['.agent_governance', 'AGENTS.md', 'CLAUDE.md', 'slice-plan.md'])

    const governanceFolder = tree.find((n) => n.name === '.agent_governance')
    expect(governanceFolder?.type).toBe('folder')
    if (governanceFolder?.type !== 'folder') throw new Error('expected folder')
    expect(governanceFolder.path).toBe('.agent_governance')
    expect(governanceFolder.children.map((n) => n.name)).toEqual(['rules', 'README.md'])

    const rulesFolder = governanceFolder.children.find((n) => n.name === 'rules')
    expect(rulesFolder?.type).toBe('folder')
    if (rulesFolder?.type !== 'folder') throw new Error('expected folder')
    expect(rulesFolder.path).toBe('.agent_governance/rules')
    expect(rulesFolder.children.map((n) => n.name)).toEqual(['no-payment-storage.md', 'provisional-use-sqlite.md'])
    expect(rulesFolder.children.map((n) => n.path)).toEqual([
      '.agent_governance/rules/no-payment-storage.md',
      '.agent_governance/rules/provisional-use-sqlite.md',
    ])
  })

  it('handles a flat list with no folders at all', () => {
    const tree = buildFileTreeHierarchy(['CLAUDE.md', 'AGENTS.md'])
    expect(tree).toEqual([
      { type: 'file', name: 'AGENTS.md', path: 'AGENTS.md' },
      { type: 'file', name: 'CLAUDE.md', path: 'CLAUDE.md' },
    ])
  })

  it('merges multiple files under the same folder into one folder node, not duplicates', () => {
    const tree = buildFileTreeHierarchy(['a/one.md', 'a/two.md', 'a/three.md'])
    expect(tree).toHaveLength(1)
    expect(tree[0].type).toBe('folder')
    if (tree[0].type !== 'folder') throw new Error('expected folder')
    expect(tree[0].children).toHaveLength(3)
  })

  it('returns an empty tree for no paths', () => {
    expect(buildFileTreeHierarchy([])).toEqual([])
  })
})
