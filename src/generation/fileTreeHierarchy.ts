export interface TreeFileNode {
  type: 'file'
  name: string
  path: string
}

export interface TreeFolderNode {
  type: 'folder'
  name: string
  path: string
  children: TreeNode[]
}

export type TreeNode = TreeFileNode | TreeFolderNode

// Parses a flat list of "/"-separated paths into a nested folder hierarchy.
// Folders sort before files at each level; both alphabetically by name.
export function buildFileTreeHierarchy(paths: string[]): TreeNode[] {
  const root: TreeFolderNode = { type: 'folder', name: '', path: '', children: [] }

  for (const path of paths) {
    const segments = path.split('/')
    let current = root

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]
      const isFile = i === segments.length - 1
      const segmentPath = segments.slice(0, i + 1).join('/')

      if (isFile) {
        current.children.push({ type: 'file', name: segment, path: segmentPath })
        continue
      }

      let folder = current.children.find(
        (child): child is TreeFolderNode => child.type === 'folder' && child.name === segment,
      )
      if (!folder) {
        folder = { type: 'folder', name: segment, path: segmentPath, children: [] }
        current.children.push(folder)
      }
      current = folder
    }
  }

  return sortChildren(root.children)
}

function sortChildren(nodes: TreeNode[]): TreeNode[] {
  const sorted = [...nodes].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  return sorted.map((node) => (node.type === 'folder' ? { ...node, children: sortChildren(node.children) } : node))
}
