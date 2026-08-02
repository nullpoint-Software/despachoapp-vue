import { defineProps, defineEmits, computed, ref } from 'vue';
import 'primeicons/primeicons.css';
import { USER_AVATAR_PLACEHOLDER as defaultprofilePicture } from '@/constants/brandAssets';

type TaskStatus = "Disponible" | "Pendiente" | "Terminado";
interface TaskCardDetail {
  id_tarea: string | number;
  id_usuario?: string | number | null;
  nombre?: string;
  username?: string;
  titulo?: string;
  descripcion?: string;
  estado: TaskStatus;
}
interface CardDetailEmits {
  (event: "advanceState", id: string | number): void;
  (event: "close"): void;
  (event: "edit", card: TaskCardDetail): void;
}

const props = defineProps<{ card: TaskCardDetail }>();
const emit = defineEmits<CardDetailEmits>();
const editTask = () => emit('edit', props.card);
const advanceState = () => emit('advanceState', props.card.id_tarea);
const getStatusColor = (status: TaskStatus): string => {
  switch (status) {
    case 'Disponible': return '#A7F3D0';
    case 'Pendiente': return '#FCD34D';
    case 'Terminado': return '#D1D5DB';
    default: return '#CCCCCC';
  }
};
const getStateIcon = (status: TaskStatus): string => {
  switch (status) {
    case 'Disponible': return 'pi pi-check-circle';
    case 'Pendiente': return 'pi pi-folder-open';
    case 'Terminado': return 'pi pi-check';
    default: return 'pi pi-question-circle';
  }
};

/* ---------------------- Cambio: funciones para escapar HTML y añadir guiones suaves (\u00AD) a palabras muy largas ----------------------
   - Evita romper el diseño cuando haya palabras largas sin espacios.
   - Inserta un guion suave cada `maxLen` caracteres en palabras continuas.
   - Escapa HTML para evitar inyección al usar v-html.
-------------------------------------------------------------------------------------------- */
function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function hyphenateText(raw = "", maxLen = 20) {
  if (raw == null) return "";
  const escaped = escapeHtml(String(raw));
  // Reemplaza secuencias largas (sin espacios) por la misma palabra con soft-hyphens cada maxLen
  const longWordRegex = new RegExp(`\\S{${maxLen},}`, "g");
  return escaped.replace(longWordRegex, (word) => {
    const parts = word.match(new RegExp(`.{1,${maxLen}}`, "g")) || [word];
    return parts.join("\u00AD");
  });
}
/* -------------------------------------------------------------------------------------------- */

/* ---------------------- Cambio: lógica de truncamiento y modal para "Mostrar más" ----------------------
   - Si el texto pasa de `truncateLimit` caracteres, se muestra truncado con "..."
   - Al hacer clic en "Mostrar más" se abre un modal con el texto completo.
-------------------------------------------------------------------------------------------- */
const truncateLimitTitle = 120; // caracteres antes de truncar el título
const truncateLimitDescription = 240; // caracteres antes de truncar la descripción

const showFullModal = ref(false);
const fullModalTitle = ref('');
const fullModalContent = ref('');

// helpers para etiquetas (para mantener consistencia al abrir modal)
const propsLabel = (label: string): string => label;

// abrir modal con contenido completo
function openFullText(title: string, content: string): void {
  fullModalTitle.value = title;
  // mostrar contenido hyphenated en el modal completo también (escapado e insertando soft-hyphens)
  fullModalContent.value = content ?? '';
  showFullModal.value = true;
}
function closeFullModal() {
  showFullModal.value = false;
  fullModalTitle.value = '';
  fullModalContent.value = '';
}

const fullModalContentHyphenated = computed(() => hyphenateText(fullModalContent.value, 20));
/* -------------------------------------------------------------------------------------------- */

/* ---------------------- Cambio: computeds para hyphenation y truncamiento ---------------------- */
const hyphenatedNombre = computed(() => {
  const nombre = props.card?.id_usuario ? (props.card.nombre ?? '') : 'No asignado';
  return hyphenateText(nombre, 20);
});
const hyphenatedUsername = computed(() => hyphenateText(props.card?.username ?? '', 18));
const hyphenatedTitulo = computed(() => hyphenateText(props.card?.titulo ?? '', 24));
const hyphenatedDescripcion = computed(() => hyphenateText(props.card?.descripcion ?? '', 18));
const hyphenatedEstado = computed(() => hyphenateText(props.card?.estado ?? '', 18));

const isTituloLong = computed(() => (props.card?.titulo ?? '').length > truncateLimitTitle);
const isDescripcionLong = computed(() => (props.card?.descripcion ?? '').length > truncateLimitDescription);

const hyphenatedTituloTruncated = computed(() => {
  const raw = props.card?.titulo ?? '';
  if (!raw) return '';
  if (raw.length <= truncateLimitTitle) return hyphenateText(raw, 24);
  const truncated = raw.slice(0, truncateLimitTitle).trim() + '...';
  return hyphenateText(truncated, 24);
});
const hyphenatedDescripcionTruncated = computed(() => {
  const raw = props.card?.descripcion ?? '';
  if (!raw) return '';
  if (raw.length <= truncateLimitDescription) return hyphenateText(raw, 18);
  const truncated = raw.slice(0, truncateLimitDescription).trim() + '...';
  return hyphenateText(truncated, 18);
});
/* -------------------------------------------------------------------------------------------- */
