<script setup lang="ts">
import { computed, nextTick, provide, ref, toRef, watch } from 'vue'
import NoteFolderNode from './NoteFolderNode.vue'
import { listAncestorPaths, listVisibleFolderNodes, type NoteFolderNode as FolderTreeNode } from './noteFolderTree'
import { noteFolderTreeContextKey } from './noteFolderTreeContext'
import { readCollapsedFolderPaths, saveCollapsedFolderPaths } from './folderTreePreferences'
import { noteDragType } from './notesView'

/**
 * Árbol de carpetas del índice de Notas (patrón tree de WAI-ARIA) con subcarpetas en acordeón.
 *
 * Estado que posee:
 * - Carpetas contraídas: preferencia visual de este equipo (`folderTreePreferences`, localStorage con try/catch).
 *   Al elegir una carpeta, sus ancestros se abren solos para que la selección siempre se vea.
 * - Nodo enfocable (tabindex itinerante): un solo `treeitem` tiene `tabindex="0"`; por defecto la carpeta
 *   elegida si está visible, si no la primera.
 * - Carpeta bajo un arrastre de nota (contorno punteado).
 *
 * Teclado (sobre el treeitem enfocado):
 * - ↑/↓ nodo visible anterior/siguiente; Inicio/Fin primero/último.
 * - → abre el nodo cerrado o pasa a su primer hijo; ← cierra el nodo abierto o sube a su padre.
 * - Enter elige la carpeta (filtra las notas, como el clic); Espacio abre/cierra si tiene subcarpetas
 *   y, si no tiene, la elige.
 * - Shift+F10 o la tecla de menú abren el menú contextual de la carpeta (2026-10-10), igual que el clic derecho; el
 *   menú lo pinta NotesPage, que es quien ejecuta sus acciones.
 * Sólo emite intenciones; NotesPage cambia y guarda las notas.
 */
const props = defineProps<{ nodes: FolderTreeNode[]; selectedView: string; label: string }>()
const emit = defineEmits<{ select: [path: string]; deleteFolder: [path: string]; dropNote: [noteId: string, path: string]; openFolderMenu: [path: string, x: number, y: number] }>()

const collapsedPaths = ref<Set<string>>(readCollapsedFolderPaths())
const requestedFocusPath = ref('')
const dropTargetPath = ref<string | null>(null)
const itemElements = new Map<string, HTMLElement>()

const visibleNodes = computed(() => listVisibleFolderNodes(props.nodes, collapsedPaths.value))
/** Nodo enfocable válido: el pedido, la carpeta elegida o el primero (un nodo oculto nunca queda enfocable). */
const focusedPath = computed(() => {
  const visiblePaths = visibleNodes.value.map(node => node.path)
  if (visiblePaths.includes(requestedFocusPath.value)) return requestedFocusPath.value
  if (visiblePaths.includes(props.selectedView)) return props.selectedView
  return visiblePaths[0] ?? ''
})

function changeCollapsedPaths(change: (paths: Set<string>) => void): void {
  const next = new Set(collapsedPaths.value)
  change(next)
  collapsedPaths.value = next
  saveCollapsedFolderPaths(next)
}
function isExpanded(path: string): boolean { return !collapsedPaths.value.has(path) }
function setExpanded(path: string, shouldExpand: boolean): void {
  if (isExpanded(path) === shouldExpand) return
  // Se mide antes de cerrar: después el grupo queda inert y el foco real se perdería.
  const group = itemElements.get(path)?.querySelector('[role="group"]')
  const hasFocusInside = Boolean(group?.contains(document.activeElement))
  const hadRovingInside = focusedPath.value.startsWith(path + '/')
  changeCollapsedPaths(paths => { if (shouldExpand) paths.delete(path); else paths.add(path) })
  // Al cerrar un nodo que contenía el foco, el foco sube a ese nodo para no quedar dentro de un grupo oculto.
  if (!shouldExpand && (hasFocusInside || hadRovingInside)) focusItem(path, hasFocusInside)
}
function toggleFolder(path: string): void { setExpanded(path, !isExpanded(path)) }

/** Mueve el tabindex itinerante y, si el foco ya está en el árbol, el foco real. */
function focusItem(path: string, shouldForceFocus = false): void {
  requestedFocusPath.value = path
  void nextTick(() => {
    const element = itemElements.get(path)
    const treeElement = element?.closest('[role="tree"]')
    if (element && (shouldForceFocus || treeElement?.contains(document.activeElement))) element.focus()
  })
}
function selectFolder(path: string): void { focusItem(path, true); emit('select', path) }

// La carpeta elegida (también desde fuera, p. ej. al crearla) abre a sus ancestros.
watch(() => props.selectedView, path => {
  const closedAncestors = listAncestorPaths(path).filter(ancestor => collapsedPaths.value.has(ancestor))
  if (closedAncestors.length) changeCollapsedPaths(paths => closedAncestors.forEach(ancestor => paths.delete(ancestor)))
}, { immediate: true })

