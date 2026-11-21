<script setup lang="ts">
import { ref } from 'vue'
import { gsap } from 'gsap'
import { FileText, Pin, PinOff, Archive, ArchiveRestore, Trash2, Plus } from '@lucide/vue'
import type { LocalNote } from '../../../shared/contracts/localNotes'
import { noteDragType } from './notesView'
import { previewNoteText } from './noteText'
import HoldButton from '../../shared/vueBits/HoldButton.vue'

/**
 * Lista de documentos del directorio, como el original: número, icono, título en mayúsculas, vista previa
 * del texto, estado (Activa / Archivada, con chincheta si está anclada) y acciones. Cada fila se arrastra
 * a una carpeta del índice. Sólo emite intenciones; NotesPage modifica y guarda.
 *
 * Movimiento con GSAP (sólo sin `prefers-reduced-motion`): las filas entran escalonadas (240 ms) y salen
 * en 150 ms al moverse, archivarse o eliminarse, para que se vea a dónde fue cada documento.
 */
defineProps<{ notes: LocalNote[]; emptyMessage: string; canCreate: boolean }>()
// Eliminar se confirma manteniendo presionado (Hold Button de Vue Bits, pulido 2026-10-03).
const emit = defineEmits<{ open: [noteId: string]; togglePin: [noteId: string]; toggleArchive: [noteId: string]; remove: [noteId: string]; create: [] }>()
const draggingNoteId = ref<string | null>(null)
const isMotionAllowed = () => !matchMedia('(prefers-reduced-motion: reduce)').matches
const maximumStaggeredRows = 12

function enter(element: Element, done: () => void): void {
  if (!isMotionAllowed()) { done(); return }
  const index = Math.min(Number((element as HTMLElement).dataset.index ?? 0), maximumStaggeredRows)
  gsap.fromTo(element, { y: 8, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .24, delay: index * .03, ease: 'power2.out', clearProps: 'transform,opacity,visibility', onComplete: done })
}
function leave(element: Element, done: () => void): void {
  if (!isMotionAllowed()) { done(); return }
  gsap.to(element, { x: 12, autoAlpha: 0, duration: .15, ease: 'power2.in', onComplete: done })
}
function startDrag(event: DragEvent, noteId: string): void {
  if (!event.dataTransfer) return
  event.dataTransfer.setData(noteDragType, noteId); event.dataTransfer.effectAllowed = 'move'; draggingNoteId.value = noteId
}
</script>
<template>
  <div class="file-list">
    <div
      class="file-header"
      aria-hidden="true"
    >
      <span>Documento</span><span class="status-column">Estado</span><span>Acciones</span>
    </div>
    <TransitionGroup
      tag="ul"
      :css="false"
      appear
      @enter="enter"
      @leave="leave"
    >
      <li
        v-for="(note, index) in notes"
        :key="note.noteId"
        class="file-row"
        :class="{ 'is-dragging': draggingNoteId === note.noteId }"
        :data-index="index"
        draggable="true"
        @dragstart="startDrag($event, note.noteId)"
        @dragend="draggingNoteId = null"
      >
        <button
          class="file-open"
          :aria-label="note.title"
          @click="emit('open', note.noteId)"
        >
          <span
            class="file-number"
            aria-hidden="true"
          >{{ String(index + 1).padStart(2, '0') }}</span>
          <FileText
            class="file-icon"
            :size="20"
            aria-hidden="true"
          />
          <span class="file-copy"><strong>{{ note.title }}</strong><span>{{ previewNoteText(note.content) || 'Documento sin contenido' }}</span><small>{{ note.folder }}</small></span>
        </button>
        <span class="status-column file-status"><Pin
          v-if="note.isPinned"
          class="pin-mark"
          :size="14"
          aria-hidden="true"
        /><span
          v-if="note.isPinned"
          class="sr-only"
        >Anclada, </span>{{ note.isArchived ? 'Archivada' : 'Activa' }}</span>
        <span class="file-actions">
          <button
            class="icon-button"
            :aria-label="note.isPinned ? 'Desanclar ' + note.title : 'Anclar ' + note.title"
            :aria-pressed="note.isPinned"
            :title="note.isPinned ? 'Desanclar' : 'Anclar'"
            @click="emit('togglePin', note.noteId)"
          >
            <component
              :is="note.isPinned ? PinOff : Pin"
              :size="16"
              aria-hidden="true"
            />
          </button><button
            class="icon-button"
            :aria-label="(note.isArchived ? 'Restaurar ' : 'Archivar ') + note.title"
            :title="note.isArchived ? 'Restaurar' : 'Archivar'"
            @click="emit('toggleArchive', note.noteId)"
          >
            <component
              :is="note.isArchived ? ArchiveRestore : Archive"
              :size="16"
              aria-hidden="true"
            />
          </button><HoldButton
            is-icon-only
            size="small"
            :aria-label="'Eliminar ' + note.title"
            @hold="emit('remove', note.noteId)"
          >
            <template #icon>
              <Trash2
                :size="16"
                aria-hidden="true"
              />
            </template>
          </HoldButton>
        </span>
      </li>
    </TransitionGroup>
    <div
      v-if="!notes.length"
      class="file-empty"
    >
      <p>{{ emptyMessage }}</p>
      <button
        v-if="canCreate"
        class="action-button"
        @click="emit('create')"
      >
        <Plus
          :size="18"
          aria-hidden="true"
        />Nueva nota aquí
      </button>
    </div>
  </div>
