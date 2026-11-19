import { describe, expect, it } from 'vitest'
import { buildFolderTree, listAncestorPaths, listVisibleFolderNodes, splitFolderPath, type NoteFolderNode } from '../../src/modules/notes/noteFolderTree'

/** Resume el árbol como texto indentado para comparar estructura, etiquetas y conteos de un vistazo. */
function describeTree(nodes: NoteFolderNode[]): string[] {
  return nodes.flatMap(node => [
    '  '.repeat(node.level - 1) + node.label + ' ' + node.ownCount + '/' + node.totalCount + (node.isStored ? '' : ' (implícita)'),
    ...describeTree(node.children)
  ])
}

describe('notes folder tree', () => {
  it('nests sub folders under their parent and keeps General first at the root', () => {
    const counts = new Map([['General', 2], ['General/Gil', 3], ['Clientes', 1]])
    const tree = buildFolderTree(['Zeta', 'General/Gil', 'Clientes', 'General', 'Árbol'], counts)
    expect(describeTree(tree)).toEqual([
      'General 2/5',
      '  Gil 3/3',
      'Árbol 0/0',
      'Clientes 1/1',
      'Zeta 0/0'
    ])
    expect(tree[0]?.children[0]?.path).toBe('General/Gil')
    expect(tree[0]?.children[0]?.level).toBe(2)
  })

  it('creates implicit intermediate nodes when only the child path exists', () => {
    const tree = buildFolderTree(['Clientes/2026/Enero'], new Map([['Clientes/2026/Enero', 4]]))
    expect(describeTree(tree)).toEqual([
      'Clientes 0/4 (implícita)',
      '  2026 0/4 (implícita)',
      '    Enero 4/4'
    ])
  })

  it('sorts siblings alphabetically with Spanish rules', () => {
    const tree = buildFolderTree(['A/ñu', 'A/nube', 'A/oso', 'A/Ética', 'A'], new Map())
    expect(tree[0]?.children.map(node => node.label)).toEqual(['Ética', 'nube', 'ñu', 'oso'])
  })

  it('lists ancestors and hides descendants of collapsed nodes', () => {
    expect(listAncestorPaths('A/B/C')).toEqual(['A', 'A/B'])
    expect(listAncestorPaths('A')).toEqual([])
    expect(splitFolderPath('A//B/')).toEqual(['A', 'B'])
    const tree = buildFolderTree(['A', 'A/B', 'A/B/C', 'D'], new Map())
    expect(listVisibleFolderNodes(tree, new Set()).map(node => node.path)).toEqual(['A', 'A/B', 'A/B/C', 'D'])
    expect(listVisibleFolderNodes(tree, new Set(['A/B'])).map(node => node.path)).toEqual(['A', 'A/B', 'D'])
    expect(listVisibleFolderNodes(tree, new Set(['A'])).map(node => node.path)).toEqual(['A', 'D'])
  })
})
