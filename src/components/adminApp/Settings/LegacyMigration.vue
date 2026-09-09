<script setup lang="ts">
import { computed, ref } from 'vue'
import { bs } from '@/service/adminApp/client'
import { saveAs } from 'file-saver'
type Preview = {
  sourceHash: string
  token: string
  counts: Record<
    string,
    { total: number; create: number; reuse: number; skip: number; reject: number }
  >
  reuse: Array<{ table: string; legacyId: string; targetId: string; name: string }>
  idConflicts: Array<{
    key: string
    table: string
    legacyId: string
    targetId: string
    name: string
    targetName: string
    message: string
    selected: string
    canKeep: boolean
    canChangeId: boolean
  }>
  rejected: Array<{ table: string; legacyId: string; reason: string }>
  conflicts: string[]
  warnings: string[]
  ignoredTables: string[]
}
const decisions = ref<Record<string, string>>({})
const reviewedDecisions = ref('{}')
const decisionsChanged = computed(() => JSON.stringify(decisions.value) !== reviewedDecisions.value)
function changeDecision(key: string, event: Event) {
  const value = (event.target as HTMLSelectElement).value
  if (value) decisions.value[key] = value
  else delete decisions.value[key]
  confirmation.value = ''
}
function clearDecisions() {
  decisions.value = {}
  confirmation.value = ''
  preview.value = null
}
const file = ref<File | null>(null)
const preview = ref<Preview | null>(null)
const report = ref<Record<string, any> | null>(null)
const busy = ref(false),
  phase = ref(''),
  error = ref(''),
  confirmation = ref('')
const labels: Record<string, string> = {
  usuarios: 'Usuarios',
  clientes: 'Clientes',
  notas: 'Notas',
  tareas: 'Tareas',
  pagoconcepto: 'Pagos por concepto',
  pagomensual: 'Pagos mensuales',
  tareas_de_empleados: 'Asignaciones de tareas',
  events: 'Historial archivado'
}
const pending = computed(() =>
  Object.values(preview.value?.counts || {}).reduce(
    (n, row) => n + row.create + row.reuse + (row.reject || 0),
    0
  )
)
function selectFile(event: Event) {
  decisions.value = {}
  reviewedDecisions.value = '{}'
  preview.value = null
  report.value = null
  confirmation.value = ''
  error.value = ''
  file.value = (event.target as HTMLInputElement).files?.[0] || null
  if (
    file.value &&
    (!file.value.name.toLowerCase().endsWith('.sql') || file.value.size > 50 * 1024 * 1024)
  ) {
    file.value = null
    error.value = 'Selecciona un archivo .sql de hasta 50 MB.'
  }
}
async function analyze() {
  if (!file.value || busy.value) return
  busy.value = true
  phase.value = 'Analizando el archivo y comparando con la base actual…'
  error.value = ''
  report.value = null
  confirmation.value = ''
  try {
    preview.value = await bs.previewLegacy(file.value, decisions.value)
    reviewedDecisions.value = JSON.stringify(decisions.value)
  } catch (e: any) {
    error.value = e.response?.data?.error || 'No se pudo analizar el archivo.'
  } finally {
    busy.value = false
    phase.value = ''
  }
}
async function migrate() {
  if (
    !file.value ||
    !preview.value ||
    busy.value ||
    confirmation.value !== 'MIGRAR LEGACY' ||
    decisionsChanged.value ||
    preview.value.conflicts.length ||
    !pending.value
  )
    return
  busy.value = true
  phase.value = 'Creando el respaldo e importando los datos. Mantén esta página abierta…'
  error.value = ''
  try {
    report.value = await bs.migrateLegacy(
      file.value,
      preview.value.token,
      confirmation.value,
      decisions.value
    )
    preview.value = null
    decisions.value = {}
    confirmation.value = ''
  } catch (e: any) {
    error.value =
      e.response?.data?.error ||
      'No se pudo confirmar el resultado. Vuelve a analizar el archivo antes de reintentar; los registros ya migrados se reconocerán.'
    preview.value = null
  } finally {
    busy.value = false
    phase.value = ''
  }
}
function downloadReport() {
  if (report.value)
    saveAs(
      new Blob([JSON.stringify(report.value, null, 2)], { type: 'application/json' }),
      'resultado-migracion-legacy.json'
    )
}
async function downloadEvents() {
  if (busy.value) return
  busy.value = true
  phase.value = 'Descargando el historial legacy…'
  error.value = ''
  try {
    saveAs(await bs.legacyEvents(), 'eventos-legacy.json')
  } catch {
    error.value = 'No se pudo descargar el historial legacy.'
  } finally {
    busy.value = false
    phase.value = ''
  }
}
</script>

