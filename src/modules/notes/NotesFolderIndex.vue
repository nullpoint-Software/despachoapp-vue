<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type Component } from 'vue'
import { Folder, Pin, Archive, Files } from '@lucide/vue'
import type { LocalNote } from '../../../shared/contracts/localNotes'
import { reservedViewNames, type NotesView } from './notesView'
import { buildFolderTree } from './noteFolderTree'
import { describeDocumentCount } from './noteFolderTreeContext'
import NoteFolderTree from './NoteFolderTree.vue'

/**
 * Índice del directorio de notas (estilo del Branched Menu de Vue Bits, ADR-034): Todas, Ancladas, la sección
 * Carpetas y Archivadas, cada una con su conteo.
 * - La sección Carpetas abre/cierra como acordeón y contiene el árbol anidado (`NoteFolderTree`): las rutas
 *   `A/B` se muestran como subcarpetas de `A`, cada una con su propio acordeón (2026-10-06).
 * - Soltar una fila sobre una carpeta la mueve ahí (el teclado tiene la misma acción en el campo Ubicación).
 * - Marca azul deslizante (2026-10-06, como el Branched Menu): una sola marca en el carril viaja con un rebote corto
 *   hasta la entrada activa o, si la vista es una carpeta, hasta su renglón dentro del árbol. Si ese renglón está
 *   oculto (sección o carpeta padre cerrada), se queda en "Carpetas". Un ResizeObserver la recoloca mientras los
 *   acordeones se abren o cierran. Con movimiento reducido salta sin animación.
 * Sólo emite intenciones; NotesPage modifica y guarda las notas.
 */
const props = defineProps<{ folders: string[]; notes: LocalNote[]; selectedView: NotesView }>()
const emit = defineEmits<{ select: [view: NotesView]; deleteFolder: [folder: string]; dropNote: [noteId: string, folder: string]; openFolderMenu: [folder: string, x: number, y: number]; openViewMenu: [view: NotesView, x: number, y: number] }>()
/**
 * Menú contextual (2026-10-10): clic derecho, Shift+F10 o la tecla de menú sobre Todas, Ancladas o Archivadas piden el
 * menú de esa vista; sobre una carpeta, el del árbol. NotesPage pinta el menú y ejecuta sus acciones.
 */
function requestViewMenuFromKeyboard(event: KeyboardEvent, view: NotesView): void {
  if (event.key !== 'ContextMenu' && !(event.key === 'F10' && event.shiftKey)) return
  event.preventDefault()
  const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect()
  emit('openViewMenu', view, bounds.left + 24, bounds.bottom)
}
/** La sección Carpetas empieza abierta; cerrarla es sólo de esta visita. */
const isFoldersSectionOpen = ref(true)

const activeNotes = computed(() => props.notes.filter(note => !note.isArchived))
const folderTree = computed(() => {
  const countsByFolder = new Map<string, number>()
  for (const note of activeNotes.value) countsByFolder.set(note.folder, (countsByFolder.get(note.folder) ?? 0) + 1)
  return buildFolderTree(props.folders, countsByFolder)
})
const pinnedCount = computed(() => activeNotes.value.filter(note => note.isPinned).length)
const archivedCount = computed(() => props.notes.filter(note => note.isArchived).length)
const isFolderSelected = computed(() => !reservedViewNames.includes(props.selectedView))

interface IndexEntry { view: NotesView; label: string; icon: Component; count: number }

