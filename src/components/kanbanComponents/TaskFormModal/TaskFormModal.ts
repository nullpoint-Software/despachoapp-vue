import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { ts } from "@/service/adminApp/client";
import type { TareaEstado, TareaInput } from "@/service/adminApp/tareasService";

interface TaskFormTask {
  id_tarea: string | number | null;
  id_usuario: string | number | null;
  titulo: string;
  descripcion: string;
  estado: TareaEstado;
  fecha_vencimiento: string | null;
  assignedEmployee: string | number | null;
}

interface TaskFormProps { task?: Partial<TaskFormTask> }
interface TaskFormEmits {
  (event: "close"): void;
  (event: "save", task: TaskFormTask): void;
}
interface FormErrors { titulo: boolean; descripcion: boolean }

const props = defineProps<TaskFormProps>();
const emit = defineEmits<TaskFormEmits>();
const modalTitleId = `task-modal-title-${Math.random().toString(36).slice(2)}`;
const taskTitleSuggestions = ["Declaración mensual", "Pago provisional", "Opinión de cumplimiento", "Renovación de e.firma", "Cita SAT", "Alta o actualización ante el SAT", "Conciliación bancaria", "Cierre contable mensual"];

const normalizeTask = (task?: Partial<TaskFormTask>): TaskFormTask => ({
  id_tarea: task?.id_tarea ?? null,
  id_usuario: task?.id_usuario ?? null,
  titulo: task?.titulo ?? "",
  descripcion: task?.descripcion ?? "",
  estado: task?.estado ?? "Disponible",
  fecha_vencimiento: task?.fecha_vencimiento ?? null,
  assignedEmployee: task?.assignedEmployee ?? task?.id_usuario ?? null,
});

const localTask = ref<TaskFormTask>(normalizeTask(props.task));
const errors = ref<FormErrors>({ titulo: false, descripcion: false });
const isSaving = ref(false);
const submitError = ref<string | null>(null);
const isEdit = computed(() => localTask.value.id_tarea !== null);

let previousDocumentOverflow = "";
onMounted(() => {
  previousDocumentOverflow = document.documentElement.style.overflow;
  document.documentElement.style.overflow = "hidden";
});
onUnmounted(() => {
  document.documentElement.style.overflow = previousDocumentOverflow;
});

watch(() => props.task, (task) => {
  localTask.value = normalizeTask(task);
  errors.value = { titulo: false, descripcion: false };
  submitError.value = null;
}, { deep: true });

const validate = (): boolean => {
  errors.value = {
    titulo: localTask.value.titulo.trim().length === 0,
    descripcion: localTask.value.descripcion.trim().length === 0,
  };
  const firstInvalidId = errors.value.titulo ? "task-title" : errors.value.descripcion ? "task-description" : "";
  if (firstInvalidId) window.setTimeout(() => document.getElementById(firstInvalidId)?.focus(), 0);
  return !errors.value.titulo && !errors.value.descripcion;
};

const save = async (): Promise<void> => {
  if (!validate() || isSaving.value) return;
  isSaving.value = true;
  submitError.value = null;
  try {
    const task = { ...localTask.value, titulo: localTask.value.titulo.trim(), descripcion: localTask.value.descripcion.trim() };
    if (task.id_tarea !== null) {
      const assignedUser = task.assignedEmployee ?? task.id_usuario;
      const nextStatus: TareaEstado = assignedUser && task.estado === "Disponible" ? "Pendiente" : assignedUser ? task.estado : "Disponible";
      await ts.updateTarea(String(task.id_tarea), assignedUser, nextStatus, task.fecha_vencimiento, task.titulo, task.descripcion);
      task.estado = nextStatus;
    } else {
      const payload: TareaInput = { titulo: task.titulo, descripcion: task.descripcion, estado: "Disponible" };
      await ts.addTarea(payload, task.assignedEmployee ?? undefined);
    }
    emit("save", task);
  } catch {
    submitError.value = "No fue posible guardar la tarea. Revisa la conexión e intenta nuevamente.";
  } finally {
    isSaving.value = false;
  }
};

const close = (): void => {
  if (!isSaving.value) emit("close");
};
