<script setup lang="ts">
import { handlePdfResult } from '../../shared/pdf/pdfViewerState'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ClipboardCheck, CloudDownload, Download, Eye, FileSpreadsheet, FileText, FolderOpen, Trash2, Upload, CheckSquare, ListChecks, XSquare, Mail } from '@lucide/vue'
import TaxObligationsPanel from './TaxObligationsPanel.vue'
import { openMailComposer } from '../mail/mailComposerState'
import type { CfdiAnalysis } from '../../../shared/contracts/cfdi'
import type { FiscalDirection, FiscalPaymentStatus, FiscalTableRow } from '../../../shared/contracts/fiscalWorkspace'
import type { LocalXmlRecord, XmlImportSummary } from '../../../shared/contracts/localXml'
import { formatMoney } from '../../../shared/presentation/movementLabels'
import ActionButton from '../../shared/components/ActionButton.vue'
import SelectField from '../../shared/components/SelectField.vue'
import FormModal from '../../shared/components/FormModal.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import HelpTip from '../../shared/components/HelpTip.vue'
import ListPager from '../../shared/components/ListPager.vue'
import StatusBadge from '../../shared/components/StatusBadge.vue'
import SwipeRow, { type SwipeAction } from '../../shared/vueBits/SwipeRow.vue'
import CfdiFiscalDetail from '../xml/CfdiFiscalDetail.vue'
import CreateReportForm from '../reports/CreateReportForm.vue'
import ReportsPanel from '../reports/ReportsPanel.vue'
import SideDrawer from '../../shared/components/SideDrawer.vue'
import SatDownloadPanel from '../satDownloads/SatDownloadPanel.vue'
import SatPortalCfdiAction from './SatPortalCfdiAction.vue'
import SatPortalRecoveryList from './SatPortalRecoveryList.vue'
import { voucherTypeLabels } from '../xml/xmlLabels'
import XmlImportModal from '../xml/XmlImportModal.vue'
import { describeCode, paymentFormNames } from '../xml/cfdiLabels'
import { monthNames } from '../reports/reportLabels'
import { readIpcErrorMessage } from '../../shared/ipcErrorMessage'
import { useNotifications } from '../../shared/notifications/notificationStore'
import { workspaceAccess } from '../workspace/sessionState'
import type { FiscalClient } from './fiscalClients'
import { areAllSelected, toggleAllSelection } from './fiscalSelection'
import type { NavigationRequest } from '../../shared/navigation/navigationRequests'

/**
 * Fiscal de UN cliente (2026-10-04, como la ContaApp anterior). Todo depende del cliente elegido y del periodo:
 * 1. **Periodo:** ejercicio y mes ("Todo el año" para el anual).
 * 2. **Agregar XML:** importar XML o el ZIP del SAT (a la biblioteca LOCAL de este equipo) o descargar del SAT con la
 *    e.firma del cliente; después se vuelve a armar la tabla.
 * 3. **Resumen fiscal** del movimiento visible: documentos, base 16 %, IVA 16 %, tasa 0 %, exento y total (los egresos
 *    restan). Pestañas Emitidas / ingresos y Recibidas / egresos.
 * 4. **Tabla de datos** con las columnas de la ContaApp anterior (2026-10-05): Estatus, Forma de pago, Nombre, RFC,
 *    Abonado, Subtotal 16 %, Subtotal 8 %, Descuento, IVA 16 %, IVA 8 %, Pendiente, Exento, 0 %, Ret. IEPS y Fecha.
 *    - Main calcula de cada XML el desglose, el estatus de pago, el abonado y el pendiente (con los complementos de
 *      pago LOCALES) y la advertencia de inclusión excepcional.
 *    - Primero van los CFDI y después el grupo "Complementos de pago", que muestra a qué facturas aplica cada uno.
 *    - Sombreados: tasa 0 %, exento o egreso, o revisión excepcional.
 *    - 25 por página. Al arrastrar el renglón hacia la derecha (o con ⋯): Ver, PDF, Guardar copia y Papelera; sólo en
 *      Fiscal el panel se revela a la izquierda (`revealSide="start"`, pedido del usuario 2026-10-13).
 *    - Seleccionar CFDI permite "Crear reporte" (o agregarlos al del periodo) y muestra el subtotal seleccionado.
 *      "Seleccionar todas" toma todos los seleccionables de la pestaña y periodo visibles (todas las páginas) y alterna
 *      a "Quitar selección" (fiscalSelection.ts).
 * 5. **Reportes guardados** en un cajón lateral, como el original: calendario anual y mensual del ejercicio con PDF por
 *    periodo (ReportsPanel). Se monta al abrirlo, así que siempre consulta datos vigentes.
 * 6. **Obligaciones** (2026-10-18) en otro cajón: obligaciones fiscales del cliente y su cumplimiento por periodo
 *    (TaxObligationsPanel, [[modules/TAX-OBLIGATIONS]]).
 * Los XML nunca salen del equipo; los reportes y las obligaciones son GLOBAL en el Host.
 */
