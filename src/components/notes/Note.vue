<template>
  <div
    class="note-card flex flex-col rounded-lg h-full overflow-hidden"
    :class="noteColorClass"
  >
    <div
      class="note-header note-drag-handle cursor-move flex justify-between items-start p-3 border-b"
      :class="noteBorderClass"
    >
      <h3
        class="font-bold break-words break-all pr-2"
        v-html="highlightedTitle"
      ></h3>
    </div>

    <div
      ref="noteContentRef"
      class="note-content p-4"
      v-html="highlightedContent"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watchEffect, onMounted, onBeforeUnmount } from "vue";
import { marked } from "marked";
import { type Note } from "@/composables/useNotesStore";

const props = withDefaults(
  defineProps<{ 
    note: Note;
    searchQuery?: string;
  }>(),
  {
    searchQuery: "",
  }
);

const emit = defineEmits<{
  (e: "content-changed"): void;
}>();

const highlightText = (text: string): string => {
  if (!props.searchQuery || props.searchQuery.trim() === '') return text;
  const escapedQuery = props.searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escapedQuery})`, "gi");
  return text.replace(regex, '<mark class="bg-yellow-300/50 rounded">$1</mark>');
};

const highlightedTitle = computed(() => highlightText(props.note.titulo));
const highlightedContent = ref('');

watchEffect(async () => {
  const rendered = await marked(props.note.descripcion || '');
  highlightedContent.value = highlightText(rendered);
});

const noteContentRef = ref<HTMLElement | null>(null);
let observer: MutationObserver | null = null;
onMounted(() => {
  if (noteContentRef.value) {
    observer = new MutationObserver(() => emit("content-changed"));
    observer.observe(noteContentRef.value, { childList: true, subtree: true, characterData: true });
  }
});
onBeforeUnmount(() => { if (observer) observer.disconnect(); });

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
  min-height: 210px;
}
.note-content {
  overflow-wrap: break-word;
  hyphens: auto;
}
</style>