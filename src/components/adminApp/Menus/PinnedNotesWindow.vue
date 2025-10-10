<template>
  <div
    v-if="isPinnedWindowVisible"
    ref="floatingWindow"
    :style="style"
    class="fixed top-0 left-0 w-80 h-auto max-h-[60vh] bg-[var(--color-bg-secondary)] rounded-lg shadow-2xl border border-[var(--color-border)] flex flex-col z-50"
  >
    <div ref="dragHandle" class="cursor-move bg-[var(--color-bg)] p-2 rounded-t-lg border-b border-[var(--color-border)] flex-shrink-0">
      <h4 class="font-bold text-center">Notas Ancladas</h4>
    </div>
    <div class="p-2 overflow-y-auto space-y-2">
      <div v-if="pinnedNotes.length === 0" class="text-center text-[var(--color-text-muted)] p-4">
        No hay notas ancladas.
      </div>
      <Note 
        v-for="note in pinnedNotes" 
        :key="note.id" 
        :note="note" 
        :hide-controls="true"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useDraggable } from '@vueuse/core';
import { useNotesStore } from '@/composables/useNotesStore';
import Note from '@/components/notes/Note.vue';

const { pinnedNotes, isPinnedWindowVisible } = useNotesStore();

const floatingWindow = ref<HTMLElement | null>(null);
const dragHandle = ref<HTMLElement | null>(null);

const initialPosition = { x: 40, y: 150 };

// Ahora useDraggable nos devuelve x e y como refs que podemos modificar
const { style, x, y } = useDraggable(floatingWindow, {
  initialValue: initialPosition,
  handle: dragHandle,
  preventDefault: true,
});

// CORRECCIÓN: Observamos si la ventana se hace visible
watch(isPinnedWindowVisible, (isVisible) => {
  // Si se hace visible, reseteamos su posición al valor inicial.
  if (isVisible) {
    x.value = initialPosition.x;
    y.value = initialPosition.y;
  }
});
</script>