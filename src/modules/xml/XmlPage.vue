<script setup lang="ts">
import LatticeLoader from '../../shared/vueBits/LatticeLoader.vue'
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { Upload, Eye, Download, Trash2, RotateCcw, X, FileSpreadsheet, CheckSquare, CloudDownload } from '@lucide/vue'
import { trashRetentionDays, type LocalXmlList, type LocalXmlRecord, type XmlImportSummary } from '../../../shared/contracts/localXml'
import { formatIssuedAt, formatPeriod, formatTotal, voucherTypeLabels } from './xmlLabels'
import XmlImportModal from './XmlImportModal.vue'
import ActionButton from '../../shared/components/ActionButton.vue'
import ListToolbar from '../../shared/components/ListToolbar.vue'
import FilterChips, { type ActiveFilterChip } from '../../shared/components/FilterChips.vue'
import SearchSelectField from '../../shared/components/SearchSelectField.vue'
import SelectField from '../../shared/components/SelectField.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import StatusBadge from '../../shared/components/StatusBadge.vue'
import { useNotifications } from '../../shared/notifications/notificationStore'
import type { CfdiAnalysis } from '../../../shared/contracts/cfdi'
import type { AssignedClient, ClientSummary } from '../../../shared/contracts/clients'
import { workspaceAccess } from '../workspace/sessionState'
import CfdiFiscalDetail from './CfdiFiscalDetail.vue'
import FormModal from '../../shared/components/FormModal.vue'
import CreateReportForm from '../reports/CreateReportForm.vue'
import SatDownloadPanel from '../satDownloads/SatDownloadPanel.vue'
import { buildClientRfcIndex, cfdiDirectionLabels, matchCfdiClient } from './cfdiClientMatch'
import { StaggeredEntrance } from '../../shared/motion/staggeredEntrance'
import HoldButton from '../../shared/vueBits/HoldButton.vue'

/**
 * Biblioteca XML LOCAL de este equipo. La vista no ve rutas ni archivos: pide a Main listar,
 * importar, leer, analizar, copiar y mover a la papelera. Los XML de la papelera se borran
 * definitivamente a los 30 días.
 *
 * 6.1: cada CFDI se asocia a un cliente asignado por RFC (emitido o recibido) y "Datos fiscales"
 * muestra el análisis que calcula Main (totales, impuestos, conceptos, pagos y avisos). Nada se envía
 * al Host: los datos fiscales sólo saldrán al relacionar el CFDI con un reporte (6.2).
 */
const { notify } = useNotifications()
const view = ref<'active' | 'trash'>('active'), rfc = ref(''), period = ref(''), search = ref('')
const list = ref<LocalXmlList | null>(null), selected = ref<string[]>([])
const isLoading = ref(false), isWorking = ref(false), error = ref('')
const viewer = ref<{ record: LocalXmlRecord; content: string; analysis: CfdiAnalysis | null; tab: 'fiscal' | 'xml' } | null>(null)
/** RFC → cliente asignado; vacío sin permiso para consultar clientes (los CFDI se ven "Sin cliente"). */
const clientIndex = ref(new Map<string, { clientId: string; clientName: string }>())
/** 6.2: los CFDI elegidos se relacionan con un reporte; al guardarlo la página muestra Reportes. */
const emit = defineEmits<{ reportSaved: [] }>()
const isReportOpen = ref(false)
/** Filtros en un modal (2026-10-04): Mostrar, RFC y Periodo; la búsqueda queda a la vista. */
const isFilterOpen = ref(false)
/**
 * Filtros activos como chips (2026-10-06) bajo la barra; el contador de "Filtros" se deriva de la misma lista.
 * Quitar "Mostrar" vuelve a la Biblioteca con `changeView` (que limpia selección y visor y recarga); quitar RFC o
 * Periodo recarga desde Main como "Aplicar filtros". `viewOptions` y `periodOptions` dan los textos legibles.
 */
