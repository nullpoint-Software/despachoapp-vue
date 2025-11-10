<template>
  <div
    class="board p-4 bg-transparent text-[var(--color-text)] min-h-screen relative"
  >
    <header
      class="max-w-7xl mx-auto mb-8 sticky top-0 z-10 py-2 bg-[var(--color-bg)] flex items-center space-x-4"
    >
      <img
        src="@/assets/img/logsymbolwhite.png"
        alt="Logo de la Empresa"
        class="w-20 lg:w-20 cursor-pointer"
      />
      <h1 class="text-2xl font-bold hidden sm:block">Mis Notas</h1>
      <div class="relative flex-grow">
        <i
          class="pi pi-search absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
        ></i>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Buscar notas..."
          class="w-full pl-12 pr-4 py-3 border border-[var(--color-border)] bg-[var(--color-bg-secondary)] rounded-full focus:outline-none focus:ring-2 ring-[var(--obj-important-1)]"
        />
      </div>
      <div class="flex items-center space-x-2">
        <button
          @click="resetAndFetch"
          class="p-3 rounded-full hover:bg-[var(--btn-secondary-hover-bg)]"
          title="Actualizar"
        >
          <i class="pi pi-refresh"></i>
        </button>
        <div ref="settingsMenuContainer" class="relative">
          <button
            @click="isSettingsMenuVisible = !isSettingsMenuVisible"
            class="p-3 rounded-full hover:bg-[var(--btn-secondary-hover-bg)]"
            title="Opciones"
          >
            <i class="pi pi-cog"></i>
          </button>
          <transition name="fade">
            <div
              v-if="isSettingsMenuVisible"
              class="absolute top-full right-0 mt-2 w-52 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-xl py-2 z-20"
            >
              <button
                @click="compactNotes"
                class="w-full text-left px-4 py-2 flex items-center space-x-3 hover:bg-[var(--btn-secondary-hover-bg)]"
              >
                <i class="pi pi-sort w-4"></i>
                <span>Ordenar Notas</span>
              </button>
              <button
                @click="exportNotesToJSON"
                class="w-full text-left px-4 py-2 flex items-center space-x-3 hover:bg-[var(--btn-secondary-hover-bg)]"
              >
                <i class="pi pi-download w-4"></i>
                <span>Exportar</span>
              </button>
            </div>
          </transition>
        </div>
      </div>
    </header>

    <div v-if="isLoading && displayedNotes.length === 0" class="text-center text-[var(--color-text-muted)] py-10">
      Cargando notas...
    </div>
    <div v-if="error" class="text-center text-red-500 py-10">{{ error }}</div>

    <div v-show="!error" class="max-w-7xl mx-auto">
      <div class="grid-stack">
        <div
          v-for="note in displayedNotes"
          :key="note.id"
          class="grid-stack-item"
          :gs-id="note.id"
          :gs-x="note.layout?.x"
          :gs-y="note.layout?.y"
          :gs-w="note.layout?.w || 4"
          :gs-h="note.layout?.h || 6"
        >
          <div class="grid-stack-item-content">
            <Note :note="note" :search-query="searchQuery" />
            <div class="absolute top-2 right-2 flex items-center space-x-1 z-10 bg-inherit/70 backdrop-blur-sm rounded-full p-1">
              <button @click.stop="openNoteModal(note)" class="p-1 rounded-full hover:bg-black/10" title="Ver nota"><i class="pi pi-window-maximize text-xs"></i></button>
              <button @click.stop="toggleNotePin(note.id)" class="p-1 rounded-full hover:bg-black/10" title="Anclar">
                <i class="pi pi-thumbtack" :class="{'text-yellow-500': note.pinned}"></i>
              </button>
              <button @click.stop="handleDeleteRequest(note)" class="p-1 rounded-full hover:bg-black/10" title="Eliminar">
                <i class="pi pi-trash"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div ref="observerElement" class="h-20"></div>
      <div v-if="isFetchingMore" class="text-center text-[var(--color-text-muted)] py-4">Cargando más notas...</div>
      <div v-if="allNotesLoaded && !isLoading" class="text-center text-[var(--color-text-muted)] py-4">No hay más notas para mostrar.</div>
    </div>
    
    <NoteDetailModal 
      :is-visible="isNoteModalVisible" 
      :note="selectedNote"
      @close="closeNoteModal"
    />

    <div
      ref="pinnedDrawer"
      class="fixed top-0 right-0 h-full w-full sm:w-96 max-w-full bg-[var(--color-bg-secondary)] shadow-2xl border-l border-[var(--color-border)] z-30 transform translate-x-full"
    >
      <div class="p-4 h-full flex flex-col">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-bold">Notas Fijadas</h2>
          <button @click="togglePinnedDrawer" class="p-2 -mr-2 rounded-full hover:bg-black/10"><i class="pi pi-times"></i></button>
        </div>
        <div class="grid-stack grid-stack-pinned flex-grow p-2 overflow-y-auto">
             <div v-if="pinnedNotes.length === 0" class="text-center text-[var(--color-text-muted)] p-4">No hay notas ancladas.</div>
            <div
              v-for="note in pinnedNotes"
              :key="note.id"
              class="grid-stack-item"
              :gs-id="note.id"
            >
              <div class="grid-stack-item-content">
                <Note :note="note" :search-query="searchQuery" />
                 <div class="absolute top-2 right-2 flex items-center space-x-1 z-10 bg-inherit/70 backdrop-blur-sm rounded-full p-1">
                  <button @click.stop="openNoteModal(note)" class="p-1 rounded-full hover:bg-black/10" title="Ver nota"><i class="pi pi-window-maximize text-xs"></i></button>
                  <button @click.stop="toggleNotePin(note.id)" class="p-1 rounded-full hover:bg-black/10" title="Anclar"><i class="pi pi-thumbtack text-yellow-500"></i></button>
                  <button @click.stop="handleDeleteRequest(note)" class="p-1 rounded-full hover:bg-black/10" title="Eliminar"><i class="pi pi-trash"></i></button>
                </div>
              </div>
            </div>
        </div>
      </div>
    </div>

    <button
      ref="drawerToggle"
      @click="togglePinnedDrawer"
      class="fixed top-1/2 right-0 -translate-y-1/2 w-8 h-16 bg-[var(--color-bg-secondary)] border border-r-0 border-[var(--color-border)] rounded-l-lg z-30 flex items-center justify-center"
    >
      <i class="pi pi-thumbtack transition-transform" :class="{ 'transform rotate-45': isPinnedDrawerOpen }"></i>
    </button>
    
    <button @click="openAddModal" class="fixed bottom-8 right-8 w-14 h-14 rounded-2xl bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] shadow-lg hover:bg-[var(--btn-primary-hover-bg)] flex items-center justify-center z-40 transition-transform hover:scale-105">
      <i class="pi pi-plus text-2xl"></i>
    </button>
    
    <div v-if="noteToDelete" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div class="bg-[var(--color-bg-secondary)] p-6 rounded-lg shadow-xl text-[var(--color-text)]">
            <h3 class="text-xl font-bold mb-4">Confirmar Eliminación</h3>
            <p class="mb-6">¿Estás seguro de que quieres eliminar la nota "{{ noteToDelete.titulo }}"?</p>
            <div class="flex justify-end space-x-4">
                <button @click="cancelDelete" class="px-4 py-2 rounded-md hover:bg-black/10">Cancelar</button>
                <button @click="confirmDelete" class="px-4 py-2 rounded-md bg-red-500 text-white hover:bg-red-600">Eliminar</button>
            </div>
        </div>
    </div>

    <div v-if="showAddModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" @click.self="closeAddModal">
        <div class="bg-[var(--color-bg-secondary)] p-6 rounded-lg shadow-xl text-[var(--color-text)] w-full max-w-lg">
            <h2 class="text-2xl font-bold mb-6">Añadir Nota</h2>
            <form @submit.prevent="submitNewNote">
              </form>
        </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch, computed } from "vue";
