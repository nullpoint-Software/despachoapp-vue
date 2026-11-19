<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { CheckCircle2, Download, FileText } from '@lucide/vue'
import { getOfficeToday } from '../../../shared/contracts/movements'
import type { ObligationReportRow, ReportStatusFilter } from '../../../shared/contracts/taxObligations'
import { classifyObligationReport, countObligationReport, filterObligationReport, type ClassifiedObligationRow } from '../../../shared/fiscal/classifyObligationReport'
import { describePeriod } from '../../../shared/fiscal/taxObligationSchedule'
import ActionButton from '../../shared/components/ActionButton.vue'
import FormModal from '../../shared/components/FormModal.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import SearchBox from '../../shared/components/SearchBox.vue'
import SelectField from '../../shared/components/SelectField.vue'
import StatusBadge from '../../shared/components/StatusBadge.vue'
import { readIpcErrorMessage } from '../../shared/ipcErrorMessage'
import { useNotifications } from '../../shared/notifications/notificationStore'
import { handlePdfResult } from '../../shared/pdf/pdfViewerState'
import { workspaceAccess } from '../workspace/sessionState'
import { monthNames } from '../reports/reportLabels'
import { formatBusinessDay, formatInstant, obligationStatusTexts, obligationStatusTones } from './obligationPresentation'
import TaxObligationMarkForm from './TaxObligationMarkForm.vue'

/**
 * Reporte de obligaciones fiscales del periodo para TODOS los clientes asignados (2026-10-18, pedido del usuario:
 * "un reporte… y si ya se realizaron"). Cajón "Obligaciones de clientes" de Fiscal.
 * - Ejercicio y mes: se listan las obligaciones cuyo periodo termina en ese mes (mensuales cada mes, bimestrales en
 *   meses pares, trimestrales cada tres meses y anuales en diciembre).
 * - Filtro por estado (Todas, Vencidas, Pendientes, Cumplidas) con sus totales y búsqueda por cliente o RFC.
 * - "Marcar cumplida" desde el renglón (mismo formulario por pasos); el Host exige `reports.manage` y asignación de
 *   escritura, así que con sólo lectura el intento se rechaza con su mensaje.
 * - PDF del periodo con el filtro de estado elegido (Ver en el visor o Guardar), con el mismo patrón que el reporte de
 *   tareas: Main vuelve a pedir el reporte al Host.
 */
const { notify } = useNotifications()
const now = new Date()
const fiscalYear = ref(String(now.getFullYear())), fiscalMonth = ref(String(now.getMonth() + 1))
const yearOptions = [...Array(6).keys()].map(offset => ({ value: String(now.getFullYear() + 1 - offset), label: String(now.getFullYear() + 1 - offset) }))
const monthOptions = monthNames.map((name, index) => ({ value: String(index + 1), label: name }))
const statusFilter = ref<ReportStatusFilter>('all'), search = ref('')
const rows = ref<ObligationReportRow[]>([]), isLoading = ref(false), isBusy = ref(false), error = ref('')
const markTarget = ref<ClassifiedObligationRow | null>(null)
let isMounted = true

async function load(): Promise<void> {
  isLoading.value = true; error.value = ''
  try {
    const result = await window.contapp.manageTaxObligations({ action: 'report', fiscalYear: Number(fiscalYear.value), fiscalMonth: Number(fiscalMonth.value) })
    if (isMounted && result.status === 'report') rows.value = result.rows
  } catch (caught) { if (isMounted) { rows.value = []; error.value = readIpcErrorMessage(caught, 'No se pudo consultar el reporte de obligaciones.') } }
  finally { isLoading.value = false }
}
watch([fiscalYear, fiscalMonth], () => { void load() }, { immediate: true })