/** `navigationRequest` (2026-10-10): solicitud de un aviso entregada por FiscalPage; `view: 'reports'` abre el cajón. */
const props = defineProps<{ client: FiscalClient; navigationRequest?: NavigationRequest | null }>()
const { notify } = useNotifications()
const currentYear = new Date().getFullYear(), currentMonth = new Date().getMonth() + 1
const fiscalYear = ref(String(currentYear)), fiscalMonth = ref(String(currentMonth))
const direction = ref<FiscalDirection>('issued')
const rows = ref<FiscalTableRow[]>([]), isTruncated = ref(false), unreadableCount = ref(0)
const isLoading = ref(false), error = ref('')
const selected = ref<string[]>([]), page = ref(0)
const satInitialTab = ref<'portal' | undefined>(undefined)
const isSatOpen = ref(false), isReportOpen = ref(false), isReportsOpen = ref(false), isImportOpen = ref(false), isObligationsOpen = ref(false)
const viewer = ref<{ row: FiscalTableRow; analysis: CfdiAnalysis | null; content: string; tab: 'fiscal' | 'xml' } | null>(null)
let isMounted = true
const rowsPerPage = 25

const yearOptions = [...Array(8).keys()].map(offset => ({ value: String(currentYear - offset), label: String(currentYear - offset) }))
const monthOptions = [{ value: '0', label: 'Todo el año' }, ...monthNames.map((name, index) => ({ value: String(index + 1), label: name }))]
/** CFDI primero y complementos de pago al final, como los dos grupos de la tabla original. */
const directionRows = computed(() => {
  const visible = rows.value.filter(row => row.direction === direction.value)
  return [...visible.filter(row => row.voucherType !== 'P'), ...visible.filter(row => row.voucherType === 'P')]
})
const pageCount = computed(() => Math.max(1, Math.ceil(directionRows.value.length / rowsPerPage)))
const pagedRows = computed(() => directionRows.value.slice(page.value * rowsPerPage, (page.value + 1) * rowsPerPage))
/** Encabezado de grupo antes del primer renglón de cada grupo dentro de la página. */
function groupLabelBefore(index: number): string | null {
  const row = pagedRows.value[index]!, previous = pagedRows.value[index - 1]
  const isComplement = row.voucherType === 'P'
  if (previous && (previous.voucherType === 'P') === isComplement) return null
  const count = directionRows.value.filter(item => (item.voucherType === 'P') === isComplement).length
  return (isComplement ? 'Complementos de pago' : direction.value === 'issued' ? 'CFDI emitidos' : 'CFDI recibidos') + ' · ' + count + ' documento(s)'
}
const countOf = (value: FiscalDirection) => rows.value.filter(row => row.direction === value).length
const periodLabel = computed(() => fiscalMonth.value === '0' ? 'ejercicio ' + fiscalYear.value : monthNames[Number(fiscalMonth.value) - 1] + ' ' + fiscalYear.value)