import { GridStack } from "gridstack";
import "grid-stack/dist/gridstack.css";
import gsap from "gsap";
import Note from "./Note.vue";
import NoteDetailModal from "./NoteDetailModal.vue";
import { useNotesStore, type Note as NoteType, type NewNotePayload } from "@/composables/useNotesStore.ts";
import { onClickOutside } from "@vueuse/core";

const { notes, unpinnedNotes, pinnedNotes, isLoading, error, fetchNotes, addNote, saveLayout, deleteNote, updateNote, exportNotesToJSON } = useNotesStore();

let grid: GridStack | null = null;
let gridPinned: GridStack | null = null;
const searchQuery = ref("");
const noteToDelete = ref<NoteType | null>(null);
const selectedNote = ref<NoteType | null>(null);
const isNoteModalVisible = ref(false);

const filteredUnpinnedNotes = computed(() => {
    if (!searchQuery.value) return unpinnedNotes.value;
    const query = searchQuery.value.toLowerCase();
    return unpinnedNotes.value.filter(note => note.titulo.toLowerCase().includes(query) || note.descripcion.toLowerCase().includes(query));
});

const filteredPinnedNotes = computed(() => {
    if (!searchQuery.value) return pinnedNotes.value;
    const query = searchQuery.value.toLowerCase();
    return pinnedNotes.value.filter(note => note.titulo.toLowerCase().includes(query) || note.descripcion.toLowerCase().includes(query));
});

