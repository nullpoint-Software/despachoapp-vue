<script setup lang="ts">
import { computed, ref } from 'vue'
import type { LocalXmlRecord } from '../../../shared/contracts/localXml'
import type { ReportType } from '../../../shared/contracts/fiscalReports'
import ActionButton from '../../shared/components/ActionButton.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import SelectField from '../../shared/components/SelectField.vue'
import TextField from '../../shared/components/TextField.vue'
import CaptureSteps from '../../shared/components/CaptureSteps.vue'
import { useNotifications } from '../../shared/notifications/notificationStore'
import { readIpcErrorMessage } from '../../shared/ipcErrorMessage'
import { matchCfdiClient, type CfdiClientMatch } from '../xml/cfdiClientMatch'
import { reportDirectionLabels, reportTypeLabels, suggestReportName, monthNames } from './reportLabels'

/**
 * "Guardar reporte" (6.2), como el modal del original: los CFDI elegidos en la biblioteca, su cliente y
 * movimiento (por RFC) y el periodo. La vista sólo comprueba que la selección sea coherente para explicar
 * el problema antes de enviarla; Main analiza los XML y el Host vuelve a validar todo.
 * Por pasos (ADR-034): Selección (tipo y lo que se reportará) → Nombre → Revisar.
 */
const props = defineProps<{ records: LocalXmlRecord[]; clientIndex: Map<string, { clientId: string; clientName: string }> }>()
const emit = defineEmits<{ saved: []; cancel: [] }>()
const { notify } = useNotifications()
const reportType = ref<ReportType>('monthly'), isSaving = ref(false), error = ref('')
const typeOptions = (['monthly', 'annual'] as const).map(value => ({ value, label: reportTypeLabels[value] }))

/** Cliente, movimiento y periodo comunes a la selección, o el motivo por el que no se puede guardar. */
type SelectionState = { isValid: false; problem: string } | { isValid: true; match: CfdiClientMatch; fiscalYear: number; fiscalMonth: number }
const selection = computed((): SelectionState => {
  const matches = props.records.map(record => matchCfdiClient(record, props.clientIndex))
  if (matches.some(match => !match)) return { isValid: false, problem: 'Hay CFDI sin cliente. Sólo se pueden reportar CFDI cuyo emisor o receptor sea un cliente asignado con RFC capturado.' }
  if (new Set(matches.map(match => match!.clientId)).size > 1) return { isValid: false, problem: 'La selección contiene CFDI de clientes distintos. Filtra por RFC y vuelve a seleccionarlos.' }
  if (new Set(matches.map(match => match!.direction)).size > 1) return { isValid: false, problem: 'La selección contiene CFDI de un movimiento distinto (emitidas y recibidas).' }
  if (props.records.some(record => record.voucherType !== 'I' && record.voucherType !== 'E')) return { isValid: false, problem: 'Sólo se reportan ingresos y egresos; quita pagos, nóminas o traslados de la selección.' }
  const periods = new Set(props.records.map(record => record.issuedAt.slice(0, reportType.value === 'monthly' ? 7 : 4)))
  if (periods.size > 1) return { isValid: false, problem: reportType.value === 'monthly' ? 'Todos los CFDI seleccionados deben pertenecer al mismo mes y año. Filtra el mes y vuelve a seleccionarlos.' : 'Todos los CFDI seleccionados deben pertenecer al mismo ejercicio.' }
  const first = props.records[0]!
  return { isValid: true, match: matches[0]!, fiscalYear: Number(first.issuedAt.slice(0, 4)), fiscalMonth: Number(first.issuedAt.slice(5, 7)) }
})
const suggestedName = computed(() => { const current = selection.value; return current.isValid ? suggestReportName(reportType.value, current.match.direction, current.fiscalYear, current.fiscalMonth) : '' })
const typedName = ref('')
const displayName = computed({ get: () => typedName.value || suggestedName.value, set: value => { typedName.value = value } })

