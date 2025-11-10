<template>
  <transition name="modal-fade">
    <div
      v-if="isVisible"
      class="fixed inset-0 z-[100] flex items-center justify-center p-4 modal-overlay"
      @click.self="$emit('close')"
    >
      <div
        v-if="note"
        class="modal-content relative bg-[var(--bg-modal)] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
      >
        <header class="p-5 border-b border-[var(--color-border)] flex justify-between items-center flex-shrink-0">
          <h2 class="text-2xl font-bold">{{ note.titulo }}</h2>
          <button @click="$emit('close')" class="p-2 -mr-2 rounded-full hover:bg-[var(--btn-secondary-hover-bg)]">
            <i class="pi pi-times text-xl"></i>
          </button>
        </header>

        <div class="p-5 overflow-y-auto note-content-display" v-html="renderedContent"></div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, watchEffect } from 'vue';
import { marked } from 'marked';
import type { Note } from '@/composables/useNotesStore';

const props = defineProps<{
  note: Note | null;
  isVisible: boolean;
}>();

defineEmits(['close']);

const renderedContent = ref('');

watchEffect(async () => {
  if (props.note?.descripcion) {
    renderedContent.value = await marked(props.note.descripcion);
  } else {
    renderedContent.value = '';
  }
});
</script>

<style scoped>
.modal-fade-enter-active,.modal-fade-leave-active{transition:opacity .3s ease}.modal-fade-enter-from,.modal-fade-leave-to{opacity:0}.modal-fade-enter-active .modal-content,.modal-fade-leave-active .modal-content{transition:transform .3s ease}.modal-fade-enter-from .modal-content,.modal-fade-leave-to .modal-content{transform:scale(.95)}.modal-overlay{background-color:rgba(0,0,0,.6);backdrop-filter:blur(8px)}.note-content-display:deep(h1),.note-content-display:deep(h2),.note-content-display:deep(h3){font-weight:700;margin-bottom:.75rem;margin-top:1.5rem}.note-content-display:deep(p){margin-bottom:1rem;line-height:1.6}.note-content-display:deep(ul),.note-content-display:deep(ol){margin-left:1.5rem;margin-bottom:1rem}.note-content-display:deep(a){color:var(--obj-important-1);text-decoration:underline}.note-content-display:deep(pre){background-color:var(--color-bg-secondary);padding:1rem;border-radius:.5rem;overflow-x:auto;margin-bottom:1rem}.note-content-display:deep(code){font-family:monospace}.note-content-display:deep(blockquote){border-left:4px solid var(--color-border);padding-left:1rem;margin-left:0;font-style:italic;color:var(--color-text-muted)}
</style>