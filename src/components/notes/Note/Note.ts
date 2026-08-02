interface NoteProps { note: NoteType; searchQuery?: string }

interface NoteEmits {
  (e: "store-note", id: number): void;
  (e: "open-note", note: NoteType): void;
  (e: "toggle-pin", id: number): void;
  (e: "delete-note", note: NoteType): void;
  (e: "change-color", payload: { id: number; color: NoteType["color"] }): void;
}

import { ref, computed, watch, onMounted } from "vue";
import { marked } from "marked";
import type { Note as NoteType } from "@/composables/useNotesStore";

const props = withDefaults(defineProps<NoteProps>(), { searchQuery: "" });
const emit = defineEmits<NoteEmits>();

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