const menu = ref<HTMLElement | null>(null)
const markerTop = ref(0), isMarkerVisible = ref(false)
let resizeObserver: ResizeObserver | null = null
/** Lleva la marca al centro del renglón activo visible. */
function placeMarker(): void {
  const element = menu.value
  if (!element) return
  const folderRow = element.querySelector<HTMLElement>('.folder-row.is-selected')
  const isFolderRowVisible = Boolean(folderRow) && isFoldersSectionOpen.value && !folderRow!.closest('.folder-fold:not([data-open])')
  const target = isFolderRowVisible ? folderRow : element.querySelector<HTMLElement>('.index-head[aria-current="true"], .index-head.is-active')
  if (!target) { isMarkerVisible.value = false; return }
  const menuBox = element.getBoundingClientRect(), targetBox = target.getBoundingClientRect()
  markerTop.value = Math.round(targetBox.top - menuBox.top + targetBox.height / 2 - 9)
  isMarkerVisible.value = true
}
watch([() => props.selectedView, isFoldersSectionOpen, () => props.folders.length], () => { void nextTick(placeMarker) })
onMounted(() => {
  placeMarker()
  // El alto del menú cambia en cada cuadro mientras un acordeón se anima: la marca lo acompaña.
  resizeObserver = new ResizeObserver(() => placeMarker())
  if (menu.value) resizeObserver.observe(menu.value)
})
onBeforeUnmount(() => resizeObserver?.disconnect())
const leadingEntries = computed<IndexEntry[]>(() => [
  { view: 'all', label: 'Todas', icon: Files, count: activeNotes.value.length },
  { view: 'pinned', label: 'Ancladas', icon: Pin, count: pinnedCount.value }
])
const trailingEntries = computed<IndexEntry[]>(() => [{ view: 'archive', label: 'Archivadas', icon: Archive, count: archivedCount.value }])
</script>
<template>
  <aside
    class="folder-index notes-stage"
    aria-label="Directorio de notas"
  >
    <p class="index-caption">
      <span>Índice</span><span>{{ activeNotes.length }} doc.</span>
    </p>
    <nav
      ref="menu"
      class="index-menu"
      aria-label="Carpetas de notas"
      @click="nextTick(placeMarker)"
      @keyup="nextTick(placeMarker)"
    >
      <span
        class="index-marker"
        :class="{ 'is-visible': isMarkerVisible }"
        :style="{ transform: 'translateY(' + markerTop + 'px)' }"
        aria-hidden="true"
      />
      <button
        v-for="entry in leadingEntries"
        :key="entry.view"
        type="button"
        class="index-head"
        :aria-current="selectedView === entry.view ? 'true' : undefined"
        :aria-label="entry.label + ', ' + describeDocumentCount(entry.count)"
        @click="emit('select', entry.view)"
        @contextmenu.prevent="emit('openViewMenu', entry.view, $event.clientX, $event.clientY)"
        @keydown="requestViewMenuFromKeyboard($event, entry.view)"
      >
        <component
          :is="entry.icon"
          :size="16"
          aria-hidden="true"
        />
        <span class="index-label">{{ entry.label }}</span>
        <span class="index-count">{{ entry.count }}</span>
      </button>
      <div
        class="index-section"
        :data-open="isFoldersSectionOpen ? '' : undefined"
      >
        <button
          type="button"
          class="index-head"
          :class="{ 'is-active': isFolderSelected }"
          :aria-expanded="isFoldersSectionOpen"
          @click="isFoldersSectionOpen = !isFoldersSectionOpen"
        >
          <Folder
            :size="16"
            aria-hidden="true"
          />
          <span class="index-label">Carpetas</span>
          <span class="index-count">{{ folders.length }}</span>
        </button>
        <div
          class="index-fold"
          :inert="!isFoldersSectionOpen"
        >
          <div class="index-fold-inner">
            <NoteFolderTree
              :nodes="folderTree"
              :selected-view="selectedView"
              label="Carpetas"
              @select="path => emit('select', path)"
              @delete-folder="path => emit('deleteFolder', path)"
              @drop-note="(noteId, path) => emit('dropNote', noteId, path)"
              @open-folder-menu="(path, x, y) => emit('openFolderMenu', path, x, y)"
            />
          </div>
        </div>
      </div>
      <button
        v-for="entry in trailingEntries"
        :key="entry.view"
        type="button"
        class="index-head"
        :aria-current="selectedView === entry.view ? 'true' : undefined"
        :aria-label="entry.label + ', ' + describeDocumentCount(entry.count)"
        @click="emit('select', entry.view)"
        @contextmenu.prevent="emit('openViewMenu', entry.view, $event.clientX, $event.clientY)"
        @keydown="requestViewMenuFromKeyboard($event, entry.view)"
      >
        <component
          :is="entry.icon"
          :size="16"
          aria-hidden="true"
        />
        <span class="index-label">{{ entry.label }}</span>
        <span class="index-count">{{ entry.count }}</span>
      </button>
    </nav>
  </aside>
