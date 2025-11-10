<template>
  <div
    class="board-container w-full h-full bg-theme-main text-base-content p-4 box-border flex flex-col rounded-lg"
  >
    <BoardHeader
      ref="boardHeaderRef"
      v-model:searchQuery="searchQuery"
      :zoom="zoom"
      @update:zoom="(val) => (zoom = val)"
      @fetch-notes="fetchNotes"
      @export-layout="exportLayout"
    />

    <div
      v-if="searchQuery && suggestions.length"
      ref="suggestionsRef"
      class="absolute left-1/2 transform -translate-x-1/2 mt-20 w-[min(600px,90%)] z-50"
    >
      <ul class="menu bg-base-200 w-full rounded-box shadow-xl border border-base-300">
        <li class="menu-title px-4 pt-2">
          <span>Sugerencias</span>
        </li>
        <li v-for="s in suggestions" :key="s.note.id" @click="selectSuggestion(s.note)">
          <a class="!items-center">
            <span class="font-semibold truncate flex-1">{{ s.note.titulo }}</span>
            <span class="badge badge-ghost badge-sm ml-4">{{ s.type }}</span>
          </a>
        </li>
      </ul>
    </div>

    <div
      v-if="isLoading"
      class="flex-grow flex items-center justify-center text-lg text-base-content"
    >
      Cargando...
    </div>
    <div
      v-if="error"
      class="flex-grow flex items-center justify-center text-red-500"
    >
      {{ error }}
    </div>

    <div class="flex-1 flex items-center justify-center relative">
      <NoteCanvas
        ref="noteCanvasRef"
        :notes="allNotesForCanvas"
        :search-query="searchQuery"
        :zoom="zoom"
        @open-note="openNoteModal"
        @toggle-pin="toggleNotePin"
        @delete-note="handleDeleteRequest"
        @store-note="storeNote"
        @save-layout="saveLayout"
        @drop-note="handleDropFromStorage"
        class="w-full h-full"
      />
    </div>

    <NoteDetailModal
      :is-visible="isNoteModalVisible"
      :note="selectedNote"
      @close="closeNoteModal"
    />

    <StorageDrawer
      :open="isStorageDrawerOpen"
      :notes="filteredStorageNotes"
      @close="toggleStorageDrawer"
      @unstore-note="unstoreNote"
    />

    <button
      @click="toggleStorageDrawer"
      class="fixed left-4 top-1/2 -translate-y-1/2 btn btn-base-100 btn-circle btn-lg z-40 shadow-lg group transition-all duration-300 ease-in-out hover:scale-110 hover:shadow-2xl"
      title="Archivadas"
    >
      <i
        class="pi pi-inbox text-2xl transition-transform duration-300 ease-in-out group-hover:rotate-12"
      ></i>
    </button>

    <PinnedDrawer
      :open="isPinnedDrawerOpen"
      :notes="filteredPinnedNotes"
      :search-query="searchQuery"
      @close="togglePinnedDrawer"
      @open-note="openNoteModal"
      @toggle-pin="toggleNotePin"
      @delete-note="handleDeleteRequest"
    />

    <button
      @click="togglePinnedDrawer"
      class="fixed right-4 top-1/2 -translate-y-1/2 btn btn-base-100 btn-circle btn-lg z-40 shadow-lg group transition-all duration-300 ease-in-out hover:scale-110 hover:shadow-2xl"
      title="Ancladas"
    >
      <i
        class="pi pi-thumbtack text-2xl transition-transform duration-300 ease-in-out group-hover:-rotate-12"
      ></i>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, nextTick } from "vue";
import BoardHeader from "./BoardComponents/BoardHeader.vue";
import NoteCanvas from "./BoardComponents/NoteCanvas.vue";
import PinnedDrawer from "./BoardComponents/PinnedDrawer.vue";
import StorageDrawer from "./BoardComponents/StorageDrawer.vue";
import NoteDetailModal from "./NoteDetailModal.vue";
import {
  useNotesStore,
  type Note as NoteType,
} from "@/composables/useNotesStore";

// CAMBIO 3: Importar 'onClickOutside'
import { onClickOutside } from '@vueuse/core';
// CAMBIO 4: 'marked' ya no es necesario, se elimina
// import { marked } from "marked"; 

const {
  notes,
  canvasNotes,
  pinnedNotes,
  storageNotes,
  isLoading,
  error,
  fetchNotes,
  saveLayout,
  deleteNote,
  updateNote,
  isPinnedDrawerOpen,
  togglePinnedDrawer,
} = useNotesStore();

let zoom = ref(1);

const searchQuery = ref("");
const selectedNote = ref<NoteType | null>(null);
const isNoteModalVisible = ref(false);
const isStorageDrawerOpen = ref(false);

const noteCanvasRef = ref<any>(null);

// CAMBIO 5: Definir los refs para el click-outside
const suggestionsRef = ref(null);
const boardHeaderRef = ref(null);

