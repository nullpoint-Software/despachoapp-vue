<template>
  <div
    class="board p-4 bg-transparent text-[var(--color-text)] min-h-screen relative overflow-x-hidden"
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
          @click="fetchNotes()"
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
                <i class="pi pi-arrows-alt-h w-4"></i>
                <span>Compactar Notas</span>
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

    <div
      v-if="isLoading"
      class="text-center text-[var(--color-text-muted)] py-10"
    >
      Cargando notas...
    </div>
    <div v-if="error" class="text-center text-red-500 py-10">{{ error }}</div>

    <div v-show="!isLoading && !error" class="max-w-7xl mx-auto">
        <div class="p-2 overflow-y-auto space-y-2">
          <div
            v-if="pinnedNotes.length === 0"
            class="text-center text-[var(--color-text-muted)] p-4"
          >
            No hay notas.
          </div>
          <Note
            v-for="note in unpinnedNotes"
            :key="note.id"
            :note="note"
            @request-delete="handleDeleteRequest"
          />
        </div>
    </div>

    <div
      ref="pinnedDrawer"
      class="fixed top-0 right-0 h-full w-96 max-w-full bg-[var(--color-bg-secondary)] shadow-2xl border-l border-[var(--color-border)] z-30 transform translate-x-full"
    >
      <div class="p-4 h-full flex flex-col">
        <h2 class="text-xl font-bold mb-4">Notas Fijadas</h2>
        <div class="p-2 overflow-y-auto space-y-2">
          <div
            v-if="pinnedNotes.length === 0"
            class="text-center text-[var(--color-text-muted)] p-4"
          >
            No hay notas ancladas.
          </div>
          <Note
            v-for="note in pinnedNotes"
            :key="note.id"
            :note="note"
            @request-delete="handleDeleteRequest"
          />
        </div>
      </div>
    </div>

    <button
      ref="drawerToggle"
      @click="togglePinnedDrawer"
      class="fixed top-1/2 right-0 -translate-y-1/2 w-8 h-16 bg-[var(--color-bg-secondary)] border border-r-0 border-[var(--color-border)] rounded-l-lg z-30 flex items-center justify-center"
    >
      <i
        class="pi pi-thumbtack transition-transform"
        :class="{ 'transform rotate-45': isPinnedDrawerOpen }"
      ></i>
    </button>

    <button
      @click="openAddModal"
      class="fixed bottom-8 right-8 w-14 h-14 rounded-2xl bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] shadow-lg hover:bg-[var(--btn-primary-hover-bg)] flex items-center justify-center z-40 transition-transform hover:scale-105"
    >
      <i class="pi pi-plus text-2xl"></i>
    </button>

    <transition name="fade">
      <div
        v-if="noteToDelete"
        class="fixed inset-0 modal-overlay flex items-center justify-center z-50"
      >
        <div
          class="modal-content relative bg-[var(--bg-modal)] p-6 rounded-xl shadow-2xl max-w-sm w-full"
        >
          <h3 class="text-xl font-bold mb-4">Confirmar Eliminación</h3>
          <p class="text-[var(--color-text-muted)] mb-6">
            ¿Estás seguro de que quieres eliminar la nota "{{
              noteToDelete.titulo
            }}"? Esta acción no se puede deshacer.
          </p>
          <div class="flex justify-end space-x-4">
            <button
              @click="cancelDelete"
              class="bg-[var(--btn-secondary-bg)] text-[var(--btn-secondary-text)] font-semibold py-2 px-4 rounded-xl transition hover:bg-[var(--btn-secondary-hover-bg)]"
            >
              Cancelar
            </button>
            <button
              @click="confirmDelete"
              class="bg-[var(--btn-danger-bg)] text-[var(--btn-danger-text)] font-semibold py-2 px-4 rounded-xl transition hover:bg-[var(--btn-danger-hover-bg)]"
            >
              Eliminar
            </button>
          </div>
        </div>
      </div>
    </transition>

    <transition name="fade">
      <div
        v-if="showAddModal"
        class="fixed inset-0 modal-overlay flex items-center justify-center z-50"
        @click.self="closeAddModal"
      >
        <div
          class="modal-content relative bg-[var(--bg-modal)] p-6 rounded-xl shadow-2xl max-w-lg w-full"
        >
          <h2 class="text-2xl font-bold mb-6">Añadir Nota</h2>
          <form @submit.prevent="submitNewNote">
            <input
              v-model="newNote.titulo"
              type="text"
              placeholder="Título"
              class="w-full p-3 mb-4 border border-[var(--color-border)] bg-[var(--color-bg-secondary)] rounded-xl focus:outline-none focus:ring-2 ring-[var(--obj-important-1)]"
              required
            />
            <textarea
              v-model="newNote.descripcion"
              rows="5"
              placeholder="Descripción (Markdown)"
              class="w-full p-3 mb-4 border border-[var(--color-border)] bg-[var(--color-bg-secondary)] rounded-xl focus:outline-none focus:ring-2 ring-[var(--obj-important-1)]"
              required
            ></textarea>
            <div class="mb-6">
              <label class="block font-semibold mb-2">Color</label>
              <div class="flex space-x-3">
                <label
                  v-for="color in noteColors"
                  :key="color"
                  class="cursor-pointer"
                >
                  <input
                    type="radio"
                    v-model="newNote.color"
                    :value="color"
                    name="noteColor"
                    class="hidden"
                  />
                  <span
                    class="w-8 h-8 rounded-full border-2 transition-transform"
                    :class="[
                      colorClasses[color],
                      newNote.color === color
                        ? 'border-blue-500 scale-110'
                        : 'border-transparent',
                    ]"
                  ></span>
                </label>
              </div>
            </div>
            <div class="flex justify-end space-x-4">
              <button
                type="button"
                @click="closeAddModal"
                class="bg-[var(--btn-secondary-bg)] text-[var(--btn-secondary-text)] font-semibold py-2 px-4 rounded-xl transition hover:bg-[var(--btn-secondary-hover-bg)]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                class="bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] font-semibold py-2 px-6 rounded-xl transition hover:bg-[var(--btn-primary-hover-bg)]"
              >
                Guardar
              </button>
            </div>
          </form>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, watch } from "vue";
