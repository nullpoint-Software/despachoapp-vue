<script setup lang="ts">
import HoldButton from '../../shared/vueBits/HoldButton.vue'
import CountUp from '../../shared/vueBits/CountUp.vue'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Check, Download, FileUp, Link2, RefreshCw, StickyNote, Trash2, Unlink, X } from '@lucide/vue'
import type { ReconciliationDetail, ReconciliationItem, ReconciliationResult, ReconciliationStatus, ReconciliationViewRequest } from '../../../shared/contracts/bankReconciliation'
import type { AssignedClient } from '../../../shared/contracts/clients'
import ActionButton from '../../shared/components/ActionButton.vue'
import ConfirmDialog from '../../shared/components/ConfirmDialog.vue'
import FormModal from '../../shared/components/FormModal.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import SelectField from '../../shared/components/SelectField.vue'
import SearchSelectField from '../../shared/components/SearchSelectField.vue'
import StatusBadge from '../../shared/components/StatusBadge.vue'
import { useNotifications } from '../../shared/notifications/notificationStore'
import { readIpcErrorMessage } from '../../shared/ipcErrorMessage'
import { formatMoney } from '../../../shared/presentation/movementLabels'
import { monthNames } from '../reports/reportLabels'
import ReconcileStatementForm from './ReconcileStatementForm.vue'
import { expectedSourceLabels, formatLabels, formatMovementDate, movementTypeLabels, reconciliationStatusLabels, reconciliationStatusTones } from './reconciliationLabels'

/**
 * Conciliación bancaria GLOBAL (6.5): un cliente y un mes.
 * - **Consultar** muestra la conciliación guardada en el Host (cualquier equipo con `reports.read` y
 *   la asignación del cliente).
 * - **Conciliar** abre el modal: Main lee el estado de cuenta en memoria y el Host concilia y guarda.
 * - **Revisión** (`bank.reconcile` y asignación de lectura y escritura): confirmar o descartar lo que
 *   está en revisar, enlazar a mano un "sólo banco" con un "sólo CFDI", deshacer un enlace manual y notas.
 *   Cada cambio envía la revisión vigente; si otro equipo la cambió, el Host lo rechaza y la vista recarga.
 */
const { notify } = useNotifications()
const today = new Date()
const clients = ref<AssignedClient[]>([])
const clientId = ref(''), fiscalYear = ref(String(today.getFullYear())), fiscalMonth = ref(String(today.getMonth() + 1))
const statusFilter = ref<'' | ReconciliationStatus>('')
const reconciliation = ref<ReconciliationDetail | null>(null), canReconcile = ref(false), hasLoaded = ref(false)
const isLoading = ref(false), isWorking = ref(false), isRunBusy = ref(false), error = ref('')
const isRunOpen = ref(false)
const pendingDismissal = ref<ReconciliationItem | null>(null)
const linkingItem = ref<ReconciliationItem | null>(null), linkTargetId = ref('')
const notingItem = ref<ReconciliationItem | null>(null), noteText = ref('')
let isMounted = true

