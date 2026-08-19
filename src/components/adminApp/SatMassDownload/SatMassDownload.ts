import { computed, onBeforeUnmount, ref, watch } from "vue";
import { fs } from "@/service/adminApp/client";
import type { SatDownloadJob } from "@/service/adminApp/fiscalService";
import DateTimePicker from "@/components/ui/DateTimePicker/DateTimePicker.vue";

interface Props {
  clientId: number;
  clientLabel: string;
  year: number;
  month: number;
}
interface Emits {
  (event: "imported", counts: { imported: number; duplicate: number; rejected: number }): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();
const open = ref(false);
const loading = ref(false);
const submitting = ref(false);
const errorMessage = ref("");
const successMessage = ref("");
const jobs = ref<SatDownloadJob[]>([]);
const direction = ref<"ambas" | "emitida" | "recibida">("ambas");
const startDate = ref("");
const trackedJobs = new Set<number>();
const endDate = ref("");
const certificate = ref<File | null>(null);
const privateKey = ref<File | null>(null);
const password = ref("");
const notifiedJobs = new Set<number>();
let pollTimer = 0;

const activeStates = new Set(["solicitada", "procesando", "descargando"]);
const activeJobs = computed(() => jobs.value.filter((job) => activeStates.has(job.estado)));
const waitingJobs = computed(() => jobs.value.filter((job) => job.estado === "solicitada" || job.estado === "procesando"));
const canSubmit = computed(() => Boolean(
  props.clientId && startDate.value && endDate.value && certificate.value &&
  privateKey.value && password.value && !submitting.value,
));

const directionOptions = [
  { label: "Emitidas y recibidas", value: "ambas" },
  { label: "Sólo emitidas", value: "emitida" },
  { label: "Sólo recibidas", value: "recibida" },
];

const statusCopy: Record<string, { label: string; detail: string; icon: string }> = {
  solicitada: { label: "Solicitud enviada", detail: "El SAT recibió la petición.", icon: "pi pi-send" },
  procesando: { label: "Preparando paquetes", detail: "El SAT está reuniendo los CFDI.", icon: "pi pi-spin pi-spinner" },
  descargando: { label: "Importando XML", detail: "Descargando paquetes y procesando comprobantes.", icon: "pi pi-cloud-download" },
  completada: { label: "Importación terminada", detail: "Los CFDI ya están disponibles en Fiscal.", icon: "pi pi-check-circle" },
  sin_datos: { label: "Sin CFDI", detail: "No se encontraron comprobantes en ese periodo.", icon: "pi pi-info-circle" },
  error: { label: "Requiere atención", detail: "La solicitud no pudo completarse.", icon: "pi pi-exclamation-triangle" },
  cancelada: { label: "Cancelada", detail: "Las credenciales temporales fueron eliminadas.", icon: "pi pi-ban" },
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}
function formatDate(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
}
function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
}
const startDateModel = computed<Date>({
  get: () => parseDate(startDate.value),
  set: (value) => {
    startDate.value = formatDate(value.getFullYear(), value.getMonth() + 1, value.getDate());
    if (endDate.value && startDate.value > endDate.value) {
      endDate.value = startDate.value;
    }
  },
});
const endDateModel = computed<Date>({
  get: () => parseDate(endDate.value),
  set: (value) => {
    endDate.value = formatDate(value.getFullYear(), value.getMonth() + 1, value.getDate());
    if (startDate.value && endDate.value < startDate.value) {
      startDate.value = endDate.value;
    }
  },
});
function resetPeriod() {
  const current = new Date();
  const selectedMonth = props.month > 0
    ? props.month
    : props.year === current.getFullYear() ? current.getMonth() + 1 : 1;
  const lastDay = new Date(props.year, selectedMonth, 0).getDate();
  startDate.value = formatDate(props.year, selectedMonth, 1);
  endDate.value = formatDate(props.year, selectedMonth, lastDay);
}
function dateLabel(value: string) {
  if (!value) return "";
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}
function jobCopy(job: SatDownloadJob) {
  return statusCopy[job.estado] || statusCopy.procesando;
}
function jobDirection(job: SatDownloadJob) {
  return job.direccion === "emitida" ? "Emitidas" : "Recibidas";
}
function chooseFile(event: Event, field: "certificate" | "privateKey") {
  const file = (event.target as HTMLInputElement).files?.[0] || null;
  if (field === "certificate") certificate.value = file;
  else privateKey.value = file;
}