/** Ruta del treeitem que recibió el evento, o null si el evento viene de otro elemento (p. ej. un botón del renglón). */
function readTreeItemPath(target: EventTarget | null): string | null {
  return target instanceof HTMLElement && target.getAttribute('role') === 'treeitem' ? target.dataset.folderPath ?? null : null
}
/** Si el foco llega a un nodo por clic o desde fuera, ese nodo pasa a ser el del tabindex itinerante. */
function rememberFocusedItem(event: FocusEvent): void {
  const path = readTreeItemPath(event.target)
  if (path !== null) requestedFocusPath.value = path
}
function handleKeydown(event: KeyboardEvent): void {
  // Las teclas sobre botones del renglón (quitar carpeta) son de esos botones.
  const currentPath = readTreeItemPath(event.target)
  if (currentPath === null) return
  const nodes = visibleNodes.value
  const index = nodes.findIndex(node => node.path === currentPath)
  const node = nodes[index]
  if (!node) return
  const hasChildren = node.children.length > 0
  if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) {
    event.preventDefault()
    const bounds = (itemElements.get(node.path)?.querySelector('.folder-row') ?? event.target as HTMLElement).getBoundingClientRect()
    emit('openFolderMenu', node.path, bounds.left + 24, bounds.bottom)
    return
  }
  const actions: Record<string, () => void> = {
    ArrowDown: () => { const next = nodes[index + 1]; if (next) focusItem(next.path, true) },
    ArrowUp: () => { const previous = nodes[index - 1]; if (previous) focusItem(previous.path, true) },
    Home: () => { const first = nodes[0]; if (first) focusItem(first.path, true) },
    End: () => { const last = nodes[nodes.length - 1]; if (last) focusItem(last.path, true) },
    ArrowRight: () => {
      if (!hasChildren) return
      if (!isExpanded(node.path)) setExpanded(node.path, true)
      else { const firstChild = node.children[0]; if (firstChild) focusItem(firstChild.path, true) }
    },
    ArrowLeft: () => {
      if (hasChildren && isExpanded(node.path)) { setExpanded(node.path, false); return }
      const parentPath = listAncestorPaths(node.path).pop()
      if (parentPath) focusItem(parentPath, true)
    },
    Enter: () => selectFolder(node.path),
    ' ': () => { if (hasChildren) toggleFolder(node.path); else selectFolder(node.path) }
  }
  const action = actions[event.key]
  if (!action) return
  event.preventDefault()
  action()
}

provide(noteFolderTreeContextKey, {
  selectedView: toRef(props, 'selectedView'),
  focusedPath,
  dropTargetPath,
  isExpanded,
  toggleFolder,
  selectFolder,
  registerItemElement: (path, element) => { if (element) itemElements.set(path, element); else itemElements.delete(path) },
  allowNoteDrop: (event, path) => {
    // Sólo se aceptan filas de nota (tipo propio), nunca texto o archivos soltados desde fuera.
    if (!event.dataTransfer?.types.includes(noteDragType)) return
    event.preventDefault(); event.dataTransfer.dropEffect = 'move'; dropTargetPath.value = path
  },
  leaveNoteDrop: path => { if (dropTargetPath.value === path) dropTargetPath.value = null },
  dropNote: (event, path) => {
    dropTargetPath.value = null
    const noteId = event.dataTransfer?.getData(noteDragType)
    if (noteId) { event.preventDefault(); emit('dropNote', noteId, path) }
  },
  deleteFolder: path => emit('deleteFolder', path),
  openFolderMenu: (path, x, y) => { focusItem(path, true); emit('openFolderMenu', path, x, y) }
})
</script>
<template>
  <ul
    v-if="nodes.length"
    role="tree"
    class="folder-tree"
    :aria-label="label"
    @keydown="handleKeydown"
    @focusin="rememberFocusedItem"
  >
    <NoteFolderNode
      v-for="node in nodes"
      :key="node.path"
      :node="node"
    />
  </ul>
  <p
    v-else
    class="folder-tree-empty"
  >
    Sin carpetas
  </p>
</template>
<style scoped>
/* Medidas compartidas por todos los niveles (los nodos las heredan). */
.folder-tree { --folderRowHeight: 34px; --folderIndent: 22px; --folderTrunk: 12px; --folderCountWidth: 3ch; --folderActionWidth: 32px; margin: 0; padding: 4px 0 4px var(--folderIndent); font-size: 14px; min-width: 0; }
.folder-tree-empty { margin: 0; padding: 8px 0 8px 22px; font-size: 12px; color: var(--mutedTextColor); }
</style>
