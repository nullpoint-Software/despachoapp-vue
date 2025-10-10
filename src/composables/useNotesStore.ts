import { ref, computed } from 'vue';
import { saveAs } from 'file-saver';
import { ns } from '@/service/adminApp/client';

// --- INTERFACES ---
export interface Note {
  id: number;
  titulo: string;
  descripcion: string;
  pinned: boolean;
  color: 'white' | 'blue' | 'red' | 'yellow' | 'green';
  gs_x?: number;
  gs_y?: number;
  gs_w?: number;
  gs_h?: number;
}

export type NewNotePayload = Omit<Note, 'id'>;
export type UpdateNotePayload = Partial<Omit<Note, 'id'>>;

// --- CONSTANTES ---
const PINNED_NOTES_KEY = 'pinnedNotesState';

// --- ESTADO GLOBAL REACTIVO ---
const notes = ref<Note[]>([]);
const isLoading = ref<boolean>(false);
const error = ref<string | null>(null);
const isPinnedWindowVisible = ref<boolean>(false);
const compactGridTrigger = ref<number>(0);
const isPinnedDrawerOpen = ref<boolean>(false);

// --- COMPOSABLE ---
export function useNotesStore() {

  // --- LÓGICA DE LOCAL STORAGE ---
  const getPinnedIdsFromStorage = (): number[] => {
    const stored = localStorage.getItem(PINNED_NOTES_KEY);
    return stored ? JSON.parse(stored) : [];
  };

  const savePinnedIdsToStorage = (ids: number[]) => {
    localStorage.setItem(PINNED_NOTES_KEY, JSON.stringify(ids));
  };

  const togglePinnedWindow = () => {
    isPinnedWindowVisible.value = !isPinnedWindowVisible.value;
  };

  const togglePinnedDrawer = () => {
    isPinnedDrawerOpen.value = !isPinnedDrawerOpen.value;
  };

  // CORRECCIÓN: La función vuelve a no tener argumentos
  const fetchNotes = async (): Promise<void> => {
    isLoading.value = true;
    error.value = null;
    try {
      const notesFromDB: Note[] = await ns.getNotas();
      const pinnedIds = getPinnedIdsFromStorage();

      notes.value = notesFromDB.map(note => ({
        ...note,
        pinned: pinnedIds.includes(note.id),
        gs_w: (note.gs_w && note.gs_w >= 2) ? note.gs_w : 2,
        gs_h: (note.gs_h && note.gs_h >= 2) ? note.gs_h : 2,
      }));
    } catch (e) {
      const err = e as Error;
      error.value = 'Error al cargar las notas.';
      console.error(err.message);
    } finally {
      isLoading.value = false;
    }
  };
  
  const addNote = async (newNoteData: NewNotePayload): Promise<void> => {
    isLoading.value = true;
    error.value = null;
    try {
      await ns.addNota(newNoteData);
      await fetchNotes(); 
    } catch (e) {
      const err = e as Error;
      error.value = 'No se pudo añadir la nota.';
      console.error(err.message);
    } finally {
      isLoading.value = false;
    }
  };

  const updateNote = async (noteId: number, updatedData: UpdateNotePayload): Promise<void> => {
    error.value = null;
    try {
      // TODO: Conecta tu función de API que actualiza una nota.
      // await ns.updateNota(noteId, updatedData);
      
      const index = notes.value.findIndex(n => n.id === noteId);
      if (index !== -1) {
        const updatedNote = { ...notes.value[index], ...updatedData } as Note;
        notes.value[index] = updatedNote;

        if (updatedData.pinned !== undefined) {
          let pinnedIds = getPinnedIdsFromStorage();
          if (updatedNote.pinned) {
            if (!pinnedIds.includes(noteId)) {
              pinnedIds.push(noteId);
            }
          } else {
            pinnedIds = pinnedIds.filter(id => id !== noteId);
          }
          savePinnedIdsToStorage(pinnedIds);
        }
      }
    } catch (e) {
      const err = e as Error;
      error.value = 'Error al actualizar la nota.';
      console.error(err.message);
    }
  };

  const saveLayout = async (layout: { id: number; x: number; y: number; w: number; h: number }[]): Promise<void> => {
    error.value = null;
    try {
      // TODO: Conecta tu función de API que guarda el layout.
      // await ns.saveNoteLayout(layout);
      
      layout.forEach(item => {
        const note = notes.value.find(n => n.id === item.id);
        if (note) {
          note.gs_x = item.x;
          note.gs_y = item.y;
          note.gs_w = item.w;
          note.gs_h = item.h;
        }
      });
    } catch (e) {
      const err = e as Error;
      error.value = 'No se pudo guardar el layout.';
      console.error(err.message);
    }
  };

  const deleteNote = async (noteId: number): Promise<void> => {
    error.value = null;
    try {
      const index = notes.value.findIndex(n => n.id === noteId);
      if (index === -1) return;
      notes.value.splice(index, 1);
      await ns.deleteNota(noteId);
    } catch (e) {
      const err = e as Error;
      error.value = 'Error al eliminar la nota.';
      console.error(err.message);
      await fetchNotes();
    }
  };

  const exportNotesToJSON = () => {
    try {
      const data = JSON.stringify(notes.value, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      saveAs(blob, `notas_exportadas_${new Date().toISOString().split('T')[0]}.json`);
    } catch (e) {
      error.value = "Error al exportar las notas.";
      console.error(e);
    }
  };

  const compactNotes = () => {
    compactGridTrigger.value++;
  };

  const pinnedNotes = computed(() => notes.value.filter(note => note.pinned));
  const unpinnedNotes = computed(() => notes.value.filter(note => !note.pinned));

  return {
    notes,
    pinnedNotes,
    unpinnedNotes,
    isLoading,
    error,
    isPinnedWindowVisible,
    compactGridTrigger,
    isPinnedDrawerOpen,
    togglePinnedWindow,
    togglePinnedDrawer,
    fetchNotes,
    addNote,
    updateNote,
    saveLayout,
    deleteNote,
    exportNotesToJSON,
    compactNotes,
  };
}