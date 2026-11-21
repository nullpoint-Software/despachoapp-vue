<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Plus } from '@lucide/vue'
import type { TaxObligation, TaxObligationDraft, TaxObligationFulfillment } from '../../../shared/contracts/taxObligations'
import { getOfficeToday } from '../../../shared/contracts/movements'
import { countPeriods, describeDueRule, describePeriod, dueDateOf, periodicityLabels, statusOf, type ObligationStatus } from '../../../shared/fiscal/taxObligationSchedule'
import { describeTaxRegime } from '../../../shared/fiscal/taxRegimes'
import ActionButton from '../../shared/components/ActionButton.vue'
import FormModal from '../../shared/components/FormModal.vue'
import HelpTip from '../../shared/components/HelpTip.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import SelectField from '../../shared/components/SelectField.vue'
import StatusBadge from '../../shared/components/StatusBadge.vue'
import HoldButton from '../../shared/vueBits/HoldButton.vue'
import { readIpcErrorMessage } from '../../shared/ipcErrorMessage'
import { useNotifications } from '../../shared/notifications/notificationStore'
import type { FiscalClient } from './fiscalClients'
import { formatBusinessDay, formatInstant, obligationSourceTexts, obligationStatusTexts, obligationStatusTones, shortPeriodLabel } from './obligationPresentation'
import TaxObligationForm from './TaxObligationForm.vue'
import TaxObligationMarkForm from './TaxObligationMarkForm.vue'

/**
 * Obligaciones fiscales de UN cliente (2026-10-18, [[modules/TAX-OBLIGATIONS]]), en el cajón "Obligaciones" de Fiscal.
 * - Ejercicio elegido y, por obligación, una celda por periodo (12 meses, 6 bimestres, 4 trimestres o el anual) con
 *   su estado: cumplida, pendiente, vencida (pasó la fecha límite sin marcar) o no aplica (antes del inicio).
 * - Celda sin marcar → "Marcar como cumplida" (TaxObligationMarkForm, por pasos). Celda cumplida → quién, cuándo y la
 *   nota, con "Desmarcar" manteniendo presionado.
 * - "Agregar obligaciones" (TaxObligationForm): de la constancia, por régimen o manual. "Retirar" (mantener presionado)
 *   la quita del cliente sin borrar su historial.
 * Las acciones de cambio sólo aparecen con `canManage` (permiso de administrar reportes y asignación de escritura);
 * el Host lo vuelve a verificar. Todo es GLOBAL: lo ven los demás equipos con permiso.
 */
const props = defineProps<{ client: FiscalClient }>()
const { notify } = useNotifications()
const currentYear = new Date().getFullYear()
const fiscalYear = ref(String(currentYear))
const yearOptions = [...Array(6).keys()].map(offset => ({ value: String(currentYear + 1 - offset), label: String(currentYear + 1 - offset) }))
const obligations = ref<TaxObligation[]>([]), fulfillments = ref<TaxObligationFulfillment[]>([]), taxRegimes = ref<string[]>([]), canManage = ref(false)
const isLoading = ref(false), isBusy = ref(false), error = ref('')
const isAddOpen = ref(false)
const selectedCell = ref<{ obligation: TaxObligation; periodNumber: number } | null>(null)
let isMounted = true
const today = getOfficeToday()

async function load(): Promise<void> {
  isLoading.value = true; error.value = ''
  try {
    const result = await window.contapp.manageTaxObligations({ action: 'listClient', clientId: props.client.clientId, fiscalYear: Number(fiscalYear.value) })
    if (!isMounted || result.status !== 'client') return
    obligations.value = result.obligations; fulfillments.value = result.fulfillments; taxRegimes.value = result.taxRegimes; canManage.value = result.canManage
  } catch (caught) { if (isMounted) error.value = readIpcErrorMessage(caught, 'No se pudieron consultar las obligaciones.') }
  finally { isLoading.value = false }
}
watch([fiscalYear, () => props.client.clientId], () => { selectedCell.value = null; void load() }, { immediate: true })