// CAMBIO 6: Añadir la lógica del click-outside
onClickOutside(
  suggestionsRef, // El elemento a vigilar
  () => {
    searchQuery.value = ''; // La acción a tomar (limpiar búsqueda)
  },
  {
    ignore: [boardHeaderRef] // Ignorar clics dentro del header
  }
);

const filteredCanvasNotes = computed(() => {
  if (!searchQuery.value) return canvasNotes.value;
  const q = searchQuery.value.toLowerCase();
  return canvasNotes.value.filter(
    (n) =>
      n.titulo.toLowerCase().includes(q) ||
      n.descripcion.toLowerCase().includes(q)
  );
});
const filteredPinnedNotes = computed(() => {
  if (!searchQuery.value) return pinnedNotes.value;
  const q = searchQuery.value.toLowerCase();
  return pinnedNotes.value.filter(
    (n) =>
      n.titulo.toLowerCase().includes(q) ||
      n.descripcion.toLowerCase().includes(q)
  );
});
const filteredStorageNotes = computed(() => {
  if (!searchQuery.value) return storageNotes.value;
  const q = searchQuery.value.toLowerCase();
  return storageNotes.value.filter(
    (n) =>
      n.titulo.toLowerCase().includes(q) ||
      n.descripcion.toLowerCase().includes(q)
  );
});

const allNotesForCanvas = computed(() =>
  notes.value.filter((n) => n.status === "canvas" || n.status === "pinned")
);

const openNoteModal = (note: NoteType) => {
  selectedNote.value = note;
  isNoteModalVisible.value = true;
};
const closeNoteModal = () => {
  isNoteModalVisible.value = false;
};
const toggleNotePin = (noteId: number) => {
  const note = notes.value.find((n) => n.id === noteId);
  if (note)
    updateNote(note.id, {
      status: note.status === "pinned" ? "canvas" : "pinned",
    });
};
const storeNote = (noteId: number) => updateNote(noteId, { status: "storage" });
const unstoreNote = (noteId: number) =>
  updateNote(noteId, { status: "canvas" });
const handleDeleteRequest = (note: NoteType) => {
  deleteNote(note.id);
};

const handleDropFromStorage = async (payload: {
  id: number;
  x: number;
  y: number;
}) => {
  await updateNote(payload.id, {
    status: "canvas",
    gs_x: Math.round(payload.x),
    gs_y: Math.round(payload.y),
    gs_w: 2,
    gs_h: 2,
  });
  await fetchNotes();
};

const toggleStorageDrawer = () => {
  isStorageDrawerOpen.value = !isStorageDrawerOpen.value;
};

const exportLayout = () => {
  const layout = allNotesForCanvas.value.map((n) => ({
    id: n.id,
    x: n.gs_x ?? 0,
    y: n.gs_y ?? 0,
    w: n.gs_w ?? 2,
    h: n.gs_h ?? 2,
  }));
  saveLayout(layout as any);
  const data = JSON.stringify(layout, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `layout_export_${new Date().toISOString().split("T")[0]}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

function scoreText(query: string, text: string) {
  const q = query.toLowerCase();
  const t = (text || "").toLowerCase();
  if (!q || !t) return 0;
  if (t === q) return 100;
  const idx = t.indexOf(q);
  if (idx === -1) return 0;
  return Math.max(1, 50 - idx) + Math.max(0, 20 - (t.length - q.length));
}
type SuggestItem = { note: NoteType; score: number; type: string };
const suggestions = computed(() => {
  const q = searchQuery.value.trim();
  if (!q) return [];
  const candidates: SuggestItem[] = [];
  const pushFrom = (arr: NoteType[], typeLabel: string) => {
    for (const n of arr) {
      const sTitle = scoreText(q, n.titulo);
      const sDesc = scoreText(q, n.descripcion);
      const score = Math.max(sTitle, sDesc);
      if (score > 0) candidates.push({ note: n, score, type: typeLabel });
    }
  };
  pushFrom(canvasNotes.value, "Lienzo");
  pushFrom(pinnedNotes.value, "Fijada");
  pushFrom(storageNotes.value, "Archivada");
  return candidates.sort((a, b) => b.score - a.score).slice(0, 8);
});

// CAMBIO 7: La función snippet ya no es necesaria, se elimina
/*
function snippet(text: string | undefined, query: string) {
  if (!text) return "";
  ...
}
*/

async function selectSuggestion(note: NoteType) {
  if (isPinnedDrawerOpen.value) togglePinnedDrawer();
  if (isStorageDrawerOpen.value) isStorageDrawerOpen.value = false;
  
  // CAMBIO 8: Limpiar la búsqueda al seleccionar
  searchQuery.value = '';

  await nextTick();
  noteCanvasRef.value?.locateNote?.(note.id);
  openNoteModal(note);
}

onMounted(() => {
  fetchNotes();
});
</script>