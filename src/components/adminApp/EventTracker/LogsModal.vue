<template>
  <transition name="logs-fade">
    <div
      v-if="visible"
      class="logs-overlay"
      role="presentation"
      @click.self="closeModal"
      @keydown.esc="closeModal"
    >
      <section
        class="logs-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="logs-title"
      >
        <header class="logs-header">
          <div class="logs-heading">
            <p>REGISTRO / SISTEMA</p>
            <h2 id="logs-title">Registros de cambios</h2>
            <div class="logs-context">
              <strong>{{ currentPageTitle }}</strong>
              <span>{{ filteredLogs.length }} visibles</span>
              <span>{{ showAll ? "Historial completo" : "Últimos 90 días" }}</span>
            </div>
          </div>
          <button
            type="button"
            class="logs-close"
            aria-label="Cerrar registros"
            @click="closeModal"
          >
            <i class="pi pi-times" aria-hidden="true" />
          </button>
        </header>

        <div class="logs-toolbar">
          <label class="logs-search">
            <span>Buscar registro</span>
            <div>
              <i class="pi pi-search" aria-hidden="true" />
              <input
                v-model="searchId"
                type="search"
                placeholder="Evento, objeto, usuario o movimiento"
              />
            </div>
          </label>

          <div class="logs-filter">
            <span>Tipo de movimiento</span>
            <button
              type="button"
              class="filter-trigger"
              :aria-expanded="dropdownOpen"
              aria-haspopup="listbox"
              @click="dropdownOpen = !dropdownOpen"
            >
              <span>{{ selectedTypes.length ? selectedLabels.join(", ") : "Todos" }}</span>
              <i
                class="pi pi-chevron-down"
                :class="{ rotated: dropdownOpen }"
                aria-hidden="true"
              />
            </button>
            <div v-if="dropdownOpen" class="filter-menu" role="listbox">
              <button type="button" :class="{ active: !selectedTypes.length }" @click="selectAll">
                <i :class="!selectedTypes.length ? 'pi pi-check-square' : 'pi pi-stop'" />
                <span>Todos los movimientos</span>
              </button>
              <button
                v-for="option in typeOptions"
                :key="option.value"
                type="button"
                :class="{ active: selectedTypes.includes(option.value) }"
                @click="toggleType(option.value)"
              >
                <i :class="selectedTypes.includes(option.value) ? 'pi pi-check-square' : 'pi pi-stop'" />
                <span>{{ option.label }}</span>
              </button>
            </div>
          </div>

          <label class="history-toggle">
            <input v-model="showAll" type="checkbox" />
            <span class="toggle-track" aria-hidden="true"><i /></span>
            <span><b>Historial completo</b><small>Ignora sección y límite de 90 días</small></span>
          </label>
        </div>

        <div class="logs-body">
          <div v-if="loading" class="logs-skeleton" aria-label="Cargando registros">
            <span v-for="item in 5" :key="item" />
          </div>

          <div v-else-if="loadError" class="logs-state error" role="alert">
            <i class="pi pi-exclamation-triangle" aria-hidden="true" />
            <strong>No se pudieron cargar los registros</strong>
            <span>{{ loadError }}</span>
            <button type="button" @click="loadLogs">Reintentar</button>
          </div>

          <div v-else-if="!filteredLogs.length" class="logs-state">
            <i class="pi pi-inbox" aria-hidden="true" />
            <strong>Sin coincidencias</strong>
            <span>Cambia la búsqueda o los filtros para ver más movimientos.</span>
            <button type="button" @click="clearFilters">Limpiar filtros</button>
          </div>

          <div v-else class="logs-list">
            <article
              v-for="log in filteredLogs"
              :key="log.id"
              class="log-entry"
              :class="cardClasses(log)"
            >
              <button
                type="button"
                class="log-summary"
                :aria-expanded="Boolean(detailsVisible[log.id])"
                @click="toggleDetails(log.id)"
              >
                <span class="operation-mark">{{ operationCode(log) }}</span>
                <span class="log-copy">
                  <span class="log-title">{{ humanizeType(log.type) }}</span>
                  <span class="log-user">{{ getUser(log) }}</span>
                  <span class="log-meta">
                    <time :datetime="log.timestamp">{{ formatDate(log.timestamp) }}</time>
                    <span>Evento {{ log.id }}</span>
                    <span>Objeto {{ log.aggregate_id || "Sin ID" }}</span>
                  </span>
                </span>
                <i
                  class="pi pi-chevron-down expand-icon"
                  :class="{ rotated: detailsVisible[log.id] }"
                  aria-hidden="true"
                />
              </button>

              <button
                type="button"
                class="undo-button"
                title="Deshacer cambio"
                :disabled="undoingIds.has(log.id)"
                @click="onUndo(log.id)"
              >
                <i class="pi pi-undo" aria-hidden="true" />
                <span class="sr-only">Deshacer cambio</span>
              </button>

              <div v-if="detailsVisible[log.id]" class="log-details">
                <section v-if="log.oldpayload" class="payload-panel">
                  <header><span>Antes</span><b>{{ fieldCount(log.oldpayload) }} campos</b></header>
                  <dl>
                    <div v-for="(value, key) in log.oldpayload" :key="key">
                      <dt>{{ key }}</dt>
                      <dd>{{ displayValue(value) }}</dd>
                    </div>
                  </dl>
                </section>
                <section v-if="log.payload" class="payload-panel current">
                  <header><span>Después</span><b>{{ fieldCount(log.payload) }} campos</b></header>
                  <dl>
                    <div v-for="(value, key) in log.payload" :key="key">
                      <dt>{{ key }}</dt>
                      <dd>{{ displayValue(value) }}</dd>
                    </div>
                  </dl>
                </section>
                <p v-if="!log.oldpayload && !log.payload" class="no-payload">
                  Este movimiento no contiene datos comparables.
                </p>
              </div>
            </article>
          </div>
        </div>

        <footer class="logs-footer">
          <span>{{ filteredLogs.length }} de {{ logs.length }} registros cargados</span>
          <button type="button" @click="closeModal">
            <i class="pi pi-times" aria-hidden="true" /> Cerrar
          </button>
        </footer>
      </section>
    </div>
  </transition>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { ls, us } from "@/service/adminApp/client";