const fulfillmentOf = (obligationId: string, periodNumber: number) => fulfillments.value.find(item => item.obligationId === obligationId && item.periodNumber === periodNumber) ?? null
function cellsOf(obligation: TaxObligation): { periodNumber: number; status: ObligationStatus; label: string; dueDate: string }[] {
  const year = Number(fiscalYear.value)
  return Array.from({ length: countPeriods(obligation.periodicity) }, (_, index) => {
    const periodNumber = index + 1
    return { periodNumber, label: shortPeriodLabel(obligation.periodicity, periodNumber), dueDate: dueDateOf(obligation, year, periodNumber),
      status: statusOf(obligation, year, periodNumber, fulfillmentOf(obligation.obligationId, periodNumber) !== null, today) }
  })
}
/** Totales del ejercicio para el resumen superior (los periodos que no aplican no cuentan). */
const totals = computed(() => {
  const statuses = obligations.value.flatMap(obligation => cellsOf(obligation).map(cell => cell.status))
  return { fulfilled: statuses.filter(status => status === 'fulfilled').length, overdue: statuses.filter(status => status === 'overdue').length, pending: statuses.filter(status => status === 'pending').length }
})
const selected = computed(() => {
  const cell = selectedCell.value
  if (!cell) return null
  const year = Number(fiscalYear.value)
  return { ...cell, fulfillment: fulfillmentOf(cell.obligation.obligationId, cell.periodNumber), periodLabel: describePeriod(cell.obligation.periodicity, cell.periodNumber, year),
    dueDateLabel: formatBusinessDay(dueDateOf(cell.obligation, year, cell.periodNumber)) }
})

