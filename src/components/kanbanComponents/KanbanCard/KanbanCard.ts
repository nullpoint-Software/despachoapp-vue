import { computed } from "vue";
import { USER_AVATAR_PLACEHOLDER } from "@/constants/brandAssets";
import type { KanbanTask } from "@/components/kanbanComponents/types";

interface KanbanCardProps {
  task: KanbanTask;
}

interface KanbanCardEmits {
  (event: "open"): void;
}

const props = defineProps<KanbanCardProps>();
const emit = defineEmits<KanbanCardEmits>();

const displayedStatus = computed(() => props.task.estado);

const statusClass = computed(() => ({
  Disponible: "is-available",
  Pendiente: "is-pending",
  Terminado: "is-done",
})[displayedStatus.value] ?? "is-pending");

const responsibleImage = computed(() =>
  props.task.image || USER_AVATAR_PLACEHOLDER,
);

function startDrag(event: DragEvent): void {
  if (!event.dataTransfer) return;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", String(props.task.id_tarea));
}

function formatDate(value?: string | null): string {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}