import { loadProgressively } from "@/service/adminApp/progressiveLoader";

const props = defineProps({
  visible: { type: Boolean, required: true },
});
const emit = defineEmits(["close", "undo"]);
const route = useRoute();
const now = Date.now();
const msDay = 864e5;

const logs = ref([]);
const users = ref([]);
const loading = ref(true);
const loadError = ref("");
const detailsVisible = ref({});
const searchId = ref("");
const selectedTypes = ref([]);
const dropdownOpen = ref(false);
const showAll = ref(true);
const undoingIds = ref(new Set());

const typeOptions = [
  { label: "Agregados", value: "Added" },
  { label: "Modificados", value: "Updated" },
  { label: "Eliminados", value: "Deleted" },
];

const routeScope = computed(() => {
  const path = route.fullPath;
  if (path.includes("/app/pagos/mensual")) return { title: "Pago mensual", prefix: "PagoMensual" };
  if (path.includes("/app/pagos/concepto")) return { title: "Pago por concepto", prefix: "PagoConcepto" };
  if (path.includes("/app/pagos")) return { title: "Pagos", prefix: "Pago" };
  if (path.includes("/app/clientes")) return { title: "Clientes", prefix: "Cliente" };
  if (path.includes("/app/tareas")) return { title: "Tareas", prefix: "Tarea" };
  return { title: "Sistema", prefix: "" };
});

const currentPageTitle = computed(() => (showAll.value ? "Todos los módulos" : routeScope.value.title));
const selectedLabels = computed(() =>
  selectedTypes.value
    .map((value) => typeOptions.find((option) => option.value === value)?.label)
    .filter(Boolean),
);

