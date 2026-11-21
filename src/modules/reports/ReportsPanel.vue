<script setup lang="ts">
import { handlePdfResult } from '../../shared/pdf/pdfViewerState'
import HoldButton from '../../shared/vueBits/HoldButton.vue'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ArrowLeft, Download, FileSpreadsheet, FileText, RefreshCw, Trash2, X } from '@lucide/vue'
import type { FiscalReportDetail, FiscalReportDocument, FiscalReportRequest, FiscalReportResult, FiscalReportSummary } from '../../../shared/contracts/fiscalReports'
import type { AssignedClient } from '../../../shared/contracts/clients'
import ActionButton from '../../shared/components/ActionButton.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import SelectField from '../../shared/components/SelectField.vue'
import SearchSelectField from '../../shared/components/SearchSelectField.vue'
import StatusBadge from '../../shared/components/StatusBadge.vue'
import { useNotifications } from '../../shared/notifications/notificationStore'
import { readIpcErrorMessage } from '../../shared/ipcErrorMessage'
import { StaggeredEntrance } from '../../shared/motion/staggeredEntrance'
import { formatMoney } from '../../../shared/presentation/movementLabels'
import { formatIssuedAt } from '../xml/xmlLabels'
import { formatReportPeriod, reportDirectionLabels } from './reportLabels'
import DiotPanel from './DiotPanel.vue'

/**
 * Reportes fiscales GLOBAL (6.2): lista por ejercicio y cliente, y el detalle de un reporte con sus
 * totales en MXN (los egresos restan), sus CFDI y en qué equipos está cada XML. Retirar y eliminar
 * envían la revisión vigente; si otro equipo cambió el reporte, el Host lo rechaza y la vista recarga.
 * Un reporte mensual de recibidas muestra además su DIOT.
 *
 * Desde el rediseño vive en el cajón "Reportes guardados" de Fiscal y, como el original, la lista es un
 * calendario del ejercicio: un renglón anual y uno por mes con sus reportes de emitidas y recibidas; el
 * mensual de recibidas ofrece además su DIOT. Abrir un reporte muestra su detalle dentro del cajón.
 *
 * Fiscal por cliente (2026-10-04): con `clientId` y `fiscalYear` fijos (los elige la página de Fiscal) se ocultan
 * los filtros y el calendario es sólo de ese cliente. Cada periodo ofrece su PDF (el mensual junta emitidas y
 * recibidas, como el "PDF conjunto" del original) y el detalle ofrece Ver PDF y Guardar PDF.
 *
 * Encabezado del detalle (2026-10-10, pedido del usuario: "acomoda mejor los botones"): fila de título con "Reportes"
 * (volver) a la izquierda; debajo, una barra de acciones agrupada —PDF (Ver/Guardar) como un bloque, Exportar CSV y,
 * separado al final, el Hold Button destructivo—; y las pestañas "CFDI y totales | DIOT" a todo lo ancho bajo una línea.
 * En el cajón angosto la barra se reacomoda en renglones parejos (consulta de contenedor del cuerpo del cajón).
 *
 * Exportar (2026-10-13): Excel con el diseño de la app y CSV para otros sistemas, unidos como el bloque de PDF.
 *
 * `requestedReport` (2026-10-10): reporte que se abre al montarse o al cambiar, por un aviso "Reporte guardado".
 */
const props = defineProps<{ clientId?: string | null; fixedYear?: number; requestedReport?: { reportId: string; requestId: number } | null }>()
const { notify } = useNotifications()
const currentYear = new Date().getFullYear()
const fiscalYear = ref(String(currentYear)), clientFilter = ref('')
const reports = ref<FiscalReportSummary[]>([]), clients = ref<AssignedClient[]>([])
const detail = ref<FiscalReportDetail | null>(null)
const isLoading = ref(false), isWorking = ref(false), error = ref('')