const activeFilterChips = computed<ActiveFilterChip[]>(() => [
  ...(view.value !== 'active' ? [{ filterId: 'view', label: 'Mostrar', value: viewOptions.find(option => option.value === view.value)?.label ?? view.value }] : []),
  ...(rfc.value ? [{ filterId: 'rfc', label: 'RFC', value: rfc.value }] : []),
  ...(period.value ? [{ filterId: 'period', label: 'Periodo', value: formatPeriod(period.value) }] : [])
])
const activeFilterCount = computed(() => activeFilterChips.value.length)
function applyFilters(): void { isFilterOpen.value = false; void load() }
function clearFilters(): void { rfc.value = ''; period.value = ''; if (view.value !== 'active') changeView('active') }
function removeFilter(filterId: string): void {
  if (filterId === 'view') { changeView('active'); return }
  if (filterId === 'rfc') rfc.value = ''
  if (filterId === 'period') period.value = ''
  void load()
}
/** "Quitar todos": `clearFilters` sólo recarga si cambia la vista; en la Biblioteca se recarga aquí. */
function clearAppliedFilters(): void {
  const isShowingTrash = view.value !== 'active'
  clearFilters()
  if (!isShowingTrash) void load()
}
/** 6.3: clientes con escritura y RFC para la descarga del SAT; al cerrar el modal se recarga la biblioteca. */
const isSatOpen = ref(false), satClients = ref<Array<{ clientId: string; clientName: string }>>([])
function closeSat(): void { isSatOpen.value = false; void load() }
const selectedRecords = computed(() => records.value.filter(record => selected.value.includes(record.uuid)))
function selectVisible(): void { selected.value = records.value.map(record => record.uuid) }
function finishReport(): void { isReportOpen.value = false; selected.value = []; emit('reportSaved') }
const listElement = ref<HTMLElement | null>(null)
const viewOptions = [{ value: 'active', label: 'Biblioteca' }, { value: 'trash', label: 'Papelera (' + trashRetentionDays + ' días)' }]
const rfcOptions = computed(() => (list.value?.rfcs ?? []).map(value => ({ value, label: value })))
const periodOptions = computed(() => [{ value: '', label: 'Todos los periodos' }, ...(list.value?.periods ?? []).map(value => ({ value, label: formatPeriod(value) }))])
const records = computed(() => list.value?.records ?? [])
/** Entrada escalonada de la biblioteca tras cada consulta. */
const rowEntrance = new StaggeredEntrance({ selector: '.xml-row', distancePixels: 6, staggerSeconds: .012 })
let isMounted = true

