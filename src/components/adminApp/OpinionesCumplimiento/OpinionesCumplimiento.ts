import { computed, nextTick, onMounted, ref } from "vue";
import { cos } from "@/service/adminApp/client";
import type { ComplianceRecord, ComplianceStatus, ComplianceSummary } from "@/service/adminApp/cumplimientoService";
import { regimenesFiscales, regimenFiscalLabel } from "@/constants/regimenesFiscales";

const records = ref<ComplianceRecord[]>([]);
const selected = ref<ComplianceRecord | null>(null);
const documentClient = ref<ComplianceRecord | null>(null);
const loading = ref(true);
const syncing = ref(false);
const syncingClientId = ref<number | null>(null);
const syncProgress = ref({ processed: 0, total: 0, documents: 0 });
const showGuide = ref(false);
const showThirdParty = ref(false);
const showFilters = ref(false);
const filtersModal = ref<HTMLElement | null>(null);
const search = ref("");
const statusFilter = ref("todos");
const regimeFilter = ref("todos");
const draftStatusFilter = ref("todos");
const draftRegimeFilter = ref("todos");
const errorMessage = ref("");
const successMessage = ref("");
const emptySummary: ComplianceSummary = { total: 0, positiva: 0, negativa: 0, suspension_actividades: 0, inscrito_sin_obligaciones: 0, no_inscrito: 0, cancelado: 0, no_localizado: 0, no_publica: 0, otro: 0, sin_consulta: 0, error: 0, especial: 0, con_documento: 0 };
const summary = ref<ComplianceSummary>({ ...emptySummary });
const statusOptions = [
  { label: "Todos", value: "todos" },
  { label: "Positiva", value: "positiva" },
  { label: "Con pendientes", value: "negativa" },
  { label: "Suspensión de actividades", value: "suspension_actividades" },
  { label: "Inscrito sin obligaciones", value: "inscrito_sin_obligaciones" },
  { label: "No inscrito", value: "no_inscrito" },
  { label: "Cancelado", value: "cancelado" },
  { label: "No localizado", value: "no_localizado" },
  { label: "No pública", value: "no_publica" },
  { label: "Sin consultar", value: "sin_consulta" },
  { label: "Con error", value: "error" },
];
const regimeOptions = [{ label: "Todos", value: "todos" }, ...regimenesFiscales];
const activeFilterCount = computed(() => Number(statusFilter.value !== "todos") + Number(regimeFilter.value !== "todos"));
const filterButtonLabel = computed(() => activeFilterCount.value ? `Filtros (${activeFilterCount.value})` : "Filtros");

const filteredRecords = computed(() => {
  const term = search.value.trim().toLocaleLowerCase("es-MX");
  return records.value.filter((record) => {
    const matchesStatus = statusFilter.value === "todos" || record.status === statusFilter.value;
    const matchesRegime = regimeFilter.value === "todos" || record.regimen_fiscal === regimeFilter.value;
    const matchesTerm = !term || `${record.nombre} ${record.rfc}`.toLocaleLowerCase("es-MX").includes(term);
    return matchesStatus && matchesRegime && matchesTerm;
  });
});
const regimeOrder = new Map<string, number>(
  regimenesFiscales.map((regime, index) => [regime.value, index]),
);
const groupedRecords = computed(() => {
  const groups = new Map<string, ComplianceRecord[]>();
  filteredRecords.value.forEach((record) => {
    const code = record.regimen_fiscal || "sin_regimen";
    const group = groups.get(code) || [];
    group.push(record);
    groups.set(code, group);
  });
  return Array.from(groups, ([code, groupRecords]) => ({
    code,
    label: regimenFiscalLabel(code === "sin_regimen" ? null : code),
    records: groupRecords,
  })).sort((left, right) => {
    const leftOrder = regimeOrder.get(left.code) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = regimeOrder.get(right.code) ?? Number.MAX_SAFE_INTEGER;
    return leftOrder - rightOrder || left.label.localeCompare(right.label, "es-MX");
  });
});

function clearFilters() {
  search.value = "";
  statusFilter.value = "todos";
  regimeFilter.value = "todos";
  draftStatusFilter.value = "todos";
  draftRegimeFilter.value = "todos";
  showFilters.value = false;
}

async function openFilters() {
  draftStatusFilter.value = statusFilter.value;
  draftRegimeFilter.value = regimeFilter.value;
  showFilters.value = true;
  await nextTick();
  filtersModal.value?.focus();
}

function closeFilters() {
  showFilters.value = false;
}

function resetDraftFilters() {
  draftStatusFilter.value = "todos";
  draftRegimeFilter.value = "todos";
}

function applyFilters() {
  statusFilter.value = draftStatusFilter.value;
  regimeFilter.value = draftRegimeFilter.value;
  showFilters.value = false;
}

function errorText(error: unknown, fallback: string) {
  const candidate = error as { response?: { data?: { error?: string } } };
  return candidate?.response?.data?.error || fallback;
}

