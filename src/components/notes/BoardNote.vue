<template>
  <div
    class="board p-4 bg-transparent text-[var(--color-text)] h-screen w-screen flex flex-col overflow-hidden"
  >
    <header
      class="max-w-7xl w-full mx-auto mb-4 sticky top-0 z-20 py-2 bg-[var(--color-bg)] flex items-center space-x-4 flex-shrink-0"
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
        <button @click="fetchNotes()" class="p-3 rounded-full hover:bg-[var(--btn-secondary-hover-bg)]" title="Actualizar"><i class="pi pi-refresh"></i></button>
        <div ref="settingsMenuContainer" class="relative">
          <button @click="isSettingsMenuVisible = !isSettingsMenuVisible" class="p-3 rounded-full hover:bg-[var(--btn-secondary-hover-bg)]" title="Opciones">
            <i class="pi pi-cog"></i>
          </button>
          <transition name="fade">
            <div
              v-if="isSettingsMenuVisible"
              class="absolute top-full right-0 mt-2 w-52 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-xl py-2 z-20"
            >
              <button @click="compactNotes" class="w-full text-left px-4 py-2 flex items-center space-x-3 hover:bg-[var(--btn-secondary-hover-bg)]">
                <i class="pi pi-sort w-4"></i>
                <span>Ordenar Notas</span>
              </button>
              <button @click="exportNotesToJSON" class="w-full text-left px-4 py-2 flex items-center space-x-3 hover:bg-[var(--btn-secondary-hover-bg)]">
                <i class="pi pi-download w-4"></i>
                <span>Exportar</span>
              </button>
            </div>
          </transition>
        </div>
      </div>
    </header>

    <div v-if="isLoading" class="flex-grow flex items-center justify-center text-lg">Cargando...</div>
    <div v-if="error" class="flex-grow flex items-center justify-center text-red-500">{{ error }}</div>

    <div ref="canvasContainer" v-show="!isLoading && !error" class="canvas-container flex-grow relative">
      <div class="grid-stack grid-stack-others">
        <div
          v-for="note in filteredUnpinnedNotes"
          :key="note.id"
          class="grid-stack-item"
          :gs-id="note.id"
          :gs-x="note.layout?.x"
          :gs-y="note.layout?.y"
          :gs-w="note.layout?.w"
          :gs-h="note.layout?.h"
          :gs-min-w="isMobile ? 4 : 5"
          :gs-min-h="9"
        >
          <div 
            class="grid-stack-item-content"
            @mousedown="onMouseDown($event)"
            @mouseup="onMouseUp($event, note)"
          >
            <Note
              :note="note"
              @content-changed="updateNoteSizeById(note.id)"
            />
            <div class="absolute top-2 right-2 flex items-center space-x-1 z-10 bg-inherit/70 backdrop-blur-sm rounded-full p-1">
              <button @click.stop="openNoteModal(note)" class="p-1 rounded-full hover:bg-black/10" title="Ver nota"><i class="pi pi-window-maximize text-xs"></i></button>
              <button @click.stop="toggleNotePin(note.id)" class="p-1 rounded-full hover:bg-black/10" title="Anclar"><i class="pi pi-thumbtack" :class="{'text-yellow-500': note.pinned}"></i></button>
              <button @click.stop="handleDeleteRequest(note)" class="p-1 rounded-full hover:bg-black/10" title="Eliminar"><i class="pi pi-trash"></i></button>
            </div>
          </div>
        </div>
      </div>
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
             <div v-if="filteredPinnedNotes.length === 0" class="text-center text-[var(--color-text-muted)] p-4">No hay notas ancladas.</div>
            <div
              v-for="note in filteredPinnedNotes"
              :key="note.id"
              class="grid-stack-item"
              :gs-id="note.id"
            >
              <div class="grid-stack-item-content">
                <Note :note="note" @content-changed="updateNoteSizeById(note.id, true)" />
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
    
    <button
      @click="openAddModal"
      class="fixed bottom-8 right-8 w-14 h-14 rounded-2xl bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] shadow-lg hover:bg-[var(--btn-primary-hover-bg)] flex items-center justify-center z-40 transition-transform hover:scale-105"
    >
      <i class="pi pi-plus text-2xl"></i>
    </button>
    
    <transition name="fade">
      <div v-if="noteToDelete" class="fixed inset-0 modal-overlay flex items-center justify-center z-50">
        <div class="modal-content relative bg-[var(--bg-modal)] p-6 rounded-xl shadow-2xl max-w-sm w-full">
          <h3 class="text-xl font-bold mb-4">Confirmar Eliminación</h3>
          <p class="text-[var(--color-text-muted)] mb-6">¿Estás seguro de que quieres eliminar la nota "{{ noteToDelete.titulo }}"?</p>
          <div class="flex justify-end space-x-4">
            <button @click="cancelDelete" class="bg-[var(--btn-secondary-bg)] text-[var(--btn-secondary-text)] font-semibold py-2 px-4 rounded-xl transition hover:bg-[var(--btn-secondary-hover-bg)]">Cancelar</button>
            <button @click="confirmDelete" class="bg-[var(--btn-danger-bg)] text-[var(--btn-danger-text)] font-semibold py-2 px-4 rounded-xl transition hover:bg-[var(--btn-danger-hover-bg)]">Eliminar</button>
          </div>
        </div>
      </div>
    </transition>

    <transition name="fade">
      <div v-if="showAddModal" class="fixed inset-0 modal-overlay flex items-center justify-center z-50" @click.self="closeAddModal">
        <div class="modal-content relative bg-[var(--bg-modal)] p-6 rounded-xl shadow-2xl max-w-lg w-full">
          <h2 class="text-2xl font-bold mb-6">Añadir Nota</h2>
          <form @submit.prevent="submitNewNote">
            </form>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, watch, computed } from "vue";