const tab = ref<'documents' | 'diot'>('documents')
const listElement = ref<HTMLElement | null>(null)
const rowEntrance = new StaggeredEntrance({ selector: '.report-row', distancePixels: 6, staggerSeconds: .015 })
let isMounted = true
const monthLabels = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
/** Renglones del calendario: el anual (mes 0) y los doce meses, con los reportes de cada uno. */
const calendarRows = computed(() => [
  { key: 'annual', label: 'Anual', reports: reports.value.filter(report => report.reportType === 'annual') },
  ...monthLabels.map((label, index) => ({ key: 'month-' + (index + 1), label, reports: reports.value.filter(report => report.reportType === 'monthly' && report.fiscalMonth === index + 1) }))
])
const yearOptions = [...Array(8).keys()].map(offset => ({ value: String(currentYear - offset), label: String(currentYear - offset) }))
const clientOptions = computed(() => clients.value.map(client => ({ value: client.clientId, label: client.displayName })))
const totalRows = computed(() => {
  const totals = detail.value?.totals
  if (!totals) return []
  return ([['Subtotal', totals.subtotal], ['Descuento', totals.discount], ['Base IVA 16 %', totals.vatBase16], ['IVA 16 %', totals.vat16], ['Base IVA 8 %', totals.vatBase8], ['IVA 8 %', totals.vat8],
    ['Base 0 %', totals.vatBase0], ['Exento', totals.exemptBase], ['No objeto', totals.notSubjectBase], ['IVA retenido', totals.vatWithheld], ['ISR retenido', totals.isrWithheld], ['IEPS retenido', totals.iepsWithheld], ['Total', totals.total]] as Array<[string, string]>)
    .filter(([label, amount]) => label === 'Total' || amount !== '0.00')
})