import { GridStack, type GridStackNode } from "gridstack";
import "gridstack/dist/gridstack.min.css";
import gsap from "gsap";
import Note from "./Note.vue";
import {
  useNotesStore,
  type Note as NoteType,
  type NewNotePayload,
} from "@/composables/useNotesStore.ts";
import { onClickOutside } from "@vueuse/core";

const {
  unpinnedNotes,
  pinnedNotes,
  isLoading,
  error,
  fetchNotes,
  addNote,
  saveLayout,
  deleteNote,
  exportNotesToJSON,
  isPinnedDrawerOpen,
  togglePinnedDrawer,
} = useNotesStore();

const searchQuery = ref("");
let gridOthers: GridStack | null = null;
let gridPinned: GridStack | null = null;

const settingsMenuContainer = ref(null);
const isSettingsMenuVisible = ref(false);
onClickOutside(
  settingsMenuContainer,
  () => (isSettingsMenuVisible.value = false)
);

const compactNotes = () => {
  if (gridOthers) {
    gridOthers.compact();
  }
  isSettingsMenuVisible.value = false;
};

const pinnedDrawer = ref<HTMLElement | null>(null);
const drawerToggle = ref<HTMLElement | null>(null);
let pinnedGridInitialized = false;

watch(isPinnedDrawerOpen, async (isOpen) => {
  const drawerWidth = pinnedDrawer.value?.offsetWidth || 384;
  gsap.to(pinnedDrawer.value, {
    x: isOpen ? 0 : "100%",
    duration: 0.5,
    ease: "power3.out",
  });
  gsap.to(drawerToggle.value, {
    x: isOpen ? -drawerWidth : 0,
    duration: 0.5,
    ease: "power3.out",
  });

  if (isOpen && !pinnedGridInitialized) {
    await nextTick();
    gridPinned = GridStack.init(
      {
        column: 1,
        float: true,
        cellHeight: "auto",
        margin: 10,
        staticGrid: true,
      },
      ".grid-stack-pinned"
    );

    gridPinned.on("added", (e, items: GridStackNode[]) =>
      items.forEach((item) => gridPinned!.resizeToContent(item.el!))
    );
    pinnedGridInitialized = true;
  }
});