import { GridStack } from "gridstack";
import gsap from "gsap";
import Note from "./Note.vue";
import NoteDetailModal from "./NoteDetailModal.vue";
import { useNotesStore, type Note as NoteType, type NewNotePayload } from "@/composables/useNotesStore.ts";
import { useMobileDetection } from "@/composables/useMobileDetection.ts";
import { onClickOutside } from "@vueuse/core";

const { unpinnedNotes, pinnedNotes, isLoading, error, fetchNotes, addNote, saveLayout, deleteNote, updateNote, exportNotesToJSON } = useNotesStore();
const { isMobile } = useMobileDetection();

let gridOthers: GridStack | null = null;
let gridPinned: GridStack | null = null;
const manuallyResizedNotes = ref(new Set<number>());
const selectedNote = ref<NoteType | null>(null);
const isNoteModalVisible = ref(false);
const canvasContainer = ref<HTMLElement | null>(null);
const searchQuery = ref("");

const filteredUnpinnedNotes = computed(() => {
  if (!searchQuery.value) return unpinnedNotes.value;
  const query = searchQuery.value.toLowerCase();
  return unpinnedNotes.value.filter(n => n.titulo.toLowerCase().includes(query) || n.descripcion.toLowerCase().includes(query));
});
const filteredPinnedNotes = computed(() => {
  if (!searchQuery.value) return pinnedNotes.value;
  const query = searchQuery.value.toLowerCase();
  return pinnedNotes.value.filter(n => n.titulo.toLowerCase().includes(query) || n.descripcion.toLowerCase().includes(query));
});

const openNoteModal = (note: NoteType) => { isNoteModalVisible.value = true; selectedNote.value = note; };
const closeNoteModal = () => { isNoteModalVisible.value = false; };