const yearOptions = [...Array(8).keys()].map(offset => ({ value: String(today.getFullYear() - offset), label: String(today.getFullYear() - offset) }))
const monthOptions = monthNames.map((name, index) => ({ value: String(index + 1), label: name.charAt(0).toUpperCase() + name.slice(1) }))
const clientOptions = computed(() => clients.value.map(client => ({ value: client.clientId, label: client.displayName })))
const statusOptions = [{ value: '', label: 'Todos los resultados' }, ...(Object.keys(reconciliationStatusLabels) as ReconciliationStatus[]).map(value => ({ value, label: reconciliationStatusLabels[value] }))]
const selectedClient = computed(() => clients.value.find(client => client.clientId === clientId.value) ?? null)
/** Conciliar y revisar exige el permiso y la asignación de lectura y escritura; el Host vuelve a comprobarlo. */
const canChange = computed(() => canReconcile.value && selectedClient.value?.access === 'readWrite')
const visibleItems = computed(() => (reconciliation.value?.items ?? []).filter(item => !statusFilter.value || item.status === statusFilter.value))
const summaryRows = computed(() => {
  const summary = reconciliation.value?.summary
  if (!summary) return []
  // Los importes se muestran fijos; sólo los conteos usan Count Up (decisión del usuario, 2026-10-03).
  return [{ label: 'Abonos del banco', amount: formatMoney(summary.bankCredits) }, { label: 'Cargos del banco', amount: formatMoney(summary.bankDebits) }, { label: 'Abonos esperados', amount: formatMoney(summary.fiscalCredits) }, { label: 'Cargos esperados', amount: formatMoney(summary.fiscalDebits) },
    { label: 'Coinciden', count: summary.matchedCount }, { label: 'Por revisar', count: summary.reviewCount }, { label: 'Sólo banco', count: summary.bankOnlyCount }, { label: 'Sólo CFDI', count: summary.fiscalOnlyCount }, { label: 'Cobertura', count: summary.coveragePercent, suffix: ' %' }] as Array<{ label: string; amount?: string; count?: number; suffix?: string }>
})
/** Candidatos para enlazar: "sólo CFDI" del mismo tipo, del importe más cercano al más lejano. */
const linkCandidates = computed(() => {
  const bank = linkingItem.value?.bankMovements[0]
  if (!bank) return []
  return (reconciliation.value?.items ?? []).filter(item => item.status === 'fiscalOnly' && item.fiscalMovements[0]!.type === bank.type)
    .sort((first, second) => Math.abs(Number(first.fiscalMovements[0]!.amount) - Number(bank.amount)) - Math.abs(Number(second.fiscalMovements[0]!.amount) - Number(bank.amount)))
})

function period(): { fiscalYear: number; fiscalMonth: number } { return { fiscalYear: Number(fiscalYear.value), fiscalMonth: Number(fiscalMonth.value) } }
function apply(result: ReconciliationResult): void {
  if (result.status === 'deleted') { reconciliation.value = null; return }
  reconciliation.value = result.reconciliation; canReconcile.value = result.canReconcile
}
async function operate(request: ReconciliationViewRequest): Promise<ReconciliationResult> {
  // Copia plana: los proxies reactivos de Vue no cruzan contextBridge.
  return window.contapp.manageBankReconciliation(JSON.parse(JSON.stringify(request)) as ReconciliationViewRequest)
}
async function load(): Promise<void> {
  if (!clientId.value) { error.value = 'Elige un cliente para consultar su conciliación.'; return }
  isLoading.value = true; error.value = ''
  try { const result = await operate({ action: 'get', clientId: clientId.value, ...period() }); if (isMounted) { apply(result); hasLoaded.value = true } }
  catch (caught) { if (isMounted) { reconciliation.value = null; error.value = readIpcErrorMessage(caught, 'No se pudo consultar la conciliación.') } }
  finally { isLoading.value = false }
}
async function loadClients(): Promise<void> {
  try { clients.value = (await window.contapp.manageClients({ action: 'list', afterClientId: null })).clients } catch { clients.value = [] }
}
function changeFilter(): void { reconciliation.value = null; hasLoaded.value = false }
function finishRun(result: ReconciliationResult): void {
  apply(result); isRunOpen.value = false; hasLoaded.value = true
  const summary = reconciliation.value?.summary
  if (summary) notify('Conciliación guardada', summary.matchedCount + ' coinciden, ' + summary.reviewCount + ' por revisar, ' + summary.bankOnlyCount + ' sólo banco y ' + summary.fiscalOnlyCount + ' sólo CFDI.', 'success')
}
/** Cambio de revisión; si falla (por ejemplo, otro equipo ya la cambió) se explica y se recarga. */
async function review(request: ReconciliationViewRequest, failure: string): Promise<boolean> {
  isWorking.value = true; error.value = ''
  try { apply(await operate(request)); return true }
  catch (caught) { error.value = readIpcErrorMessage(caught, failure); await load(); return false }
  finally { isWorking.value = false }
}
function current(): { reconciliationId: string; revision: number } | null {
  return reconciliation.value ? { reconciliationId: reconciliation.value.reconciliationId, revision: reconciliation.value.revision } : null
}
async function confirmItem(item: ReconciliationItem): Promise<void> {
  const state = current()
  if (state) await review({ action: 'confirm', ...state, itemId: item.itemId }, 'No se confirmó la coincidencia.')
}
async function dismissItem(): Promise<void> {
  const state = current(), item = pendingDismissal.value
  if (state && item) await review({ action: 'dismiss', ...state, itemId: item.itemId }, 'No se descartó la sugerencia.')
  pendingDismissal.value = null
}
async function unlinkItem(item: ReconciliationItem): Promise<void> {
  const state = current()
  if (state) await review({ action: 'unlink', ...state, itemId: item.itemId }, 'No se deshizo el enlace.')
}
function openLink(item: ReconciliationItem): void { linkingItem.value = item; linkTargetId.value = '' }
async function saveLink(): Promise<void> {
  const state = current(), item = linkingItem.value
  if (!state || !item || !linkTargetId.value) return
  if (await review({ action: 'link', ...state, bankItemId: item.itemId, fiscalItemId: linkTargetId.value }, 'No se enlazó el movimiento.')) { linkingItem.value = null; notify('Movimiento enlazado', 'Quedó como coincidencia manual.', 'success') }
}
function openNote(item: ReconciliationItem): void { notingItem.value = item; noteText.value = item.note }
async function saveNote(): Promise<void> {
  const state = current(), item = notingItem.value
  if (!state || !item) return
  if (await review({ action: 'note', ...state, itemId: item.itemId, note: noteText.value.trim() }, 'No se guardó la nota.')) notingItem.value = null
}
async function deleteReconciliation(): Promise<void> {
  const state = current()
  if (state && await review({ action: 'delete', ...state }, 'No se eliminó la conciliación.')) notify('Conciliación eliminada', 'Puedes volver a conciliar el mes cuando quieras.', 'success')
}
async function exportCsv(): Promise<void> {
  try { if (await window.contapp.exportReconciliationCsv({ action: 'get', clientId: clientId.value, ...period() }) === 'saved') notify('Conciliación exportada', 'El CSV se guardó donde elegiste.', 'success') }
  catch (caught) { error.value = readIpcErrorMessage(caught, 'No se exportó la conciliación.') }
}