async function addObligations(drafts: TaxObligationDraft[]): Promise<void> {
  isBusy.value = true
  try {
    const result = await window.contapp.manageTaxObligations({ action: 'add', clientId: props.client.clientId, obligations: drafts })
    if (result.status === 'added') notify('Obligaciones guardadas', result.addedCount + ' nueva(s)' + (result.skippedCount ? '; ' + result.skippedCount + ' ya las tenía el cliente.' : '.'), 'success')
    isAddOpen.value = false
    await load()
  } catch (caught) { error.value = readIpcErrorMessage(caught, 'No se guardaron las obligaciones.') }
  finally { isBusy.value = false }
}
async function mark(note: string): Promise<void> {
  const cell = selectedCell.value
  if (!cell) return
  isBusy.value = true
  try {
    await window.contapp.manageTaxObligations({ action: 'mark', obligationId: cell.obligation.obligationId, fiscalYear: Number(fiscalYear.value), periodNumber: cell.periodNumber, note })
    notify('Obligación cumplida', cell.obligation.description + ' · ' + describePeriod(cell.obligation.periodicity, cell.periodNumber, Number(fiscalYear.value)), 'success')
    selectedCell.value = null
  } catch (caught) { error.value = readIpcErrorMessage(caught, 'No se marcó la obligación. Si otro equipo ya la marcó, actualiza.') }
  finally { isBusy.value = false; await load() }
}
async function unmark(): Promise<void> {
  const cell = selectedCell.value
  if (!cell) return
  isBusy.value = true
  try {
    await window.contapp.manageTaxObligations({ action: 'unmark', obligationId: cell.obligation.obligationId, fiscalYear: Number(fiscalYear.value), periodNumber: cell.periodNumber })
    notify('Marca retirada', 'El periodo vuelve a quedar pendiente.', 'success')
    selectedCell.value = null
  } catch (caught) { error.value = readIpcErrorMessage(caught, 'No se desmarcó la obligación.') }
  finally { isBusy.value = false; await load() }
}
async function retire(obligation: TaxObligation): Promise<void> {
  isBusy.value = true
  try {
    await window.contapp.manageTaxObligations({ action: 'retire', obligationId: obligation.obligationId })
    notify('Obligación retirada', obligation.description, 'success')
  } catch (caught) { error.value = readIpcErrorMessage(caught, 'No se retiró la obligación.') }
  finally { isBusy.value = false; await load() }
}
onBeforeUnmount(() => { isMounted = false })
</script>
<template>
  <div
    class="obligations-panel"
    data-testid="tax-obligations-panel"
  >
    <div class="obligations-toolbar">
      <SelectField
        id="obligations-year"
        v-model="fiscalYear"
        label="Ejercicio"
        :options="yearOptions"
      />
      <p class="obligations-regimes">
        <span>Regímenes</span>
        {{ taxRegimes.length ? taxRegimes.map(describeTaxRegime).join(' / ') : 'Sin régimen en la ficha' }}
      </p>
      <ActionButton
        v-if="canManage"
        variant="primary"
        data-testid="obligations-add"
        @click="isAddOpen = true"
      >
        <Plus
          :size="16"
          aria-hidden="true"
        /> Agregar obligaciones
      </ActionButton>
      <HelpTip
        title="Cómo se calcula el estado"
        text="Cada celda es un periodo del ejercicio. Vencida: pasó la fecha límite y nadie la marcó. Las fechas no recorren fines de semana ni días inhábiles. Las marcas se guardan en el Host y las ven los demás equipos."
      />
    </div>
    <InlineNotice
      v-if="error"
      title="Operación no confirmada"
      tone="error"
    >
      <p>{{ error }}</p>
    </InlineNotice>
    <section
      class="obligations-summary"
      aria-label="Resumen del ejercicio"
    >
      <div class="is-overdue">
        <span>Vencidas</span><strong>{{ totals.overdue }}</strong>
      </div>
      <div class="is-pending">
        <span>Pendientes</span><strong>{{ totals.pending }}</strong>
      </div>
      <div class="is-fulfilled">
        <span>Cumplidas</span><strong>{{ totals.fulfilled }}</strong>
      </div>
    </section>
    <ul
      class="obligations-list"
      aria-label="Obligaciones del cliente"
      data-testid="obligations-list"
    >
      <li
        v-for="obligation in obligations"
        :key="obligation.obligationId"
      >
        <div class="obligation-head">
          <div>
            <strong>{{ obligation.description }}</strong>
            <small>{{ periodicityLabels[obligation.periodicity] }} · {{ describeDueRule(obligation) }} · {{ obligationSourceTexts[obligation.source] }}{{ obligation.startsOn ? ' · desde ' + formatBusinessDay(obligation.startsOn) : '' }}</small>
          </div>
          <HoldButton
            v-if="canManage"
            size="small"
            :aria-label="'Retirar la obligación ' + obligation.description"
            :is-disabled="isBusy"
            @hold="retire(obligation)"
          >
            Retirar
          </HoldButton>
        </div>
        <div
          class="obligation-cells"
          role="group"
          :aria-label="'Periodos de ' + obligation.description"
        >
          <button
            v-for="cell in cellsOf(obligation)"
            :key="cell.periodNumber"
            type="button"
            class="obligation-cell"
            :class="'is-' + cell.status"
            :data-status="cell.status"
            :disabled="cell.status === 'notApplicable' || (cell.status !== 'fulfilled' && !canManage)"
            :aria-label="describePeriod(obligation.periodicity, cell.periodNumber, Number(fiscalYear)) + ': ' + obligationStatusTexts[cell.status] + ', vence ' + formatBusinessDay(cell.dueDate)"
            :title="'Vence ' + formatBusinessDay(cell.dueDate)"
            @click="selectedCell = { obligation, periodNumber: cell.periodNumber }"
          >
            <span>{{ cell.label }}</span>
            <small>{{ obligationStatusTexts[cell.status] }}</small>
          </button>
        </div>
      </li>
      <li
        v-if="!obligations.length"
        class="obligations-empty"
      >
        <strong>{{ isLoading ? 'Consultando obligaciones…' : 'Este cliente no tiene obligaciones registradas' }}</strong>
        <span v-if="!isLoading && canManage">Agrégalas desde su constancia de situación fiscal o con las sugeridas por régimen.</span>
      </li>
    </ul>

    <FormModal
      :is-open="isAddOpen"
      title="Agregar obligaciones"
      :description="client.displayName + ' · ' + (client.rfc || 'Sin RFC')"
      :is-busy="isBusy"
      test-id="obligation-add-modal"
      @close="isAddOpen = false"
    >
      <TaxObligationForm
        v-if="isAddOpen"
        :client-id="client.clientId"
        :client-rfc="client.rfc"
        :tax-regimes="taxRegimes"
        :is-busy="isBusy"
        @save="addObligations"
        @cancel="isAddOpen = false"
      />
    </FormModal>
    <FormModal
      :is-open="Boolean(selected && !selected.fulfillment)"
      title="Marcar como cumplida"
      :description="client.displayName"
      :is-busy="isBusy"
      test-id="obligation-mark-modal"
      @close="selectedCell = null"
    >
      <TaxObligationMarkForm
        v-if="selected && !selected.fulfillment"
        :client-name="client.displayName"
        :obligation-description="selected.obligation.description"
        :period-label="selected.periodLabel"
        :due-date-label="selected.dueDateLabel"
        :is-busy="isBusy"
        @save="mark"
        @cancel="selectedCell = null"
      />
    </FormModal>
    <FormModal
      :is-open="Boolean(selected?.fulfillment)"
      title="Obligación cumplida"
      :description="selected ? selected.obligation.description + ' · ' + selected.periodLabel : ''"
      test-id="obligation-detail-modal"
      @close="selectedCell = null"
    >
      <template v-if="selected?.fulfillment">
        <dl class="obligation-detail">
          <div>
            <dt>Estado</dt><dd>
              <StatusBadge :tone="obligationStatusTones.fulfilled">
                {{ obligationStatusTexts.fulfilled }}
              </StatusBadge>
            </dd>
          </div>
          <div><dt>Marcada por</dt><dd>{{ selected.fulfillment.markedByDisplayName }}</dd></div>
          <div><dt>Cuándo</dt><dd>{{ formatInstant(selected.fulfillment.markedAt) }}</dd></div>
          <div><dt>Fecha límite</dt><dd>{{ selected.dueDateLabel }}</dd></div>
          <div><dt>Nota o acuse</dt><dd>{{ selected.fulfillment.note || 'Sin nota' }}</dd></div>
        </dl>
        <div
          v-if="canManage"
          class="actions form-footer"
        >
          <HoldButton
            size="small"
            aria-label="Desmarcar el periodo"
            :is-disabled="isBusy"
            @hold="unmark"
          >
            Desmarcar
          </HoldButton>
        </div>
      </template>
    </FormModal>
  </div>