/** Importe en MXN con signo: los egresos (notas de crédito) restan, como en los reportes. */
function signed(row: FiscalTableRow, amount: string): number {
  const rate = row.currency === 'MXN' || !row.exchangeRate ? 1 : Number(row.exchangeRate)
  return Number(amount) * rate * (row.voucherType === 'E' ? -1 : 1)
}
const summary = computed(() => {
  const reportable = directionRows.value.filter(row => row.voucherType === 'I' || row.voucherType === 'E')
  const sum = (pick: (row: FiscalTableRow) => string) => reportable.reduce((total, row) => total + signed(row, pick(row)), 0).toFixed(2)
  return { count: directionRows.value.length, base16: sum(row => row.breakdown.vatBase16), vat16: sum(row => row.breakdown.vat16), base0: sum(row => row.breakdown.vatBase0), exempt: sum(row => row.breakdown.exemptBase), total: sum(row => row.total) }
})
const isReportable = (row: FiscalTableRow) => row.voucherType === 'I' || row.voucherType === 'E'
/** Atención, como el original: egreso, o base a tasa 0 % o exenta. */
const hasFiscalAttention = (row: FiscalTableRow) => row.voucherType === 'E' || Number(row.breakdown.vatBase0) > 0 || Number(row.breakdown.exemptBase) > 0
const paymentStatusLabels: Record<FiscalPaymentStatus, string> = { paid: 'Pagada', partial: 'Parcial', pending: 'Pendiente', paymentComplement: 'Complemento', payroll: 'Nómina', creditNote: 'Nota de crédito', transfer: 'Traslado' }
const paymentStatusTones: Record<FiscalPaymentStatus, 'success' | 'warning' | 'error' | 'neutral' | 'info'> = { paid: 'success', partial: 'warning', pending: 'error', paymentComplement: 'info', payroll: 'neutral', creditNote: 'warning', transfer: 'neutral' }
/** Moneda del CFDI: los importes en otra moneda se muestran en ella, como en el original. */
const money = (row: FiscalTableRow, amount: string) => formatMoney(amount) + (row.currency === 'MXN' ? '' : ' ' + row.currency)
const shortUuid = (uuid: string) => uuid.slice(0, 8).toUpperCase() + '…' + uuid.slice(-6).toUpperCase()
const formatDate = (value: string) => new Date(value.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
/** Subtotal en MXN de lo seleccionado (los egresos restan), como "Subtotal seleccionado" del original. */
const selectedSubtotal = computed(() => rows.value.filter(row => selected.value.includes(row.uuid)).reduce((total, row) => total + signed(row, row.subtotal), 0).toFixed(2))

/** Para CreateReportForm: el registro LOCAL equivalente y el índice RFC → cliente (sólo este cliente). */
const selectedRecords = computed<LocalXmlRecord[]>(() => rows.value.filter(row => selected.value.includes(row.uuid)).map(row => ({
  uuid: row.uuid, version: '4.0', voucherType: row.voucherType,
  issuerRfc: row.direction === 'issued' ? props.client.rfc : row.counterpartRfc, issuerName: row.direction === 'issued' ? props.client.displayName : row.counterpartName,
  receiverRfc: row.direction === 'issued' ? row.counterpartRfc : props.client.rfc, receiverName: row.direction === 'issued' ? row.counterpartName : props.client.displayName,
  issuedAt: row.issuedAt, total: row.total, currency: row.currency, sizeBytes: 0, sha256: '0'.repeat(64), importedAt: row.issuedAt, trashedAt: null
})))
const clientIndex = computed(() => new Map([[props.client.rfc, { clientId: props.client.clientId, clientName: props.client.displayName }]]))

async function load(): Promise<void> {
  isLoading.value = true; error.value = ''
  try {
    const result = await window.contapp.readFiscalTable({ clientRfc: props.client.rfc, fiscalYear: Number(fiscalYear.value), fiscalMonth: fiscalMonth.value === '0' ? null : Number(fiscalMonth.value) })
    if (!isMounted) return
    rows.value = result.rows.sort((first, second) => second.issuedAt.localeCompare(first.issuedAt)); isTruncated.value = result.isTruncated; unreadableCount.value = result.unreadableCount
    selected.value = selected.value.filter(uuid => rows.value.some(row => row.uuid === uuid))
  } catch (caught) { if (isMounted) { rows.value = []; error.value = readIpcErrorMessage(caught, 'No se pudo armar la tabla fiscal.') } }
  finally { isLoading.value = false }
}
watch([fiscalYear, fiscalMonth, () => props.client.clientId], () => { selected.value = []; page.value = 0; viewer.value = null; void load() }, { immediate: true })
watch(direction, () => { page.value = 0 })
/** Reporte que el cajón debe abrir al montarse (aviso "Reporte guardado"); `requestId` distingue dos avisos seguidos. */
const requestedReport = ref<{ reportId: string; requestId: number } | null>(null)
watch(() => props.navigationRequest?.requestId, () => {
  const request = props.navigationRequest
  if (!request || request.itemId !== props.client.clientId) return
  // Avisos de la descarga automática del SAT (2026-10-11): abren el modal "Descargar CFDI del SAT" de este cliente.
  if (request.view === 'satDownloads') { satInitialTab.value = undefined; isSatOpen.value = true; return }
  // Aviso "escribe el captcha para recuperarla" (2026-10-17): el modal abre directo en «RFC y CIEC».
  if (request.view === 'satPortal') { satInitialTab.value = 'portal'; isSatOpen.value = true; return }
  if (request.view !== 'reports') return
  requestedReport.value = request.nestedItemId ? { reportId: request.nestedItemId, requestId: request.requestId } : null
  isReportsOpen.value = true
}, { immediate: true })
// Al cerrar el cajón se olvida el reporte pedido: reabrirlo después muestra el calendario.
watch(isReportsOpen, isOpen => { if (!isOpen) requestedReport.value = null })

/** Modal "Importar XML" (XmlImportModal): el resultado por archivo se ve ahí; al cerrarlo se vuelve a armar la tabla. */
function announceImport(importSummary: XmlImportSummary): void {
  notify('Importación terminada', importSummary.imported + ' nuevo(s), ' + importSummary.duplicates + ' ya existían, ' + importSummary.conflicts + ' en conflicto y ' + importSummary.rejected + ' rechazado(s).', importSummary.rejected || importSummary.conflicts ? 'warning' : 'success',
    { target: { section: 'fiscal', itemId: props.client.clientId, label: 'Fiscal de ' + props.client.displayName } })
}
function toggle(uuid: string, isChecked: boolean): void { selected.value = isChecked ? [...new Set([...selected.value, uuid])] : selected.value.filter(item => item !== uuid) }
/** UUID seleccionables de la vista filtrada (pestaña y periodo), en todas sus páginas. */
const selectableUuids = computed(() => directionRows.value.filter(isReportable).map(row => row.uuid))
const isEverythingSelected = computed(() => areAllSelected(selected.value, selectableUuids.value))
function toggleSelectAll(): void { selected.value = toggleAllSelection(selected.value, selectableUuids.value) }
function selectPage(): void { selected.value = [...new Set([...selected.value, ...pagedRows.value.filter(isReportable).map(row => row.uuid)])] }
async function view(row: FiscalTableRow): Promise<void> {
  try {
    const [content, analysis] = await Promise.all([window.contapp.readLocalXml(row.uuid), window.contapp.analyzeLocalXml(row.uuid).catch(() => null)])
    if (isMounted) viewer.value = { row, analysis, content, tab: analysis ? 'fiscal' : 'xml' }
  } catch (caught) { error.value = readIpcErrorMessage(caught, 'No se pudo abrir el XML.') }
}
async function cfdiPdf(row: FiscalTableRow, action: 'preview' | 'save'): Promise<void> {
  try { if (handlePdfResult(await window.contapp.openCfdiPdf({ uuid: row.uuid, action }))) notify('PDF guardado', 'El PDF del CFDI se guardó donde elegiste.', 'success') }
  catch (caught) { error.value = readIpcErrorMessage(caught, 'No se generó el PDF del CFDI.') }
}
async function saveCopy(row: FiscalTableRow): Promise<void> {
  try { if (await window.contapp.saveLocalXmlCopy(row.uuid) === 'saved') notify('Copia guardada', 'El XML se guardó donde elegiste; esa copia no está cifrada.', 'success') }
  catch (caught) { error.value = readIpcErrorMessage(caught, 'No se guardó la copia.') }
}
async function trash(row: FiscalTableRow): Promise<void> {
  try { await window.contapp.trashLocalXml([row.uuid]); notify('Movido a la papelera', '1 XML. Puedes restaurarlo desde la biblioteca durante 30 días.', 'success', { target: { section: 'fiscal', view: 'library', label: 'la Biblioteca XML' } }); await load() }
  catch (caught) { error.value = readIpcErrorMessage(caught, 'No se movió el XML a la papelera.') }
}
/** Acciones al arrastrar (2026-10-04): las del renglón y las que no caben a la vista. */
function rowActions(row: FiscalTableRow): SwipeAction[] {
  const id = row.uuid.toUpperCase()
  return [
    { actionId: 'view', label: 'Ver', icon: Eye, accessibleName: 'Ver CFDI ' + id, onSelect: () => { void view(row) } },
    { actionId: 'pdf', label: 'PDF', icon: FileText, accessibleName: 'PDF del CFDI ' + id, onSelect: () => { void cfdiPdf(row, 'preview') } },
    // Correo (2026-10-17): XML y PDF del CFDI adjuntos; "para" la contraparte (el cliente del cliente).
    ...(workspaceAccess.value.canSendMail ? [{ actionId: 'mail', label: 'Correo', icon: Mail, accessibleName: 'Enviar por correo el CFDI ' + id, onSelect: () => openMailComposer({ clientId: props.client.clientId, clientName: props.client.displayName, documentLabel: 'Factura', recipientName: row.counterpartName, attachments: [{ reference: { kind: 'xml', uuid: row.uuid }, label: id + '.xml' }, { reference: { kind: 'cfdiPdf', uuid: row.uuid }, label: id + '.pdf' }] }) }] : []),
    { actionId: 'copy', label: 'Copia', icon: Download, accessibleName: 'Guardar copia del CFDI ' + id, onSelect: () => { void saveCopy(row) } },
    { actionId: 'trash', label: 'Papelera', icon: Trash2, tone: 'danger', accessibleName: 'Mover a la papelera el CFDI ' + id, onSelect: () => { void trash(row) } }
  ]
}
function finishReport(): void { isReportOpen.value = false; selected.value = [] }
onBeforeUnmount(() => { isMounted = false; rows.value = []; viewer.value = null })
</script>
<template>
  <div
    class="client-fiscal"
    data-testid="client-fiscal"
  >
    <!-- Periodo y entrada de XML. -->
    <div class="surface-panel toolbar-panel fiscal-context">
      <SelectField
        id="fiscal-year"
        v-model="fiscalYear"
        label="Ejercicio"
        :options="yearOptions"
      />
      <SelectField
        id="fiscal-month"
        v-model="fiscalMonth"
        label="Mes"
        :options="monthOptions"
      />
      <div class="fiscal-intake">
        <ActionButton
          v-if="workspaceAccess.canDownloadSat && client.access === 'readWrite'"
          @click="satInitialTab = undefined; isSatOpen = true"
        >
          <CloudDownload
            :size="16"
            aria-hidden="true"
          /> Descargar del SAT
        </ActionButton>
        <ActionButton
          variant="primary"
          @click="isImportOpen = true"
        >
          <Upload
            :size="16"
            aria-hidden="true"
          /> Importar XML o ZIP
        </ActionButton>
        <HelpTip
          title="XML guardados en este equipo"
          text="Los XML y el ZIP del SAT se guardan cifrados sólo en esta computadora (son LOCALES): otro equipo no verá estas facturas hasta importarlas también. Lo que sí se comparte por el Host son los reportes que guardes."
        />
      </div>
    </div>
    <InlineNotice
      v-if="error"
      title="Operación no confirmada"
      tone="error"
    >
      <p>{{ error }}</p>
    </InlineNotice>
    <XmlImportModal
      :is-open="isImportOpen"
      @imported="announceImport"
      @close="isImportOpen = false; load()"
    />

    <!-- Resumen fiscal del movimiento visible. -->
    <section
      class="fiscal-summary"
      aria-label="Resumen fiscal"
    >
      <div><span>Documentos</span><strong>{{ summary.count }}</strong></div>
      <div><span>Base 16 %</span><strong>{{ formatMoney(summary.base16) }}</strong></div>
      <div class="is-accent">
        <span>IVA 16 %</span><strong>{{ formatMoney(summary.vat16) }}</strong>
      </div>
      <div><span>Tasa 0 %</span><strong>{{ formatMoney(summary.base0) }}</strong></div>
      <div><span>Exento</span><strong>{{ formatMoney(summary.exempt) }}</strong></div>
      <div><span>Total</span><strong>{{ formatMoney(summary.total) }}</strong></div>
    </section>

    <div class="table-panel">
      <div class="table-toolbar fiscal-table-toolbar">
        <div
          v-sliding-tabs
          class="segmented-tabs"
          role="tablist"
          aria-label="Movimiento"
        >
          <button
            type="button"
            role="tab"
            :aria-selected="direction === 'issued'"
            @click="direction = 'issued'"
          >
            Emitidas / ingresos · {{ countOf('issued') }}
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="direction === 'received'"
            @click="direction = 'received'"
          >
            Recibidas / egresos · {{ countOf('received') }}
          </button>
        </div>
        <div class="actions">
          <ActionButton
            v-if="workspaceAccess.canReadReports"
            aria-haspopup="dialog"
            data-testid="fiscal-obligations-open"
            @click="isObligationsOpen = true"
          >
            <ClipboardCheck
              :size="16"
              aria-hidden="true"
            /> Obligaciones
          </ActionButton>
          <ActionButton
            v-if="workspaceAccess.canReadReports"
            aria-haspopup="dialog"
            @click="isReportsOpen = true"
          >
            <FolderOpen
              :size="16"
              aria-hidden="true"
            /> Reportes guardados
          </ActionButton>
          <ActionButton
            v-if="selectableUuids.length"
            :aria-pressed="isEverythingSelected"
            data-testid="fiscal-select-all"
            @click="toggleSelectAll"
          >
            <ListChecks
              :size="16"
              aria-hidden="true"
            /> {{ isEverythingSelected ? 'Quitar selección' : 'Seleccionar todas' }} ({{ selectableUuids.length }})
          </ActionButton>
          <ActionButton
            v-if="pagedRows.length"
            @click="selectPage"
          >
            <CheckSquare
              :size="16"
              aria-hidden="true"
            /> Seleccionar página
          </ActionButton>
          <ActionButton
            v-if="selected.length"
            @click="selected = []"
          >
            <XSquare
              :size="16"
              aria-hidden="true"
            /> Limpiar selección
          </ActionButton>
          <ActionButton
            v-if="selected.length && workspaceAccess.canManageReports"
            variant="primary"
            @click="isReportOpen = true"
          >
            <FileSpreadsheet
              :size="16"
              aria-hidden="true"
            /> Crear reporte ({{ selected.length }})
          </ActionButton>
        </div>
      </div>
      <div class="fiscal-selection">
        <strong>{{ selected.length }} seleccionadas · Subtotal seleccionado: {{ formatMoney(selectedSubtotal) }}</strong>
        <!-- La ayuda "?" va fuera de .fiscal-legend: ahí cada span lleva el cuadro de color de la leyenda. -->
        <div class="fiscal-legend-group">
          <span class="fiscal-legend">
            <span class="legend-attention">Tasa 0 %, exento o devolución</span>
            <span class="legend-warning">Revisión excepcional</span>
          </span>
          <HelpTip
            title="Abonado, Pendiente y revisión"
            text="Abonado y Pendiente sólo aplican a ingresos: una factura PUE cuenta como pagada; en una PPD, Abonado es lo que cubren los complementos de pago guardados en este equipo y Pendiente lo que falta. La revisión excepcional marca nómina, forma de pago 99, efectivo mayor a $2,000 o gasolina en efectivo: valida si debe reportarse."
          />
        </div>
      </div>
      <!-- Tabla de datos: encabezado y renglones comparten la misma rejilla; cada renglón se arrastra para más acciones. -->
      <div class="fiscal-scroll">
        <div
          class="fiscal-columns"
          aria-hidden="true"
        >
          <span /><span>Estatus</span><span>Forma de pago</span><span>Nombre</span><span>RFC</span><span class="number">Abonado</span><span class="number">Subtotal 16 %</span><span class="number">Subtotal 8 %</span><span class="number">Descuento</span><span class="number">IVA 16 %</span><span class="number">IVA 8 %</span><span class="number">Pendiente</span><span class="number">Exento</span><span class="number">0 %</span><span class="number">Ret. IEPS</span><span>Fecha</span>
        </div>
        <ul
          class="fiscal-list"
          :aria-label="direction === 'issued' ? 'CFDI emitidos' : 'CFDI recibidos'"
          data-testid="fiscal-table"
        >
          <template
            v-for="(row, index) in pagedRows"
            :key="row.uuid"
          >
            <li
              v-if="groupLabelBefore(index)"
              class="fiscal-group"
            >
              {{ groupLabelBefore(index) }}
            </li>
            <li>
              <SwipeRow
                :label="'CFDI ' + row.uuid.toUpperCase()"
                :actions="rowActions(row)"
                reveal-side="start"
              >
                <div
                  class="fiscal-row"
                  :class="{ 'is-attention': hasFiscalAttention(row), 'is-warning': row.reportWarning }"
                  :title="row.reportWarning ?? undefined"
                >
                  <input
                    type="checkbox"
                    :checked="selected.includes(row.uuid)"
                    :disabled="!isReportable(row)"
                    :aria-label="'Seleccionar CFDI de ' + row.counterpartName + ' del ' + row.issuedAt.slice(0, 10)"
                    @change="toggle(row.uuid, ($event.target as HTMLInputElement).checked)"
                  >
                  <span class="fiscal-status">
                    <StatusBadge :tone="paymentStatusTones[row.paymentStatus]">{{ paymentStatusLabels[row.paymentStatus] }}</StatusBadge>
                    <small>{{ voucherTypeLabels[row.voucherType] }}</small>
                    <small
                      v-if="row.reportWarning"
                      class="fiscal-warning"
                    >Revisión: {{ row.reportWarning }}</small>
                  </span>
                  <span class="fiscal-payment">
                    <strong>{{ row.paymentForm ? describeCode(row.paymentForm, paymentFormNames) : 'Sin forma de pago' }}</strong>
                    <small v-if="row.paymentMethod">{{ row.paymentMethod }}</small>
                    <template v-if="row.voucherType === 'P'">
                      <small>Aplica a {{ row.appliedDocuments.length }} factura(s)</small>
                      <small
                        v-for="document in row.appliedDocuments"
                        :key="document.uuid"
                        class="fiscal-applied"
                      >{{ shortUuid(document.uuid) }} · {{ formatMoney(document.paidAmount) }}</small>
                    </template>
                  </span>
                  <strong class="fiscal-name">{{ row.counterpartName || 'Sin nombre' }}</strong>
                  <span class="fiscal-rfc">{{ row.counterpartRfc }}</span>
                  <span class="number">{{ money(row, row.paidAmount) }}</span>
                  <span class="number">{{ money(row, row.breakdown.vatBase16) }}</span>
                  <span class="number">{{ money(row, row.breakdown.vatBase8) }}</span>
                  <span class="number">{{ money(row, row.discount) }}</span>
                  <span class="number">{{ money(row, row.breakdown.vat16) }}</span>
                  <span class="number">{{ money(row, row.breakdown.vat8) }}</span>
                  <span class="number">{{ money(row, row.pendingAmount) }}</span>
                  <span class="number">{{ money(row, row.breakdown.exemptBase) }}</span>
                  <span class="number">{{ money(row, row.breakdown.vatBase0) }}</span>
                  <span class="number">{{ money(row, row.breakdown.iepsWithheld) }}</span>
                  <span class="fiscal-date"><time :datetime="row.issuedAt">{{ formatDate(row.issuedAt) }}</time><small>{{ shortUuid(row.uuid) }}</small></span>
                </div>
              </SwipeRow>
            </li>
          </template>
          <li
            v-if="!pagedRows.length"
            class="fiscal-empty"
          >
            <strong>{{ isLoading ? 'Armando la tabla…' : 'No hay CFDI en este periodo' }}</strong>
            <span v-if="!isLoading">Importa los XML del cliente o cambia el periodo.</span>
          </li>
        </ul>
      </div>
      <div class="table-footer">
        <span>{{ directionRows.length }} CFDI · {{ periodLabel }}{{ isTruncated ? ' · se analizaron los 500 más recientes' : '' }}{{ unreadableCount ? ' · ' + unreadableCount + ' XML no se pudieron leer' : '' }}</span>
        <ListPager
          v-model:page="page"
          :page-count="pageCount"
          :total-count="directionRows.length"
          :page-size="rowsPerPage"
          label="CFDI"
        />
      </div>
    </div>

    <!-- Reportes guardados del cliente en un cajón lateral, como el original: calendario del ejercicio con PDF por periodo. -->
    <SideDrawer
      :is-open="isReportsOpen"
      :title="'Reportes guardados · ' + client.displayName + ' · ' + fiscalYear"
      test-id="fiscal-reports-drawer"
      @close="isReportsOpen = false"
    >
      <ReportsPanel
        v-if="isReportsOpen"
        :client-id="client.clientId"
        :fixed-year="Number(fiscalYear)"
        :requested-report="requestedReport"
      />
    </SideDrawer>

    <!-- Obligaciones fiscales del cliente (2026-10-18): qué debe presentar y qué periodos ya se cumplieron. -->
    <SideDrawer
      :is-open="isObligationsOpen"
      :title="'Obligaciones fiscales · ' + client.displayName"
      test-id="fiscal-obligations-drawer"
      @close="isObligationsOpen = false"
    >
      <TaxObligationsPanel
        v-if="isObligationsOpen"
        :client="client"
      />
    </SideDrawer>

    <FormModal
      :is-open="isReportOpen"
      title="Guardar reporte"
      description="Los CFDI seleccionados forman un reporte mensual o anual del cliente."
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
    <FormModal
      :is-open="isSatOpen"
      title="Descargar CFDI del SAT"
      :description="client.displayName + ': con e.firma, automático o con RFC y CIEC. Los XML entran a la biblioteca de este equipo.'"
      test-id="sat-modal"
      @close="isSatOpen = false; load()"
    >
      <SatDownloadPanel
        :clients="[{ clientId: client.clientId, clientName: client.displayName }]"
        :initial-tab="satInitialTab"
      >
        <!-- Pestaña "RFC y CIEC" (2026-10-11): sin e.firma; la persona escribe el captcha. -->
        <template #portal>
          <SatPortalCfdiAction
            :client-id="client.clientId"
            :client-display-name="client.displayName"
            :can-use="workspaceAccess.canDownloadSat && workspaceAccess.canUseXml && client.access === 'readWrite'"
            @completed="load()"
          />
        </template>
        <!-- Recuperaciones pendientes del portal (2026-10-17): también en el Historial, con «Recuperar ahora». -->
        <template #portalHistory>
          <SatPortalRecoveryList
            :client-id="client.clientId"
            :client-display-name="client.displayName"
            :can-use="workspaceAccess.canDownloadSat && workspaceAccess.canUseXml && client.access === 'readWrite'"
          />
        </template>
      </SatDownloadPanel>
    </FormModal>
    <FormModal
      :is-open="Boolean(viewer)"
      :title="viewer ? viewer.row.counterpartName : 'CFDI'"
      :description="viewer ? viewer.row.uuid.toUpperCase() : ''"
      test-id="fiscal-viewer"
      @close="viewer = null"
    >
      <template v-if="viewer">
        <div
          v-sliding-tabs
          class="segmented-tabs"
          role="tablist"
          aria-label="Vista del CFDI"
        >
          <button
            type="button"
            role="tab"
            :aria-selected="viewer.tab === 'fiscal'"
            :disabled="!viewer.analysis"
            @click="viewer.tab = 'fiscal'"
          >
            Datos fiscales
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="viewer.tab === 'xml'"
            @click="viewer.tab = 'xml'"
          >
            XML
          </button>
        </div>
        <CfdiFiscalDetail
          v-if="viewer.tab === 'fiscal' && viewer.analysis"
          :analysis="viewer.analysis"
          :client-match="{ clientId: client.clientId, clientName: client.displayName, direction: viewer.row.direction }"
        />
        <pre
          v-else
          class="fiscal-xml"
        >{{ viewer.content }}</pre>
        <div class="actions form-footer">
          <ActionButton @click="cfdiPdf(viewer.row, 'save')">
            <Download
              :size="16"
              aria-hidden="true"
            /> Guardar PDF
          </ActionButton>
          <ActionButton @click="cfdiPdf(viewer.row, 'preview')">
            <FileText
              :size="16"
              aria-hidden="true"
            /> Ver PDF
          </ActionButton>
        </div>
      </template>
    </FormModal>
  </div>
</template>
<style scoped>
.client-fiscal { display: grid; gap: var(--spaceMedium); }
.fiscal-context { display: flex; flex-wrap: wrap; align-items: end; gap: 12px; margin-bottom: 0; }
.fiscal-context > .field { flex: 0 1 12rem; }
.fiscal-intake { display: flex; flex-wrap: wrap; gap: 8px; margin-left: auto; }
.fiscal-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 150px), 1fr)); gap: var(--spaceMedium); margin: 0; }
.fiscal-summary div { display: grid; gap: 4px; padding: 14px 16px; border: 2px solid var(--borderColor); background: var(--surfaceColor); box-shadow: var(--buttonShadow); }
.fiscal-summary div.is-accent { border-color: var(--accentColor); }
.fiscal-summary span { font-family: var(--monoFontFamily); font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--mutedTextColor); }
.fiscal-summary strong { font-size: 22px; font-weight: 800; letter-spacing: -.02em; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.fiscal-table-toolbar { justify-content: space-between; }
/*
 * Rejilla común de encabezado y renglones; en ventanas angostas la tabla se desplaza a lo ancho.
 * El ancho mínimo va en el encabezado y en la lista (no en el renglón): si el renglón fuera más ancho que su
 * SwipeRow, su contenido taparía las acciones al deslizarlo. El encabezado suma a los lados lo que el SwipeRow
 * agrega al renglón (borde, relleno y el botón ⋯, que con revealSide="start" va a la izquierda) para alinear columnas.
 */
.fiscal-scroll { overflow-x: auto; }
.fiscal-columns, .fiscal-row { display: grid; grid-template-columns: 24px 8.5rem 10.5rem minmax(12rem, 1.4fr) 8.5rem repeat(10, minmax(6.5rem, .7fr)) 7.5rem; gap: 10px; align-items: start; }
.fiscal-columns, .fiscal-list { min-width: 2060px; }
.fiscal-columns { align-items: end; }
.fiscal-columns { padding: 8px 38px 8px 78px; border-top: 2px solid var(--borderColor); font-family: var(--monoFontFamily); font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--mutedTextColor); }
.fiscal-list { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--hairlineColor); }
.fiscal-row { padding: 10px 20px; background: var(--surfaceColor); font-size: 13px; }
/* Atención (0 %, exento o egreso) y revisión excepcional, con un filete a la izquierda además del color. */
.fiscal-row.is-attention { background: color-mix(in srgb, var(--warningColor) 12%, var(--surfaceColor)); box-shadow: inset 4px 0 0 var(--warningColor); }
.fiscal-row.is-warning { box-shadow: inset 4px 0 0 var(--errorColor); }
.fiscal-row small { display: block; color: var(--mutedTextColor); font-size: 11px; }
.fiscal-status, .fiscal-payment, .fiscal-date { display: grid; gap: 3px; justify-items: start; min-width: 0; }
.fiscal-warning { color: var(--errorText) !important; overflow-wrap: anywhere; }
.fiscal-applied { font-family: var(--monoFontFamily); }
.fiscal-name { min-width: 0; overflow-wrap: anywhere; }
.fiscal-rfc, .fiscal-date { font-family: var(--monoFontFamily); font-size: 12px; }
.fiscal-group { padding: 8px 20px; border-top: 2px solid var(--borderColor); background: var(--subtleColor); font-family: var(--monoFontFamily); font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
.fiscal-selection { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 16px; padding: 8px 20px; font-size: 13px; }
.fiscal-legend-group { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
.fiscal-legend { display: flex; flex-wrap: wrap; gap: 12px; color: var(--mutedTextColor); font-size: 12px; }
.fiscal-legend span::before { content: ""; display: inline-block; width: 12px; height: 12px; margin-right: 6px; vertical-align: -2px; border: 2px solid var(--borderColor); }
.legend-attention::before { background: color-mix(in srgb, var(--warningColor) 30%, var(--surfaceColor)); }
.legend-warning::before { background: var(--errorColor); }
.number { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.fiscal-empty { display: grid; gap: 4px; justify-items: center; padding: 40px 16px; text-align: center; color: var(--mutedTextColor); }
.fiscal-empty strong { color: var(--textColor); }
.fiscal-xml { max-height: 420px; overflow: auto; padding: var(--spaceMedium); border: 2px solid var(--borderColor); background: var(--subtleColor); font-family: var(--monoFontFamily); font-size: 12px; white-space: pre-wrap; overflow-wrap: anywhere; }
</style>
