interface NoteCanvasProps { notes: NoteType[]; searchQuery?: string; zoom?: number }

interface NoteCanvasEmits {
  (e: "open-note", note: NoteType): void;
  (e: "toggle-pin", id: number): void;
  (e: "delete-note", note: NoteType): void;
  (e: "store-note", id: number): void;
  (e: "save-layout", layout: Array<any>): void;
  (e: "drop-note", payload: { id: number; x: number; y: number }): void;
  (e: "update:zoom", v: number): void;
}

import { ref, computed, onMounted, onUnmounted, watch, nextTick } from "vue";
import type { CSSProperties } from "vue";
import gsap from "gsap";
import type { Note as NoteType } from "@/composables/useNotesStore";

// --- Constantes y Configuración ---
const GRID_CELL_PX = 150;
const DEFAULT_NOTE_W_PX = 300;
const DEFAULT_NOTE_H_PX = 250;

// --- Props y Emits ---
const props = defineProps<NoteCanvasProps>();
const emit = defineEmits<NoteCanvasEmits>();

// --- Refs del Template ---
const canvasContainer = ref<HTMLElement | null>(null);
const canvasContent = ref<HTMLElement | null>(null);

// --- Estado del Canvas (Pan & Zoom) ---
const zoom = ref(props.zoom ?? 1);
const panX = ref(0);
const panY = ref(0);
const canvasSize = ref({ width: 20000, height: 20000 }); // Lienzo enorme

// ---
// CAMBIO 5: Copia local de las notas para evitar mutar props
// ---
const internalNotes = ref<NoteType[]>([]);
watch(() => props.notes, (newNotes) => {
    // Usamos JSON.parse/stringify para una copia profunda y romper la reactividad
    internalNotes.value = JSON.parse(JSON.stringify(newNotes));
  },
  { deep: true, immediate: true }
);

// --- Lógica de Tamaño (Encapsulada) ---
function getNoteWidthPx(note: NoteType): number {
  if (note.gs_w === undefined) return DEFAULT_NOTE_W_PX;
  return note.gs_w < 50 ? note.gs_w * GRID_CELL_PX : note.gs_w;
}

function getNoteHeightPx(note: NoteType): number {
  if (note.gs_h === undefined) return DEFAULT_NOTE_H_PX;
  return note.gs_h < 50 ? note.gs_h * GRID_CELL_PX : note.gs_h;
}

// --- Estilos Computados ---
const canvasContentStyle = computed((): CSSProperties => ({
  width: `${canvasSize.value.width}px`,
  height: `${canvasSize.value.height}px`,
  transform: `translate(${panX.value}px, ${panY.value}px) scale(${zoom.value})`,
  transformOrigin: "0 0",
}));

const noteInnerStyle = (note: NoteType): CSSProperties => ({
  position: "absolute",
  left: `${note.gs_x ?? 0}px`,
  top: `${note.gs_y ?? 0}px`,
  width: `${getNoteWidthPx(note)}px`,
  height: "auto",
});

// --- Lógica de Panning (Arrastre del Lienzo) ---
let isPanning = false;
let panStartX = 0;
let panStartY = 0;
let startPanX = 0;
let startPanY = 0;

const onCanvasMouseDown = (e: MouseEvent) => {
  if (!canvasContainer.value) return;
  if ((e.target as HTMLElement).closest(".note-wrapper")) return;

  e.preventDefault();
  isPanning = true;
  panStartX = e.clientX;
  panStartY = e.clientY;
  startPanX = panX.value;
  startPanY = panY.value;
  document.body.style.userSelect = "none";

  document.addEventListener("mousemove", onCanvasMouseMove);
  document.addEventListener("mouseup", onCanvasMouseUp);
};

const onCanvasMouseMove = (e: MouseEvent) => {
  if (!isPanning) return;
  const dx = e.clientX - panStartX;
  const dy = e.clientY - panStartY;

  panX.value = Math.min(0, startPanX + dx);
  panY.value = Math.min(0, startPanY + dy);
};

const onCanvasMouseUp = () => {
  if (!isPanning) return;
  isPanning = false;
  document.body.style.userSelect = "";

  document.removeEventListener("mousemove", onCanvasMouseMove);
  document.removeEventListener("mouseup", onCanvasMouseUp);
};

// --- Lógica de Zoom ---
watch(() => props.zoom, (v) => { zoom.value = v ?? 1; });

function zoomIn() {
  zoom.value = Math.min(1.5, +(zoom.value + 0.05).toFixed(2));
  emit("update:zoom", zoom.value);
}
function zoomOut() {
  zoom.value = Math.max(0.5, +(zoom.value - 0.05).toFixed(2));
  emit("update:zoom", zoom.value);
}
function resetZoom() {
  zoom.value = 1;
  emit("update:zoom", zoom.value);
}

const onWheel = (e: WheelEvent) => {
  if (e.ctrlKey) {
    e.preventDefault();
    const newZoom = e.deltaY < 0 ? zoom.value + 0.05 : zoom.value - 0.05;
    zoom.value = Math.max(0.5, Math.min(1.5, +newZoom.toFixed(2)));
    emit("update:zoom", zoom.value);
  } else {
    e.preventDefault();
    panX.value = Math.min(0, panX.value - e.deltaX * 0.5);
    panY.value = Math.min(0, panY.value - e.deltaY * 0.5);
  }
};