const classified = computed(() => classifyObligationReport(rows.value, Number(fiscalYear.value), getOfficeToday()))
const counts = computed(() => countObligationReport(classified.value))
const visibleRows = computed(() => {
  const term = search.value.trim().toLocaleLowerCase('es-MX')
  return filterObligationReport(classified.value, statusFilter.value).filter(row => !term || row.clientDisplayName.toLocaleLowerCase('es-MX').includes(term) || row.clientRfc.toLocaleLowerCase('es-MX').includes(term))
})
const filterTabs = computed<{ value: ReportStatusFilter; label: string; count: number }[]>(() => [
  { value: 'all', label: 'Todas', count: counts.value.total }, { value: 'overdue', label: 'Vencidas', count: counts.value.overdue },
  { value: 'pending', label: 'Pendientes', count: counts.value.pending }, { value: 'fulfilled', label: 'Cumplidas', count: counts.value.fulfilled }])

async function openPdf(action: 'preview' | 'save'): Promise<void> {
  isBusy.value = true
  try {
    if (handlePdfResult(await window.contapp.openObligationReportPdf({ fiscalYear: Number(fiscalYear.value), fiscalMonth: Number(fiscalMonth.value), statusFilter: statusFilter.value, action }))) notify('PDF guardado', 'El reporte de obligaciones se guardó donde elegiste.', 'success')
  } catch (caught) { error.value = readIpcErrorMessage(caught, 'No se generó el PDF del reporte.') }
  finally { isBusy.value = false }
}
async function mark(note: string): Promise<void> {
  const target = markTarget.value
  if (!target) return
  isBusy.value = true
  try {
    await window.contapp.manageTaxObligations({ action: 'mark', obligationId: target.obligation.obligationId, fiscalYear: Number(fiscalYear.value), periodNumber: target.periodNumber, note })
    notify('Obligación cumplida', target.clientDisplayName + ' · ' + target.obligation.description, 'success')
    markTarget.value = null
  } catch (caught) { error.value = readIpcErrorMessage(caught, 'No se marcó la obligación. Revisa que tengas acceso de escritura al cliente.') }
  finally { isBusy.value = false; await load() }
}
onBeforeUnmount(() => { isMounted = false })
</script>
<template>
  <div
    class="obligation-report"
    data-testid="tax-obligations-report"
  >
    <div class="obligation-report-toolbar">
      <SelectField
        id="obligation-report-year"
        v-model="fiscalYear"
        label="Ejercicio"
        :options="yearOptions"
      />
      <SelectField
        id="obligation-report-month"
        v-model="fiscalMonth"
        label="Mes"
        :options="monthOptions"
      />
      <SearchBox
        id="obligation-report-search"
        v-model="search"
        label="Buscar cliente"
        placeholder="Cliente o RFC"
      />
      <div class="actions">
        <ActionButton
          :disabled="isBusy"
          @click="openPdf('preview')"
        >
          <FileText
            :size="16"
            aria-hidden="true"
          /> Ver PDF
        </ActionButton>
        <ActionButton
          :disabled="isBusy"
          @click="openPdf('save')"
        >
          <Download
            :size="16"
            aria-hidden="true"
          /> Guardar PDF
        </ActionButton>
      </div>
    </div>
    <InlineNotice
      v-if="error"
      title="Operación no confirmada"
      tone="error"
    >
      <p>{{ error }}</p>
    </InlineNotice>
    <div
      v-sliding-tabs
      class="segmented-tabs"
      role="tablist"
      aria-label="Estado"
    >
      <button
        v-for="tab in filterTabs"
        :key="tab.value"
        type="button"
        role="tab"
        :aria-selected="statusFilter === tab.value"
        :data-filter="tab.value"
        @click="statusFilter = tab.value"
      >
        {{ tab.label }} · {{ tab.count }}
      </button>
    </div>
    <ul
      class="obligation-report-list"
      aria-label="Obligaciones del periodo"
      data-testid="obligation-report-list"
    >
      <li
        v-for="row in visibleRows"
        :key="row.obligation.obligationId + ':' + row.periodNumber"
        :class="'is-' + row.status"
        :data-status="row.status"
      >
        <div class="report-client">
          <strong>{{ row.clientDisplayName }}</strong>
          <small>{{ row.clientRfc || 'Sin RFC' }}</small>
        </div>
        <div class="report-obligation">
          <span>{{ row.obligation.description }}</span>
          <small>{{ describePeriod(row.obligation.periodicity, row.periodNumber, Number(fiscalYear)) }} · vence {{ formatBusinessDay(row.dueDate) }}</small>
        </div>
        <div class="report-status">
          <StatusBadge :tone="obligationStatusTones[row.status]">
            {{ obligationStatusTexts[row.status] }}
          </StatusBadge>
          <small v-if="row.fulfillment">{{ row.fulfillment.markedByDisplayName }} · {{ formatInstant(row.fulfillment.markedAt) }}{{ row.fulfillment.note ? ' · ' + row.fulfillment.note : '' }}</small>
          <ActionButton
            v-else-if="workspaceAccess.canManageReports"
            @click="markTarget = row"
          >
            <CheckCircle2
              :size="16"
              aria-hidden="true"
            /> Marcar cumplida
          </ActionButton>
        </div>
      </li>
      <li
        v-if="!visibleRows.length"
        class="obligation-report-empty"
      >
        <strong>{{ isLoading ? 'Consultando…' : 'No hay obligaciones con este filtro' }}</strong>
        <span v-if="!isLoading">Registra las obligaciones de cada cliente en Fiscal → Obligaciones.</span>
      </li>
    </ul>
    <FormModal
      :is-open="Boolean(markTarget)"
      title="Marcar como cumplida"
      :description="markTarget?.clientDisplayName ?? ''"
      :is-busy="isBusy"
      test-id="obligation-report-mark-modal"
      @close="markTarget = null"
    >
      <TaxObligationMarkForm
        v-if="markTarget"
        :client-name="markTarget.clientDisplayName"
        :obligation-description="markTarget.obligation.description"
        :period-label="describePeriod(markTarget.obligation.periodicity, markTarget.periodNumber, Number(fiscalYear))"
        :due-date-label="formatBusinessDay(markTarget.dueDate)"
        :is-busy="isBusy"
        @save="mark"
        @cancel="markTarget = null"
      />
    </FormModal>
  </div>
