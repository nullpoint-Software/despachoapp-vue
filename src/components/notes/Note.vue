<template>
  <div 
    class="note-card flex flex-col rounded-lg shadow-md h-full transition-opacity duration-300"
    :class="[noteColorClass, { 'opacity-30': !isMatch && searchQuery }]"
  >
    <div class="note-header flex justify-between items-start p-3 border-b" :class="noteBorderClass">
      <h3 class="font-bold break-words break-all pr-2" v-html="highlightedTitle"></h3>
      <div v-if="!hideControls" class="flex items-center space-x-1 flex-shrink-0">
        <button @click="togglePin" class="p-1 rounded-full hover:bg-black/10 transition-colors" title="Anclar Nota">
          <i 
            class="pi pi-thumbtack" 
            :class="{ 'text-yellow-500 transform rotate-45': note.pinned, 'text-[var(--color-text-muted)]': !note.pinned }"
          ></i>
        </button>
        <button @click="$emit('request-delete', note)" class="p-1 rounded-full hover:bg-black/10 transition-colors" title="Eliminar Nota">
          <i class="pi pi-trash text-[var(--color-text-muted)] hover:text-red-500"></i>
        </button>
      </div>
    </div>
    <div 
      class="note-content p-4"
      v-html="highlightedContent"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue';
import { marked } from 'marked';
import { useNotesStore, type Note } from '@/composables/useNotesStore';

const props = withDefaults(defineProps<{
  note: Note,
  searchQuery?: string,
  hideControls?: boolean,
}>(), {
  searchQuery: '',
  hideControls: false,
});

const emit = defineEmits<{ (e: 'request-delete', note: Note): void }>();

const { updateNote } = useNotesStore();

const togglePin = () => {
  updateNote(props.note.id, { pinned: !props.note.pinned });
};

const isMatch = computed(() => {
  if (!props.searchQuery) return true;
  const query = props.searchQuery.toLowerCase();
  return (
    props.note.titulo.toLowerCase().includes(query) ||
    props.note.descripcion.toLowerCase().includes(query)
  );
});

const highlightText = (text: string): string => {
  if (!props.searchQuery || props.searchQuery.trim() === '' || !isMatch.value) {
    return text;
  }
  const escapedQuery = props.searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  return text.replace(regex, '<mark class="bg-yellow-300 bg-opacity-50 rounded px-0.5">$1</mark>');
};

const highlightedTitle = computed(() => highlightText(props.note.titulo));

const highlightedContent = ref('');
watchEffect(async () => {
  const rendered = await marked(props.note.descripcion || '');
  highlightedContent.value = highlightText(rendered);
});

const noteColorClass = computed(() => ({
  'bg-blue-50 text-blue-900': props.note.color === 'blue',
  'bg-red-50 text-red-900': props.note.color === 'red',
  'bg-yellow-50 text-yellow-900': props.note.color === 'yellow',
  'bg-green-50 text-green-900': props.note.color === 'green',
  'bg-white text-gray-800': !props.note.color || props.note.color === 'white',
}));

const noteBorderClass = computed(() => ({
  'border-blue-200': props.note.color === 'blue',
  'border-red-200': props.note.color === 'red',
  'border-yellow-200': props.note.color === 'yellow',
  'border-green-200': props.note.color === 'green',
  'border-gray-200': !props.note.color || props.note.color === 'white',
}));
</script>

<style scoped>
.note-card {
  min-height: 100px;
  display: flex;
  flex-direction: column;
}
.note-content {
  overflow-wrap: break-word;
  hyphens: auto;
}
.note-content:deep(h1), .note-content:deep(h2), .note-content:deep(h3) { font-weight: bold; margin-bottom: 0.5rem; }
.note-content:deep(p) { margin-bottom: 0.5rem; }
.note-content:deep(ul) { list-style-type: disc; margin-left: 1.5rem; }
.note-content:deep(ol) { list-style-type: decimal; margin-left: 1.5rem; }
.note-content:deep(a) { color: var(--obj-important-1); text-decoration: underline; }
.note-content:deep(pre) { background-color: #f3f4f6; padding: 0.5rem; border-radius: 0.5rem; }
</style>