const filteredLogs = computed(() => {
  const search = searchId.value.trim().toLocaleLowerCase("es");
  return logs.value.filter((log) => {
    if (!showAll.value) {
      if (Date.parse(log.timestamp) < now - 90 * msDay) return false;
      if (routeScope.value.prefix && !String(log.type || "").startsWith(routeScope.value.prefix)) return false;
    }

    const suffix = String(log.type || "").match(/Added|Updated|Deleted/)?.[0];
    if (!suffix) return false;
    if (selectedTypes.value.length && !selectedTypes.value.includes(suffix)) return false;

    if (search) {
      const searchable = [
        log.id,
        log.aggregate_id,
        log.type,
        humanizeType(log.type),
        getUser(log),
      ].join(" ").toLocaleLowerCase("es");
      if (!searchable.includes(search)) return false;
    }
    return true;
  });
});

function normalizeLogs(items) {
  return items
    .map((log) => ({
      ...log,
      payload: parsePayload(log.payload),
      oldpayload: parsePayload(log.oldpayload),
      timestamp: new Date(log.timestamp).toISOString(),
    }))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

function parsePayload(value) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return { valor: value };
  }
}

async function loadLogs() {
  loading.value = true;
  loadError.value = "";
  try {
    users.value = await us.getUsuarios();
    await loadProgressively({
      pageSize: 50,
      fetchPage: (page) => ls.getLogs(page),
      onUpdate: (items) => {
        logs.value = normalizeLogs(items);
        loading.value = false;
      },
      onBackgroundError: (error) => console.error("No se completó la carga de registros", error),
    });
  } catch (error) {
    loading.value = false;
    loadError.value = error?.message || "Revisa la conexión con el servidor.";
  }
}

onMounted(loadLogs);

function toggleType(value) {
  const index = selectedTypes.value.indexOf(value);
  if (index >= 0) selectedTypes.value.splice(index, 1);
  else selectedTypes.value.push(value);
}

function selectAll() {
  selectedTypes.value = [];
  dropdownOpen.value = false;
}

function clearFilters() {
  searchId.value = "";
  selectedTypes.value = [];
}

function toggleDetails(id) {
  detailsVisible.value[id] = !detailsVisible.value[id];
}

function closeModal() {
  dropdownOpen.value = false;
  emit("close");
}

async function onUndo(id) {
  const selectedLog = logs.value.find((log) => log.id == id);
  if (!selectedLog || undoingIds.value.has(id)) return;
  undoingIds.value.add(id);
  try {
    await ls.revertLog(selectedLog);
    logs.value = logs.value.filter((log) => log.id !== id);
    emit("undo", id);
    window.location.reload();
  } catch (error) {
    console.error(error);
  } finally {
    undoingIds.value.delete(id);
  }
}

function getUser(log) {
  const user = users.value.find((item) => item.id_usuario == log.userid);
  return user ? `${user.nombre} (${user.username})` : `Usuario ${log.userid || "desconocido"}`;
}

function humanizeType(type) {
  const labels = {
    ClienteAdded: "Cliente agregado",
    ClienteUpdated: "Cliente modificado",
    ClienteDeleted: "Cliente eliminado",
    TareaAdded: "Tarea agregada",
    TareaUpdated: "Tarea modificada",
    TareaDeleted: "Tarea eliminada",
    PagoConceptoAdded: "Pago por concepto agregado",
    PagoConceptoDeleted: "Pago por concepto eliminado",
    PagoConceptoUpdated: "Pago por concepto modificado",
    PagoMensualAdded: "Pago mensual agregado",
    PagoMensualUpdated: "Pago mensual modificado",
    PagoMensualDeleted: "Pago mensual eliminado",
  };
  return labels[type] || type || "Movimiento del sistema";
}

function formatDate(timestamp) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function operationCode(log) {
  if (String(log.type).endsWith("Added")) return "ALT";
  if (String(log.type).endsWith("Updated")) return "MOD";
  if (String(log.type).endsWith("Deleted")) return "BAJ";
  return "SYS";
}

function cardClasses(log) {
  if (String(log.type).endsWith("Added")) return "is-added";
  if (String(log.type).endsWith("Updated")) return "is-updated";
  if (String(log.type).endsWith("Deleted")) return "is-deleted";
  return "is-system";
}

function fieldCount(value) {
  return value && typeof value === "object" ? Object.keys(value).length : 0;
}