onMounted(() => { void loadClients() })
onBeforeUnmount(() => { isMounted = false; reconciliation.value = null })
</script>
<template>
  <section
    class="reconciliation-panel"
    data-testid="reconciliation-panel"
  >
    <InlineNotice
      v-if="error"
      title="Operación no confirmada"
      tone="error"
    >
      <p>{{ error }}</p>
    </InlineNotice>

    <form
      class="table-toolbar reconciliation-filters"
      role="search"
      aria-label="Elegir conciliación"
      @submit.prevent="load"
    >
      <SearchSelectField
        id="reconciliation-client"
        v-model="clientId"
        placeholder="Nombre del cliente"
        label="Cliente"
        :options="clientOptions"
        @update:model-value="changeFilter"
      />
      <SelectField
        id="reconciliation-year"
        v-model="fiscalYear"
        label="Ejercicio"
        :options="yearOptions"
        @update:model-value="changeFilter"
      />
      <SelectField
        id="reconciliation-month"
        v-model="fiscalMonth"
        label="Mes"
        :options="monthOptions"
        @update:model-value="changeFilter"
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

    <template v-if="hasLoaded && !reconciliation">
      <div
        class="reconciliation-empty"
        data-testid="reconciliation-empty"
      >
        <p>No hay conciliación de {{ monthNames[Number(fiscalMonth) - 1] }} {{ fiscalYear }} para {{ selectedClient?.displayName }}.</p>
        <ActionButton
          v-if="canChange"
          variant="primary"
          @click="isRunOpen = true"
        >
          <FileUp
            :size="16"
            aria-hidden="true"
          /> Conciliar estado de cuenta
        </ActionButton>
        <p
          v-else
          class="field-help"
        >
          Para conciliar se necesita el permiso de conciliación y la asignación del cliente con lectura y escritura.
        </p>
      </div>
    </template>

    <template v-if="reconciliation">
      <div
        class="section-heading reconciliation-heading"
        data-testid="reconciliation-detail"
      >
        <div>
          <h2>{{ reconciliation.fileName }}</h2>
          <p class="heading-meta">
            {{ reconciliation.clientDisplayName }} · {{ monthNames[reconciliation.fiscalMonth - 1] }} {{ reconciliation.fiscalYear }}
          </p>
          <p class="field-help">
            {{ formatLabels[reconciliation.format] }} · tolerancia {{ formatMoney(reconciliation.tolerance) }} · ventana {{ reconciliation.dateWindowDays }} día(s) ·
            conciliado por {{ reconciliation.createdByDisplayName }} el {{ new Date(reconciliation.createdAt).toLocaleString('es-MX') }}
          </p>
        </div>
        <div class="actions">
          <ActionButton
            v-if="canChange"
            :disabled="isWorking"
            @click="isRunOpen = true"
          >
            <FileUp
              :size="16"
              aria-hidden="true"
            /> Conciliar de nuevo
          </ActionButton>
          <ActionButton @click="exportCsv">
            <Download
              :size="16"
              aria-hidden="true"
            /> Exportar CSV
          </ActionButton>
          <!-- Se eliminan la conciliación del mes y su revisión; los reportes y los XML no cambian. -->
          <HoldButton
            v-if="canChange"
            :is-disabled="isWorking"
            aria-label="Eliminar la conciliación del mes y su revisión (los reportes y los XML no cambian)"
            done-label="Eliminada"
            @hold="deleteReconciliation"
          >
            <template #icon>
              <Trash2
                :size="16"
                aria-hidden="true"
              />
            </template>
            Eliminar
          </HoldButton>
        </div>
      </div>

      <dl
        class="reconciliation-summary"
        data-testid="reconciliation-summary"
      >
        <div
          v-for="row in summaryRows"
          :key="row.label"
        >
          <dt>{{ row.label }}</dt><dd class="numeric">
            <template v-if="row.amount">
              {{ row.amount }}
            </template><template v-else>
              <CountUp :value="row.count ?? 0" />{{ row.suffix }}
            </template>
          </dd>
        </div>
      </dl>
      <p class="field-help">
        La cobertura cuenta sólo los movimientos del banco que coinciden.
        <template v-if="reconciliation.summary.excludedOutsidePeriodCount">
          {{ reconciliation.summary.excludedOutsidePeriodCount }} movimiento(s) del archivo eran de otro mes y no se conciliaron.
        </template>
        <template v-if="reconciliation.summary.cashExcludedCount">
          {{ reconciliation.summary.cashExcludedCount }} CFDI o pago(s) en efectivo no se esperan en el banco.
        </template>
        <template v-if="reconciliation.summary.unpaidPpdCount">
          {{ reconciliation.summary.unpaidPpdCount }} factura(s) PPD del mes no tienen complemento de pago en este equipo.
        </template>
      </p>

      <div class="table-toolbar reconciliation-status-filter">
        <SelectField
          id="reconciliation-status"
          :model-value="statusFilter"
          label="Resultado"
          :options="statusOptions"
          @update:model-value="statusFilter = $event as '' | ReconciliationStatus"
        />
      </div>
      <div
        class="table-region"
        tabindex="0"
        aria-label="Renglones de la conciliación"
      >
        <table aria-label="Conciliación">
          <thead>
            <tr>
              <th>Resultado</th><th>Banco</th><th>CFDI o pago</th><th>Motivo</th><th class="actions-column">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in visibleItems"
              :key="item.itemId"
              :data-testid="'reconciliation-item-' + item.status"
            >
              <td class="nowrap">
                <StatusBadge :tone="reconciliationStatusTones[item.status]">
                  {{ reconciliationStatusLabels[item.status] }}
                </StatusBadge>
                <span class="field-help reconciliation-meta">{{ item.isManual ? 'Manual' : item.isConfirmed ? 'Confirmado' : item.score ? 'Puntaje ' + item.score : '' }}</span>
              </td>
              <td>
                <div
                  v-for="(movement, index) in item.bankMovements"
                  :key="index"
                  class="reconciliation-movement"
                >
                  <strong class="numeric">{{ movementTypeLabels[movement.type] }} {{ formatMoney(movement.amount) }}</strong>
                  <span class="field-help reconciliation-meta">{{ formatMovementDate(movement.date) }} · {{ movement.description || movement.reference }}</span>
                </div>
              </td>
              <td>
                <div
                  v-for="movement in item.fiscalMovements"
                  :key="movement.uuid + movement.date + movement.amount"
                  class="reconciliation-movement"
                >
                  <strong class="numeric">{{ formatMoney(movement.amount) }}</strong> {{ movement.counterpartName || movement.counterpartRfc }}
                  <span class="field-help reconciliation-meta">{{ formatMovementDate(movement.date) }} · {{ expectedSourceLabels[movement.source] }}{{ movement.folio ? ' · ' + movement.folio : '' }} · {{ movement.uuid.toUpperCase() }}</span>
                </div>
              </td>
              <td>
                {{ item.reason }}
                <span
                  v-if="item.note"
                  class="reconciliation-note"
                >Nota: {{ item.note }}</span>
              </td>
              <td class="actions-column">
                <template v-if="canChange">
                  <ActionButton
                    v-if="item.status === 'requiresReview'"
                    :disabled="isWorking"
                    :aria-label="'Confirmar ' + item.itemId"
                    title="Confirmar coincidencia"
                    @click="confirmItem(item)"
                  >
                    <Check
                      :size="15"
                      aria-hidden="true"
                    />
                  </ActionButton>
                  <ActionButton
                    v-if="item.status === 'requiresReview'"
                    :disabled="isWorking"
                    :aria-label="'Descartar ' + item.itemId"
                    title="Descartar sugerencia"
                    @click="pendingDismissal = item"
                  >
                    <X
                      :size="15"
                      aria-hidden="true"
                    />
                  </ActionButton>
                  <ActionButton
                    v-if="item.status === 'bankOnly'"
                    :disabled="isWorking"
                    :aria-label="'Enlazar ' + item.itemId"
                    title="Enlazar con un CFDI"
                    @click="openLink(item)"
                  >
                    <Link2
                      :size="15"
                      aria-hidden="true"
                    />
                  </ActionButton>
                  <ActionButton
                    v-if="item.status === 'matched' && item.isManual"
                    :disabled="isWorking"
                    :aria-label="'Desenlazar ' + item.itemId"
                    title="Deshacer enlace manual"
                    @click="unlinkItem(item)"
                  >
                    <Unlink
                      :size="15"
                      aria-hidden="true"
                    />
                  </ActionButton>
                  <ActionButton
                    :disabled="isWorking"
                    :aria-label="'Nota ' + item.itemId"
                    title="Nota"
                    @click="openNote(item)"
                  >
                    <StickyNote
                      :size="15"
                      aria-hidden="true"
                    />
                  </ActionButton>
                </template>
              </td>
            </tr>
            <tr v-if="!visibleItems.length">
              <td colspan="5">
                No hay renglones con ese resultado.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <FormModal
      :is-open="isRunOpen"
      title="Conciliar estado de cuenta"
      description="Compara los movimientos del banco con los CFDI y pagos del mes."
      :is-busy="isRunBusy"
      test-id="reconcile-modal"
      @close="isRunOpen = false"
    >
      <ReconcileStatementForm
        :client-id="clientId"
        :client-name="selectedClient?.displayName ?? ''"
        :fiscal-year="Number(fiscalYear)"
        :fiscal-month="Number(fiscalMonth)"
        :has-previous="Boolean(reconciliation)"
        @reconciled="finishRun"
        @busy="isRunBusy = $event"
        @cancel="isRunOpen = false"
      />
    </FormModal>

    <FormModal
      :is-open="Boolean(linkingItem)"
      title="Enlazar movimiento"
      description="Elige el CFDI o pago que corresponde a este movimiento del banco."
      :is-busy="isWorking"
      test-id="link-modal"
      @close="linkingItem = null"
    >
      <form
        class="reconciliation-form"
        @submit.prevent="saveLink"
      >
        <p v-if="linkingItem?.bankMovements[0]">
          <strong>{{ movementTypeLabels[linkingItem.bankMovements[0].type] }} {{ formatMoney(linkingItem.bankMovements[0].amount) }}</strong>
          · {{ formatMovementDate(linkingItem.bankMovements[0].date) }} · {{ linkingItem.bankMovements[0].description }}
        </p>
        <fieldset class="reconciliation-candidates">
          <legend>CFDI sin movimiento del mismo tipo</legend>
          <label
            v-for="candidate in linkCandidates"
            :key="candidate.itemId"
            class="choice-card reconciliation-candidate"
          >
            <input
              v-model="linkTargetId"
              type="radio"
              name="link-target"
              :value="candidate.itemId"
            >
            <span>
              <strong class="numeric">{{ formatMoney(candidate.fiscalMovements[0]!.amount) }}</strong> {{ candidate.fiscalMovements[0]!.counterpartName || candidate.fiscalMovements[0]!.counterpartRfc }}
              <span class="field-help reconciliation-meta">{{ formatMovementDate(candidate.fiscalMovements[0]!.date) }} · {{ expectedSourceLabels[candidate.fiscalMovements[0]!.source] }} · {{ candidate.fiscalMovements[0]!.uuid.toUpperCase() }}</span>
            </span>
          </label>
          <p
            v-if="!linkCandidates.length"
            class="field-help"
          >
            No hay CFDI pendientes del mismo tipo.
          </p>
        </fieldset>
        <div class="actions form-footer">
          <ActionButton
            variant="primary"
            type="submit"
            :is-loading="isWorking"
            :disabled="!linkTargetId"
          >
            Enlazar
          </ActionButton>
          <ActionButton
            :disabled="isWorking"
            @click="linkingItem = null"
          >
            Cancelar
          </ActionButton>
        </div>
      </form>
    </FormModal>

    <FormModal
      :is-open="Boolean(notingItem)"
      title="Nota del renglón"
      description="Aclaración visible para todos los que consultan esta conciliación."
      :is-busy="isWorking"
      test-id="note-modal"
      @close="notingItem = null"
    >
      <form
        class="reconciliation-form"
        @submit.prevent="saveNote"
      >
        <div class="field">
          <label for="reconciliation-note">Nota</label>
          <textarea
            id="reconciliation-note"
            v-model="noteText"
            rows="4"
            maxlength="500"
          />
        </div>
        <div class="actions form-footer">
          <ActionButton
            variant="primary"
            type="submit"
            :is-loading="isWorking"
          >
            Guardar nota
          </ActionButton>
          <ActionButton
            :disabled="isWorking"
            @click="notingItem = null"
          >
            Cancelar
          </ActionButton>
        </div>
      </form>
    </FormModal>

    <ConfirmDialog
      :is-open="Boolean(pendingDismissal)"
      title="Descartar sugerencia"
      confirm-label="Descartar"
      :is-loading="isWorking"
      @close="pendingDismissal = null"
      @confirm="dismissItem"
    >
      <p>El movimiento del banco y el CFDI quedan por separado (sólo banco y sólo CFDI). Después puedes enlazarlos a mano.</p>
    </ConfirmDialog>
  </section>