const displayedNotes = ref<NoteType[]>([]);
const notesPerPage = 10;
let page = 1;
const isFetchingMore = ref(false);
const allNotesLoaded = ref(false);

const loadMoreNotes = () => {
  if (isFetchingMore.value || allNotesLoaded.value) return;
  isFetchingMore.value = true;
  
  const sourceNotes = filteredUnpinnedNotes.value;
  const newNotes = sourceNotes.slice(0, page * notesPerPage);

  if (page > 1 && newNotes.length === displayedNotes.value.length) {
    allNotesLoaded.value = true;
    isFetchingMore.value = false;
    return;
  }

  const trulyNewNotes = newNotes.filter((n: NoteType) => !displayedNotes.value.some(dn => dn.id === n.id));
  displayedNotes.value = newNotes;
  page++;

  nextTick(() => {
    if (grid) {
      trulyNewNotes.forEach((note: NoteType) => {
        const el = document.querySelector(`.grid-stack-item[gs-id='${note.id}']`) as HTMLElement;
        if (el && !grid.isElementWidget(el)) {
          grid.makeWidget(el);
        }
      });
    }
    isFetchingMore.value = false;
  });
};

const resetAndFetch = () => {
    page = 1;
    allNotesLoaded.value = false;
    displayedNotes.value = [];
    grid?.removeAll();
    fetchNotes().then(() => {
        loadMoreNotes();
    });
};

const observerElement = ref<HTMLElement | null>(null);
let observer: IntersectionObserver;

onMounted(() => {
  observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      loadMoreNotes();
    }
  }, { threshold: 1.0 });

  if (observerElement.value) observer.observe(observerElement.value);
});

onUnmounted(() => {
  if (observerElement.value) observer.unobserve(observerElement.value);
  grid?.destroy();
  gridPinned?.destroy();
});

const openNoteModal = (note: NoteType) => { selectedNote.value = note; isNoteModalVisible.value = true; };
const closeNoteModal = () => { isNoteModalVisible.value = false; };

const toggleNotePin = (noteId: number) => {
  const note = notes.value.find(n => n.id === noteId);
  if (note) updateNote(note.id, { pinned: !note.pinned });
};

