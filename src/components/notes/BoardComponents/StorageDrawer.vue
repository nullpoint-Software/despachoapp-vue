<!-- StorageDrawer.vue -->
<template>
  <transition name="slide-left">
    <div v-if="open" class="fixed top-0 left-0 h-full sm:w-80 w-full bg-[var(--color-bg-secondary)] shadow-2xl border-r border-[var(--color-border)] z-50">
      <div class="p-4 h-full flex flex-col">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-bold">Archivadas</h2>
          <button @click="$emit('close')" class="p-2 -mr-2 rounded-full hover:bg-black/10 transition-all" aria-label="Cerrar">
            <i class="pi pi-times"></i>
          </button>
        </div>

        <div class="flex-grow overflow-y-auto pr-2 space-y-2">
          <div v-if="notes.length === 0" class="text-center text-[var(--color-text-muted)] p-4">No hay notas archivadas.</div>

          <div
            v-for="note in notes"
            :key="note.id"
            class="p-3 rounded-lg border border-[var(--color-border)] flex flex-col gap-2 cursor-grab hover:shadow-lg transition-shadow duration-150"
            :draggable="true"
            @dragstart="onDragStart($event, note)"
            :data-note-id="note.id"
          >
            <div class="flex items-center justify-between">
              <div class="font-semibold truncate max-w-[70%]">{{ note.titulo }}</div>
              <div class="text-xs text-[var(--color-text-muted)]">{{ note.status === 'pinned' ? 'Fijada' : 'Archivada' }}</div>
            </div>
            <div class="text-xs text-[var(--color-text-muted)] note-snippet" v-html="renderMarkdown(note.descripcion)"></div>
            <div class="flex items-center gap-2 justify-end">
              <button @click="$emit('unstore-note', note.id)" class="btn btn-sm btn-primary">Restaurar</button>
              <button @click="$emit('close')" class="btn btn-sm btn-ghost">Cerrar</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { marked } from "marked";
import type { Note as NoteType } from "@/composables/useNotesStore";
const props = defineProps<{ notes: NoteType[]; open?: boolean }>();
const emit = defineEmits<{
  (e: "close"): void;
  (e: "unstore-note", id: number): void;
}>();

const onDragStart = (e: DragEvent, note: NoteType) => {
  if (!e.dataTransfer) return;
  e.dataTransfer.setData("text/plain", String(note.id));
  try { e.dataTransfer.effectAllowed = "copyMove"; } catch {}
};

const renderMarkdown = (md?: string) => {
  if (!md) return "";
  const rendered = marked(md) as unknown as string;
  return rendered.replace(/^<p>|<\/p>$/g, "");
};
</script>

<style scoped>
.slide-left-enter-active, .slide-left-leave-active { transition: transform .28s ease, opacity .28s ease; }
.slide-left-enter-from { transform: translateX(-100%); opacity: 0; }
.slide-left-enter-to { transform: translateX(0); opacity: 1; }
.slide-left-leave-from { transform: translateX(0); opacity: 1; }
.slide-left-leave-to { transform: translateX(-100%); opacity: 0; }
.note-snippet :global(p) { margin: 0; color: var(--color-text-muted); }
</style>
