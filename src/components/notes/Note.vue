<!-- Note.vue -->
<template>
  <div
    :class="['note-card rounded-lg overflow-hidden relative', noteColorClass]"
    ref="rootRef"
    :style="cardStyle"
  >
    <div class="note-header flex items-center justify-between p-3" :class="noteBorderClass">
      <h3 class="font-semibold note-title" v-html="highlightedTitle"></h3>

      <div class="absolute top-2 right-2 flex items-center space-x-1 z-10 bg-inherit/70 backdrop-blur-sm rounded-full p-1">
        <button @click.stop="$emit('store-note', note.id)" class="p-1 rounded-full hover:bg-black/10" title="Archivar">
          <i class="pi pi-inbox text-xs"></i>
        </button>
        <button @click.stop="$emit('open-note', note)" class="p-1 rounded-full hover:bg-black/10" title="Ver nota">
          <i class="pi pi-window-maximize text-xs"></i>
        </button>
        <button @click.stop="$emit('toggle-pin', note.id)" class="p-1 rounded-full hover:bg-black/10" title="Anclar">
          <i class="pi pi-thumbtack text-yellow-500" v-if="note.status === 'pinned'"></i>
          <i class="pi pi-thumbtack" v-else></i>
        </button>
        <button @click.stop="$emit('delete-note', note)" class="p-1 rounded-full hover:bg-black/10" title="Eliminar">
          <i class="pi pi-trash"></i>
        </button>
      </div>
    </div>

    <div class="note-content p-4" v-html="highlightedContent" ref="contentRef"></div>

    <div class="coords-badge">{{ coordsText }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { marked } from "marked";
import type { Note as NoteType } from "@/composables/useNotesStore";

const props = withDefaults(defineProps<{ note: NoteType; searchQuery?: string }>(), { searchQuery: "" });
const emit = defineEmits<{
  (e: "store-note", id: number): void;
  (e: "open-note", note: NoteType): void;
  (e: "toggle-pin", id: number): void;
  (e: "delete-note", note: NoteType): void;
  (e: "change-color", payload: { id: number; color: NoteType["color"] }): void;
}>();

const rootRef = ref<HTMLElement | null>(null);
const contentRef = ref<HTMLElement | null>(null);
const highlightedContent = ref("");
const highlightedTitle = ref("");

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const highlightText = (text: string) => {
  const q = (props.searchQuery || "").trim();
  if (!q) return text;
  const escaped = escapeRegExp(q);
  try {
    const re = new RegExp(`(${escaped})`, "gi");
    return text.replace(re, '<mark class="bg-yellow-300/50 rounded">$1</mark>');
  } catch {
    return text;
  }
};

watch(() => props.note.descripcion, async () => {
  const md = props.note.descripcion || "";
  const rendered = await marked(md);
  highlightedContent.value = highlightText(rendered);
}, { immediate: true });

watch(() => props.note.titulo, () => {
  highlightedTitle.value = highlightText(props.note.titulo || "");
}, { immediate: true });

const noteColorClass = computed(() => {
  switch (props.note.color) {
    case "blue": return "bg-blue-50 text-blue-900";
    case "red": return "bg-red-50 text-red-900";
    case "yellow": return "bg-yellow-50 text-yellow-900";
    case "green": return "bg-green-50 text-green-900";
    default: return "bg-white text-gray-800";
  }
});

const noteBorderClass = computed(() => {
  switch (props.note.color) {
    case "blue": return "border border-blue-200";
    case "red": return "border border-red-200";
    case "yellow": return "border border-yellow-200";
    case "green": return "border border-green-200";
    default: return "border border-gray-200";
  }
});

const coordsText = computed(() => `${Math.round(props.note.gs_x ?? 0)}, ${Math.round(props.note.gs_y ?? 0)}`);

const cardStyle = computed(() => {
  const minW = 220;
  const maxW = 480;
  const unit = props.note.gs_w ?? 2;
  const widthPx = typeof unit === "number" && unit >= 50 ? unit : Math.min(maxW, Math.max(minW, unit * 150));
  return { minWidth: `${minW}px`, width: `${widthPx}px`, height: "auto" };
});
</script>

<style scoped>
.note-card { box-sizing: border-box; display: inline-block; vertical-align: top; position: relative; }
.note-header { padding-right: 56px; }
.note-title { margin: 0; line-height: 1.1; font-size: 1rem; word-break: break-word; }
.note-content { padding-top: 0.5rem; padding-bottom: 0.6rem; white-space: normal; }
.note-content :global(pre) { background-color: var(--color-bg-secondary); padding: 0.75rem; border-radius: 0.5rem; overflow-x: auto; }
.note-content :global(code) { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, "Roboto Mono", monospace; font-size: 0.95em; }
.coords-badge { position: absolute; right: 8px; bottom: 8px; font-size: 11px; background: rgba(0,0,0,0.35); color:#fff; padding:6px 8px; border-radius:8px; }
</style>