const handleDeleteRequest = (note: NoteType) => { noteToDelete.value = note; };
const cancelDelete = () => { noteToDelete.value = null; };
const confirmDelete = () => {
    if (!noteToDelete.value) return;
    const el = document.querySelector(`.grid-stack-item[gs-id='${noteToDelete.value.id}']`) as HTMLElement;
    if (el) {
        if (grid?.isElementWidget(el)) grid.removeWidget(el);
        if (gridPinned?.isElementWidget(el)) gridPinned.removeWidget(el);
    }
    deleteNote(noteToDelete.value.id);
    noteToDelete.value = null;
};

const settingsMenuContainer = ref(null);
const isSettingsMenuVisible = ref(false);
onClickOutside(settingsMenuContainer,() => (isSettingsMenuVisible.value = false));
const compactNotes = () => grid?.compact();

const pinnedDrawer = ref<HTMLElement | null>(null);
const drawerToggle = ref<HTMLElement | null>(null);
const isPinnedDrawerOpen = ref(false);
let pinnedGridInitialized = false;
const togglePinnedDrawer = () => { isPinnedDrawerOpen.value = !isPinnedDrawerOpen.value; };

watch(isPinnedDrawerOpen, async (isOpen) => {
  const drawerWidth = pinnedDrawer.value?.offsetWidth || 384;
  gsap.to(pinnedDrawer.value, { x: isOpen ? 0 : "100%", duration: 0.5, ease: "power3.out" });
  gsap.to(drawerToggle.value, { x: isOpen ? -drawerWidth : 0, duration: 0.5, ease: "power3.out" });
  if (isOpen && !pinnedGridInitialized) {
    await nextTick();
    gridPinned = GridStack.init({ column: 1, margin: 10, cellHeight: 30, handle: '.note-drag-handle' }, ".grid-stack-pinned");
    pinnedGridInitialized = true;
  }
});

watch(pinnedNotes, async (newVal, oldVal) => {
    if (!gridPinned || !grid) return;
    if (newVal.length > oldVal.length) {
        const moved = newVal.find(n => !oldVal.some(o => o.id === n.id));
        if (moved) {
            const el = document.querySelector(`.grid-stack-item[gs-id="${moved.id}"]`);
            if (el && grid.isElementWidget(el)) grid.removeWidget(el, false);
        }
    } else if (newVal.length < oldVal.length) {
        const moved = oldVal.find(o => !newVal.some(n => n.id === o.id));
        if (moved) {
            const el = document.querySelector(`.grid-stack-item[gs-id="${moved.id}"]`);
            if (el && gridPinned.isElementWidget(el)) gridPinned.removeWidget(el, false);
        }
    }
}, { deep: true });

watch(filteredNotes, () => {
    page = 1;
    allNotesLoaded.value = false;
    displayedNotes.value = [];
    grid?.removeAll();
    nextTick(() => {
        loadMoreNotes();
    });
});

onMounted(() => {
  fetchNotes();
  nextTick(() => {
    if (!grid) {
      grid = GridStack.init({
        column: 12,
        margin: 15,
        cellHeight: 30,
        alwaysShowResizeHandle: true,
        handle: '.note-drag-handle',
      });
      grid.on('change', (_e, items) => {
        const layout = items.map(item => ({ id: Number(item.id), x: item.x, y: item.y, w: item.w, h: item.h }));
        if (layout.length > 0) saveLayout(layout as any);
      });
    }
  });
});

const showAddModal = ref(false);
const newNote = ref<NewNotePayload>({ titulo: "", descripcion: "", color: "white", pinned: false });
const openAddModal = () => { showAddModal.value = true; };
const closeAddModal = () => { showAddModal.value = false; };
const submitNewNote = async () => { await addNote({ ...newNote.value }); closeAddModal(); };
</script>

<style>
.grid-stack-item-content {
  background-color: var(--color-bg-secondary);
  border-radius: 0.75rem;
  border: 1px solid var(--color-border);
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  position: relative;
  overflow: hidden;
}
</style>