import { computed, onMounted, onUnmounted, ref } from "vue";
import { useAppToast } from "@/composables/useAppToast";
import { base64ToFile } from "@/service/adminApp/authService";
import { ts } from "@/service/adminApp/client";
import { hasPermission } from "@/service/adminApp/permissionsService";
import { prepareTaskReportPreview, revokeTaskReportPreview, type TaskReportPreviewResult } from "@/service/reports/taskReportService";
import type { TareaDto } from "@/service/adminApp/tareasService";
import type { KanbanLane, KanbanStatus, KanbanTask } from "@/components/kanbanComponents/types";

interface KanbanBoardProps {
  mini?: boolean;
  showOwn?: boolean;
}

interface TaskFormValue {
  id_tarea: number | string | null;
  id_usuario: number | string | null;
  titulo: string;
  descripcion: string;
  estado: KanbanTask["estado"];
  fecha_vencimiento: string | null;
  assignedEmployee: number | string | null;
}

const props = withDefaults(defineProps<KanbanBoardProps>(), {
  mini: false,
  showOwn: false,
});

const TASKS_PER_PAGE = 12;
const REPORT_PAGE_SIZE = 100;

const toast = useAppToast();
const tasks = ref<KanbanTask[]>([]);
const selectedTask = ref<KanbanTask | null>(null);
const isLoading = ref(false);
const loadError = ref<string | null>(null);
const searchQuery = ref("");
const showTaskForm = ref(false);
const taskFormMode = ref<"add" | "edit">("add");
const reportDate = ref(new Date().toISOString().slice(0, 10));
const isGeneratingReport = ref(false);
const currentPage = ref(1);
const hasNextPage = ref(false);
const reportPreview = ref<TaskReportPreviewResult | null>(null);
const currentTaskForm = ref<TaskFormValue>(emptyTaskForm());
const taskImages = new Map<string, string>();

const laneDefinitions: ReadonlyArray<Omit<KanbanLane, "tasks">> = [
  { status: "Disponible", label: "Disponible", caption: "Sin responsable" },
  { status: "Pendiente", label: "Pendiente", caption: "Por atender" },
  { status: "Terminado", label: "Terminado", caption: "Completadas" },
];

function emptyTaskForm(): TaskFormValue {
  return {
    id_tarea: null,
    id_usuario: null,
    titulo: "",
    descripcion: "",
    estado: "Disponible",
    fecha_vencimiento: null,
    assignedEmployee: null,
  };
}

function visibleStatus(status: TareaDto["estado"]): KanbanStatus {
  return status === "En Progreso" ? "Pendiente" : status;
}

function taskImage(task: TareaDto): string | null {
  if (!task.usuario_imagen) return null;
  const key = String(task.id_tarea);
  const cached = taskImages.get(key);
  if (cached) return cached;

  try {
    const url = URL.createObjectURL(base64ToFile(task.usuario_imagen, `task-${key}.png`));
    taskImages.set(key, url);
    return url;
  } catch {
    return null;
  }
}

function normalizeTask(task: TareaDto): KanbanTask {
  return {
    ...task,
    estado: visibleStatus(task.estado),
    highlight: false,
    image: taskImage(task),
  };
}

function uniqueById(items: TareaDto[]): TareaDto[] {
  return [...new Map(items.map((task) => [String(task.id_tarea), task])).values()];
}

function canCurrentUserSee(task: TareaDto): boolean {
  const employeeView = props.showOwn || localStorage.getItem("level") === "Empleado";
  if (!employeeView || task.estado === "Disponible") return true;
  return String(task.id_usuario ?? "") === String(localStorage.getItem("userid") ?? "");
}

async function loadTasks(page = currentPage.value): Promise<void> {
  const requestedPage = Math.max(1, page);
  isLoading.value = true;
  loadError.value = null;

  try {
    const response = await ts.getTareas({
      limit: TASKS_PER_PAGE + 1,
      offset: (requestedPage - 1) * TASKS_PER_PAGE,
    });
    const pageTasks = response.slice(0, TASKS_PER_PAGE);
    tasks.value = uniqueById(pageTasks)
      .filter(canCurrentUserSee)
      .map(normalizeTask);
    currentPage.value = requestedPage;
    hasNextPage.value = response.length > TASKS_PER_PAGE;
  } catch {
    loadError.value = "No se pudieron cargar las tareas.";
  } finally {
    isLoading.value = false;
  }
}

async function changePage(page: number): Promise<void> {
  if (isLoading.value || page < 1 || (page > currentPage.value && !hasNextPage.value)) return;
  selectedTask.value = null;
  await loadTasks(page);
}
const filteredTasks = computed<KanbanTask[]>(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase("es-MX");
  if (!query) return tasks.value;

  return tasks.value.filter((task) =>
    [task.titulo, task.descripcion, task.nombre, task.username, task.estado]
      .some((value) => String(value ?? "").toLocaleLowerCase("es-MX").includes(query)),
  );
});

const lanes = computed<KanbanLane[]>(() =>
  laneDefinitions.map((lane) => ({
    ...lane,
    tasks: filteredTasks.value.filter((task) => visibleStatus(task.estado) === lane.status),
  })),
);

const totalVisibleTasks = computed(() => filteredTasks.value.length);

async function canMove(task: KanbanTask): Promise<boolean> {
  if (await hasPermission("canMoveAllCards")) return true;
  if (!task.id_usuario) return hasPermission("canMoveAvailableCard");
  return (
    String(task.id_usuario) === String(localStorage.getItem("userid")) &&
    await hasPermission("canMoveOwnCard")
  );
}

