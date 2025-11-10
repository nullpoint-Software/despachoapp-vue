<!-- PinnedDrawer.vue -->
<template>
  <transition name="slide-right">
    <div v-if="open" class="fixed top-0 right-0 h-full sm:w-96 w-full bg-[var(--color-bg-secondary)] shadow-2xl border-l border-[var(--color-border)] z-50">
      <div class="p-4 h-full flex flex-col">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-bold">Notas Fijadas</h2>
          <button @click="$emit('close')" class="p-2 -mr-2 rounded-full hover:bg-black/10 transition-all" aria-label="Cerrar">
            <i class="pi pi-times"></i>
          </button>
        </div>

        <div class="flex-grow overflow-y-auto pr-2 space-y-3">
          <div v-if="notes.length === 0" class="text-center text-[var(--color-text-muted)] p-4">No hay notas ancladas.</div>

          <div v-for="note in notes" :key="note.id" class="rounded-md hover:shadow-lg transition-shadow duration-150" :data-note-id="note.id">
            <div class="grid-stack-item-content p-2">
              <Note :note="note" :search-query="searchQuery" @store-note="$emit('store-note', $event)" @open-note="$emit('open-note', $event)" @toggle-pin="$emit('toggle-pin', $event)" @delete-note="$emit('delete-note', $event)" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import Note from "../Note.vue";
import type { Note as NoteType } from "@/composables/useNotesStore";
const props = defineProps<{ notes: NoteType[]; searchQuery?: string; open?: boolean }>();
const emit = defineEmits<{
  (e: "close"): void;
  (e: "open-note", note: NoteType): void;
  (e: "toggle-pin", id: number): void;
  (e: "delete-note", note: NoteType): void;
  (e: "store-note", id: number): void;
}>();
</script>

<style scoped>
.slide-right-enter-active, .slide-right-leave-active { transition: transform .28s ease, opacity .28s ease; }
.slide-right-enter-from { transform: translateX(100%); opacity: 0; }
.slide-right-enter-to { transform: translateX(0); opacity: 1; }
.slide-right-leave-from { transform: translateX(0); opacity: 1; }
.slide-right-leave-to { transform: translateX(100%); opacity: 0; }

.grid-stack-item-content { background-color: var(--color-bg-secondary); border-radius: 0.75rem; border: 1px solid var(--color-border); position: relative; overflow: hidden; }
</style>