async function load(keepError = ''): Promise<void> {
  isLoading.value = true; error.value = keepError
  try {
    const result = await window.contapp.listLocalXml({ view: view.value, rfc: rfc.value || null, period: period.value || null, search: search.value.trim() })
    if (!isMounted) return
    list.value = result; selected.value = selected.value.filter(uuid => result.records.some(item => item.uuid === uuid))
    if (rfc.value && !result.rfcs.includes(rfc.value)) rfc.value = ''
    void rowEntrance.play(() => listElement.value)
  } catch { if (isMounted) { list.value = null; error.value = 'No se pudo consultar la biblioteca XML de este equipo. Si persiste, la clave protegida del equipo no está disponible.' } }
  finally { isLoading.value = false }
}
function changeView(value: string): void { view.value = value as 'active' | 'trash'; selected.value = []; viewer.value = null; void load() }
/** Modal "Importar XML" (XmlImportModal): muestra el resultado por archivo; al cerrarlo se recarga la biblioteca. */
const isImportOpen = ref(false)
function announceImport(importSummary: XmlImportSummary): void {
  // Lleva a la Biblioteca XML (Fiscal abre el cajón): útil si el aviso se activa desde otra sección.
  notify('Importación terminada', importSummary.imported + ' nuevo(s), ' + importSummary.duplicates + ' ya existían, ' + importSummary.conflicts + ' en conflicto y ' + importSummary.rejected + ' rechazado(s).', importSummary.imported ? 'success' : 'info',
    { target: { section: 'fiscal', view: 'library', label: 'la Biblioteca XML' } })
  view.value = 'active'
}
function closeImport(): void { isImportOpen.value = false; void load() }
/** Clientes asignados por páginas de 50 (con tope), sólo para asociar por RFC; el Host filtra por asignación. */
async function loadClientIndex(): Promise<void> {
  if (!workspaceAccess.value.canReadClients) return
  const clients: AssignedClient[] = [], summaries: ClientSummary[] = []
  let afterClientId: string | null = null
  try {
    for (let page = 0; page < 40; page++) {
      const result = await window.contapp.manageClients({ action: 'list', afterClientId })
      clients.push(...result.clients); summaries.push(...(result.summaries ?? []))
      afterClientId = result.nextClientId
      if (!afterClientId) break
    }
    if (isMounted) {
      clientIndex.value = buildClientRfcIndex(clients, summaries)
      const rfcs = new Map(summaries.map(summary => [summary.clientId, summary.rfc]))
      satClients.value = clients.filter(client => client.access === 'readWrite' && client.isActive && rfcs.get(client.clientId)).map(client => ({ clientId: client.clientId, clientName: client.displayName }))
    }
  } catch { /* Sin clientes la biblioteca funciona igual; los CFDI se muestran "Sin cliente". */ }
}
function clientOf(record: LocalXmlRecord) { return matchCfdiClient(record, clientIndex.value) }
/** El XML y su análisis se piden juntos; si el análisis falla, el XML se muestra igual con un aviso. */
async function openViewer(record: LocalXmlRecord): Promise<void> {
  error.value = ''
  try {
    const [content, analysis] = await Promise.all([window.contapp.readLocalXml(record.uuid), window.contapp.analyzeLocalXml(record.uuid).catch(() => null)])
    viewer.value = { record, content, analysis, tab: analysis ? 'fiscal' : 'xml' }
  } catch { error.value = 'No se pudo leer el XML: el archivo cifrado falta o está dañado.' }
}
async function saveCopy(record: LocalXmlRecord): Promise<void> {
  try { if (await window.contapp.saveLocalXmlCopy(record.uuid) === 'saved') notify('Copia guardada', 'El XML se guardó donde elegiste; esa copia no está cifrada.', 'success') }
  catch { error.value = 'No se guardó la copia. Revisa la carpeta elegida.' }
}
/** Confirmado al mantener presionado (Hold Button); la notificación recuerda los días para restaurar. */
async function moveToTrash(uuids: string[]): Promise<void> {
  if (!uuids.length) return
  isWorking.value = true
  // Copia plana: un arreglo reactivo de Vue no cruza contextBridge.
  try { const count = await window.contapp.trashLocalXml([...uuids]); notify('Movido a la papelera', count + ' XML. Puedes restaurarlos durante ' + trashRetentionDays + ' días.', 'success'); selected.value = []; viewer.value = null; await load() }
  catch { await load('No se movieron los XML a la papelera.') }
  finally { isWorking.value = false }
}
async function restore(uuids: string[]): Promise<void> {
  isWorking.value = true
  try { const count = await window.contapp.restoreLocalXml([...uuids]); notify('Restaurado', count + ' XML de vuelta en la biblioteca.', 'success'); selected.value = []; await load() }
  catch { await load('No se restauraron los XML.') }
  finally { isWorking.value = false }
}
function toggle(uuid: string, isChecked: boolean): void { selected.value = isChecked ? [...new Set([...selected.value, uuid])] : selected.value.filter(item => item !== uuid) }
function daysLeft(record: LocalXmlRecord): number { return Math.max(0, trashRetentionDays - Math.floor((Date.now() - Date.parse(record.trashedAt ?? '')) / 86400000)) }

onMounted(() => { void load(); void loadClientIndex() })
onBeforeUnmount(() => { isMounted = false; rowEntrance.dispose(); viewer.value = null; list.value = null })
</script>