let mouseDownPos = { x: 0, y: 0 };
const onMouseDown = (e: MouseEvent) => { mouseDownPos = { x: e.clientX, y: e.clientY }; };
const onMouseUp = (e: MouseEvent, note: NoteType) => {
  const target = e.target as HTMLElement;
  if (target.closest('.absolute.top-2.right-2')) return;
  const dx = Math.abs(e.clientX - mouseDownPos.x);
  const dy = Math.abs(e.clientY - mouseDownPos.y);
  if (dx < 5 && dy < 5) openNoteModal(note);
};

const toggleNotePin = (noteId: number) => {
  const note = [...unpinnedNotes.value, ...pinnedNotes.value].find(n => n.id === noteId);
  if (note) updateNote(note.id, { pinned: !note.pinned });
};

const settingsMenuContainer = ref(null);
const isSettingsMenuVisible = ref(false);
onClickOutside(settingsMenuContainer,() => (isSettingsMenuVisible.value = false));

const compactNotes = () => { gridOthers?.compact(); isSettingsMenuVisible.value = false; };

const pinnedDrawer = ref<HTMLElement | null>(null);
const drawerToggle = ref<HTMLElement | null>(null);
const isPinnedDrawerOpen = ref(false);
let pinnedGridInitialized = false;
const togglePinnedDrawer = () => { isPinnedDrawerOpen.value = !isPinnedDrawerOpen.value; };

const adjustNoteSize = (el: HTMLElement, grid: GridStack) => {
    if (!grid) return;
    requestAnimationFrame(() => {
        const noteCard = el.querySelector('.note-card') as HTMLElement;
        if (!noteCard) return;
        const newH = Math.ceil(noteCard.scrollHeight / (grid.getCellHeight() + (grid.opts.margin as number)));
        const newW = Math.max(isMobile.value ? 4 : 5, Math.ceil(noteCard.scrollWidth / (grid.cellWidth() + (grid.opts.margin as number))));
        const node = grid.engine.nodes.find(n => n.el === el);
        if (node && (node.h !== newH || node.w !== newW)) {
            grid.update(el, { h: newH, w: newW });
        }
    });
};

const updateNoteSizeById = (noteId: number, isPinnedGrid = false) => {
  const grid = isPinnedGrid ? gridPinned : gridOthers;
  const el = document.querySelector(`.grid-stack [gs-id='${noteId}']`) as HTMLElement;
  if (!el || !grid) return;
  const isManual = manuallyResizedNotes.value.has(noteId);
  if (isManual) {
    const noteCard = el.querySelector('.note-card') as HTMLElement;
    if (noteCard && (noteCard.scrollHeight > el.clientHeight || noteCard.scrollWidth > el.clientWidth)) {
      manuallyResizedNotes.value.delete(noteId);
      adjustNoteSize(el, grid);
    }
  } else {
    adjustNoteSize(el, grid);
  }
};

watch(isPinnedDrawerOpen, async (isOpen) => {
    const drawerWidth = pinnedDrawer.value?.offsetWidth || 384;
    gsap.to(pinnedDrawer.value, { x: isOpen ? 0 : "100%", duration: 0.5, ease: "power3.out" });
    gsap.to(drawerToggle.value, { x: isOpen ? -drawerWidth : 0, duration: 0.5, ease: "power3.out" });
    if (isOpen && !pinnedGridInitialized) {
        await nextTick();
        gridPinned = GridStack.init({ column: 1, margin: 10, cellHeight: 10, handle: '.note-drag-handle' }, ".grid-stack-pinned");
        gridPinned.on('added', (_e, items) => items.forEach(i => adjustNoteSize(i.el as HTMLElement, gridPinned!)));
        pinnedGridInitialized = true;
    }
});