async function loadOpinions(preserveSelection = true) {
  loading.value = true;
  errorMessage.value = "";
  const selectedId = preserveSelection ? selected.value?.id_cliente : null;
  try {
    const data = await cos.getOpiniones();
    records.value = Array.isArray(data.records) ? data.records : [];
    summary.value = { ...emptySummary, ...(data.summary || {}) };
    selected.value = records.value.find((item) => item.id_cliente === selectedId) || records.value[0] || null;
  } catch (error) {
    errorMessage.value = errorText(error, "No se pudieron cargar las opiniones de cumplimiento.");
  } finally {
    loading.value = false;
  }
}

function openThirdPartyQuery() {
  showThirdParty.value = true;
}

async function completeThirdParty(message: string) {
  showThirdParty.value = false;
  successMessage.value = message;
  await loadOpinions();
}

async function syncAll() {
  syncing.value = true;
  errorMessage.value = "";
  successMessage.value = "";
  syncProgress.value = { processed: 0, total: records.value.length, documents: 0 };
  try {
    let offset = 0;
    let hasMore = true;
    while (hasMore) {
      const response = await cos.sincronizar({ offset, limit: 8 });
      syncProgress.value = {
        processed: response.processed,
        total: response.total,
        documents: syncProgress.value.documents + response.documents,
      };
      if (response.processed <= offset && response.hasMore) throw new Error("La consulta masiva no avanzó.");
      offset = response.processed;
      hasMore = response.hasMore;
    }
    successMessage.value = `Consulta masiva terminada: ${syncProgress.value.processed} clientes revisados y ${syncProgress.value.documents} PDF nuevos archivados.`;
    await loadOpinions();
  } catch (error) {
    errorMessage.value = errorText(error, "No fue posible completar la consulta al SAT.");
  } finally {
    syncing.value = false;
  }
}

async function syncClient(clientId: number) {
  syncingClientId.value = clientId;
  errorMessage.value = "";
  successMessage.value = "";
  try {
    await cos.sincronizar({ clientIds: [clientId] });
    successMessage.value = "La opinión del cliente se actualizó.";
    await loadOpinions();
  } catch (error) {
    errorMessage.value = errorText(error, "No fue posible actualizar este cliente.");
  } finally {
    syncingClientId.value = null;
  }
}

function statusLabel(status: ComplianceStatus) {
  return ({ positiva: "Positiva", negativa: "Con pendientes", suspension_actividades: "Suspensión de actividades", inscrito_sin_obligaciones: "Inscrito sin obligaciones", no_inscrito: "No inscrito", cancelado: "Cancelado", no_localizado: "No localizado", no_publica: "No pública", otro: "Otro resultado", sin_consulta: "Sin consultar", error: "Error de consulta" })[status];
}
function statusClass(status: ComplianceStatus) { return `status-${status}`; }
function statusIcon(status: ComplianceStatus) {
  return ({ positiva: "pi pi-check-circle", negativa: "pi pi-exclamation-triangle", suspension_actividades: "pi pi-pause-circle", inscrito_sin_obligaciones: "pi pi-minus-circle", no_inscrito: "pi pi-user-minus", cancelado: "pi pi-ban", no_localizado: "pi pi-map-marker", no_publica: "pi pi-lock", otro: "pi pi-info-circle", sin_consulta: "pi pi-clock", error: "pi pi-times-circle" })[status];
}
function statusDescription(status: ComplianceStatus) {
  return ({ suspension_actividades: "El SAT identifica al contribuyente con suspensión de actividades.", inscrito_sin_obligaciones: "El RFC está inscrito, pero actualmente no tiene obligaciones fiscales registradas.", no_inscrito: "El RFC consultado no aparece inscrito ante el SAT.", cancelado: "El RFC aparece con estatus cancelado.", no_localizado: "El SAT reporta un problema de localización del contribuyente.", otro: "El SAT devolvió un resultado distinto. Revisa el mensaje original.", sin_consulta: "Todavía no se ha consultado este RFC.", error: "La consulta no pudo completarse. Inténtalo nuevamente.", negativa: "La opinión contiene obligaciones o situaciones que requieren atención.", no_publica: "El contribuyente debe autorizar la consulta pública.", positiva: "La opinión pública está al corriente." })[status];
}
function formatDate(value: string | null) {
  if (!value) return "Nunca";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Sin fecha" : new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}
function formatDateTime(value: string | null) {
  if (!value) return "Nunca";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Sin fecha" : new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
function vigenciaLabel(record: ComplianceRecord) {
  if (record.vigente_hasta) return formatDate(record.vigente_hasta);
  if (!record.fecha_consulta) return "Sin consultar";
  return "No indicada por el SAT";
}
function issueSubtitle(record: ComplianceRecord) {
  if (record.status === "positiva") return "Resultado público vigente al momento de la consulta.";
  if (record.status === "no_publica") return "El SAT no permite ver el detalle mientras la opinión sea privada.";
  return "Las causas confirmadas se distinguen de las que aún deben revisarse.";
}

onMounted(() => loadOpinions(false));