async function operate(request: FiscalReportRequest): Promise<FiscalReportResult> {
  // Copia plana: los proxies reactivos de Vue no cruzan contextBridge.
  return window.contapp.manageFiscalReports(JSON.parse(JSON.stringify(request)) as FiscalReportRequest)
}
async function load(): Promise<void> {
  isLoading.value = true; error.value = ''
  try {
    const result = await operate({ action: 'list', clientId: props.clientId ?? (clientFilter.value || null), fiscalYear: props.fixedYear ?? Number(fiscalYear.value) })
    if (result.status === 'listed' && isMounted) { reports.value = result.reports; void rowEntrance.play(() => listElement.value) }
  } catch (caught) { if (isMounted) { reports.value = []; error.value = readIpcErrorMessage(caught, 'No se pudieron consultar los reportes.') } }
  finally { isLoading.value = false }
}
async function loadClients(): Promise<void> {
  try { clients.value = (await window.contapp.manageClients({ action: 'list', afterClientId: null })).clients } catch { clients.value = [] }
}
async function open(reportId: string, initialTab: 'documents' | 'diot' = 'documents'): Promise<void> {
  tab.value = initialTab
  error.value = ''
  try {
    const result = await operate({ action: 'get', reportId })
    if (result.status === 'detail' && isMounted) { detail.value = result.detail; if (!result.detail.hasDiot) tab.value = 'documents' }
  } catch (caught) { error.value = readIpcErrorMessage(caught, 'No se pudo abrir el reporte.'); detail.value = null; await load() }
}
/** Confirmado al mantener presionado (Hold Button). Si era el último CFDI, el Host elimina el reporte. */
async function confirmRemoval(document: FiscalReportDocument): Promise<void> {
  const report = detail.value?.report
  if (!document || !report) return
  isWorking.value = true
  try {
    const result = await operate({ action: 'removeDocument', reportId: report.reportId, revision: report.revision, uuid: document.uuid })
    notify('CFDI retirado', result.status === 'removed' && result.isReportDeleted ? 'El reporte se eliminó porque quedó vacío.' : 'Se retiró del reporte; el XML sigue en su equipo.', 'success')
    if (result.status === 'removed' && result.isReportDeleted) { detail.value = null; await load() } else await open(report.reportId)
  } catch (caught) { error.value = readIpcErrorMessage(caught, 'No se retiró el CFDI.'); await open(report.reportId) }
  finally { isWorking.value = false }
}
async function confirmDelete(): Promise<void> {
  const report = detail.value?.report
  if (!report) return
  isWorking.value = true
  try {
    await operate({ action: 'delete', reportId: report.reportId, revision: report.revision })
    notify('Reporte eliminado', report.displayName + '. Los XML siguen en sus equipos.', 'success')
    detail.value = null; await load()
  } catch (caught) { error.value = readIpcErrorMessage(caught, 'No se eliminó el reporte.'); await open(report.reportId) }
  finally { isWorking.value = false }
}
async function exportCsv(): Promise<void> {
  const report = detail.value?.report
  if (!report) return
  try { if (await window.contapp.exportReportCsv(report.reportId) === 'saved') notify('Reporte exportado', 'El CSV se guardó donde elegiste.', 'success') }
  catch (caught) { error.value = readIpcErrorMessage(caught, 'No se exportó el reporte.') }
}
/** Excel con el diseño de la app (2026-10-13): Main lo arma con los datos vigentes del Host. */
async function exportXlsx(): Promise<void> {
  const report = detail.value?.report
  if (!report) return
  try { if (await window.contapp.exportReportXlsx(report.reportId) === 'saved') notify('Reporte exportado', 'El Excel se guardó donde elegiste.', 'success') }
  catch (caught) { error.value = readIpcErrorMessage(caught, 'No se exportó el reporte.') }
}
/** PDF de un periodo (uno o dos reportes del mismo tipo y periodo) o del reporte abierto. */
async function openPdf(reportIds: string[], action: 'preview' | 'save'): Promise<void> {
  error.value = ''
  // "Ver" abre el visor de Fiscenix; "Guardar" pide destino en Main.
  try { if (handlePdfResult(await window.contapp.openReportPdf({ reportIds: reportIds.slice(0, 2), action }))) notify('PDF guardado', 'El PDF del reporte se guardó donde elegiste.', 'success') }
  catch (caught) { error.value = readIpcErrorMessage(caught, 'No se generó el PDF del reporte.') }
}
watch(() => [props.clientId, props.fixedYear], () => { detail.value = null; void load() })
function availabilityText(document: FiscalReportDocument): string {
  if (document.availability.some(item => item.isThisDevice)) return 'En este equipo'
  return document.availability.length ? 'Sólo en ' + document.availability.map(item => item.deviceAlias).join(', ') : 'Sin XML registrado'
}