function displayValue(value) {
  if (value == null || value === "") return "Sin valor";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}
</script>

<style scoped>
.logs-overlay{position:fixed;inset:0;z-index:1100;display:grid;place-items:center;padding:clamp(.6rem,2vw,1.5rem);background:color-mix(in srgb,var(--br-bg) 88%,transparent);backdrop-filter:blur(7px)}
.logs-dialog{display:grid;width:min(72rem,100%);height:min(52rem,calc(100dvh - 2rem));grid-template-rows:auto auto minmax(0,1fr) auto;overflow:hidden;border:1px solid var(--br-line-strong);background:var(--br-panel);color:var(--br-text);box-shadow:12px 12px 0 var(--br-accent)}
.logs-header{position:relative;display:flex;min-height:9.5rem;align-items:flex-end;padding:1.35rem 5.5rem 1.35rem 1.5rem;border-bottom:1px solid var(--br-line-strong);background:var(--br-bg)}
.logs-heading p{margin:0 0 .45rem;color:var(--br-accent);font:800 .68rem "Courier New",monospace;letter-spacing:.11em}
.logs-heading h2{max-width:18ch;margin:0;font:900 clamp(2.1rem,5vw,4.25rem)/.82 Arial,sans-serif;letter-spacing:-.06em;text-transform:uppercase}
.logs-context{display:flex;gap:.5rem 1rem;flex-wrap:wrap;margin-top:1rem;color:var(--br-muted);font:700 .68rem "Courier New",monospace;text-transform:uppercase}
.logs-context strong{color:var(--br-text)}
.logs-context span+span{padding-left:1rem;border-left:1px solid var(--br-line)}
.logs-close{position:absolute;right:0;top:0;display:grid;width:4rem;height:4rem;place-items:center;border:0;border-left:1px solid var(--br-line-strong);border-bottom:1px solid var(--br-line-strong);background:var(--br-accent);color:var(--br-accent-text);font-size:1.3rem;cursor:pointer;transition:filter .15s ease,transform .15s ease}
.logs-close:hover{filter:brightness(1.12)}.logs-close:active{transform:translateY(1px)}
.logs-toolbar{position:relative;z-index:5;display:grid;grid-template-columns:minmax(15rem,1.35fr) minmax(13rem,1fr) minmax(14rem,.9fr);gap:.75rem;padding:1rem 1.5rem;border-bottom:1px solid var(--br-line);background:var(--br-panel-2)}
.logs-toolbar>label>span:first-child,.logs-filter>span{display:block;margin-bottom:.35rem;color:var(--br-muted);font:800 .62rem "Courier New",monospace;letter-spacing:.07em;text-transform:uppercase}
.logs-search>div{position:relative}.logs-search i{position:absolute;left:.85rem;top:50%;color:var(--br-muted);transform:translateY(-50%)}
.logs-search input,.filter-trigger{box-sizing:border-box;width:100%;height:3rem;border:1px solid var(--br-line-strong);border-radius:0;background:var(--br-bg);color:var(--br-text);font:700 .76rem "Courier New",monospace}
.logs-search input{padding:.65rem .8rem .65rem 2.6rem}.logs-search input::placeholder{color:var(--br-muted);opacity:.9}
.logs-search input:focus,.filter-trigger:focus-visible,.history-toggle:focus-within{outline:2px solid var(--br-accent);outline-offset:2px}
.logs-filter{position:relative}.filter-trigger{display:flex;align-items:center;justify-content:space-between;gap:.75rem;padding:.65rem .8rem;text-align:left;cursor:pointer}.filter-trigger>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.filter-trigger i,.expand-icon{transition:transform .18s ease}.rotated{transform:rotate(180deg)}
.filter-menu{position:absolute;left:0;right:0;top:calc(100% + .35rem);border:1px solid var(--br-line-strong);background:var(--br-bg);box-shadow:6px 6px 0 var(--br-accent)}
.filter-menu button{display:grid;width:100%;min-height:2.8rem;grid-template-columns:1.1rem 1fr;align-items:center;gap:.6rem;border:0;border-bottom:1px solid var(--br-line);background:transparent;color:var(--br-text);padding:.65rem .8rem;text-align:left;font:700 .72rem "Courier New",monospace;cursor:pointer}.filter-menu button:last-child{border-bottom:0}.filter-menu button:hover,.filter-menu button.active{background:var(--br-accent);color:var(--br-accent-text)}
.history-toggle{display:grid;grid-template-columns:2.5rem minmax(0,1fr);align-items:center;gap:.65rem;min-height:3rem;margin-top:1rem;border:1px solid var(--br-line-strong);padding:.45rem .7rem;cursor:pointer}.history-toggle>input{position:absolute;width:1px;height:1px;opacity:0}.toggle-track{position:relative;width:2.5rem;height:1.25rem;border:1px solid var(--br-line-strong);background:var(--br-bg)}.toggle-track i{position:absolute;left:.15rem;top:.15rem;width:.8rem;height:.8rem;background:var(--br-muted);transition:transform .18s ease,background-color .18s ease}.history-toggle input:checked+.toggle-track i{background:var(--br-accent);transform:translateX(1.15rem)}.history-toggle b,.history-toggle small{display:block}.history-toggle b{font:800 .66rem "Courier New",monospace;text-transform:uppercase}.history-toggle small{margin-top:.15rem;color:var(--br-muted);font:600 .58rem/1.2 "Courier New",monospace}
.logs-body{min-height:0;overflow:auto;padding:1rem 1.5rem;background:var(--br-panel)}
.logs-list{display:grid;gap:.65rem}.log-entry{--event-color:var(--br-line-strong);position:relative;border:1px solid var(--br-line);border-left:4px solid var(--event-color);background:var(--br-bg)}.log-entry.is-added{--event-color:var(--br-success-line,#68ad81)}.log-entry.is-updated{--event-color:var(--br-warning-line,#d0a928)}.log-entry.is-deleted{--event-color:var(--br-danger-line,#e06a5c)}
.log-summary{display:grid;width:100%;min-height:5.2rem;grid-template-columns:3.2rem minmax(0,1fr) 1.5rem;align-items:center;gap:1rem;border:0;background:transparent;color:var(--br-text);padding:.9rem 4.5rem .9rem 1rem;text-align:left;cursor:pointer}.log-summary:hover{background:var(--br-panel-2)}.log-summary:focus-visible{outline:2px solid var(--br-accent);outline-offset:-3px}
.operation-mark{display:grid;min-height:2.25rem;place-items:center;border:1px solid var(--event-color);color:var(--event-color);font:900 .62rem "Courier New",monospace}.log-title,.log-user{display:block}.log-title{font:900 .92rem Arial,sans-serif}.log-user{margin-top:.2rem;color:var(--br-muted);font:700 .68rem "Courier New",monospace}.log-meta{display:flex;gap:.35rem .8rem;flex-wrap:wrap;margin-top:.55rem;color:var(--br-muted);font:600 .61rem "Courier New",monospace}.log-meta span{padding-left:.8rem;border-left:1px solid var(--br-line)}
.undo-button{position:absolute;right:.8rem;top:50%;display:grid;width:2.75rem;height:2.75rem;place-items:center;border:1px solid var(--br-line-strong);background:var(--br-panel);color:var(--br-text);cursor:pointer;transform:translateY(-50%)}.undo-button:hover:not(:disabled){border-color:var(--event-color);background:var(--event-color);color:var(--br-bg)}.undo-button:active:not(:disabled){transform:translateY(calc(-50% + 1px))}.undo-button:disabled{cursor:wait;opacity:.45}
.log-details{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1px;border-top:1px solid var(--br-line);background:var(--br-line)}.payload-panel{min-width:0;background:var(--br-panel)}.payload-panel>header{display:flex;justify-content:space-between;padding:.7rem .9rem;border-bottom:1px solid var(--br-line);color:var(--br-muted);font:800 .62rem "Courier New",monospace;text-transform:uppercase}.payload-panel.current>header{color:var(--event-color)}.payload-panel dl{margin:0}.payload-panel dl>div{display:grid;grid-template-columns:minmax(7rem,.38fr) minmax(0,1fr);border-bottom:1px solid var(--br-line)}.payload-panel dl>div:last-child{border-bottom:0}.payload-panel dt,.payload-panel dd{min-width:0;margin:0;padding:.65rem .8rem;font:650 .66rem/1.4 "Courier New",monospace}.payload-panel dt{overflow-wrap:anywhere;color:var(--br-muted)}.payload-panel dd{border-left:1px solid var(--br-line);white-space:pre-wrap;overflow-wrap:anywhere}.no-payload{grid-column:1/-1;margin:0;background:var(--br-panel);padding:1rem;color:var(--br-muted);font:700 .7rem "Courier New",monospace}
.logs-footer{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:.85rem 1.5rem;border-top:1px solid var(--br-line-strong);background:var(--br-bg)}.logs-footer>span{color:var(--br-muted);font:700 .65rem "Courier New",monospace;text-transform:uppercase}.logs-footer button,.logs-state button{min-height:2.75rem;border:1px solid var(--br-line-strong);background:transparent;color:var(--br-text);padding:.6rem .9rem;font:800 .68rem "Courier New",monospace;text-transform:uppercase;cursor:pointer}.logs-footer button:hover,.logs-state button:hover{background:var(--br-accent);color:var(--br-accent-text)}
.logs-skeleton{display:grid;gap:.65rem}.logs-skeleton span{height:5.2rem;border:1px solid var(--br-line);background:linear-gradient(90deg,var(--br-bg),var(--br-panel-2),var(--br-bg));background-size:200% 100%;animation:logs-shimmer 1.1s linear infinite}.logs-state{display:grid;min-height:20rem;place-items:center;align-content:center;gap:.65rem;text-align:center}.logs-state>i{color:var(--br-accent);font-size:2rem}.logs-state>strong{font:900 1.3rem Arial,sans-serif;text-transform:uppercase}.logs-state>span{max-width:30rem;color:var(--br-muted);font:700 .72rem/1.5 "Courier New",monospace}.logs-state.error>i{color:var(--br-danger-line,#e06a5c)}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@keyframes logs-shimmer{to{background-position:-200% 0}}
.logs-fade-enter-active,.logs-fade-leave-active{transition:opacity .18s ease}.logs-fade-enter-active .logs-dialog,.logs-fade-leave-active .logs-dialog{transition:transform .2s cubic-bezier(.2,.8,.2,1)}.logs-fade-enter-from,.logs-fade-leave-to{opacity:0}.logs-fade-enter-from .logs-dialog{transform:translateY(14px)}.logs-fade-leave-to .logs-dialog{transform:translateY(7px)}
@media(max-width:850px){.logs-toolbar{grid-template-columns:1fr 1fr}.history-toggle{grid-column:1/-1;margin-top:0}.logs-dialog{height:calc(100dvh - 1.2rem)}.log-details{grid-template-columns:1fr}}
@media(max-width:580px){.logs-overlay{padding:.35rem}.logs-dialog{height:calc(100dvh - .7rem);box-shadow:5px 5px 0 var(--br-accent)}.logs-header{min-height:8.2rem;padding:1rem 4.4rem 1rem 1rem}.logs-heading h2{font-size:2.1rem}.logs-context span:last-child{display:none}.logs-toolbar{grid-template-columns:1fr;padding:.8rem 1rem}.history-toggle{grid-column:auto}.logs-body{padding:.75rem 1rem}.log-summary{grid-template-columns:2.7rem minmax(0,1fr);gap:.65rem;padding:.75rem 3.8rem .75rem .75rem}.expand-icon{display:none}.log-meta span{padding-left:0;border-left:0}.undo-button{right:.55rem}.logs-footer{padding:.7rem 1rem}.logs-footer>span{display:none}.logs-footer button{width:100%}}
@media(prefers-reduced-motion:reduce){.logs-fade-enter-active,.logs-fade-leave-active,.logs-fade-enter-active .logs-dialog,.logs-fade-leave-active .logs-dialog{transition:none}.logs-skeleton span{animation:none}.filter-trigger i,.expand-icon,.toggle-track i{transition:none}}
</style>