watch(
  pinnedNotes,
  async (newPinned, oldPinned) => {
    if (!gridPinned || !gridOthers) return;

    if (newPinned.length > oldPinned.length) {
      const movedNote = newPinned.find(
        (n) => !oldPinned.some((on) => on.id === n.id)
      );
      if (movedNote) {
        const el = document.querySelector(
          `.grid-stack-others [gs-id="${movedNote.id}"]`
        );
        if (el) gridOthers.removeWidget(el as HTMLElement);
      }
    } else if (newPinned.length < oldPinned.length) {
      const movedNote = oldPinned.find(
        (on) => !newPinned.some((n) => n.id === on.id)
      );
      if (movedNote) {
        await nextTick();
        const el = document.querySelector(
          `.grid-stack-others [gs-id="${movedNote.id}"]`
        );
        if (el) gridOthers.makeWidget(el as HTMLElement);
      }
    }
  },
  { deep: true }
);

onMounted(async () => {
  await fetchNotes();
  await nextTick();

  gridOthers = GridStack.init(
    {
      column: 12,
      float: true,
      cellHeight: 1,
      margin: 15,
      alwaysShowResizeHandle: true,
    },
    ".grid-stack-others"
  );

  gridOthers.on("added", (_event: Event, items: GridStackNode[]) => {
    items.forEach((item) => gridOthers!.resizeToContent(item.el!));
  });

  gridOthers.on("resizestop", (_event: Event, el: GridStackNode) => {
    gridOthers?.resizeToContent(el as HTMLElement);
  });

  gridOthers.on("change", (_, items: GridStackNode[]) => {
    const layout = items.map((item) => ({
      id: Number(item.el?.getAttribute("gs-id")),
      x: item.x!,
      y: item.y!,
      w: item.w!,
      h: item.h!,
    }));
    if (layout.length > 0) saveLayout(layout);
  });
});

const noteToDelete = ref<NoteType | null>(null);
const handleDeleteRequest = (note: NoteType) => {
  noteToDelete.value = note;
};
const cancelDelete = () => {
  noteToDelete.value = null;
};
const confirmDelete = () => {
  if (noteToDelete.value) {
    deleteNote(noteToDelete.value.id);
  }
  noteToDelete.value = null;
};

const showAddModal = ref(false);
const newNote = ref<NewNotePayload>({
  titulo: "",
  descripcion: "",
  color: "white",
  pinned: false,
});
type NoteColor = "white" | "blue" | "red" | "yellow" | "green";
const noteColors: NoteColor[] = ["white", "blue", "red", "yellow", "green"];
const colorClasses: Record<NoteColor, string> = {
  white: "bg-white",
  blue: "bg-blue-300",
  red: "bg-red-300",
  yellow: "bg-yellow-300",
  green: "bg-green-300",
};

const openAddModal = () => (showAddModal.value = true);
const closeAddModal = () => {
  showAddModal.value = false;
  newNote.value = {
    titulo: "",
    descripcion: "",
    color: "white",
    pinned: false,
  };
};
const submitNewNote = async () => {
  if (!newNote.value.titulo && !newNote.value.descripcion) return;
  await addNote({ ...newNote.value });
  closeAddModal();
};
</script>

<style>
.grid-stack {
  overflow: visible !important;
}
.grid-stack > .grid-stack-item > .grid-stack-item-content {
  overflow: hidden;
  position: relative;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.modal-overlay {
  background-color: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}
</style>