</template>
<style scoped>
.obligation-report { display: grid; gap: var(--spaceMedium); }
.obligation-report-toolbar { display: flex; flex-wrap: wrap; align-items: end; gap: 12px; }
.obligation-report-toolbar > .field { flex: 0 1 9rem; }
.obligation-report-toolbar .actions { margin-left: auto; }
.obligation-report-list { list-style: none; margin: 0; padding: 0; border-top: 2px solid var(--borderColor); }
.obligation-report-list > li { display: grid; grid-template-columns: minmax(10rem, 1fr) minmax(14rem, 2fr) minmax(10rem, 1fr); gap: 12px; align-items: start; padding: 10px 14px; border-bottom: 1px solid var(--hairlineColor); background: var(--surfaceColor); }
/* Franja y fondo por estado (2026-10-19, colores más llamativos): rojo vencida, ámbar pendiente, verde cumplida. */
.obligation-report-list > li.is-overdue { background: var(--errorFill); box-shadow: inset 6px 0 0 var(--errorColor); }
.obligation-report-list > li.is-pending { background: var(--warningFill); box-shadow: inset 6px 0 0 var(--warningColor); }
.obligation-report-list > li.is-fulfilled { background: var(--successFill); box-shadow: inset 6px 0 0 var(--successColor); }
.obligation-report-list > li[class^="is-"] { padding-left: 20px; }
.obligation-report-list small { display: block; color: var(--mutedTextColor); font-size: 12px; }
.report-client, .report-obligation, .report-status { display: grid; gap: 4px; justify-items: start; min-width: 0; overflow-wrap: anywhere; }
.report-client small { font-family: var(--monoFontFamily); }
.obligation-report-empty { grid-template-columns: 1fr !important; justify-items: center; padding: 32px 16px !important; text-align: center; color: var(--mutedTextColor); }
.obligation-report-empty strong { color: var(--textColor); }
@container (max-width: 640px) { .obligation-report-list > li { grid-template-columns: minmax(0, 1fr); } }
</style>