</template>
<style scoped>
.file-list { border: 2px solid var(--borderColor); background: var(--surfaceColor); min-width: 0; border-radius: var(--radiusNested); }
ul { list-style: none; margin: 0; padding: 0; }
.file-header, .file-row { display: grid; grid-template-columns: minmax(0, 1fr) 112px auto; align-items: center; gap: var(--spaceMedium); }
.file-header { padding: 10px var(--spaceMedium); border-bottom: 1px solid var(--borderColor); font-family: var(--monoFontFamily); font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--mutedTextColor); }
.file-row { padding: 0 var(--spaceMedium) 0 0; border-bottom: 1px solid var(--borderColor); min-height: 84px; cursor: grab; }
.file-row:hover { background: var(--subtleColor); }
.file-row.is-dragging { opacity: .38; transform: scale(.985); }
.file-open { display: grid; grid-template-columns: 28px 24px minmax(0, 1fr); align-items: start; gap: 10px; min-width: 0; height: 100%; padding: 14px 0 14px var(--spaceMedium); border: 0; background: transparent; color: var(--textColor); text-align: left; cursor: pointer; }
.file-number { font-size: 11px; color: var(--mutedTextColor); font-variant-numeric: tabular-nums; padding-top: 2px; }
.file-icon { color: var(--accentColor); }
.file-copy { display: grid; gap: 4px; min-width: 0; }
.file-copy strong { font-size: 14px; letter-spacing: .05em; text-transform: uppercase; overflow-wrap: anywhere; }
.file-copy span { font-size: 13px; color: var(--mutedTextColor); overflow-wrap: anywhere; }
.file-copy small { font-size: 12px; color: var(--mutedTextColor); letter-spacing: .05em; text-transform: uppercase; }
.file-status { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 500; letter-spacing: .05em; text-transform: uppercase; }
.pin-mark { color: var(--accentColor); }
.file-actions { display: inline-flex; gap: 4px; }
.file-actions .icon-button { width: 40px; height: 40px; border-color: var(--borderColor); }
.file-actions .icon-button:hover { background: var(--accentColor); color: var(--primaryTextColor); }
.file-actions .danger-icon:hover { background: var(--errorFill); color: var(--statusText); }
.file-empty { padding: var(--spaceLarge) var(--spaceMedium); display: grid; gap: 12px; justify-items: start; color: var(--mutedTextColor); }
.file-empty p { margin: 0; }
@container (max-width: 760px) {
  .file-header .status-column, .file-row .status-column { display: none; }
  .file-header, .file-row { grid-template-columns: minmax(0, 1fr) auto; }
}
@container (max-width: 520px) {
  .file-row { grid-template-columns: minmax(0, 1fr); padding: 0 var(--spaceMedium) 12px 0; }
  .file-actions { padding-left: calc(var(--spaceMedium) + 62px); }
}
</style>
