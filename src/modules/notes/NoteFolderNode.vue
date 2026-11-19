<script setup lang="ts">
import { computed, inject } from 'vue'
import { ChevronRight, Folder, FolderOpen, Trash2 } from '@lucide/vue'
import HoldButton from '../../shared/vueBits/HoldButton.vue'
import { defaultFolderName, type NoteFolderNode } from './noteFolderTree'
import { describeDocumentCount, formatFolderPath, noteFolderTreeContextKey, type NoteFolderTreeContext } from './noteFolderTreeContext'

/**
 * Un nodo del árbol de carpetas (`role="treeitem"`) y, si tiene subcarpetas, su grupo anidado.
 * Se renderiza a sí mismo para cada hijo, así que el árbol admite cualquier profundidad.
 *
 * Renglón: [chevrón o hueco] [icono] [nombre…] [conteo] [quitar o hueco]. Las dos últimas columnas tienen
 * ancho fijo para que el conteo quede alineado en una sola columna haya o no botón de quitar.
 * El nombre muestra sólo el último segmento; la ruta completa va en `title` y en el nombre accesible.
 *
 * El acordeón usa grid-template-rows (0fr ↔ 1fr, 200 ms; sin transición con movimiento reducido). Un grupo
 * cerrado queda `inert`: sus nodos y botones no reciben foco ni aparecen para lectores de pantalla.
 * El teclado lo maneja `NoteFolderTree`; aquí sólo hay clics, arrastre y el clic derecho, que pide al árbol el menú
 * contextual de la carpeta (2026-10-10).
 */
const props = defineProps<{ node: NoteFolderNode }>()
const injectedTree = inject(noteFolderTreeContextKey)
if (!injectedTree) throw new Error('NoteFolderNode requiere un NoteFolderTree.')
const tree: NoteFolderTreeContext = injectedTree

const hasChildren = computed(() => props.node.children.length > 0)
const isExpanded = computed(() => hasChildren.value && tree.isExpanded(props.node.path))
const isSelected = computed(() => tree.selectedView.value === props.node.path)
const fullPath = computed(() => formatFolderPath(props.node.path))
/** El total con subcarpetas sólo se menciona cuando aporta algo distinto del conteo propio. */
const accessibleName = computed(() => fullPath.value + ', ' + describeDocumentCount(props.node.ownCount)
  + (props.node.totalCount !== props.node.ownCount ? ' (' + describeDocumentCount(props.node.totalCount) + ' con subcarpetas)' : ''))
const rowTitle = computed(() => props.node.totalCount !== props.node.ownCount ? fullPath.value + ' · ' + props.node.totalCount + ' con subcarpetas' : fullPath.value)
/** Sólo se quitan carpetas guardadas; General y los intermedios implícitos no. */
const canDelete = computed(() => props.node.isStored && props.node.path !== defaultFolderName)
</script>
<template>
  <li
    :ref="element => tree.registerItemElement(node.path, element as HTMLElement | null)"
    role="treeitem"
    class="folder-node"
    :aria-level="node.level"
    :aria-expanded="hasChildren ? isExpanded : undefined"
    :aria-selected="isSelected"
    :aria-label="accessibleName"
    :tabindex="tree.focusedPath.value === node.path ? 0 : -1"
    :data-folder-path="node.path"
  >
    <div
      class="folder-row"
      :class="{ 'is-selected': isSelected, 'is-drop-target': tree.dropTargetPath.value === node.path }"
      :title="rowTitle"
      @click="tree.selectFolder(node.path)"
      @dragover="tree.allowNoteDrop($event, node.path)"
      @dragleave="tree.leaveNoteDrop(node.path)"
      @drop="tree.dropNote($event, node.path)"
      @contextmenu.prevent="tree.openFolderMenu(node.path, $event.clientX, $event.clientY)"
    >
      <button
        v-if="hasChildren"
        type="button"
        class="folder-toggle"
        tabindex="-1"
        :aria-label="(isExpanded ? 'Contraer ' : 'Expandir ') + fullPath"
        @click.stop="tree.toggleFolder(node.path)"
      >
        <ChevronRight
          :size="14"
          aria-hidden="true"
        />
      </button>
      <span
        v-else
        class="folder-toggle-spacer"
        aria-hidden="true"
      />
      <component
        :is="isSelected ? FolderOpen : Folder"
        :size="15"
        aria-hidden="true"
      />
      <span class="folder-label">{{ node.label }}</span>
      <span
        class="folder-count"
        aria-hidden="true"
      >{{ node.ownCount }}</span>
      <span
        class="folder-action"
        @click.stop
      >
        <HoldButton
          v-if="canDelete"
          is-icon-only
          size="small"
          :aria-label="'Quitar carpeta ' + node.path + ' (sus notas pasan a General)'"
          @hold="tree.deleteFolder(node.path)"
        >
          <template #icon>
            <Trash2
              :size="15"
              aria-hidden="true"
            />
          </template>
        </HoldButton>
      </span>
    </div>
    <div
      v-if="hasChildren"
      class="folder-fold"
      :data-open="isExpanded ? '' : undefined"
      :inert="!isExpanded"
    >
      <div class="folder-fold-inner">
        <ul
          role="group"
          class="folder-group"
        >
          <NoteFolderNode
            v-for="child in node.children"
            :key="child.path"
            :node="child"
          />
        </ul>
      </div>
    </div>
  </li>