</template>
<style scoped>
.folder-index { border: 2px solid var(--borderColor); background: var(--surfaceColor); box-shadow: var(--cardShadow); padding: var(--spaceMedium); display: grid; gap: 8px; align-content: start; min-width: 0; }
.index-caption { display: flex; justify-content: space-between; margin: 0 0 4px; padding-bottom: 8px; border-bottom: 2px solid var(--borderColor); font-family: var(--monoFontFamily); font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
/* Carril izquierdo en tinta que se desvanece hacia abajo; la entrada activa lleva la marca azul encima. */
.index-menu { position: relative; display: flex; flex-direction: column; padding-left: 14px; min-width: 0; font-size: 14px; }
.index-menu::before { content: ""; position: absolute; top: 8px; bottom: 0; left: 0; width: 2px; background: linear-gradient(to bottom, var(--textColor) 0%, var(--textColor) 55%, transparent 100%); }
.index-section { display: flex; flex-direction: column; min-width: 0; }
.index-head { position: relative; display: flex; align-items: center; gap: 8px; min-height: 40px; padding: 8px 6px; border: 0; background: transparent; color: var(--mutedTextColor); font: inherit; font-size: 15px; font-weight: 700; text-align: left; cursor: pointer; transition: color 200ms ease; }
/* Marca única que se desliza (rebote corto) y se estira un instante al moverse, como el Branched Menu. */
.index-marker { position: absolute; top: 0; left: -2px; z-index: 1; width: 6px; height: 18px; background: var(--primaryBackgroundColor); opacity: 0; pointer-events: none; transition: transform 380ms cubic-bezier(.34, 1.56, .64, 1), opacity 150ms ease; }
.index-marker.is-visible { opacity: 1; }
.index-head svg { transition: transform 200ms var(--easeSmoothOut); }
.index-head:hover svg { transform: translateX(2px) rotate(-6deg); }
.index-head:hover, .index-section[data-open] > .index-head { color: var(--textColor); }
.index-head[aria-current="true"] { color: var(--primaryBackgroundColor); }
.index-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.index-count { flex: none; font-family: var(--monoFontFamily); font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--mutedTextColor); }
.index-fold { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 300ms var(--easeSmoothOut); }
.index-section[data-open] > .index-fold { grid-template-rows: 1fr; }
.index-fold-inner { min-height: 0; overflow: hidden; }
/* Al abrir Carpetas, las carpetas del primer nivel entran escalonadas, como los hijos de cada carpeta. */
.index-section[data-open] > .index-fold :deep(.folder-tree > .folder-node) { animation: index-folder-in 260ms var(--easeSmoothOut) both; }
.index-section[data-open] > .index-fold :deep(.folder-tree > .folder-node:nth-child(2)) { animation-delay: 40ms; }
.index-section[data-open] > .index-fold :deep(.folder-tree > .folder-node:nth-child(3)) { animation-delay: 80ms; }
.index-section[data-open] > .index-fold :deep(.folder-tree > .folder-node:nth-child(n+4)) { animation-delay: 120ms; }
@keyframes index-folder-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .index-section[data-open] > .index-fold :deep(.folder-tree > .folder-node) { animation: none; } }
@media (prefers-reduced-motion: reduce) { .index-fold, .index-head, .index-marker, .index-head svg { transition: none; } .index-head:hover svg { transform: none; } }
</style>