<template>
  <section
    class="legacy-migration settings-panel"
    aria-labelledby="legacy-migration-title"
    :aria-busy="busy"
  >
    <header class="legacy-heading">
      <div>
        <p>SISTEMA / TRANSFERENCIA DE DATOS</p>
        <h2 id="legacy-migration-title">Migrar desde ContaApp legacy</h2>
      </div>
      <i class="pi pi-database" aria-hidden="true"></i>
    </header>
    <div class="legacy-body">
      <p class="legacy-intro">
        Importa una exportación SQL completa de la base legacy. Primero revisa el contenido; después
        confirma la migración. Se crea un respaldo antes de importar y se conservan los datos
        actuales.
      </p>
      <p class="legacy-hint">
        Incluye usuarios, clientes, pagos, notas y tareas. Los eventos quedan en un archivo
        histórico descargable. Los archivos adjuntos y certificados requieren un traslado separado.
      </p>
      <ol class="legacy-steps" aria-label="Etapas de migración">
        <li :class="{ active: !preview && !report }">
          <span>01</span><strong>Cargar archivo</strong>
        </li>
        <li :class="{ active: preview }"><span>02</span><strong>Revisar datos</strong></li>
        <li :class="{ active: report }"><span>03</span><strong>Confirmar migración</strong></li>
      </ol>
      <label class="legacy-file"
        >Exportación legacy (.sql, UTF-8, hasta 50 MB)
        <input type="file" accept=".sql" :disabled="busy" @change="selectFile" />
      </label>
      <div class="legacy-actions">
        <button type="button" class="legacy-primary" :disabled="!file || busy" @click="analyze">
          <i class="pi pi-search" aria-hidden="true"></i>Analizar SQL
        </button>
        <button type="button" :disabled="busy" @click="downloadEvents">
          <i class="pi pi-download" aria-hidden="true"></i>Descargar historial migrado
        </button>
      </div>
      <p v-if="busy" class="legacy-status" role="status">
        <i class="pi pi-spin pi-spinner" aria-hidden="true"></i> {{ phase }}
      </p>
      <p v-if="error" class="legacy-error" role="alert">{{ error }}</p>
      <template v-if="preview">
        <div class="legacy-table">
          <table>
            <caption>
              Resultado del análisis
            </caption>
            <thead>
              <tr>
                <th>Datos</th>
                <th>En archivo</th>
                <th>Nuevos</th>
                <th>Vincular existentes</th>
                <th>Ya migrados</th>
                <th>Rechazados</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, table) in preview.counts" :key="table">
                <th scope="row">{{ labels[table] || table }}</th>
                <td>{{ row.total }}</td>
                <td>{{ row.create }}</td>
                <td>{{ row.reuse }}</td>
                <td>{{ row.skip }}</td>
                <td>{{ row.reject || 0 }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="preview.idConflicts?.length" class="legacy-conflicts">
          <h3>Resolver conflictos de ID</h3>
          <p class="legacy-hint">
            Conservar usa el registro actual y le vincula los datos entrantes. Rechazar omite el
            entrante y sus dependientes. Cambiar ID crea un registro independiente con un
            identificador nuevo automático.
          </p>
          <div v-for="item in preview.idConflicts" :key="item.key" class="legacy-conflict-row">
            <div>
              <strong>{{ labels[item.table] }} · ID legacy {{ item.legacyId }}</strong>
              <p>
                Entrante: {{ item.name }} · Actual: {{ item.targetName }} (ID {{ item.targetId }})
              </p>
              <p class="legacy-hint">{{ item.message }}</p>
            </div>
            <label
              >Decisión para {{ labels[item.table] }} #{{ item.legacyId }}
              <select
                :value="decisions[item.key] || ''"
                :disabled="busy"
                @change="changeDecision(item.key, $event)"
              >
                <option value="">Selecciona una opción</option>
                <option value="keep" :disabled="!item.canKeep">Conservar el registro actual</option>
                <option value="reject">Rechazar el registro entrante</option>
                <option value="newid" :disabled="!item.canChangeId">Cambiar ID del entrante</option>
              </select>
            </label>
            <p v-if="!item.canChangeId" class="legacy-hint">
              Ya existe ese nombre de usuario o RFC. Cambiar solo el ID no resuelve esa duplicidad.
            </p>
            <p v-if="!item.canKeep" class="legacy-hint">
              No se puede conservar un destino inexistente o una cuenta desactivada.
            </p>
          </div>
        </div>
        <div v-if="Object.keys(decisions).length || decisionsChanged" class="legacy-actions">
          <button type="button" :disabled="busy" @click="analyze">Validar decisiones</button>
          <button type="button" :disabled="busy" @click="clearDecisions">Limpiar decisiones</button>
          <p v-if="decisionsChanged" role="status">
            Valida las decisiones para actualizar las cantidades y los registros dependientes antes
            de importar.
          </p>
        </div>
        <details v-if="preview.rejected?.length">
          <summary>Registros que se omitirán ({{ preview.rejected.length }})</summary>
          <ul>
            <li v-for="item in preview.rejected" :key="item.table + item.legacyId">
              {{ labels[item.table] }} #{{ item.legacyId }}: {{ item.reason }}
            </li>
          </ul>
        </details>
        <details v-if="preview.reuse.length">
          <summary>Revisar coincidencias con datos actuales ({{ preview.reuse.length }})</summary>
          <ul>
            <li v-for="item in preview.reuse" :key="item.table + item.legacyId">
              {{ labels[item.table] }}: {{ item.name }} · ID legacy {{ item.legacyId }} → ID actual
              {{ item.targetId }}. Se conservan los datos actuales.
            </li>
          </ul>
        </details>
        <ul class="legacy-hint">
          <li v-for="warning in preview.warnings" :key="warning">{{ warning }}</li>
        </ul>
        <p v-if="preview.ignoredTables.length">
          Tablas no importadas: {{ preview.ignoredTables.join(', ') }}.
        </p>
        <div v-if="preview.conflicts.length" class="legacy-error" role="alert">
          <strong>No se puede importar hasta resolver estos conflictos:</strong>
          <ul>
            <li v-for="conflict in preview.conflicts" :key="conflict">{{ conflict }}</li>
          </ul>
        </div>
        <p v-else-if="!pending" role="status">
          Todos los registros de este archivo ya están migrados.
        </p>
        <div v-else-if="!decisionsChanged" class="legacy-confirm">
          <label
            ><span>Para aplicar este análisis, escribe <strong>MIGRAR LEGACY</strong></span>
            <input
              v-model="confirmation"
              :disabled="busy"
              autocomplete="off"
              placeholder="MIGRAR LEGACY"
            />
          </label>
          <button
            type="button"
            class="legacy-primary"
            :disabled="busy || decisionsChanged || confirmation !== 'MIGRAR LEGACY'"
            @click="migrate"
          >
            Crear respaldo e importar
          </button>
        </div>
      </template>
      <div v-if="report" class="legacy-result" role="status">
        <h3>Migración completada</h3>
        <p>
          Respaldo previo: <strong>{{ report.backup }}</strong>
        </p>
        <p>
          Los datos ya están disponibles en la aplicación. Recarga las secciones abiertas para
          verlos.
        </p>
        <button type="button" @click="downloadReport">Descargar resultado de migración</button>
      </div>
    </div>
  </section>
</template>
<style scoped>
.legacy-migration {
  min-width: 0;
  margin-top: 1.5rem;
  margin-bottom: 0.5rem;
  background: var(--br-panel);
  color: var(--br-text);
  border: 1px solid var(--br-line);
  box-shadow: 8px 8px 0 var(--br-accent);
  font-family: var(--font-family);
}
.legacy-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  padding: 1.35rem;
  border-bottom: 2px solid var(--br-line-strong);
}
.legacy-heading p {
  margin: 0 0 0.5rem;
  color: var(--br-accent);
  font:
    800 0.68rem 'Courier New',
    monospace;
  letter-spacing: 0.1em;
}
h2 {
  margin: 0;
  font: 900 clamp(1.7rem, 3vw, 2.75rem)/0.95 var(--font-family);
  letter-spacing: -0.05em;
  text-transform: uppercase;
  text-wrap: balance;
}
.legacy-heading > i {
  display: grid;
  place-items: center;
  width: 3.5rem;
  height: 3.5rem;
  flex-shrink: 0;
  border: 1px solid var(--br-accent);
  background: var(--br-accent);
  color: var(--br-accent-text);
  font-size: 1.4rem;
}
.legacy-body {
  padding: 1.35rem;
  min-width: 0;
}
p,
li {
  line-height: 1.6;
}
p {
  margin: 0 0 0.75rem;
}
.legacy-intro {
  max-width: 80ch;
  font-size: 0.9rem;
}
.legacy-hint {
  color: var(--br-muted);
  font-size: 0.8rem;
  max-width: 100ch;
}
.legacy-steps {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  list-style: none;
  margin: 1.25rem 0;
  padding: 0;
  border: 1px solid var(--br-line-strong);
}
.legacy-steps li {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.8rem;
  background: var(--br-panel-2);
  color: var(--br-muted);
  font:
    800 0.7rem 'Courier New',
    monospace;
  text-transform: uppercase;
}
.legacy-steps li + li {
  border-left: 1px solid var(--br-line-strong);
}
.legacy-steps span {
  font-size: 1rem;
}
.legacy-steps .active {
  background: var(--br-accent);
  color: var(--br-accent-text);
}
label {
  display: grid;
  gap: 0.6rem;
  font:
    800 0.7rem/1.5 'Courier New',
    monospace;
  text-transform: uppercase;
  min-width: 0;
}
.legacy-file {
  padding: 1rem;
  border: 1px solid var(--br-line-strong);
  background: var(--br-panel-2);
  margin-block: 1rem;
}
input,
select {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  min-height: 2.8rem;
  padding: 0.7rem 0.8rem;
  background: var(--br-control);
  color: var(--br-control-text);
  border: 1px solid var(--br-line-strong);
  border-radius: 0;
  font: 700 0.8rem/1.4 var(--font-family);
}
input[type='file'] {
  padding: 0.4rem;
  font-size: 0.8rem;
}
input::file-selector-button {
  margin-right: 0.8rem;
  padding: 0.65rem 0.8rem;
  border: 1px solid var(--br-line-strong);
  border-radius: 0;
  background: var(--br-panel);
  color: var(--br-text);
  font:
    800 0.7rem 'Courier New',
    monospace;
  text-transform: uppercase;
  cursor: pointer;
}
button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  min-height: 2.8rem;
  padding: 0.7rem 1rem;
  border: 1px solid var(--br-line-strong);
  border-radius: 0;
  background: transparent;
  color: var(--br-text);
  font:
    800 0.72rem/1.4 'Courier New',
    monospace;
  text-transform: uppercase;
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s,
    transform 0.15s;
}
button:hover:not(:disabled) {
  background: var(--br-panel-2);
  border-color: var(--br-accent);
}
button:active:not(:disabled) {
  transform: translateY(1px);
}
button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
button:focus-visible,
input:focus-visible,
select:focus-visible,
summary:focus-visible {
  outline: 2px solid var(--br-accent);
  outline-offset: 3px;
}
.legacy-primary {
  background: var(--br-accent);
  color: var(--br-accent-text);
  border-color: var(--br-accent);
}
.legacy-primary:hover:not(:disabled) {
  background: var(--br-accent);
  color: var(--br-accent-text);
  box-shadow: 3px 3px 0 var(--br-line-strong);
}
.legacy-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  margin-block: 1rem;
}
.legacy-actions p {
  flex-basis: 100%;
  font:
    700 0.8rem/1.6 'Courier New',
    monospace;
  color: var(--br-muted);
}
.legacy-status,
.legacy-error {
  border: 1px solid var(--br-line-strong);
  border-left: 4px solid var(--br-accent);
  padding: 1rem;
  background: var(--br-panel-2);
  font:
    700 0.8rem/1.6 'Courier New',
    monospace;
  margin-block: 1rem;
}
.legacy-table {
  overflow-x: auto;
  margin-block: 1.5rem;
  border: 1px solid var(--br-line-strong);
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
  font-variant-numeric: tabular-nums;
}
caption {
  text-align: left;
  padding: 1rem;
  font: 900 1rem var(--font-family);
  text-transform: uppercase;
  border-bottom: 1px solid var(--br-line-strong);
}
th,
td {
  text-align: left;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid var(--br-line);
}
thead {
  background: var(--br-control);
  color: var(--br-control-text);
  font:
    800 0.68rem/1.4 'Courier New',
    monospace;
  text-transform: uppercase;
}
td {
  font-family: 'Courier New', monospace;
}
tbody tr:last-child > * {
  border-bottom: 0;
}
tbody tr:hover {
  background: var(--br-panel-2);
}
h3 {
  margin: 0 0 0.75rem;
  font: 900 1.15rem/1.1 var(--font-family);
  letter-spacing: -0.025em;
  text-transform: uppercase;
}
.legacy-conflicts {
  margin-top: 1.5rem;
}
.legacy-conflict-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(220px, 320px);
  align-items: start;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid var(--br-line-strong);
  background: var(--br-panel-2);
}
.legacy-conflict-row + .legacy-conflict-row {
  border-top: 0;
}
.legacy-conflict-row strong {
  font:
    800 0.8rem 'Courier New',
    monospace;
  text-transform: uppercase;
}
.legacy-conflict-row p {
  font-size: 0.82rem;
  overflow-wrap: anywhere;
  margin-top: 0.5rem;
}
.legacy-conflict-row > .legacy-hint {
  grid-column: 1/-1;
  margin: 0;
}
details {
  border-top: 1px solid var(--br-line-strong);
  padding: 1rem 0;
}
summary {
  cursor: pointer;
  font:
    800 0.75rem/1.5 'Courier New',
    monospace;
  text-transform: uppercase;
}
summary:hover {
  color: var(--br-accent);
}
ul {
  padding-left: 1.25rem;
  margin-block: 0.75rem;
}
li {
  padding-block: 0.15rem;
  overflow-wrap: anywhere;
}
.legacy-confirm {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 1rem;
  padding: 1.25rem;
  margin-top: 1.5rem;
  border: 1px solid var(--br-line-strong);
  border-top: 3px solid var(--br-accent);
  background: var(--br-panel-2);
}
.legacy-confirm label {
  flex: 1 1 20rem;
}
.legacy-confirm input {
  max-width: 30rem;
}
.legacy-result {
  border-top: 3px solid var(--br-accent);
  padding-top: 1.5rem;
  margin-top: 1.5rem;
  overflow-wrap: anywhere;
}
@media (max-width: 650px) {
  .legacy-body,
  .legacy-heading {
    padding: 1rem;
  }
  .legacy-heading > i {
    width: 2.75rem;
    height: 2.75rem;
  }
  .legacy-steps {
    grid-template-columns: 1fr;
  }
  .legacy-steps li + li {
    border-left: 0;
    border-top: 1px solid var(--br-line-strong);
  }
  .legacy-conflict-row {
    grid-template-columns: minmax(0, 1fr);
  }
  .legacy-confirm > * {
    width: 100%;
  }
  .legacy-confirm {
    padding: 1rem;
  }
  .legacy-actions > button {
    width: 100%;
  }
}
@media (prefers-reduced-motion: reduce) {
  button {
    transition: none;
  }
}
</style>