async function moveTask(taskId: number | string, targetStatus: KanbanStatus): Promise<void> {
  const task = tasks.value.find((item) => String(item.id_tarea) === String(taskId));
  if (!task || visibleStatus(task.estado) === targetStatus) return;

  if (!(await canMove(task))) {
    toast.add({
      severity: "error",
      summary: "Permiso denegado",
      detail: "No tienes permiso para mover esta tarea.",
      life: 3000,
    });
    return;
  }

  const previous = {
    estado: task.estado,
    id_usuario: task.id_usuario,
    nombre: task.nombre,
    username: task.username,
    image: task.image,
    fecha_vencimiento: task.fecha_vencimiento,
  };

  const userId = localStorage.getItem("userid");
  const assignedUser = targetStatus === "Disponible"
    ? null
    : task.id_usuario ?? (userId ? Number(userId) : null);

  task.estado = targetStatus;
  task.id_usuario = assignedUser;
  task.nombre = targetStatus === "Disponible" ? null : task.nombre ?? localStorage.getItem("fullname");
  task.username = targetStatus === "Disponible" ? null : task.username ?? localStorage.getItem("username");
  task.image = targetStatus === "Disponible" ? null : task.image ?? localStorage.getItem("userphoto");
  task.fecha_vencimiento = targetStatus === "Terminado"
    ? task.fecha_vencimiento ?? new Date().toLocaleString("sv-SE")
    : null;

  try {
    await ts.updateTarea(
      String(task.id_tarea),
      assignedUser,
      targetStatus,
      task.fecha_vencimiento,
    );
    toast.add({
      severity: "success",
      summary: "Tarea actualizada",
      detail: `La tarea ahora est? en ${targetStatus}.`,
      life: 2200,
    });
  } catch {
    Object.assign(task, previous);
    toast.add({
      severity: "error",
      summary: "No se guard? el cambio",
      detail: "La tarea volvi? a su estado anterior.",
      life: 3500,
    });
  }
}

function openTask(task: KanbanTask): void {
  selectedTask.value = task;
}

async function advanceTask(taskId: number | string): Promise<void> {
  const task = tasks.value.find((item) => String(item.id_tarea) === String(taskId));
  if (!task) return;

  const order: KanbanStatus[] = ["Disponible", "Pendiente", "Terminado"];
  const nextStatus = order[order.indexOf(visibleStatus(task.estado)) + 1];
  if (!nextStatus) return;

  selectedTask.value = null;
  await moveTask(task.id_tarea, nextStatus);
}

async function openTaskForm(mode: "add" | "edit", task: KanbanTask | null = null): Promise<void> {
  const permission = mode === "edit"
    ? await hasPermission("canEditCard")
    : await hasPermission("canAddCard");

  if (!permission) {
    toast.add({
      severity: "error",
      summary: "Permiso denegado",
      detail: mode === "edit" ? "No puedes editar tareas." : "No puedes crear tareas.",
      life: 3000,
    });
    return;
  }

  taskFormMode.value = mode;
  currentTaskForm.value = task
    ? {
        id_tarea: task.id_tarea,
        id_usuario: task.id_usuario ?? null,
        titulo: task.titulo ?? "",
        descripcion: task.descripcion ?? "",
        estado: task.estado,
        fecha_vencimiento: task.fecha_vencimiento ?? null,
        assignedEmployee: task.id_usuario ?? null,
      }
    : emptyTaskForm();
  selectedTask.value = null;
  showTaskForm.value = true;
}

async function loadTasksForReport(): Promise<TareaDto[]> {
  const reportTasks: TareaDto[] = [];
  let offset = 0;

  while (true) {
    const page = await ts.getTareas({ limit: REPORT_PAGE_SIZE, offset });
    reportTasks.push(...page);
    if (page.length < REPORT_PAGE_SIZE) break;
    offset += REPORT_PAGE_SIZE;
  }

  return uniqueById(reportTasks);
}

function closeReportPreview(): void {
  if (reportPreview.value) revokeTaskReportPreview(reportPreview.value);
  reportPreview.value = null;
}

async function openReportPreview(): Promise<void> {
  if (isGeneratingReport.value) return;
  isGeneratingReport.value = true;

  try {
    closeReportPreview();
    const reportTasks = await loadTasksForReport();
    const result = await prepareTaskReportPreview(reportTasks, reportDate.value, {
      userId: localStorage.getItem("userid"),
      responsibleName: localStorage.getItem("fullname") || localStorage.getItem("username") || "Usuario",
    });

    if (result.exportedTasks === 0 || !result.previewUrl) {
      toast.add({
        severity: "info",
        summary: "Sin tareas finalizadas",
        detail: "No hay tareas finalizadas por este usuario hasta la fecha de corte.",
        life: 3500,
      });
      return;
    }

    reportPreview.value = result;
  } catch {
    toast.add({
      severity: "error",
      summary: "No se gener? el reporte",
      detail: "No fue posible preparar la vista previa del PDF.",
      life: 3500,
    });
  } finally {
    isGeneratingReport.value = false;
  }
}
async function handleTaskSaved(): Promise<void> {
  showTaskForm.value = false;
  await loadTasks(1);
}

onMounted(() => loadTasks(1));
onUnmounted(() => {
  closeReportPreview();
  taskImages.forEach((url) => URL.revokeObjectURL(url));
  taskImages.clear();
});