<template>
  <section data-testid="xml-page">
    <div class="section-heading">
      <h2>Biblioteca XML de este equipo</h2>
      <div class="actions">
        <ActionButton
          v-if="workspaceAccess.canDownloadSat"
          @click="isSatOpen = true"
        >
          <CloudDownload
            :size="18"
            aria-hidden="true"
          /> Descargar del SAT
        </ActionButton>
        <ActionButton
          variant="primary"
          @click="isImportOpen = true"
        >
          <Upload
            :size="18"
            aria-hidden="true"
          /> Importar XML o ZIP
        </ActionButton>
      </div>
    </div>
    <p class="lede">
      CFDI guardados cifrados sólo en este equipo. Otros equipos no los ven ni se envían al Host.
    </p>

    <InlineNotice
      v-if="error"
      title="Operación no completada"
      tone="error"
    >
      <p>{{ error }}</p>
    </InlineNotice>
    <XmlImportModal
      :is-open="isImportOpen"
      @imported="announceImport"
      @close="closeImport"
    />

    <FormModal
      :is-open="isFilterOpen"
      title="Filtros"
      description="Elige qué XML ver. La búsqueda sigue arriba."
      test-id="xml-filter-modal"
      @close="isFilterOpen = false"
    >
      <form
        class="xml-filter-form"
        aria-label="Filtros de XML"
        @submit.prevent="applyFilters"
      >
        <SelectField
          id="xml-view"
          :model-value="view"
          label="Mostrar"
          :options="viewOptions"
          :disabled="isLoading"
          @update:model-value="changeView"
        />
        <SearchSelectField
          id="xml-rfc"
          v-model="rfc"
          placeholder="RFC"
          empty-label="Todos los RFC"
          label="RFC emisor o receptor"
          :options="rfcOptions"
          :disabled="isLoading"
        />
        <SelectField
          id="xml-period"
          v-model="period"
          label="Periodo"
          :options="periodOptions"
          :disabled="isLoading"
        />
        <div class="actions form-footer">
          <ActionButton
            type="submit"
            variant="primary"
            :is-loading="isLoading"
          >
            Aplicar filtros
          </ActionButton>
          <ActionButton
            :disabled="isLoading"
            @click="clearFilters"
          >
            Limpiar
          </ActionButton>
        </div>
      </form>
    </FormModal>

    <FormModal
      :is-open="isSatOpen"
      title="Descargar CFDI del SAT"
      description="Con la e.firma del cliente guardada en este equipo; los XML entran a esta biblioteca."
      test-id="sat-modal"
      @close="closeSat"
    >
      <SatDownloadPanel :clients="satClients" />
    </FormModal>

    <FormModal
      :is-open="isReportOpen"
      title="Guardar reporte"
      description="Los CFDI seleccionados forman un reporte mensual o anual de su cliente."
      test-id="report-modal"
      @close="isReportOpen = false"
    >
      <CreateReportForm
        :records="selectedRecords"
        :client-index="clientIndex"
        @saved="finishReport"
        @cancel="isReportOpen = false"
      />
    </FormModal>

    <LatticeLoader
      v-if="isWorking"
      label="Procesando XML en este equipo"
    />

    <div
      v-if="viewer"
      class="surface-panel xml-viewer"
      data-testid="xml-viewer"
    >
      <div class="section-heading">
        <h2>{{ viewer.record.uuid.toUpperCase() }}</h2>
        <ActionButton
          aria-label="Cerrar XML"
          @click="viewer = null"
        >
          <X
            :size="16"
            aria-hidden="true"
          /> Cerrar
        </ActionButton>
      </div>
      <div
        v-sliding-tabs
        class="xml-tabs segmented-tabs"
        role="tablist"
        aria-label="Vista del CFDI"
      >
        <button
          role="tab"
          type="button"
          :aria-selected="viewer.tab === 'fiscal'"
          :disabled="!viewer.analysis"
          @click="viewer.tab = 'fiscal'"
        >
          Datos fiscales
        </button><button
          role="tab"
          type="button"
          :aria-selected="viewer.tab === 'xml'"
          @click="viewer.tab = 'xml'"
        >
          XML
        </button>
      </div>
      <p
        v-if="!viewer.analysis"
        class="field-help"
      >
        No se pudo analizar este XML; se muestra tal como está guardado.
      </p>
      <CfdiFiscalDetail
        v-if="viewer.analysis && viewer.tab === 'fiscal'"
        :analysis="viewer.analysis"
        :client-match="clientOf(viewer.record)"
      />
      <pre
        v-else
        tabindex="0"
      >{{ viewer.content }}</pre>
    </div>

    <!-- Mismo marco que Clientes y Pagos: barra arriba, lista y conteo al pie. -->
    <div class="table-panel xml-panel">
      <!-- Barra común (ListToolbar): busca en Main al dejar de escribir (400 ms) o con Enter; las acciones de la
         selección aparecen en la misma fila sólo cuando hay XML elegidos. -->
      <ListToolbar
        v-model:search="search"
        class="table-toolbar"
        search-id="xml-search"
        search-label="Buscar XML"
        placeholder="UUID, RFC o nombre"
        :filter-count="activeFilterCount"
        :search-delay-milliseconds="400"
        :is-busy="isLoading"
        @search="load()"
        @open-filters="isFilterOpen = true"
      >
        <template #actions>
          <ActionButton
            v-if="records.length && view === 'active' && selected.length < records.length"
            @click="selectVisible"
          >
            <CheckSquare
              :size="16"
              aria-hidden="true"
            /> Seleccionar visibles
          </ActionButton>
          <ActionButton
            v-if="selected.length && view === 'active' && workspaceAccess.canManageReports"
            variant="primary"
            :disabled="isWorking"
            @click="isReportOpen = true"
          >
            <FileSpreadsheet
              :size="16"
              aria-hidden="true"
            /> Crear reporte ({{ selected.length }})
          </ActionButton>
          <HoldButton
            v-if="selected.length && view === 'active'"
            :is-disabled="isWorking"
            done-label="En la papelera"
            @hold="moveToTrash([...selected])"
          >
            <template #icon>
              <Trash2
                :size="16"
                aria-hidden="true"
              />
            </template>
            Mover {{ selected.length }} a la papelera
          </HoldButton>
          <ActionButton
            v-if="selected.length && view === 'trash'"
            :disabled="isWorking"
            @click="restore([...selected])"
          >
            <RotateCcw
              :size="16"
              aria-hidden="true"
            /> Restaurar {{ selected.length }}
          </ActionButton>
        </template>
      </ListToolbar>
      <FilterChips
        :chips="activeFilterChips"
        fallback-focus-id="xml-search"
        @remove="removeFilter"
        @clear="clearAppliedFilters"
      />
      <ul
        ref="listElement"
        class="xml-list"
        aria-label="XML"
      >
        <li
          v-for="record in records"
          :key="record.uuid"
          class="xml-row"
        >
          <input
            type="checkbox"
            :aria-label="'Seleccionar ' + record.uuid"
            :checked="selected.includes(record.uuid)"
            @change="toggle(record.uuid, ($event.target as HTMLInputElement).checked)"
          >
          <div class="xml-details">
            <h2>{{ record.issuerName || record.issuerRfc }} → {{ record.receiverName || record.receiverRfc }}</h2>
            <p class="field-help">
              {{ formatIssuedAt(record.issuedAt) }} · {{ record.issuerRfc }} → {{ record.receiverRfc }} · CFDI {{ record.version }}
            </p>
            <p class="field-help xml-uuid">
              {{ record.uuid.toUpperCase() }}
            </p>
            <p
              class="field-help xml-client"
              data-testid="xml-client"
            >
              {{ clientOf(record) ? 'Cliente: ' + clientOf(record)!.clientName + ' · ' + cfdiDirectionLabels[clientOf(record)!.direction] : 'Sin cliente' }}
            </p>
            <p
              v-if="record.trashedAt"
              class="field-help"
            >
              Se borrará definitivamente en {{ daysLeft(record) }} día(s).
            </p>
          </div>
          <div class="xml-amount">
            <StatusBadge :tone="record.voucherType === 'E' ? 'warning' : record.voucherType === 'I' ? 'success' : 'info'">
              {{ voucherTypeLabels[record.voucherType] }}
            </StatusBadge>
            <strong class="numeric">{{ formatTotal(record.total, record.currency) }}</strong>
          </div>
          <div class="actions xml-actions">
            <ActionButton
              :aria-label="'Ver ' + record.uuid"
              @click="openViewer(record)"
            >
              <Eye
                :size="15"
                aria-hidden="true"
              /> Ver
            </ActionButton>
            <ActionButton
              :aria-label="'Guardar copia de ' + record.uuid"
              @click="saveCopy(record)"
            >
              <Download
                :size="15"
                aria-hidden="true"
              /> Copia
            </ActionButton>
            <!-- Mismo alto que Ver y Copia (2026-10-10): sin size="small" para que la fila no quede dispareja. -->
            <HoldButton
              v-if="!record.trashedAt"
              :is-disabled="isWorking"
              :aria-label="'Mover a la papelera ' + record.uuid"
              done-label="Movido"
              @hold="moveToTrash([record.uuid])"
            >
              <template #icon>
                <Trash2
                  :size="15"
                  aria-hidden="true"
                />
              </template>
              Papelera
            </HoldButton>
            <ActionButton
              v-else
              :disabled="isWorking"
              :aria-label="'Restaurar ' + record.uuid"
              @click="restore([record.uuid])"
            >
              <RotateCcw
                :size="15"
                aria-hidden="true"
              /> Restaurar
            </ActionButton>
          </div>
        </li>
      </ul>
      <p
        v-if="list && !records.length && !isLoading"
        class="xml-empty"
      >
        {{ view === 'trash' ? 'La papelera está vacía.' : 'Todavía no hay XML en este equipo. Importa archivos XML o el ZIP que descargas del SAT.' }}
      </p>
      <p
        v-if="list"
        class="table-footer"
        role="status"
        data-testid="xml-count"
      >
        {{ list.totalCount }} XML{{ list.isTruncated ? '; se muestran los 500 más recientes, filtra por RFC o periodo' : '' }}.
      </p>
    </div>
  </section>