</template>
<style scoped>
.obligations-panel { display: grid; gap: var(--spaceMedium); }
.obligations-toolbar { display: flex; flex-wrap: wrap; align-items: end; gap: 12px; }
.obligations-toolbar > .field { flex: 0 1 9rem; }
.obligations-regimes { flex: 1 1 14rem; display: grid; gap: 2px; margin: 0; font-size: 13px; }
.obligations-regimes span, .obligations-summary span, .obligation-detail dt { font-family: var(--monoFontFamily); font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--mutedTextColor); }
.obligations-summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--spaceMedium); }
.obligations-summary div { display: grid; gap: 4px; padding: 10px 14px; border: 2px solid var(--borderColor); background: var(--surfaceColor); box-shadow: var(--buttonShadow); }
.obligations-summary div.is-overdue { border-color: var(--errorColor); background: var(--errorColor); color: var(--solidInk); }
.obligations-summary div.is-pending { border-color: var(--warningColor); background: var(--warningFill); color: var(--warningText); }
.obligations-summary div.is-fulfilled { border-color: var(--successColor); background: var(--successFill); color: var(--successText); }
.obligations-summary div[class^="is-"] span { color: inherit; opacity: .85; }
.obligations-summary strong { font-size: 22px; font-weight: 800; font-variant-numeric: tabular-nums; }
.obligations-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.obligations-list > li { display: grid; gap: 10px; padding: 12px 14px; border: 2px solid var(--borderColor); background: var(--surfaceColor); }
.obligation-head { display: flex; align-items: start; justify-content: space-between; gap: 12px; }
.obligation-head > div { display: grid; gap: 2px; min-width: 0; }
.obligation-head strong { overflow-wrap: anywhere; }
.obligation-head small { color: var(--mutedTextColor); font-size: 12px; }
/* 5.75rem: cabe «PENDIENTE» (la palabra de estado más larga) en mono mayúsculas sin salirse de la celda. */
.obligation-cells { display: grid; grid-template-columns: repeat(auto-fill, minmax(5.75rem, 1fr)); gap: 6px; }
.obligation-cell { display: grid; gap: 2px; justify-items: start; padding: 6px 8px; border: 2px solid var(--borderColor); background: var(--surfaceColor); color: var(--textColor); font: inherit; text-align: left; cursor: pointer; }
.obligation-cell span { font-weight: 800; }
.obligation-cell small { font-family: var(--monoFontFamily); font-size: 10px; letter-spacing: .04em; text-transform: uppercase; }
.obligation-cell:hover:not(:disabled) { background: var(--hoverColor); }
.obligation-cell:focus-visible { outline: 3px solid var(--focusColor); outline-offset: 2px; }
/*
 * Colores llamativos (2026-10-19, pedido del usuario): cumplida en verde sólido, vencida en rojo sólido y pendiente en
 * ámbar. Sobre color sólido el texto es blanco en Light y casi negro en Dark (los tonos de Dark son claros); el estado
 * también va escrito en cada celda, así que el color no es la única señal.
 */