</template>
<style scoped>
.reconciliation-panel { display: grid; gap: var(--spaceMedium); min-width: 0; }
.reconciliation-filters { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap: var(--spaceMedium); align-items: end; }
.reconciliation-status-filter { max-width: 320px; }
.reconciliation-empty { display: grid; gap: var(--spaceSmall, 8px); justify-items: start; padding: var(--spaceMedium); border: 2px solid var(--borderColor); background: var(--surfaceColor); border-radius: var(--radiusNested); }
.reconciliation-empty p { margin: 0; }
.reconciliation-heading { align-items: flex-start; gap: var(--spaceMedium); flex-wrap: wrap; }
.reconciliation-heading h2 { margin: 4px 0; overflow-wrap: anywhere; }
/* Líneas por celda, como los totales de reportes. */
.reconciliation-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 160px), 1fr)); margin: 0; border-top: 2px solid var(--borderColor); border-left: 2px solid var(--borderColor); background: var(--surfaceColor); border-radius: var(--radiusNested); overflow: hidden; }
.reconciliation-summary div { display: grid; gap: 4px; padding: 10px 12px; border-right: 2px solid var(--borderColor); border-bottom: 2px solid var(--borderColor); min-width: 0; }
.reconciliation-summary dt { font-family: var(--monoFontFamily); font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--mutedTextColor); }
.reconciliation-summary dd { margin: 0; font-size: 18px; font-weight: 800; letter-spacing: -.03em; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.reconciliation-movement + .reconciliation-movement { margin-top: 6px; padding-top: 6px; border-top: 1px dashed var(--borderColor); }
.reconciliation-meta { display: block; font-size: 11px; overflow-wrap: anywhere; }
.reconciliation-note { display: block; margin-top: 4px; font-size: 12px; font-style: italic; }
.reconciliation-form { display: grid; gap: var(--spaceMedium); }
.reconciliation-candidates { display: grid; gap: 8px; margin: 0; padding: var(--spaceMedium); border: 2px solid var(--borderColor); max-height: 50vh; overflow: auto; border-radius: var(--radiusNested); }
.reconciliation-candidates legend { font-family: var(--monoFontFamily); font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--mutedTextColor); }
</style>