// --- Lógica de Notas (Drag, Drop, Z-index) ---
let topZ = 100;
const bringToFront = (e: MouseEvent, note: NoteType) => {
  const wrapper = (e.currentTarget as HTMLElement).closest(".note-wrapper") as HTMLElement;
  if (!wrapper) return;
  topZ++;
  wrapper.style.zIndex = String(topZ);
};

const activeDragHandlers: (() => void)[] = [];

// ---
// CAMBIO 6: 'initDrag' ahora modifica 'internalNotes'
// ---
const initDrag = (e: MouseEvent, note: NoteType) => {
  e.preventDefault();
  const wrapper = (e.currentTarget as HTMLElement).closest(".note-wrapper") as HTMLElement;
  if (!wrapper) return;
  bringToFront(e, note);

  const startX = e.clientX;
  const startY = e.clientY;
  // Obtenemos la posición inicial de la nota (de la prop o copia)
  const startNoteX = note.gs_x ?? 0;
  const startNoteY = note.gs_y ?? 0;
  document.body.style.userSelect = "none";

  const onMouseMove = (moveEvent: MouseEvent) => {
    // Encontrar la nota correspondiente en nuestra copia local
    const noteToDrag = internalNotes.value.find(n => n.id === note.id);
    if (!noteToDrag) return;

    const dx = (moveEvent.clientX - startX) / zoom.value;
    const dy = (moveEvent.clientY - startY) / zoom.value;

    // Mutamos la copia local, no la prop
    noteToDrag.gs_x = Math.max(0, Math.round(startNoteX + dx));
    noteToDrag.gs_y = Math.max(0, Math.round(startNoteY + dy));
  };

  const onMouseUp = () => {
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    document.body.style.userSelect = "";

    // Encontrar la nota actualizada en la copia local para emitir sus datos
    const updatedNote = internalNotes.value.find(n => n.id === note.id);
    if (updatedNote) {
      emit("save-layout", [{ id: updatedNote.id, x: updatedNote.gs_x, y: updatedNote.gs_y }]);
    }

    const index = activeDragHandlers.indexOf(cleanup);
    if (index > -1) activeDragHandlers.splice(index, 1);
  };

  const cleanup = () => {
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    document.body.style.userSelect = "";
  };

  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);
  activeDragHandlers.push(cleanup);
};

const onDrop = (e: DragEvent) => {
  const idStr = e.dataTransfer?.getData("text/plain") || "";
  const noteId = Number(idStr);
  if (!noteId || !canvasContent.value) return;

  const rect = canvasContent.value.getBoundingClientRect();
  const x = Math.max(0, (e.clientX - rect.left) / zoom.value);
  const y = Math.max(0, (e.clientY - rect.top) / zoom.value);

  emit("drop-note", { id: noteId, x: Math.round(x), y: Math.round(y) });
};

// --- Funciones Expuestas ---
async function locateNote(id: number) {
  await nextTick();
  const el = canvasContent.value?.querySelector(`[data-note-id="${id}"]`) as HTMLElement | null;
  if (!el || !canvasContainer.value || !canvasContent.value) return;

  // CAMBIO 7: Leer de 'internalNotes'
  const noteData = internalNotes.value.find(n => n.id === id);
  if (!noteData) return;

  const noteLeft = parseFloat(el.style.left || "0");
  const noteTop = parseFloat(el.style.top || "0");
  const noteWidth = getNoteWidthPx(noteData);

  const containerRect = canvasContainer.value.getBoundingClientRect();

  const noteCenterX = noteLeft + (noteWidth / 2);
  const noteCenterY = noteTop + (el.clientHeight / 2);

  const targetPanX = (containerRect.width / 2) - (noteCenterX * zoom.value);
  const targetPanY = (containerRect.height / 2) - (noteCenterY * zoom.value);

  const constrainedTargetPanX = Math.min(0, targetPanX);
  const constrainedTargetPanY = Math.min(0, targetPanY);

  gsap.to({ x: panX.value, y: panY.value }, {
    x: constrainedTargetPanX,
    y: constrainedTargetPanY,
    duration: 0.6,
    ease: "power3.out",
    onUpdate: function () {
      panX.value = this.targets()[0].x;
      panY.value = this.targets()[0].y;
    }
  });

  el.animate([
    { boxShadow: "0 0 0px 0px rgba(255, 255, 0, 0.7)" },
    { boxShadow: `0 0 60px 15px rgba(255, 255, 0, 0.7)` },
    { boxShadow: "0 0 0px 0px rgba(255, 255, 0, 0)" }
  ], { duration: 1000, easing: "ease-out" });
}

defineExpose({ locateNote, zoomIn, zoomOut, resetZoom });

// --- Ciclo de Vida ---
onMounted(() => {
  panX.value = 0;
  panY.value = 0;
});

onUnmounted(() => {
  activeDragHandlers.forEach(fn => fn());
  document.removeEventListener("mousemove", onCanvasMouseMove);
  document.removeEventListener("mouseup", onCanvasMouseUp);
});
