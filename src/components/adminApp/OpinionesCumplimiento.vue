<template>
  <main class="compliance-view">
    <header class="compliance-hero">
      <div>
        <p>FISCAL / 32-D</p>
        <h1>Opiniones de cumplimiento</h1>
        <span>Consulta pública del SAT, vigencia y pendientes de cada cliente.</span>
      </div>
      <AppButton
        :label="syncing ? `Consultando ${syncProgress.processed}/${syncProgress.total || '?'}...` : 'Consultar todos en SAT'"
        icon="pi pi-refresh"
        :disabled="syncing || loading"
        @click="syncAll"
      />
    </header>

    <section class="compliance-note" aria-label="Alcance de la consulta">
      <i class="pi pi-shield" aria-hidden="true" />
      <div>
        <strong>Consulta pública y segura</strong>
        <span>Solo se consulta el RFC. La CIECF y la e.firma nunca salen del servidor ni se envían en este proceso.</span>
      </div>
      <button type="button" class="guide-trigger" @click="showGuide = !showGuide">
        {{ showGuide ? 'Ocultar guía' : 'Cómo hacerla pública' }} <i class="pi pi-angle-down" aria-hidden="true" />
      </button>
    </section>

    <section v-if="showGuide" class="publication-guide" aria-labelledby="publication-guide-title">
      <header>
        <div><h2 id="publication-guide-title">Publicar la opinión positiva</h2><p>El trámite es gratuito y requiere Contraseña o e.firma vigente.</p></div>
        <a href="https://wwwmat.sat.gob.mx/tramites/37836/autoriza-al-sat-a-hacer-publica-tu-opinion-del-cumplimiento" target="_blank" rel="noopener noreferrer">Iniciar en SAT <i class="pi pi-external-link" /></a>
      </header>
      <ol>
        <li><strong>Abre el trámite</strong><span>Entra a “Autoriza que el resultado de tu Opinión del cumplimiento sea público”.</span></li>
        <li><strong>Inicia sesión</strong><span>Ingresa con la Contraseña o e.firma vigente del contribuyente.</span></li>
        <li><strong>Resuelve el Captcha</strong><span>Captura el texto de la imagen y selecciona Enviar.</span></li>
        <li><strong>Autoriza la publicación</strong><span>Marca “Autorizo hacer público el resultado de mi Opinión del cumplimiento”.</span></li>
        <li><strong>Guarda la autorización</strong><span>Selecciona Guardar y conserva la confirmación emitida por el SAT.</span></li>
        <li><strong>Actualiza esta vista</strong><span>Regresa y usa “Consultar todos en SAT”.</span></li>
      </ol>
    </section>

    <section class="summary-grid" aria-label="Resumen de opiniones">
      <article><span>Clientes</span><strong>{{ summary.total }}</strong></article>
      <article class="positive"><span>Positivas</span><strong>{{ summary.positiva }}</strong></article>
      <article class="negative"><span>Situación especial</span><strong>{{ summary.especial + summary.negativa }}</strong></article>
      <article><span>No públicas</span><strong>{{ summary.no_publica }}</strong></article>
      <article><span>Sin consultar</span><strong>{{ summary.sin_consulta }}</strong></article>
      <article><span>PDF archivados</span><strong>{{ summary.con_documento }}</strong></article>
    </section>

    <section class="filter-strip" aria-label="Filtros de opiniones">
      <div class="search-row">
        <label class="search-field">
          <span>Buscar cliente o RFC</span>
          <span class="search-control">
            <i class="pi pi-search" aria-hidden="true" />
            <AppInput v-model="search" type="search" placeholder="Buscar..." />
          </span>
        </label>
        <AppButton :label="filterButtonLabel" icon="pi pi-sliders-h" outlined @click="openFilters" />
        <AppButton label="Limpiar filtros" icon="pi pi-filter-slash" outlined @click="clearFilters" />
        <div class="filter-result">{{ filteredRecords.length }} resultados</div>
      </div>
    </section>

    <div v-if="errorMessage" class="feedback error" role="alert">
      <i class="pi pi-exclamation-triangle" aria-hidden="true" />
      <span>{{ errorMessage }}</span>
      <button type="button" @click="loadOpinions()">Reintentar</button>
    </div>
    <div v-else-if="successMessage" class="feedback success" role="status">
      <i class="pi pi-check-circle" aria-hidden="true" />
      <span>{{ successMessage }}</span>
      <button type="button" aria-label="Cerrar aviso" @click="successMessage = ''">×</button>
    </div>

    <section class="compliance-workspace">
      <div class="records-panel">
        <header class="panel-heading">
          <div>
            <h2>Clientes</h2>
            <span>Último resultado disponible en el SAT</span>
          </div>
        </header>

        <div v-if="loading" class="records-list skeleton-list" aria-label="Cargando opiniones">
          <article v-for="index in 6" :key="index" class="record-row skeleton-row">
            <span /><span /><span />
          </article>
        </div>

        <div v-else-if="!filteredRecords.length" class="empty-state">
          <i class="pi pi-inbox" aria-hidden="true" />
          <strong>No hay opiniones para mostrar</strong>
          <span>{{ records.length ? 'Cambia los filtros para ver otros clientes.' : 'Sincroniza con el SAT para crear la primera consulta.' }}</span>
        </div>

        <div v-else class="records-list">
          <section v-for="group in groupedRecords" :key="group.code" class="regime-group">
            <header class="regime-heading">
              <h3>{{ group.label }}</h3>
              <span>{{ group.records.length }} {{ group.records.length === 1 ? 'cliente' : 'clientes' }}</span>
            </header>
            <button
              v-for="record in group.records"
              :key="record.id_cliente"
              type="button"
              class="record-row"
              :class="{ active: selected?.id_cliente === record.id_cliente }"
              @click="selected = record"
            >
              <span class="client-cell">
                <strong>{{ record.nombre }}</strong>
                <small>{{ record.rfc || 'RFC no registrado' }}</small>
              </span>
              <span class="status-cell" :class="statusClass(record.status)">
                <i :class="statusIcon(record.status)" aria-hidden="true" />
                {{ statusLabel(record.status) }}
              </span>
              <span class="date-cell">
                <small>Última consulta</small>
                <strong>{{ formatDate(record.fecha_consulta) }}</strong>
              </span>
              <i class="pi pi-angle-right row-arrow" aria-hidden="true" />
            </button>
          </section>
        </div>
      </div>

      <aside class="detail-panel" aria-live="polite">
        <template v-if="selected">
          <header>
            <span :class="['status-mark', statusClass(selected.status)]"><i :class="statusIcon(selected.status)" /></span>
            <div><small>Opinión 32-D</small><h2>{{ selected.nombre }}</h2><p>{{ selected.rfc }}</p></div>
          </header>

          <dl class="opinion-meta">
            <div><dt>Resultado</dt><dd>{{ statusLabel(selected.status) }}</dd></div>
            <div><dt>Emitida por SAT</dt><dd>{{ formatDateTime(selected.fecha_emision) }}</dd></div>
            <div><dt>Consultada</dt><dd>{{ formatDateTime(selected.fecha_consulta) }}</dd></div>
            <div><dt>Documento</dt><dd>{{ selected.documento_guardado ? 'PDF archivado' : 'Sin PDF' }}</dd></div>
            <div><dt>Régimen</dt><dd>{{ regimenFiscalLabel(selected.regimen_fiscal) }}</dd></div>
            <div><dt>Vigencia</dt><dd>{{ vigenciaLabel(selected) }}</dd></div>
          </dl>

          <section class="issues-section">
            <div class="issues-heading">
              <div><h3>{{ selected.status === 'positiva' ? 'Sin omisiones detectadas' : 'Detalle del resultado' }}</h3><span>{{ issueSubtitle(selected) }}</span></div>
              <strong>{{ selected.pendientes.length }}</strong>
            </div>
            <div v-if="selected.status === 'positiva'" class="all-clear">
              <i class="pi pi-check" aria-hidden="true" />
              <div><strong>Opinión positiva</strong><span>El resultado público del SAT está al corriente a la fecha consultada.</span></div>
            </div>
            <div v-else-if="selected.pendientes.length" class="issue-list">
              <article v-for="issue in selected.pendientes" :key="issue.code">
                <i :class="issue.confirmed ? 'pi pi-exclamation-circle' : 'pi pi-question-circle'" aria-hidden="true" />
                <div>
                  <span>{{ issue.confirmed ? 'Confirmado por el SAT' : 'Requiere verificación' }}</span>
                  <strong>{{ issue.title }}</strong>
                  <p>{{ issue.detail }}</p>
                  <small v-if="issue.action">Siguiente acción: {{ issue.action }}</small>
                </div>
              </article>
            </div>
            <div v-else class="special-result"><i :class="statusIcon(selected.status)" /><div><strong>{{ statusLabel(selected.status) }}</strong><span>{{ statusDescription(selected.status) }}</span></div></div>
          </section>

          <div v-if="selected.mensaje" class="sat-message"><strong>Respuesta del SAT</strong><p>{{ selected.mensaje }}</p></div>

          <footer>
            <AppButton
              label="Ver documentos"
              icon="pi pi-folder-open"
              outlined
              @click="documentClient = selected"
            />
            <AppButton
              :label="syncingClientId === selected.id_cliente ? 'Consultando...' : 'Actualizar cliente'"
              icon="pi pi-refresh"
              :disabled="syncing || syncingClientId === selected.id_cliente"
              @click="syncClient(selected.id_cliente)"
            />
          </footer>
        </template>
        <div v-else class="empty-state detail-empty-state">
          <i class="pi pi-file-check" aria-hidden="true" />
          <strong>Selecciona un cliente</strong>
          <span>Aquí verás su opinión, vigencia y acciones pendientes.</span>
        </div>
      </aside>
    </section>
    <Teleport to="body">
      <div v-if="showFilters" class="filters-overlay" @click.self="closeFilters">
        <section
          ref="filtersModal"
          class="filters-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="opinions-filter-title"
          tabindex="-1"
          @keydown.esc="closeFilters"
        >
          <header class="filters-modal-header">
            <div>
              <p>OPINIONES / FILTROS</p>
              <h2 id="opinions-filter-title">Filtrar clientes</h2>
            </div>
            <button type="button" aria-label="Cerrar filtros" @click="closeFilters">×</button>
          </header>

          <div class="filters-modal-body">
            <fieldset class="radio-filter status-filter">
              <legend>Resultado</legend>
              <div class="radio-options">
                <label v-for="option in statusOptions" :key="option.value" class="radio-option" :class="{ active: draftStatusFilter === option.value }">
                  <input v-model="draftStatusFilter" type="radio" name="opinion-status" :value="option.value" />
                  <span>{{ option.label }}</span>
                </label>
              </div>
            </fieldset>

            <fieldset class="radio-filter regime-filter">
              <legend>Régimen fiscal</legend>
              <div class="radio-options">
                <label v-for="option in regimeOptions" :key="option.value" class="radio-option" :class="{ active: draftRegimeFilter === option.value }">
                  <input v-model="draftRegimeFilter" type="radio" name="opinion-regime" :value="option.value" />
                  <span>{{ option.label }}</span>
                </label>
              </div>
            </fieldset>
          </div>

          <footer class="filters-modal-footer">
            <button type="button" class="reset-filters" @click="resetDraftFilters">Restablecer</button>
            <div>
              <AppButton label="Cancelar" outlined @click="closeFilters" />
              <AppButton label="Aplicar filtros" icon="pi pi-filter" @click="applyFilters" />
            </div>
          </footer>
        </section>
      </div>
    </Teleport>
    <ClientDocumentsModal v-if="documentClient" :client="documentClient" @close="documentClient = null" />
  </main>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import AppButton from "@/components/ui/AppButton.vue";