watch(pinnedNotes, async (newVal, oldVal) => {
    if (!gridPinned || !gridOthers) return;
    if (newVal.length > oldVal.length) {
        const moved = newVal.find(n => !oldVal.some(o => o.id === n.id));
        if (moved) {
            const el = document.querySelector(`.grid-stack-others [gs-id="${moved.id}"]`);
            if (el) gridOthers.removeWidget(el as HTMLElement, false);
            await nextTick();
            const newElInPinned = document.querySelector(`.grid-stack-pinned [gs-id="${moved.id}"]`) as HTMLElement;
            if (newElInPinned) {
                gridPinned.makeWidget(newElInPinned);
                gridPinned.update(newElInPinned, { w: 1, x: 0 });
            }
        }
    } 
    else if (newVal.length < oldVal.length) {
        const moved = oldVal.find(o => !newVal.some(n => n.id === o.id));
        if (moved) {
            const el = document.querySelector(`.grid-stack-pinned [gs-id="${moved.id}"]`);
            if (el) gridPinned.removeWidget(el as HTMLElement, false);
            await nextTick();
            const newElInOthers = document.querySelector(`.grid-stack-others [gs-id="${moved.id}"]`) as HTMLElement;
            if (newElInOthers) {
                gridOthers.makeWidget(newElInOthers);
                gridOthers.update(newElInOthers, { locked: false });
            }
        }
    }
}, { deep: true });

watch(isLoading, (loading) => {
  if (loading === false && gridOthers === null) {
      nextTick(() => {
        gridOthers = GridStack.init({
            column: isMobile.value ? 4 : 12,
            margin: 15,
            cellHeight: 10,
            alwaysShowResizeHandle: true,
            handle: '.note-drag-handle',
        }, '.grid-stack-others');

        gridOthers.on('resizestop', (_e, el) => {
            const id = Number(el.getAttribute('gs-id'));
            if (id) manuallyResizedNotes.value.add(id);
        });
        gridOthers.on('change', (_e, items) => {
            const layout = items.map(item => ({ id: Number(item.id), x: item.x, y: item.y, w: item.w, h: item.h }));
            if (layout.length > 0) saveLayout(layout as any);
        });

        if (canvasContainer.value) {
            const canvas = canvasContainer.value.querySelector('.grid-stack-others') as HTMLElement;
            if (canvas) {
            canvasContainer.value.scrollTo(
                (canvas.scrollWidth - canvasContainer.value.clientWidth) / 2,
                (canvas.scrollHeight - canvasContainer.value.clientHeight) / 2
            );
            }
        }
      });
  }
});

watch(isMobile, (isNowMobile) => {
    if (gridOthers) {
        gridOthers.column(isNowMobile ? 4 : 12);
    }
});

onMounted(() => {
  fetchNotes();
});

const noteToDelete = ref<NoteType | null>(null);
const handleDeleteRequest = (note: NoteType) => { noteToDelete.value = note; };
const cancelDelete = () => { noteToDelete.value = null; };
const confirmDelete = () => { if (noteToDelete.value) { deleteNote(noteToDelete.value.id); } noteToDelete.value = null; };
const showAddModal = ref(false);
const openAddModal = () => { showAddModal.value = true; };
const closeAddModal = () => { showAddModal.value = false; };
const newNote = ref<NewNotePayload>({ titulo: "", descripcion: "", color: "white", pinned: false });
const submitNewNote = async () => { if (!newNote.value.titulo && !newNote.value.descripcion) return; await addNote({ ...newNote.value }); closeAddModal(); };
</script>

<style>
body { overflow: hidden; }
.canvas-container { overflow: auto; cursor: grab; }
.canvas-container:active { cursor: grabbing; }
.canvas-container::-webkit-scrollbar { display: none; }
.canvas-container { scrollbar-width: none; -ms-overflow-style: none; }
.grid-stack-others { width: 5000px; height: 5000px; }
.grid-stack-item-content {
  background-color: var(--color-bg-secondary);
  border-radius: 0.75rem;
  border: 1px solid var(--color-border);
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  position: relative;
  overflow: hidden;
}
.fade-enter-active,
.fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.modal-overlay { background-color: rgba(0, 0, 0, 0.5); backdrop-filter: blur(4px); }
</style>