/**
 * Árbol de carpetas de Notas a partir de sus rutas guardadas.
 *
 * Las carpetas se guardan como rutas planas separadas por `/` (por ejemplo `General/Gil`; así las arma
 * "Nueva carpeta" y así llegan del `folderPath` heredado). El índice las muestra anidadas:
 * - Cada segmento de la ruta es un nodo; si sólo existe `A/B`, se crea el nodo intermedio `A`
 *   marcado como `isStored: false` (no se puede quitar porque no está en la lista de carpetas).
 * - Los hermanos se ordenan alfabéticamente (es-MX); en la raíz General va primero, como siempre.
 * - `ownCount` cuenta las notas de esa carpeta exacta (lo que muestra el filtro al elegirla) y
 *   `totalCount` suma además las de todas sus subcarpetas.
 * Son funciones puras: no tocan el estado de notas ni el DOM.
 */

/** Separador de segmentos en las rutas de carpeta guardadas. */
export const folderPathSeparator = '/'
/** Carpeta base que nunca se quita y que encabeza la raíz del árbol. */
export const defaultFolderName = 'General'

export interface NoteFolderNode {
  /** Ruta completa guardada (`A/B`); es también la clave de la vista que filtra las notas. */
  path: string
  /** Último segmento de la ruta: lo que se ve como etiqueta del nodo. */
  label: string
  /** Nivel en el árbol empezando en 1 (como `aria-level`). */
  level: number
  /** Si la ruta existe en la lista de carpetas o sólo es un intermedio implícito. */
  isStored: boolean
  ownCount: number
  totalCount: number
  children: NoteFolderNode[]
}

/**
 * Divide una ruta en segmentos omitiendo los vacíos. No recorta espacios: la ruta del nodo debe ser idéntica a
 * la guardada en las notas para que el conteo y el filtro coincidan.
 */
export function splitFolderPath(path: string): string[] {
  return path.split(folderPathSeparator).filter(Boolean)
}

/** Rutas de los ancestros de una carpeta, de la raíz hacia abajo (`A/B/C` → `A`, `A/B`). */
export function listAncestorPaths(path: string): string[] {
  const segments = splitFolderPath(path)
  return segments.slice(1).map((segment, index) => segments.slice(0, index + 1).join(folderPathSeparator))
}

/** Ordena hermanos alfabéticamente (es-MX); en la raíz, General va primero. */
function compareSiblings(left: NoteFolderNode, right: NoteFolderNode): number {
  if (left.level === 1 && left.path !== right.path) {
    if (left.path === defaultFolderName) return -1
    if (right.path === defaultFolderName) return 1
  }
  return left.label.localeCompare(right.label, 'es-MX', { sensitivity: 'base' }) || left.label.localeCompare(right.label, 'es-MX')
}

/**
 * Construye el árbol de carpetas.
 * @param folderPaths rutas guardadas en `notesState.folders`.
 * @param countsByFolder notas activas por ruta exacta de carpeta.
 */
export function buildFolderTree(folderPaths: string[], countsByFolder: ReadonlyMap<string, number>): NoteFolderNode[] {
  const roots: NoteFolderNode[] = []
  const nodesByPath = new Map<string, NoteFolderNode>()
  const storedPaths = new Set(folderPaths.map(path => splitFolderPath(path).join(folderPathSeparator)))
  for (const folderPath of folderPaths) {
    const segments = splitFolderPath(folderPath)
    let siblings = roots
    segments.forEach((segment, index) => {
      const path = segments.slice(0, index + 1).join(folderPathSeparator)
      let node = nodesByPath.get(path)
      if (!node) {
        node = { path, label: segment, level: index + 1, isStored: storedPaths.has(path), ownCount: countsByFolder.get(path) ?? 0, totalCount: 0, children: [] }
        nodesByPath.set(path, node)
        siblings.push(node)
      }
      siblings = node.children
    })
  }
  // Ordena y suma de abajo hacia arriba en una sola pasada recursiva.
  const finish = (nodes: NoteFolderNode[]): number => {
    nodes.sort(compareSiblings)
    return nodes.reduce((sum, node) => {
      node.totalCount = node.ownCount + finish(node.children)
      return sum + node.totalCount
    }, 0)
  }
  finish(roots)
  return roots
}

/**
 * Nodos visibles en orden de lectura (lo que recorre el teclado con ↑/↓): un nodo contraído oculta a
 * todos sus descendientes.
 */
export function listVisibleFolderNodes(nodes: NoteFolderNode[], collapsedPaths: ReadonlySet<string>): NoteFolderNode[] {
  return nodes.flatMap(node => [node, ...(node.children.length && !collapsedPaths.has(node.path) ? listVisibleFolderNodes(node.children, collapsedPaths) : [])])
}