defineExpose({ load })
onMounted(() => { void load(); void loadClients() })
watch(() => props.requestedReport?.requestId, () => { if (props.requestedReport) void open(props.requestedReport.reportId) }, { immediate: true })
onBeforeUnmount(() => { isMounted = false; rowEntrance.dispose(); detail.value = null; reports.value = [] })
</script>
<template>
  <section
    class="reports-panel"
    data-testid="reports-panel"
  >
    <InlineNotice
      v-if="error"
      title="Operación no confirmada"
      tone="error"
    >
      <p>{{ error }}</p>
    </InlineNotice>

    <template v-if="!detail">
      <form
        v-if="!clientId"
        class="table-toolbar reports-filters"
        role="search"
        aria-label="Filtrar reportes"
        @submit.prevent="load"
      >
        <SelectField
          id="reports-year"
          v-model="fiscalYear"
          label="Ejercicio"
          :options="yearOptions"
        />
        <SearchSelectField
          id="reports-client"
          v-model="clientFilter"
          placeholder="Nombre del cliente"
          empty-label="Todos los clientes"
          label="Cliente"
          :options="clientOptions"
        />
        <ActionButton
          type="submit"
          :is-loading="isLoading"
        >
          <RefreshCw
            :size="16"
            aria-hidden="true"
          /> Consultar
        </ActionButton>
      </form>
      <ol
        ref="listElement"
        class="report-calendar"
        aria-label="Reportes guardados por periodo"
      >
        <li
          v-for="row in calendarRows"
          :key="row.key"
          class="report-row"
          :class="{ 'is-annual': row.key === 'annual' }"
        >
          <span class="report-period">{{ row.label }}</span>
          <span class="report-chips">
            <template
              v-for="report in row.reports"
              :key="report.reportId"
            >
              <button
                type="button"
                class="report-chip"
                :class="report.direction === 'issued' ? 'is-issued' : 'is-received'"
                :aria-label="'Abrir reporte ' + report.displayName"
                :title="report.clientDisplayName + ' · ' + report.documentCount + ' CFDI'"
                @click="open(report.reportId)"
              >
                {{ reportDirectionLabels[report.direction] }}<span v-if="!clientFilter && !clientId"> · {{ report.clientDisplayName }}</span>
              </button>
              <button
                v-if="report.reportType === 'monthly' && report.direction === 'received'"
                type="button"
                class="report-chip is-diot"
                :aria-label="'Abrir DIOT de ' + report.displayName"
                @click="open(report.reportId, 'diot')"
              >
                DIOT
              </button>
            </template>
            <span
              v-if="!row.reports.length"
              class="field-help"
            >{{ row.key === 'annual' ? 'Sin reporte anual' : 'Sin corte' }}</span>
            <button
              v-if="row.reports.length && clientId"
              type="button"
              class="report-chip is-pdf"
              :aria-label="'PDF de ' + row.label"
              @click="openPdf(row.reports.map(report => report.reportId), 'preview')"
            >
              <FileText
                :size="13"
                aria-hidden="true"
              /> PDF
            </button>
          </span>
        </li>
      </ol>
      <p class="field-help">
        {{ isLoading ? 'Consultando reportes…' : reports.length + ' reporte(s) en ' + (fixedYear ?? fiscalYear) + '. Selecciona CFDI en la tabla y usa Crear reporte para agregar.' }}
      </p>
    </template>

    <template v-else>
      <header
        class="report-detail-header"
        data-testid="report-detail"
      >
        <div class="report-title-row">
          <ActionButton
            class="report-back"
            aria-label="Volver a reportes"
            @click="detail = null; load()"
          >
            <ArrowLeft
              :size="16"
              aria-hidden="true"
            /> Reportes
          </ActionButton>
          <div class="report-title">
            <h2>{{ detail.report.displayName }}</h2>
            <p class="heading-meta">
              {{ detail.report.clientDisplayName }} · {{ reportDirectionLabels[detail.report.direction] }} · {{ formatReportPeriod(detail.report) }}
            </p>
          </div>
        </div>
        <!-- Barra de acciones: PDF agrupado, exportar (Excel/CSV) agrupado y, aparte al final, eliminar (Hold Button). -->
        <div
          class="report-actions"
          role="group"
          aria-label="Acciones del reporte"
        >
          <div
            class="report-action-group"
            role="group"
            aria-label="PDF del reporte"
          >
            <ActionButton @click="openPdf([detail.report.reportId], 'preview')">
              <FileText
                :size="16"
                aria-hidden="true"
              /> Ver PDF
            </ActionButton>
            <ActionButton @click="openPdf([detail.report.reportId], 'save')">
              <Download
                :size="16"
                aria-hidden="true"
              /> Guardar PDF
            </ActionButton>
          </div>
          <div
            class="report-action-group"
            role="group"
            aria-label="Exportar el reporte"
          >
            <ActionButton @click="exportXlsx">
              <FileSpreadsheet
                :size="16"
                aria-hidden="true"
              /> Exportar Excel
            </ActionButton>
            <ActionButton @click="exportCsv">
              <FileText
                :size="16"
                aria-hidden="true"
              /> Exportar CSV
            </ActionButton>
          </div>
          <HoldButton
            v-if="detail.canManage"
            class="report-delete"
            :is-disabled="isWorking"
            aria-label="Eliminar el reporte y su DIOT (los XML siguen en sus equipos)"
            done-label="Eliminado"
            @hold="confirmDelete"
          >
            <template #icon>
              <Trash2
                :size="16"
                aria-hidden="true"
              />
            </template>
            Eliminar reporte
          </HoldButton>
        </div>
      </header>

      <div
        v-if="detail.hasDiot"
        v-sliding-tabs
        class="report-tabs segmented-tabs"
        role="tablist"
        aria-label="Vista del reporte"
      >
        <button
          role="tab"
          type="button"
          :aria-selected="tab === 'documents'"
          @click="tab = 'documents'"
        >
          CFDI y totales
        </button><button
          role="tab"
          type="button"
          :aria-selected="tab === 'diot'"
          @click="tab = 'diot'"
        >
          DIOT
        </button>
      </div>

      <DiotPanel
        v-if="tab === 'diot' && detail.hasDiot"
        :report-id="detail.report.reportId"
        :client-id="detail.report.clientId"
      />
      <template v-else>
        <dl
          class="report-totals"
          data-testid="report-totals"
        >
          <div
            v-for="[label, amount] in totalRows"
            :key="label"
            :class="{ 'report-total': label === 'Total' }"
          >
            <dt>{{ label }}</dt><dd class="numeric">
              {{ formatMoney(amount) }}
            </dd>
          </div>
        </dl>
        <p class="field-help">
          {{ detail.totals.documentCount }} CFDI. Importes en MXN con el tipo de cambio de cada CFDI; los egresos (notas de crédito) restan.
        </p>
        <div
          class="table-region"
          tabindex="0"
          aria-label="CFDI del reporte"
        >
          <table aria-label="CFDI del reporte">
            <thead>
              <tr>
                <th>Fecha</th><th>Tipo</th><th>Contraparte</th><th>Total</th><th>IVA 16 %</th><th>XML</th><th class="actions-column">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="document in detail.documents"
                :key="document.uuid"
              >
                <td class="nowrap">
                  {{ formatIssuedAt(document.issuedAt) }}
                </td>
                <td>
                  <StatusBadge :tone="document.voucherType === 'E' ? 'warning' : 'success'">
                    {{ document.voucherType === 'E' ? 'Egreso' : 'Ingreso' }}
                  </StatusBadge>
                  <span
                    v-if="document.issueCount"
                    class="field-help"
                  > · {{ document.issueCount }} aviso(s)</span>
                </td>
                <td>
                  <strong>{{ document.counterpartName || document.counterpartRfc }}</strong>
                  <span class="field-help report-meta">{{ document.counterpartRfc }} · {{ document.uuid.toUpperCase() }}</span>
                </td>
                <td class="numeric nowrap">
                  {{ formatMoney(document.totalMxn) }}<span
                    v-if="document.currency !== 'MXN'"
                    class="field-help"
                  > ({{ document.total }} {{ document.currency }})</span>
                </td>
                <td class="numeric">
                  {{ formatMoney(document.breakdown.vat16) }}
                </td>
                <td :data-testid="'availability-' + document.uuid">
                  {{ availabilityText(document) }}
                </td>
                <td class="actions-column">
                  <HoldButton
                    v-if="detail.canManage"
                    is-icon-only
                    size="small"
                    :is-disabled="isWorking"
                    :aria-label="'Retirar del reporte ' + document.uuid"
                    @hold="confirmRemoval(document)"
                  >
                    <template #icon>
                      <X
                        :size="15"
                        aria-hidden="true"
                      />
                    </template>
                  </HoldButton>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </template>
  </section>