import AppInput from "@/components/ui/AppInput.vue";
import ClientDocumentsModal from "@/components/adminApp/ClientDocumentsModal.vue";
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
</script>

<style scoped>
.compliance-view{min-height:calc(100dvh - 5rem);color:var(--br-text)}
.compliance-hero{display:flex;align-items:flex-end;justify-content:space-between;gap:2rem;border-block:2px solid var(--br-line-strong);padding:1.45rem 0 1.35rem}
.compliance-hero p{margin:0 0 .45rem;color:var(--br-accent);font:800 .72rem "Courier New",monospace;letter-spacing:.1em}
.compliance-hero h1{max-width:18ch;margin:0;font:900 clamp(2.1rem,5vw,4.5rem)/.9 Arial,sans-serif;letter-spacing:-.065em;text-transform:uppercase}
.compliance-hero span{display:block;margin-top:.65rem;color:var(--br-muted);font:700 .76rem/1.5 "Courier New",monospace}
.compliance-note{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:.9rem;margin-top:1rem;border:1px solid var(--br-line);background:var(--br-panel);padding:.85rem 1rem}
.compliance-note>i{color:var(--br-accent);font-size:1.45rem}.compliance-note strong,.compliance-note span{display:block}.compliance-note span{margin-top:.2rem;color:var(--br-muted);font-size:.76rem}
.guide-trigger{display:flex;align-items:center;gap:.45rem;border:0;border-bottom:1px solid var(--br-accent);background:transparent;color:var(--br-text);font:800 .7rem "Courier New",monospace;text-transform:uppercase;cursor:pointer}
.publication-guide{margin-top:1rem;border:1px solid var(--br-line-strong);background:var(--br-panel);padding:1.15rem}.publication-guide>header{display:flex;align-items:flex-start;justify-content:space-between;gap:1.5rem;padding-bottom:1rem;border-bottom:1px solid var(--br-line)}.publication-guide h2{margin:0;font:900 1.2rem Arial,sans-serif;text-transform:uppercase}.publication-guide p{margin:.3rem 0 0;color:var(--br-muted);font-size:.72rem}.publication-guide a{display:flex;align-items:center;gap:.45rem;color:var(--br-text);font:800 .7rem "Courier New",monospace;text-transform:uppercase}.publication-guide ol{display:grid;grid-template-columns:repeat(3,1fr);margin:1rem 0 0;padding:0;list-style:none;counter-reset:publication-step}.publication-guide li{position:relative;min-height:7rem;padding:.2rem 1rem 1rem 3.2rem;border-right:1px solid var(--br-line);counter-increment:publication-step}.publication-guide li:nth-child(3n){border-right:0}.publication-guide li::before{content:counter(publication-step,decimal-leading-zero);position:absolute;left:.5rem;top:0;color:var(--br-accent);font:900 1.4rem Arial,sans-serif}.publication-guide li strong,.publication-guide li span{display:block}.publication-guide li strong{font-size:.78rem;text-transform:uppercase}.publication-guide li span{margin-top:.35rem;color:var(--br-muted);font-size:.69rem;line-height:1.45}
.summary-grid{display:grid;grid-template-columns:repeat(6,1fr);margin-top:1rem;border:1px solid var(--br-line-strong);background:var(--br-panel);box-shadow:8px 8px 0 var(--br-accent)}
.summary-grid article{min-width:0;border-right:1px solid var(--br-line);padding:1rem}.summary-grid article:last-child{border-right:0}.summary-grid span,.summary-grid strong{display:block}.summary-grid span{color:var(--br-muted);font:800 .62rem "Courier New",monospace;text-transform:uppercase}.summary-grid strong{margin-top:.35rem;font:900 clamp(1.7rem,3vw,2.6rem) Arial,sans-serif}.summary-grid .positive strong{color:var(--br-success-line,#70b789)}.summary-grid .negative strong{color:var(--br-danger-line,#e06a5c)}
.filter-strip{margin-top:1.5rem;border:1px solid var(--br-line);background:var(--br-panel);padding:1rem}.search-row{display:grid;grid-template-columns:minmax(18rem,1fr) auto auto auto;align-items:end;gap:.75rem}.search-field>span:first-child,.radio-filter legend{display:block;margin-bottom:.45rem;color:var(--br-muted);font:800 .62rem "Courier New",monospace;text-transform:uppercase}.search-control{display:grid;grid-template-columns:3rem minmax(0,1fr);margin:0!important}.search-control>i{display:grid;min-height:3rem;place-items:center;border:1px solid var(--br-line-strong);border-right:0;background:var(--br-bg);color:var(--br-muted);font-size:1rem}.search-control :deep(input){width:100%}.filter-result{align-self:center;padding:.7rem 0;color:var(--br-muted);font:800 .65rem "Courier New",monospace;text-align:right;text-transform:uppercase;white-space:nowrap}
.filters-overlay{position:fixed;inset:0;z-index:1200;display:grid;place-items:center;background:color-mix(in srgb,var(--br-bg) 82%,transparent);padding:1rem}.filters-modal{display:grid;width:min(48rem,100%);max-height:calc(100dvh - 2rem);grid-template-rows:auto minmax(0,1fr) auto;border:1px solid var(--br-line-strong);background:var(--br-panel);box-shadow:10px 10px 0 var(--br-accent);color:var(--br-text)}.filters-modal-header{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;border-bottom:1px solid var(--br-line-strong);padding:1rem 1.1rem}.filters-modal-header p{margin:0 0 .35rem;color:var(--br-accent);font:800 .62rem "Courier New",monospace;letter-spacing:.08em}.filters-modal-header h2{margin:0;font:900 1.35rem Arial,sans-serif;text-transform:uppercase}.filters-modal-header>button{display:grid;width:2.5rem;height:2.5rem;place-items:center;border:1px solid var(--br-line-strong);background:var(--br-bg);color:var(--br-text);font-size:1.35rem;cursor:pointer}.filters-modal-header>button:hover,.filters-modal-header>button:focus-visible{border-color:var(--br-accent);outline:0;color:var(--br-accent)}.filters-modal-body{display:grid;gap:1.25rem;overflow:auto;padding:1.1rem}.radio-filter{min-width:0;margin:0;border:0;padding:0}.radio-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.45rem}.radio-option{display:flex;min-width:0;align-items:center;gap:.55rem;min-height:2.8rem;border:1px solid var(--br-line-strong);background:var(--br-bg);padding:.55rem .7rem;color:var(--br-muted);font:800 .66rem/1.35 "Courier New",monospace;cursor:pointer;text-transform:uppercase;transition:background-color .14s ease,border-color .14s ease,color .14s ease}.radio-option:hover{border-color:var(--br-text);color:var(--br-text)}.radio-option.active{border-color:var(--br-accent);background:var(--br-panel-2);color:var(--br-text);box-shadow:inset 3px 0 0 var(--br-accent)}.radio-option input{flex:0 0 auto;width:.9rem;height:.9rem;margin:0;appearance:none;border:1px solid currentColor;border-radius:50%;background:transparent}.radio-option input:checked{border:3px solid var(--br-panel-2);background:var(--br-accent);outline:1px solid var(--br-accent)}.radio-option:focus-within{outline:2px solid var(--br-accent);outline-offset:2px}.radio-option span{min-width:0}.filters-modal-footer{display:flex;align-items:center;justify-content:space-between;gap:1rem;border-top:1px solid var(--br-line-strong);padding:1rem 1.1rem}.filters-modal-footer>div{display:flex;gap:.65rem}.reset-filters{border:0;border-bottom:1px solid var(--br-line-strong);background:transparent;color:var(--br-muted);padding:.3rem 0;font:800 .65rem "Courier New",monospace;text-transform:uppercase;cursor:pointer}.reset-filters:hover,.reset-filters:focus-visible{border-color:var(--br-accent);outline:0;color:var(--br-text)}
.feedback{display:flex;align-items:center;gap:.65rem;margin-top:1rem;border:1px solid;padding:.75rem 1rem}.feedback span{flex:1}.feedback button{border:0;background:transparent;color:inherit;font-weight:800;cursor:pointer}.feedback.error{border-color:var(--br-danger-line,#e06a5c);background:color-mix(in srgb,var(--br-danger,#96382e) 35%,var(--br-panel))}.feedback.success{border-color:var(--br-success-line,#70b789);background:color-mix(in srgb,var(--br-success,#35624a) 35%,var(--br-panel))}
.compliance-workspace{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(21rem,.75fr);gap:1rem;margin-top:1rem}.records-panel,.detail-panel{border:1px solid var(--br-line-strong);background:var(--br-panel);box-shadow:8px 8px 0 var(--br-accent)}
.panel-heading{border-bottom:1px solid var(--br-line);padding:1rem}.panel-heading h2{margin:0;font:900 1.25rem Arial,sans-serif;text-transform:uppercase}.panel-heading span{display:block;margin-top:.25rem;color:var(--br-muted);font:700 .65rem "Courier New",monospace}
.records-list{max-height:42rem;overflow:auto}.record-row{display:grid;width:100%;grid-template-columns:minmax(12rem,1fr) 9.5rem 8.5rem auto;align-items:center;gap:1rem;border:0;border-bottom:1px solid var(--br-line);background:transparent;color:inherit;padding:.9rem 1rem;text-align:left;cursor:pointer;transition:background-color .16s ease,box-shadow .16s ease}.record-row:hover,.record-row.active{background:var(--br-panel-2)}.record-row.active{box-shadow:inset 4px 0 0 var(--br-accent)}.record-row:active{transform:translateY(1px)}
.regime-group{margin:0}.regime-heading{position:sticky;top:0;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:1rem;border-bottom:1px solid var(--br-line-strong);background:var(--br-bg);padding:.65rem 1rem}.regime-group+.regime-group .regime-heading{border-top:1px solid var(--br-line-strong)}.regime-heading h3{margin:0;font:900 .72rem Arial,sans-serif;text-transform:uppercase}.regime-heading span{color:var(--br-muted);font:800 .6rem "Courier New",monospace;text-transform:uppercase}
.client-cell strong,.client-cell small,.date-cell strong,.date-cell small{display:block}.client-cell strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.client-cell small,.date-cell small{margin-top:.28rem;color:var(--br-muted);font:700 .61rem "Courier New",monospace}.date-cell strong{margin-top:.2rem;font-size:.75rem}.status-cell{display:inline-flex;align-items:center;gap:.4rem;font:800 .62rem "Courier New",monospace;text-transform:uppercase}.status-positiva{color:var(--br-success-line,#70b789)}.status-negativa,.status-error,.status-no_localizado,.status-cancelado{color:var(--br-danger-line,#e06a5c)}.status-no_publica,.status-suspension_actividades,.status-no_inscrito{color:var(--br-warning-line,#d0a928)}.status-inscrito_sin_obligaciones,.status-otro,.status-sin_consulta{color:var(--br-muted)}.row-arrow{color:var(--br-muted)}
.detail-panel{min-height:34rem}.detail-panel>header{display:grid;grid-template-columns:auto minmax(0,1fr);gap:.9rem;border-bottom:1px solid var(--br-line);padding:1.1rem}.status-mark{display:grid;width:2.8rem;height:2.8rem;place-items:center;border:1px solid currentColor;font-size:1.25rem}.detail-panel header small{color:var(--br-accent);font:800 .6rem "Courier New",monospace;text-transform:uppercase}.detail-panel header h2{margin:.2rem 0 0;overflow:hidden;font:900 1.15rem Arial,sans-serif;text-overflow:ellipsis;text-transform:uppercase}.detail-panel header p{margin:.25rem 0 0;color:var(--br-muted);font:700 .65rem "Courier New",monospace}
.opinion-meta{display:grid;grid-template-columns:1fr 1fr;margin:0;border-bottom:1px solid var(--br-line)}.opinion-meta div{border-right:1px solid var(--br-line);border-bottom:1px solid var(--br-line);padding:.8rem}.opinion-meta div:nth-child(even){border-right:0}.opinion-meta div:nth-last-child(-n+2){border-bottom:0}.opinion-meta dt{color:var(--br-muted);font:800 .58rem "Courier New",monospace;text-transform:uppercase}.opinion-meta dd{margin:.25rem 0 0;font-size:.75rem;font-weight:800}
.issues-section{padding:1rem}.issues-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem}.issues-heading h3{margin:0;font:900 .9rem Arial,sans-serif;text-transform:uppercase}.issues-heading span{display:block;margin-top:.3rem;color:var(--br-muted);font-size:.69rem;line-height:1.45}.issues-heading>strong{display:grid;min-width:2rem;height:2rem;place-items:center;background:var(--br-accent);color:var(--br-accent-text)}
.all-clear{display:flex;gap:.8rem;margin-top:1rem;border:1px solid var(--br-success-line,#70b789);padding:.9rem}.all-clear>i{color:var(--br-success-line,#70b789);font-size:1.2rem}.all-clear strong,.all-clear span{display:block}.all-clear span{margin-top:.25rem;color:var(--br-muted);font-size:.72rem;line-height:1.45}
.special-result{display:grid;grid-template-columns:auto 1fr;gap:.8rem;margin-top:1rem;border:1px solid var(--br-line);background:var(--br-panel-2);padding:.9rem}.special-result>i{color:currentColor;font-size:1.2rem}.special-result strong,.special-result span{display:block}.special-result span{margin-top:.25rem;color:var(--br-muted);font-size:.72rem;line-height:1.45}
.issue-list{display:grid;gap:.6rem;margin-top:1rem}.issue-list article{display:grid;grid-template-columns:auto 1fr;gap:.7rem;border-left:3px solid var(--br-warning-line,#d0a928);background:var(--br-panel-2);padding:.8rem}.issue-list article>i{margin-top:.15rem;color:var(--br-warning-line,#d0a928)}.issue-list span{color:var(--br-warning-line,#d0a928);font:800 .56rem "Courier New",monospace;text-transform:uppercase}.issue-list strong{display:block;margin-top:.22rem;font-size:.78rem}.issue-list p{margin:.3rem 0 0;color:var(--br-muted);font-size:.69rem;line-height:1.45}.issue-list small{display:block;margin-top:.45rem;color:var(--br-text);font-size:.65rem;font-weight:800}
.sat-message{margin:0 1rem 1rem;border:1px solid var(--br-line);padding:.8rem}.sat-message strong{font:800 .6rem "Courier New",monospace;text-transform:uppercase}.sat-message p{margin:.35rem 0 0;color:var(--br-muted);font-size:.69rem;line-height:1.45}.detail-panel>footer{display:flex;justify-content:flex-end;gap:.65rem;border-top:1px solid var(--br-line);padding:1rem}.detail-empty{margin-top:1rem;color:var(--br-muted);font-size:.72rem}.empty-state{display:grid;min-height:20rem;place-items:center;align-content:center;gap:.45rem;padding:2rem;color:var(--br-muted);text-align:center}.empty-state i{font-size:2rem}.empty-state strong{color:var(--br-text)}.empty-state span{font-size:.72rem}.detail-empty-state{min-height:34rem}.skeleton-row{cursor:default}.skeleton-row span{height:1.8rem;background:linear-gradient(90deg,var(--br-panel-2),var(--br-line),var(--br-panel-2));background-size:200% 100%;animation:skeleton 1.2s linear infinite}
@keyframes skeleton{to{background-position:-200% 0}}
@media(max-width:1100px){.summary-grid{grid-template-columns:repeat(3,1fr)}.summary-grid article:nth-child(3n){border-right:0}.compliance-workspace{grid-template-columns:1fr}.detail-panel{min-height:0}.detail-empty-state{min-height:14rem}}
@media(max-width:780px){.compliance-hero{align-items:stretch;flex-direction:column}.compliance-note{grid-template-columns:auto 1fr}.guide-trigger{grid-column:2;justify-self:start}.publication-guide>header{flex-direction:column}.publication-guide ol{grid-template-columns:1fr 1fr}.publication-guide li,.publication-guide li:nth-child(3n){border-right:1px solid var(--br-line)}.publication-guide li:nth-child(even){border-right:0}.summary-grid{grid-template-columns:repeat(2,1fr)}.summary-grid article{border-bottom:1px solid var(--br-line)}.summary-grid article:nth-child(3n){border-right:1px solid var(--br-line)}.summary-grid article:nth-child(even){border-right:0}.search-row{grid-template-columns:1fr}.filter-result{text-align:left}.record-row{grid-template-columns:minmax(0,1fr) auto}.date-cell{grid-column:1}.row-arrow{grid-column:2;grid-row:1/3}.status-cell{justify-self:end}.filters-overlay{padding:.65rem}.filters-modal{max-height:calc(100dvh - 1.3rem)}.radio-options{grid-template-columns:1fr}}
@media(max-width:480px){.summary-grid{grid-template-columns:1fr}.summary-grid article,.summary-grid article:nth-child(even),.summary-grid article:nth-child(3n){grid-column:auto;border-right:0}.compliance-note{grid-template-columns:1fr}.guide-trigger{grid-column:auto}.publication-guide ol{grid-template-columns:1fr}.publication-guide li,.publication-guide li:nth-child(3n){min-height:0;border-right:0}.opinion-meta{grid-template-columns:1fr}.opinion-meta div{border-right:0}.opinion-meta div:nth-last-child(2){border-bottom:1px solid var(--br-line)}.detail-panel>footer{align-items:stretch;flex-direction:column}.filters-modal-footer{align-items:stretch;flex-direction:column}.filters-modal-footer>div{display:grid;grid-template-columns:1fr 1fr}.reset-filters{align-self:flex-start}}
@media(prefers-reduced-motion:reduce){.skeleton-row span{animation:none}.record-row{transition:none}}
</style>
