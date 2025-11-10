<!-- BoardHeader.vue -->
<template>
  <header class="max-w-full w-full mx-auto mb-4 sticky top-0 z-40 py-2 bg-theme-main text-theme-main flex items-center gap-4 px-6">
    <img src="@/assets/img/logsymbolwhite.png" alt="Logo" class="w-14 h-14 object-contain cursor-pointer" />
    <h1 class="text-xl font-semibold hidden sm:block">Mis Notas</h1>

    <div class="relative flex-1 max-w-[900px]">
      <i class="pi pi-search absolute left-4 top-1/2 -translate-y-1/2 text-theme-muted"></i>
      <input
        :value="localValue"
        @input="onInput"
        type="text"
        placeholder="Buscar notas..."
        class="w-full pl-12 pr-4 py-3 border border-theme rounded-full bg-theme-secondary text-theme-main focus:outline-none focus:ring-2 focus:ring-[var(--obj-important-1)] transition-shadow"
        aria-label="Buscar notas"
      />
      <div v-if="showSuggestions && suggestions.length" class="absolute left-0 right-0 mt-2 z-50">
        <div class="bg-theme-secondary border border-theme rounded-lg shadow-lg overflow-hidden">
          <ul>
            <li
              v-for="s in suggestions"
              :key="s.note.id"
              class="px-4 py-3 hover:bg-[rgba(255,255,255,0.02)] cursor-pointer flex justify-between items-start"
              @click="selectSuggestion(s.note)"
            >
              <div class="flex-1 min-w-0">
                <div class="font-semibold truncate">{{ s.note.titulo }}</div>
                <div class="text-sm text-theme-muted truncate" v-html="snippet(s.note.descripcion)"></div>
              </div>
              <div class="ml-4 text-xs text-theme-muted">{{ s.type }}</div>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <div class="flex items-center gap-3">
      <div class="flex items-center gap-2">
        <input
          type="range"
          min="50"
          max="200"
          :value="zoomPercent"
          @input="onZoomSlider"
          class="range range-primary w-40"
          aria-label="Zoom"
        />
        <div class="text-sm w-12 text-right tabular-nums">{{ zoomPercent }}%</div>
      </div>

      <button @click="$emit('fetch-notes')" class="btn btn-ghost btn-sm" title="Actualizar">
        <i class="pi pi-refresh"></i>
      </button>

      <button @click="$emit('export-layout')" class="btn btn-ghost btn-sm" title="Exportar layout">
        <i class="pi pi-download"></i>
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, watch, computed } from "vue";
const props = defineProps<{ searchQuery?: string; zoom?: number; suggestions?: any[] }>();
const emit = defineEmits<{
  (e: "update:searchQuery", v: string): void;
  (e: "fetch-notes"): void;
  (e: "export-layout"): void;
  (e: "update:zoom", v: number): void;
  (e: "select-suggestion", note: any): void;
}>();

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
</script>

<style scoped>
header { box-sizing: border-box; }
.range { accent-color: var(--obj-important-1); }
</style>
