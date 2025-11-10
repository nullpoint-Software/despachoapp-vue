import { ref, computed } from "vue";
import { saveAs } from "file-saver";
import { ns } from "@/service/adminApp/client";

// --- CONSTANTES ---
const PINNED_NOTES_KEY = "pinnedNotesState";
// --- CAMBIO: Llave para guardar TODAS las notas ---
const NOTES_STATE_KEY = "notesFullState";

// --- ESTADO GLOBAL REACTIVO ---
const notes = ref<Note[]>([]);
const isLoading = ref<boolean>(false);
const error = ref<string | null>(null);
const isPinnedWindowVisible = ref<boolean>(false);
const compactGridTrigger = ref<number>(0);
const isPinnedDrawerOpen = ref<boolean>(false);

// --- INTERFACES ---
export interface Note {
  id: number;
  titulo: string;
  descripcion: string;
  pinned: boolean | number;
  color: "white" | "blue" | "red" | "yellow" | "green";
  status: "canvas" | "pinned" | "storage" | string;
  gs_x?: number;
  gs_y?: number;
  gs_w?: number;
  gs_h?: number;
}

export type NewNotePayload = Omit<Note, "id">;
export type UpdateNotePayload = Partial<Omit<Note, "id">>;

const canvasNotes = computed(() =>
  notes.value.filter((n: Note) => n.status === "canvas")
);
const storageNotes = computed(() =>
  notes.value.filter((n: Note) => n.status === "storage")
);

