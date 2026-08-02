interface BoardHeaderProps { searchQuery?: string; zoom?: number; suggestions?: any[] }

interface BoardHeaderEmits {
  (e: "update:searchQuery", v: string): void;
  (e: "fetch-notes"): void;
  (e: "export-layout"): void;
  (e: "update:zoom", v: number): void;
  (e: "select-suggestion", note: any): void;
}

import { ref, watch, computed } from "vue";
const props = defineProps<BoardHeaderProps>();
const emit = defineEmits<BoardHeaderEmits>();

const localValue = ref(props.searchQuery ?? "");
let debounceTimer: ReturnType<typeof setTimeout> | undefined;
watch(() => props.searchQuery, (v) => {
  if (v !== localValue.value) localValue.value = v ?? "";
});

const onInput = (e: Event) => {
  const v = (e.target as HTMLInputElement).value;
  localValue.value = v;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => emit("update:searchQuery", v), 220);
};

const zoomPercent = computed(() => Math.round((props.zoom ?? 0.8) * 100));
const onZoomSlider = (e: Event) => {
  const val = Number((e.target as HTMLInputElement).value);
  const z = Math.max(0.5, Math.min(2, val / 100));
  emit("update:zoom", z);
};

const showSuggestions = ref(false);
watch(localValue, (v) => {
  showSuggestions.value = v.trim().length > 0;
});

const suggestions = computed(() => props.suggestions ?? []);
const selectSuggestion = (note: any) => emit("select-suggestion", note);

const snippet = (text?: string) => {
  if (!text) return "";
  const t = text.replace(/\n/g, " ");
  return t.length > 120 ? t.slice(0, 120) + "..." : t;
};