</template>

<style scoped>
.xml-filter-form { display: grid; gap: var(--spaceMedium); }
.xml-list { list-style: none; margin: 0; padding: 0; border-top: 2px solid var(--borderColor); }
.xml-panel .table-footer { margin: 0; }
.xml-row { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: var(--spaceMedium); align-items: center; padding: var(--spaceMedium) 20px; border-bottom: 1px solid var(--hairlineColor); }
.xml-row > input { align-self: start; margin-top: 2px; }
.xml-details { min-width: 0; display: grid; gap: 4px; overflow-wrap: anywhere; }
.xml-details h2 { font-size: 15px; margin: 0; }
.xml-uuid { font-family: var(--monoFontFamily); font-size: 12px; }
.xml-amount { display: grid; justify-items: end; gap: 6px; }
.xml-amount strong { font-size: 16px; font-variant-numeric: tabular-nums; }
.xml-actions { grid-column: 2 / -1; justify-content: flex-end; }
.xml-viewer { margin: var(--spaceMedium) 0; min-width: 0; }
.xml-viewer h2 { font-size: 14px; font-family: var(--monoFontFamily); overflow-wrap: anywhere; margin: 0; }
.xml-tabs { margin: var(--spaceMedium) 0; }
.xml-tabs button:disabled { opacity: .5; cursor: not-allowed; }
.xml-client { margin: 4px 0 0; }
.xml-viewer pre { max-height: 420px; overflow: auto; margin: var(--spaceMedium) 0 0; padding: var(--spaceMedium); border: 2px solid var(--borderColor); background: var(--subtleColor); font-size: 12px; white-space: pre-wrap; overflow-wrap: anywhere; border-radius: var(--radiusNested); }
.xml-empty { margin: 0; padding: var(--spaceLarge) 20px; }
@container (max-width: 640px) {
  .xml-row { grid-template-columns: auto minmax(0, 1fr); }
  .xml-amount { grid-column: 2; justify-items: start; }
  .xml-actions { grid-column: 1 / -1; justify-content: flex-start; }
}
</style>