.obligations-panel { --solidInk: #FFFFFF; }
:root[data-theme="dark"] .obligations-panel { --solidInk: #0A0A0A; }
.obligation-cell.is-fulfilled { background: var(--successColor); border-color: var(--successColor); color: var(--solidInk); }
.obligation-cell.is-overdue { background: var(--errorColor); border-color: var(--errorColor); color: var(--solidInk); box-shadow: 2px 2px 0 var(--borderColor); }
.obligation-cell.is-pending { background: var(--warningFill); border-color: var(--warningColor); color: var(--warningText); }
.obligation-cell.is-fulfilled:hover:not(:disabled), .obligation-cell.is-overdue:hover:not(:disabled) { filter: brightness(1.1); }
.obligation-cell.is-fulfilled:hover:not(:disabled) { background: var(--successColor); }
.obligation-cell.is-overdue:hover:not(:disabled) { background: var(--errorColor); }
.obligation-cell.is-pending:hover:not(:disabled) { background: var(--warningFill); border-width: 2px; box-shadow: inset 0 0 0 1px var(--warningColor); }
.obligation-cell.is-notApplicable { opacity: .45; cursor: default; }
.obligation-cell:disabled { cursor: default; }
.obligations-empty { justify-items: center; padding: 32px 16px !important; text-align: center; color: var(--mutedTextColor); }
.obligations-empty strong { color: var(--textColor); }
.obligation-detail { display: grid; margin: 0 0 var(--spaceMedium); border: 2px solid var(--borderColor); }
.obligation-detail div { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 3fr); gap: 12px; padding: 10px 14px; }
.obligation-detail div + div { border-top: 1px solid var(--hairlineColor); }
.obligation-detail dd { margin: 0; font-weight: 600; overflow-wrap: anywhere; }
</style>