</template>
<style scoped>
/*
 * Guías del árbol (mismo trazo que el Branched Menu): cada grupo se sangra --folderIndent y cada nodo dibuja
 * su conector desde el tronco (--folderTrunk) con una curva hasta el renglón. Los nodos que no son el último
 * continúan el tronco a todo su alto, así la guía sigue a través de los hijos abiertos hasta el siguiente hermano.
 */
.folder-node { position: relative; list-style: none; outline: none; }
.folder-node:not(:last-child)::before { content: ""; position: absolute; top: 0; bottom: 0; left: calc(var(--folderTrunk) - var(--folderIndent)); border-left: 2px solid var(--hairlineColor); pointer-events: none; }
.folder-row { position: relative; display: grid; grid-template-columns: 20px 15px minmax(0, 1fr) var(--folderCountWidth) var(--folderActionWidth); align-items: center; gap: 6px; height: var(--folderRowHeight); padding-left: 2px; color: var(--mutedTextColor); cursor: pointer; transition: color 200ms ease; }
.folder-row::before { content: ""; position: absolute; top: 0; left: calc(var(--folderTrunk) - var(--folderIndent)); width: calc(var(--folderIndent) - var(--folderTrunk) - 4px); height: calc(var(--folderRowHeight) / 2); border-left: 2px solid var(--hairlineColor); border-bottom: 2px solid var(--hairlineColor); border-bottom-left-radius: 9px; pointer-events: none; }
.folder-row:hover { color: var(--textColor); }
.folder-row.is-selected { color: var(--primaryBackgroundColor); font-weight: 700; }
.folder-row.is-selected::before { border-color: var(--primaryBackgroundColor); }
.folder-row.is-drop-target { outline: 2px dashed var(--primaryBackgroundColor); outline-offset: -2px; }
.folder-node:focus-visible > .folder-row { outline: 2px solid var(--primaryBackgroundColor); outline-offset: -2px; }
.folder-toggle { display: grid; place-items: center; width: 20px; height: 20px; padding: 0; border: 0; background: transparent; color: inherit; cursor: pointer; }
.folder-toggle:hover { color: var(--textColor); background: var(--subtleColor); }
.folder-toggle svg { transition: transform 200ms var(--easeSmoothOut); }
.folder-node[aria-expanded="true"] > .folder-row .folder-toggle svg { transform: rotate(90deg); }
.folder-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.folder-count { justify-self: end; font-family: var(--monoFontFamily); font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--mutedTextColor); }
.folder-row.is-selected .folder-count { color: var(--primaryBackgroundColor); }
.folder-action { display: grid; place-items: center; width: var(--folderActionWidth); }
.folder-fold { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 200ms var(--easeSmoothOut); }
.folder-fold[data-open] { grid-template-rows: 1fr; }
.folder-fold-inner { min-height: 0; overflow: hidden; }
.folder-group { margin: 0; padding: 0 0 0 var(--folderIndent); }
/*
 * Animaciones del árbol (2026-10-06, pedido del usuario): al abrir una carpeta, sus hijos entran escalonados
 * (desvanecido y desplazamiento corto, 30 ms entre uno y otro) y su conector se dibuja de izquierda a derecha.
 * Al pasar el puntero, el nombre se desplaza 3 px. Con movimiento reducido no hay animación.
 */
.folder-fold[data-open] > .folder-fold-inner > .folder-group > .folder-node { animation: folder-child-in 240ms var(--easeSmoothOut) both; }
.folder-fold[data-open] > .folder-fold-inner > .folder-group > .folder-node:nth-child(2) { animation-delay: 30ms; }
.folder-fold[data-open] > .folder-fold-inner > .folder-group > .folder-node:nth-child(3) { animation-delay: 60ms; }
.folder-fold[data-open] > .folder-fold-inner > .folder-group > .folder-node:nth-child(4) { animation-delay: 90ms; }
.folder-fold[data-open] > .folder-fold-inner > .folder-group > .folder-node:nth-child(n+5) { animation-delay: 120ms; }
.folder-fold[data-open] > .folder-fold-inner > .folder-group > .folder-node > .folder-row::before { animation: folder-branch-draw 260ms var(--easeSmoothOut) both; }
@keyframes folder-child-in { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: none; } }
@keyframes folder-branch-draw { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
.folder-label { transition: transform 180ms var(--easeSmoothOut); }
.folder-row:hover .folder-label { transform: translateX(3px); }
.folder-row.is-selected .folder-label { animation: folder-selected 260ms var(--easeSmoothOut); }
@keyframes folder-selected { 40% { transform: translateX(4px); } }
@media (prefers-reduced-motion: reduce) {
  .folder-fold, .folder-toggle svg, .folder-row, .folder-label { transition: none; }
  .folder-fold[data-open] > .folder-fold-inner > .folder-group > .folder-node, .folder-fold[data-open] > .folder-fold-inner > .folder-group > .folder-node > .folder-row::before, .folder-row.is-selected .folder-label { animation: none; }
  .folder-row:hover .folder-label { transform: none; }
}
</style>