function notifyCompleted(items: SatDownloadJob[]) {
  for (const job of items) {
    if (job.estado !== "completada" || !trackedJobs.has(Number(job.id)) || notifiedJobs.has(Number(job.id))) continue;
    notifiedJobs.add(Number(job.id));
    emit("imported", {
      imported: Number(job.importados || 0),
      duplicate: Number(job.duplicados || 0),
      rejected: Number(job.rechazados || 0),
    });
  }
}

async function loadJobs(silent = false) {
  if (!props.clientId) return;
  if (!silent) loading.value = true;
  try {
    const result = await fs.getSatDownloads(props.clientId);
    jobs.value = result;
    notifyCompleted(result);
    errorMessage.value = "";
  } catch (error: any) {
    if (!silent) errorMessage.value = error.response?.data?.error || "No se pudo consultar el avance de las descargas.";
  } finally {
    loading.value = false;
  }
}

function startPolling() {
  window.clearInterval(pollTimer);
  pollTimer = window.setInterval(() => {
    if (open.value && activeJobs.value.length) loadJobs(true);
  }, 20_000);
}

async function showModal() {
  if (!props.clientId) return;
  resetPeriod();
  errorMessage.value = "";
  successMessage.value = "";
  open.value = true;
  await loadJobs();
  startPolling();
}
function closeModal() {
  open.value = false;
  password.value = "";
  certificate.value = null;
  privateKey.value = null;
  window.clearInterval(pollTimer);
}

async function submit() {
  if (!canSubmit.value) return;
  errorMessage.value = "";
  successMessage.value = "";
  submitting.value = true;
  try {
    const result = await fs.createSatDownloads({
      clientId: props.clientId,
      direction: direction.value,
      startDate: startDate.value,
      endDate: endDate.value,
      certificate: certificate.value!,
      privateKey: privateKey.value!,
      password: password.value,
    });
    result.jobs.forEach((job) => trackedJobs.add(Number(job.id)));
    jobs.value = [...result.jobs, ...jobs.value.filter((item) => !result.jobs.some((job) => Number(job.id) === Number(item.id)))];
    const partial = result.errors?.length ? ` ${result.errors.map((item) => item.error).join(" ")}` : "";
    successMessage.value = `${result.jobs.length === 1 ? "Solicitud creada" : "Solicitudes creadas"}. Puedes cerrar esta ventana; el servidor continuará automáticamente.${partial}`;
    password.value = "";
    certificate.value = null;
    privateKey.value = null;
    startPolling();
  } catch (error: any) {
    errorMessage.value = error.response?.data?.error || "No se pudo iniciar la descarga masiva.";
  } finally {
    submitting.value = false;
  }
}

async function cancelJob(job: SatDownloadJob) {
  try {
    const updated = await fs.cancelSatDownload(Number(job.id));
    jobs.value = jobs.value.map((item) => Number(item.id) === Number(updated.id) ? updated : item);
  } catch (error: any) {
    errorMessage.value = error.response?.data?.error || "No se pudo cancelar la solicitud.";
  }
}

watch(() => [props.year, props.month], () => {
  if (open.value) resetPeriod();
});
watch(() => props.clientId, () => {
  jobs.value = [];
  notifiedJobs.clear();
  trackedJobs.clear();
  if (open.value) {
    resetPeriod();
    loadJobs();
  }
});
onBeforeUnmount(() => window.clearInterval(pollTimer));