const currentStep = ref(0)
const steps = [{ stepId: 'selection', title: 'Selección' }, { stepId: 'name', title: 'Nombre' }]
function validateStep(index: number): boolean {
  error.value = ''
  if (index === 0 && !selection.value.isValid) error.value = selection.value.problem
  if (index === 1 && !displayName.value.trim()) error.value = 'Escribe un nombre para el reporte.'
  return !error.value
}
const reviewItems = computed(() => {
  const current = selection.value
  return [
    { label: 'Nombre', value: displayName.value.trim() },
    { label: 'Tipo', value: reportTypeLabels[reportType.value] },
    { label: 'Cliente', value: current.isValid ? current.match.clientName : '' },
    { label: 'Movimiento', value: current.isValid ? reportDirectionLabels[current.match.direction] : '' },
    { label: 'Periodo', value: current.isValid ? (reportType.value === 'monthly' ? monthNames[current.fiscalMonth - 1] + ' ' : 'Ejercicio ') + current.fiscalYear : '' },
    { label: 'CFDI', value: String(props.records.length) }
  ]
})
async function save(): Promise<void> {
  const current = selection.value
  if (!(current.isValid) || isSaving.value) return
  if (!displayName.value.trim()) { error.value = 'Escribe un nombre para el reporte.'; return }
  isSaving.value = true; error.value = ''
  try {
    const result = await window.contapp.addCfdisToReport({ clientId: current.match.clientId, reportType: reportType.value, displayName: displayName.value.trim(), uuids: props.records.map(record => record.uuid) })
    if (result.status === 'added') {
      // El aviso abre el reporte en el cajón "Reportes guardados" del Fiscal de su cliente.
      const target = { section: 'fiscal' as const, itemId: result.report.clientId, view: 'reports', nestedItemId: result.report.reportId, label: 'el reporte ' + result.report.displayName }
      notify(result.isNewReport ? 'Reporte guardado' : 'Reporte actualizado', result.addedCount ? result.addedCount + ' CFDI agregado(s) a ' + result.report.displayName + '.' : 'Los CFDI seleccionados ya pertenecían a este reporte.', 'success', { target })
      emit('saved')
    }
  } catch (caught) { error.value = readIpcErrorMessage(caught, 'No se agregaron los CFDI. Revisa tu sesión y la conexión con el Host.') }
  finally { isSaving.value = false }
}
</script>
<template>
  <form
    class="create-report"
    data-testid="create-report-form"
    @submit.prevent
  >
    <InlineNotice
      v-if="!selection.isValid"
      title="Revisa la selección"
      tone="warning"
    >
      <p>{{ selection.problem }}</p>
    </InlineNotice>
    <InlineNotice
      v-if="error"
      title="No se guardó el reporte"
      tone="error"
    >
      <p>{{ error }}</p>
    </InlineNotice>
    <CaptureSteps
      v-model="currentStep"
      :steps="steps"
      :review-items="reviewItems"
      :validate="validateStep"
      :is-busy="isSaving"
      :can-complete="selection.isValid"
      complete-label="Guardar reporte"
      @complete="save"
    >
      <template #step-selection>
        <div class="create-report-grid">
          <SelectField
            id="report-type"
            :model-value="reportType"
            label="Tipo"
            :options="typeOptions"
            :disabled="isSaving"
            @update:model-value="reportType = $event as ReportType"
          />
          <dl
            v-if="selection.isValid"
            class="create-report-facts"
          >
            <div><dt>Cliente</dt><dd>{{ selection.match.clientName }}</dd></div>
            <div><dt>Movimiento</dt><dd>{{ reportDirectionLabels[selection.match.direction] }}</dd></div>
            <div><dt>Periodo</dt><dd>{{ reportType === 'monthly' ? monthNames[selection.fiscalMonth - 1] + ' ' : 'Ejercicio ' }}{{ selection.fiscalYear }}</dd></div>
          </dl>
        </div>
        <p class="field-help">
          {{ records.length }} CFDI. Sus datos fiscales se guardan en el Host para que otros equipos vean el reporte; el XML original se queda en este equipo.
          <template v-if="selection.isValid && reportType === 'monthly' && selection.match.direction === 'received'">
            La DIOT del mes se calcula con este reporte.
          </template>
        </p>
      </template>
      <template #step-name>
        <TextField
          id="report-name"
          v-model="displayName"
          label="Nombre del reporte"
          :disabled="isSaving"
          help="Si ya existe un reporte del mismo cliente, tipo, movimiento y periodo, los CFDI se agregan a ese."
        />
      </template>
      <template #footer-start>
        <ActionButton
          :disabled="isSaving"
          @click="emit('cancel')"
        >
          Cancelar
        </ActionButton>
      </template>
    </CaptureSteps>
  </form>
</template>
<style scoped>
.create-report { display: grid; gap: var(--spaceMedium); }
.create-report-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: var(--spaceMedium); align-items: start; }
.create-report-facts { margin: 0; display: grid; gap: 8px; }
.create-report-facts div { display: flex; justify-content: space-between; gap: 12px; border-bottom: 1px solid var(--hairlineColor); padding-bottom: 6px; }
.create-report-facts dt { font-family: var(--monoFontFamily); font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--mutedTextColor); }
.create-report-facts dd { margin: 0; text-align: right; overflow-wrap: anywhere; }
</style>