// --- COMPOSABLE ---
export function useNotesStore() {
  // --- CAMBIO: Nueva función helper para guardar en LS ---
  const saveNotesToStorage = (notesToSave: Note[]) => {
    try {
      localStorage.setItem(NOTES_STATE_KEY, JSON.stringify(notesToSave));
    } catch (e) {
      console.error("Error saving notes to Local Storage", e);
    }
  };

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

  // --- CAMBIO: fetchNotes ahora es "Local-First" ---
  const fetchNotes = async (): Promise<void> => {
    isLoading.value = true;
    error.value = null;
    try {
      // 1. Intentar cargar desde Local Storage PRIMERO
      const localNotesData = localStorage.getItem(NOTES_STATE_KEY);
      if (localNotesData && localNotesData !== "[]") {
        console.log("Cargando notas desde Local Storage...");
        notes.value = JSON.parse(localNotesData);
        isLoading.value = false;
        return; // ¡Importante! No buscar en la DB si ya tenemos datos locales
      }

      // 2. Si no hay datos locales, buscar en la DB
      console.log("No hay notas locales, cargando desde DB...");
      const notesFromDB: any[] = await ns.getNotas();
      const pinnedIds = getPinnedIdsFromStorage();

      const normalizedNotes = notesFromDB.map((raw) => {
        const pinnedBool = Boolean(Number(raw.pinned));
        const status = raw.status ?? (pinnedBool ? "pinned" : "canvas");
        const gs_w = raw.gs_w ?? 2;
        const gs_h = raw.gs_h ?? 2;
        return {
          id: Number(raw.id),
          titulo: raw.titulo ?? "",
          descripcion: raw.descripcion ?? "",
          pinned: pinnedBool || pinnedIds.includes(Number(raw.id)),
          color: raw.color ?? "white",
          status,
          gs_x: raw.gs_x !== undefined ? Number(raw.gs_x) : undefined,
          gs_y: raw.gs_y !== undefined ? Number(raw.gs_y) : undefined,
          gs_w: Number(gs_w),
          gs_h: Number(gs_h),
        } as Note;
      });

      notes.value = normalizedNotes;

      // 3. Guardar las notas de la DB en Local Storage para la próxima vez
      saveNotesToStorage(normalizedNotes);
      // ----------------------
    } catch (e) {
      const err = e as any;
      error.value = "Error al cargar las notas.";
      console.error(err);
    } finally {
      isLoading.value = false;
    }
  };

  // --- CAMBIO: addNote ahora actualiza el estado local ---
  const addNote = async (newNoteData: NewNotePayload): Promise<void> => {
    isLoading.value = true;
    error.value = null;
    try {
      // 1. Asumir que la API devuelve la nota creada con su ID
      const addedRaw = (await ns.addNota(newNoteData)) as any;

      // 2. Normalizar la nueva nota (lógica similar a fetchNotes)
      const pinnedIds = getPinnedIdsFromStorage();
      const pinnedBool = Boolean(Number(addedRaw.pinned));
      const status = addedRaw.status ?? (pinnedBool ? "pinned" : "canvas");
      const newNote: Note = {
        id: Number(addedRaw.id),
        titulo: addedRaw.titulo ?? "",
        descripcion: addedRaw.descripcion ?? "",
        pinned: pinnedBool || pinnedIds.includes(Number(addedRaw.id)),
        color: addedRaw.color ?? "white",
        status,
        gs_x: addedRaw.gs_x !== undefined ? Number(addedRaw.gs_x) : 0, // Default a 0,0
        gs_y: addedRaw.gs_y !== undefined ? Number(addedRaw.gs_y) : 0,
        gs_w: Number(addedRaw.gs_w ?? 2),
        gs_h: Number(addedRaw.gs_h ?? 2),
      };

      // 3. Añadir a la lista local y guardar en Local Storage
      notes.value.push(newNote);
      saveNotesToStorage(notes.value);
    } catch (e) {
      const err = e as any;
      error.value = "No se pudo añadir la nota.";
      console.error(err);
    } finally {
      isLoading.value = false;
    }
  };

  const updateNote = async (
    noteId: number,
    updatedData: UpdateNotePayload
  ): Promise<void> => {
    error.value = null;
    try {
      if ((ns as any).updateNota) {
        try {
          await ns.updateNota(noteId, updatedData);
        } catch {
          /* tolerante */
        }
      }

      const index = notes.value.findIndex((n) => n.id === noteId);
      if (index !== -1) {
        const updatedNote = { ...notes.value[index], ...updatedData } as Note;
        // ... (tu lógica de normalización de pinned/status está bien)
        if (updatedData.pinned !== undefined) {
          updatedNote.pinned = Boolean(updatedData.pinned as any);
          updatedNote.status = updatedNote.pinned
            ? "pinned"
            : updatedNote.status === "pinned"
            ? "canvas"
            : updatedNote.status;
          let pinnedIds = getPinnedIdsFromStorage();
          if (updatedNote.pinned) {
            if (!pinnedIds.includes(noteId)) pinnedIds.push(noteId);
          } else {
            pinnedIds = pinnedIds.filter((id) => id !== noteId);
          }
          savePinnedIdsToStorage(pinnedIds);
        }
        if (updatedData.status !== undefined) {
          updatedNote.status = updatedData.status as string;
          let pinnedIds = getPinnedIdsFromStorage();
          if (updatedNote.status === "pinned") {
            if (!pinnedIds.includes(noteId)) pinnedIds.push(noteId);
            updatedNote.pinned = true;
          } else {
            pinnedIds = pinnedIds.filter((id) => id !== noteId);
            updatedNote.pinned = false;
          }
          savePinnedIdsToStorage(pinnedIds);
        }
        notes.value[index] = updatedNote;

        // --- CAMBIO: Guardar en Local Storage ---
        saveNotesToStorage(notes.value);
      }
    } catch (e) {
      const err = e as any;
      error.value = "Error al actualizar la nota.";
      console.error(err);
    }
  };

  const saveLayout = async (
    layout: { id: number; x?: number; y?: number; w?: number; h?: number }[]
  ): Promise<void> => {
    error.value = null;
    try {
      if ((ns as any).saveNoteLayout) {
        try {
          await (ns as any).saveNoteLayout(layout);
        } catch {}
      }
      layout.forEach((item) => {
        const note = notes.value.find((n) => n.id === item.id);
        if (note) {
          if (item.x !== undefined) note.gs_x = item.x;
          if (item.y !== undefined) note.gs_y = item.y;
          if (item.w !== undefined) note.gs_w = item.w;
          if (item.h !== undefined) note.gs_h = item.h;
        }
      });

      // --- CAMBIO: Guardar en Local Storage ---
      saveNotesToStorage(notes.value);
    } catch (e) {
      const err = e as any;
      error.value = "No se pudo guardar el layout.";
      console.error(err);
    }
  };

  const deleteNote = async (noteId: number): Promise<void> => {
    error.value = null;
    try {
      const index = notes.value.findIndex((n) => n.id === noteId);
      if (index === -1) return;

      // 1. Eliminar de la lista local
      notes.value.splice(index, 1);

      // --- CAMBIO: Guardar en Local Storage ---
      saveNotesToStorage(notes.value);

      // 3. Llamar a la API
      await ns.deleteNota(noteId);
    } catch (e) {
      const err = e as any;
      error.value = "Error al eliminar la nota.";
      console.error(err);
      // Recargar todo si la API falla (buena idea)
      await fetchNotes();
    }
  };

  const exportNotesToJSON = () => {
    try {
      // Exporta el estado local actual
      const data = JSON.stringify(notes.value, null, 2);
      const blob = new Blob([data], { type: "application/json" });
      saveAs(
        blob,
        `notas_exportadas_${new Date().toISOString().split("T")[0]}.json`
      );
    } catch (e) {
      const err = e as any;
      error.value = "Error al exportar las notas.";
      console.error(err);
    }
  };

  const compactNotes = () => {
    compactGridTrigger.value++;
  };

  const pinnedNotes = computed(() =>
    notes.value.filter((note) => Boolean(note.pinned))
  );
  const unpinnedNotes = computed(() =>
    notes.value.filter((note) => !note.pinned)
  );

  return {
    notes,
    canvasNotes,
    pinnedNotes,
    unpinnedNotes,
    storageNotes,
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
    compactNotes,
    exportNotesToJSON,
  };
}