</template>
<style scoped>
.reports-panel { display: grid; gap: var(--spaceMedium); min-width: 0; }
.reports-filters { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap: var(--spaceMedium); align-items: end; }
/* Calendario del ejercicio: periodo a la izquierda y fichas de reporte en píldora. */
.report-calendar { list-style: none; margin: 0; padding: 0; border: 2px solid var(--borderColor); border-radius: var(--radiusCard); background: var(--surfaceColor); overflow: hidden; }
.report-row { display: grid; grid-template-columns: 7rem minmax(0, 1fr); gap: 12px; align-items: center; padding: 10px 16px; border-bottom: 1px solid var(--borderColor); }
.report-row:last-child { border-bottom: 0; }
.report-row.is-annual { background: var(--sidebarColor); }
.report-period { font-weight: 500; }
.report-chips { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; min-width: 0; }
.report-chip { display: inline-flex; align-items: center; min-height: 28px; padding: 2px 10px; border: 0; border-radius: var(--radiusControl); font: inherit; font-size: 12px; font-weight: 500; cursor: pointer; overflow-wrap: anywhere; text-align: left; }
.report-chip.is-issued { background: var(--successFill); color: var(--successText); }
.report-chip.is-received { background: var(--infoFill); color: var(--infoText); }
.report-chip.is-diot { background: var(--primaryBackgroundColor); color: var(--primaryTextColor); }
.report-chip.is-pdf { gap: 4px; background: var(--surfaceColor); color: var(--textColor); box-shadow: inset 0 0 0 2px var(--borderColor); font-weight: 700; }
.report-chip:hover { opacity: .85; }
.link-button { border: 0; padding: 0; background: none; color: var(--accentColor); font: inherit; font-weight: 700; text-align: left; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
/* Encabezado del detalle: título, barra de acciones y, bajo una línea de tinta, las pestañas a todo lo ancho. */
.report-detail-header { display: grid; gap: 14px; padding-bottom: var(--spaceMedium); border-bottom: 2px solid var(--borderColor); }
.report-title-row { display: flex; align-items: flex-start; gap: 14px; min-width: 0; }
.report-back { flex: none; }
.report-title { display: grid; gap: 2px; min-width: 0; }
.report-title h2 { margin: 0; overflow-wrap: anywhere; }
.report-title .heading-meta { margin: 0; }
.report-actions { display: flex; flex-wrap: wrap; align-items: stretch; gap: 10px 12px; }
/* PDF como un solo bloque: dos botones unidos por el marco y una sola sombra dura. */
.report-action-group { display: inline-flex; box-shadow: var(--buttonShadow); }
.report-action-group .action-button { box-shadow: none; }
.report-action-group .action-button + .action-button { margin-left: -2px; }
.report-action-group .action-button:active:not(:disabled) { transform: none; background: var(--hoverColor); }
.report-delete { margin-left: auto; }
.report-tabs { display: flex; width: 100%; }
.report-tabs button { flex: 1 1 0; min-width: 0; }
/* Cajón angosto: cada bloque ocupa su renglón completo con alturas iguales; eliminar queda al final. */
@container (max-width: 520px) {
  .report-title-row { flex-direction: column; gap: 10px; }
  .report-actions { flex-direction: column; align-items: stretch; }
  .report-action-group { display: flex; }
  .report-action-group .action-button { flex: 1 1 0; }
  .report-delete { margin-left: 0; }
}
/* Líneas por celda: una fila incompleta no deja bloques del color de borde. */
.report-totals { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 170px), 1fr)); margin: 0; border-top: 2px solid var(--borderColor); border-left: 2px solid var(--borderColor); background: var(--surfaceColor); border-radius: var(--radiusNested); overflow: hidden; }
.report-totals div { display: grid; gap: 4px; padding: 10px 12px; border-right: 2px solid var(--borderColor); border-bottom: 2px solid var(--borderColor); min-width: 0; }
.report-totals dt { font-family: var(--monoFontFamily); font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--mutedTextColor); }
.report-totals dd { margin: 0; font-size: 18px; font-weight: 800; letter-spacing: -.03em; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.report-total { background: var(--subtleColor); }
.report-total dd { font-weight: 600; color: var(--accentColor); }
.report-meta { display: block; font-family: var(--monoFontFamily); font-size: 11px; overflow-wrap: anywhere; }
/* Tablas de reportes con la rejilla interior visible (2026-10-06, pedido del usuario). */
table { border: 2px solid var(--borderColor); }
th, td { border: 1px solid var(--borderColor); }
th { border-bottom-width: 2px; }
</style>
