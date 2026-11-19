<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import AnimatedList from '../../shared/vueBits/AnimatedList.vue'
import SwipeRow, { type SwipeAction } from '../../shared/vueBits/SwipeRow.vue'
import { Plus, Pencil, Filter, Calculator, RefreshCw, Printer, Trash2 } from '@lucide/vue'
import { getOfficeToday, movementTypes, officeCategories, parseMovementFilter, paymentMethods, type Movement, type MovementCapabilities, type MovementDraft, type MovementFilter, type MovementRequest, type MovementScope, type MovementSummary, type OfficeCategory, type MovementType, type PaymentMethod } from '../../../shared/contracts/movements'
import type { AssignedClient } from '../../../shared/contracts/clients'
import { formatBusinessDate, formatBusinessDateTime, formatFolio, formatMoney, movementTypeLabels, officeCategoryLabels, paymentMethodLabels } from '../../../shared/presentation/movementLabels'
import MovementForm, { type MovementParty } from './MovementForm.vue'
import ActionButton from '../../shared/components/ActionButton.vue'
import PageSizeField from '../../shared/components/PageSizeField.vue'
import { pageSizeFor } from '../settings/localPreferencesState'
import ListToolbar from '../../shared/components/ListToolbar.vue'
import FilterChips, { type ActiveFilterChip } from '../../shared/components/FilterChips.vue'
import ListPager from '../../shared/components/ListPager.vue'
import UserAvatar from '../../shared/components/UserAvatar.vue'
import DateTimeField from '../../shared/components/DateTimeField.vue'
import AutocompleteField from '../../shared/components/AutocompleteField.vue'
import SelectField from '../../shared/components/SelectField.vue'
import TextField from '../../shared/components/TextField.vue'
import CheckField from '../../shared/components/CheckField.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import StatusBadge from '../../shared/components/StatusBadge.vue'
import ConfirmDialog from '../../shared/components/ConfirmDialog.vue'
import HelpTip from '../../shared/components/HelpTip.vue'
import FormModal from '../../shared/components/FormModal.vue'
import TicketPreviewDialog from '../../shared/components/TicketPreviewDialog.vue'
import { useNotifications } from '../../shared/notifications/notificationStore'
import { useNavigationRequest } from '../../shared/navigation/navigationRequests'
import { revealNavigationItem } from '../../shared/navigation/revealNavigationItem'
import { useTicketPrinting } from '../../shared/printing/useTicketPrinting'
import { withSensitiveConfirmation, type SensitiveRequest } from '../../shared/security/confirmSensitive'

/**
 * Movimientos GLOBAL de los contribuyentes asignados y, con `officeMovements.*`, del propio despacho (4.3a:
 * "Registrar para: el despacho", filtro "Origen" y subtotal por categoría en el corte). La vista sólo arma filtros y borradores: el Host
 * valida permisos, asignaciones, importes y revisiones, y calcula los totales exactos. Tras cada
 * escritura se vuelve a consultar; una respuesta perdida no se reintenta automáticamente.
 */
const { notify } = useNotifications()
const today = getOfficeToday()
const clients = ref<AssignedClient[]>([])
/** Periodo de la lista y del corte; las horas (2026-10-10) son opcionales: vacías = día completo. */
const clientFilterLabel = ref(''), fromDate = ref(today), fromTime = ref(''), toDate = ref(today), toTime = ref(''), typeFilter = ref(''), methodFilter = ref(''), search = ref(''), includeVoided = ref(false)
const movements = ref<Movement[]>([]), nextCursor = ref<string | null>(null), summary = ref<MovementSummary | null>(null)
/** Paginador de la lista (2026-10-04): 10 movimientos por página sobre los cargados; "Movimientos anteriores" trae más. */
// Renglones por página elegidos en Filtros y recordados en este equipo (2026-10-17, `PageSizeField`).
const movementsPerPage = computed(() => pageSizeFor('movements'))
const movementPage = ref(0)
const movementPageCount = computed(() => Math.max(1, Math.ceil(movements.value.length / movementsPerPage.value)))
const pagedMovements = computed(() => movements.value.slice(movementPage.value * movementsPerPage.value, (movementPage.value + 1) * movementsPerPage.value))
watch(movementsPerPage, () => { movementPage.value = 0 })
const capabilities = ref<MovementCapabilities>({ canCreate: false, canUpdate: false, canVoid: false, canReadOffice: false, canCreateOffice: false, canUpdateOffice: false, canVoidOffice: false })
const scopeFilter = ref<MovementScope>('all'), officeCategoryFilter = ref('')
const scopeOptions = [{ value: 'all', label: 'Clientes y despacho' }, { value: 'clients', label: 'Sólo clientes' }, { value: 'office', label: 'Sólo despacho' }]
const officeCategoryOptions = [{ value: '', label: 'Todas las categorías' }, ...officeCategories.map(value => ({ value, label: officeCategoryLabels[value] }))]
const isLoading = ref(false), isSaving = ref(false), error = ref(''), hasRemoteChanges = ref(false)
const editor = ref<Movement | null>(null), isFormOpen = ref(false)
const pendingVoid = ref<Movement | null>(null)
const voidReason = ref('')
/**
 * Impresión (5.4), como el original: tras registrar se pregunta si se imprime el recibo, cada fila tiene
 * "Imprimir" y el corte de caja tiene su ticket. Main arma el ticket con datos del Host y muestra la
 * vista previa; sólo "Imprimir ticket" lo envía.
 */
const { preview: ticketPreview, isPreparing: isPreparingTicket, openTicket, closeTicket } = useTicketPrinting()
const lastSavedMovement = ref<Movement | null>(null), pendingReceipt = ref<Movement | null>(null)
/** Como en el original: filtros y corte de caja se abren a demanda sobre la tabla. */
const isFilterOpen = ref(false), isCashCutOpen = ref(false)
const typeOptions = [{ value: '', label: 'Ingresos y gastos' }, ...movementTypes.map(value => ({ value, label: movementTypeLabels[value] }))]
const methodOptions = [{ value: '', label: 'Todos los métodos' }, ...paymentMethods.map(value => ({ value, label: paymentMethodLabels[value] }))]
let isMounted = true
let movementVersion: number | undefined
let eventsTimer: ReturnType<typeof setTimeout> | undefined

/** Nombre visible único por contribuyente; si dos comparten nombre se agrega el inicio del identificador. */
const clientOptions = computed(() => clients.value.map(client => ({ client, label: clients.value.filter(other => other.displayName === client.displayName).length > 1 ? client.displayName + ' (' + client.clientId.slice(0, 8) + ')' : client.displayName })))
const writableClientOptions = computed(() => clientOptions.value.filter(option => option.client.access === 'readWrite').map(option => ({ clientId: option.client.clientId, label: option.label })))
const selectedClientId = computed(() => clientOptions.value.find(option => option.label === clientFilterLabel.value)?.client.clientId ?? null)
/** Elegir un cliente implica origen "clientes"; la categoría sólo aplica con origen "despacho". */
function currentFilter(): MovementFilter {
  const clientId = scopeFilter.value === 'office' ? null : selectedClientId.value
  const scope: MovementScope = clientId ? 'clients' : scopeFilter.value
  return { scope, clientId, officeCategory: scope === 'office' && officeCategoryFilter.value ? officeCategoryFilter.value as OfficeCategory : null, fromDate: fromDate.value, fromTime: fromTime.value || null, toDate: toDate.value, toTime: toTime.value || null, movementType: (typeFilter.value || null) as MovementType | null,
    paymentMethod: (methodFilter.value || null) as PaymentMethod | null, search: search.value.trim(), includeVoided: includeVoided.value }
}

/** Contribuyentes asignados por páginas de 50, con un tope para no bloquear la vista. */
async function loadClients(): Promise<void> {
  const loaded: AssignedClient[] = []
  let afterClientId: string | null = null
  for (let page = 0; page < 40; page++) {
    const result = await window.contapp.manageClients({ action: 'list', afterClientId })
    loaded.push(...result.clients)
    afterClientId = result.nextClientId
    if (!afterClientId) break
  }
  if (isMounted) clients.value = loaded
}


/**
 * Valida un periodo con horas opcionales antes de consultar, con el mismo contrato que aplica el Host
 * (`parseMovementFilter`): fechas reales, horas HH:MM, inicio no posterior al fin y rango máximo. '' si es válido.
 */
function describePeriodError(periodFromDate: string, periodFromTime: string, periodToDate: string, periodToTime: string): string {
  if (!periodFromDate || !periodToDate) return 'Elige la fecha inicial y la final.'
  if (periodFromDate + (periodFromTime || '00:00') > periodToDate + (periodToTime || '23:59')) return 'El inicio del periodo no puede ser posterior al fin.'
  try { parseMovementFilter({ ...currentFilter(), fromDate: periodFromDate, fromTime: periodFromTime || null, toDate: periodToDate, toTime: periodToTime || null }) } catch { return 'Revisa el periodo: fechas válidas, horas de 00:00 a 23:59 y como máximo 5 años.' }
  return ''
}
/** Texto del periodo para chips, totales y pie: con horas sólo si se eligieron. */
function describePeriod(periodFromDate: string, periodFromTime: string, periodToDate: string, periodToTime: string): string {
  const start = periodFromTime ? formatBusinessDateTime(periodFromDate, periodFromTime) : formatBusinessDate(periodFromDate)
  const end = periodToTime ? formatBusinessDateTime(periodToDate, periodToTime) : formatBusinessDate(periodToDate)
  return start === end ? start : start + ' – ' + end
}
const periodText = computed(() => describePeriod(fromDate.value, fromTime.value, toDate.value, toTime.value))

/** Lista y corte con el mismo filtro. Un error retira datos para no mostrar acceso antiguo como vigente. */
async function load(shouldContinue = false, writeError = ''): Promise<void> {
  if (isLoading.value) return
  const periodError = describePeriodError(fromDate.value, fromTime.value, toDate.value, toTime.value)
  if (periodError) { error.value = periodError; return }
  // Un error de escritura se conserva tras volver a consultar; un error de consulta lo sustituye.
  isLoading.value = true; error.value = writeError
  if (!shouldContinue) hasRemoteChanges.value = false
  try {
    if (!clients.value.length && !shouldContinue) await loadClients()
    const filter = currentFilter()
    const listed = await window.contapp.manageMovements({ action: 'list', filter, beforeCursor: shouldContinue ? nextCursor.value : null })
    if (listed.status !== 'listed') throw new Error('Unexpected result')
    const summarized = shouldContinue ? null : await window.contapp.manageMovements({ action: 'summarize', filter })
    if (!isMounted) return
    hasListedMovements = true
    movements.value = shouldContinue ? [...movements.value, ...listed.movements] : listed.movements
    if (!shouldContinue) movementPage.value = 0
    nextCursor.value = listed.nextCursor; capabilities.value = listed.capabilities
    if (summarized?.status === 'summarized') summary.value = summarized.summary
  } catch {
    if (isMounted) { movements.value = []; summary.value = null; nextCursor.value = null; error.value = 'No se pudo consultar. Revisa el permiso Consultar movimientos, tus asignaciones y la conexión con el Host.' }
  } finally { isLoading.value = false }
}

function openCreate(): void { editor.value = null; isFormOpen.value = true }
function openEdit(movement: Movement): void { editor.value = movement; isFormOpen.value = true }

/**
 * Envía una escritura y devuelve el mensaje de error ('' si se confirmó, `null` si se canceló la contraseña). La solicitud
 * se copia a objetos planos: los proxies reactivos de Vue no se pueden clonar a través de contextBridge.
 * Editar y anular pasan por el diálogo único de contraseña (ADR-038): editar no lo abre durante la gracia de la sesión;
 * anular es zona crítica y lo abre siempre.
 */
async function run(request: MovementRequest, successTitle: string, confirmation?: SensitiveRequest): Promise<string | null> {
  isSaving.value = true; error.value = ''
  try {
    const plainRequest = JSON.parse(JSON.stringify(request)) as MovementRequest
    const send = (proof?: string) => window.contapp.manageMovements(plainRequest, proof)
    const result = confirmation ? await withSensitiveConfirmation(confirmation, send) : await send()
    if (!result) return null
    if (result.status === 'saved' && isMounted) {
      lastSavedMovement.value = result.movement
      // El aviso lleva al renglón; uno anulado sólo se ve con "Anulados: incluidos" (`view: 'voided'`).
      const target = { section: 'payments' as const, itemId: result.movement.movementId, label: 'el movimiento ' + formatFolio(result.movement.folio), ...(result.movement.state === 'voided' ? { view: 'voided' } : {}) }
      notify(successTitle, formatFolio(result.movement.folio) + ' · ' + formatMoney(result.movement.amount), 'success', { target })
    }
    return ''
  } catch {
    return 'No se confirmó el movimiento. Revisa permisos, asignación, contraseña o cambios de otro equipo; la lista se actualizó con la versión vigente.'
  } finally { isSaving.value = false }
}

async function handleSubmit(value: { party: MovementParty; draft: MovementDraft }): Promise<void> {
  if (editor.value) { await saveUpdate(editor.value, value.draft, value.party.kind === 'office' ? value.party.officeCategory : null); return }
  lastSavedMovement.value = null
  const request: MovementRequest = value.party.kind === 'office' ? { action: 'createOffice', officeCategory: value.party.officeCategory, draft: value.draft } : { action: 'create', clientId: value.party.clientId, draft: value.draft }
  const failure = await run(request, 'Movimiento registrado')
  if (failure === null) return
  if (!failure) { isFormOpen.value = false; pendingReceipt.value = lastSavedMovement.value }
  await load(false, failure)
}
async function saveUpdate(movement: Movement, draft: MovementDraft, officeCategory: OfficeCategory | null): Promise<void> {
  const description = formatFolio(movement.folio) + ': ' + formatMoney(movement.amount) + ' pasa a ' + formatMoney(draft.amount) + '.'
  const failure = await run({ action: 'update', movementId: movement.movementId, revision: movement.revision, draft, officeCategory }, 'Cambios guardados', { operation: 'movements.update', title: 'Confirmar cambios del movimiento', description })
  // Cancelar la contraseña deja el formulario abierto con lo capturado.
  if (failure === null) return
  if (!failure) isFormOpen.value = false
  await load(false, failure)
}
async function confirmVoid(): Promise<void> {
  const movement = pendingVoid.value
  if (!movement || !voidReason.value.trim()) return
  const failure = await run({ action: 'void', movementId: movement.movementId, revision: movement.revision, reason: voidReason.value.trim() }, 'Movimiento anulado', { operation: 'movements.void', title: 'Confirma la anulación con tu contraseña' })
  // Cancelar la contraseña conserva el motivo escrito.
  if (failure === null) return
  pendingVoid.value = null; voidReason.value = ''
  await load(false, failure)
}
function printReceipt(movement: Movement): void { pendingReceipt.value = null; void openTicket(() => window.contapp.prepareMovementReceipt(movement.movementId)) }
/**
 * Corte de caja por horas (2026-10-10, pedido del usuario: "seleccionar horas en el corte de caja"). "Imprimir corte"
 * abre un modal con Desde y Hasta, cada uno con fecha y hora del despacho. Propone el periodo filtrado y, sin horas,
 * el día completo (00:00–23:59), que equivale al corte por días de antes. Se envía el filtro vigente con esas fechas y
 * horas (copiado a un objeto plano para cruzar contextBridge): el Host acota por la hora de negocio de cada pago y
 * suma; Main excluye anulados. Ejemplo de turno: 08:00–14:00 incluye los pagos de las 08:00 y de las 14:00.
 */
const isCashCutPrintOpen = ref(false), cutFromDate = ref(''), cutFromTime = ref('00:00'), cutToDate = ref(''), cutToTime = ref('23:59'), cutError = ref('')
function openCashCut(): void {
  const today = getOfficeToday()
  cutFromDate.value = fromDate.value || today; cutFromTime.value = fromTime.value || '00:00'
  cutToDate.value = toDate.value || today; cutToTime.value = toTime.value || '23:59'
  cutError.value = ''; isCashCutPrintOpen.value = true
}
function printCashCut(): void {
  if (!cutFromTime.value || !cutToTime.value) { cutError.value = 'Elige la hora de inicio y la de fin.'; return }
  cutError.value = describePeriodError(cutFromDate.value, cutFromTime.value, cutToDate.value, cutToTime.value)
  if (cutError.value) return
  isCashCutPrintOpen.value = false
  const filter: MovementFilter = { ...currentFilter(), fromDate: cutFromDate.value, fromTime: cutFromTime.value, toDate: cutToDate.value, toTime: cutToTime.value }
  void openTicket(() => window.contapp.prepareCashCutTicket(JSON.parse(JSON.stringify(filter)) as MovementFilter))
}
function showToday(): void { fromDate.value = today; fromTime.value = ''; toDate.value = today; toTime.value = ''; void load() }
/**
 * Filtros en un modal (decisión del usuario, 2026-10-04: no estorban a la vista). El botón "Filtros" muestra cuántos
 * hay activos además de las fechas; "Limpiar" vuelve a lo de hoy, todos los clientes y sin anulados.
 */
/**
 * Filtros activos como chips (2026-10-06) bajo la barra, con los mismos textos que el modal (`*Options`, `*Labels`).
 * Sólo aparecen los que `currentFilter()` de verdad envía al Host: la categoría con origen "despacho" y el cliente con
 * cualquier otro origen. El contador de "Filtros" se deriva de esta lista, así barra y chips nunca discrepan.
 */
function labelOf(options: Array<{ value: string; label: string }>, value: string): string { return options.find(option => option.value === value)?.label ?? value }
const activeFilterChips = computed<ActiveFilterChip[]>(() => {
  const chips: ActiveFilterChip[] = []
  if (scopeFilter.value !== 'all') chips.push({ filterId: 'scope', label: 'Origen', value: labelOf(scopeOptions, scopeFilter.value) })
  if (scopeFilter.value === 'office' && officeCategoryFilter.value) chips.push({ filterId: 'officeCategory', label: 'Categoría', value: labelOf(officeCategoryOptions, officeCategoryFilter.value) })
  if (scopeFilter.value !== 'office' && clientFilterLabel.value.trim()) chips.push({ filterId: 'client', label: 'Cliente', value: clientFilterLabel.value.trim() })
  if (fromDate.value !== today || toDate.value !== today || fromTime.value || toTime.value) chips.push({ filterId: 'period', label: 'Periodo', value: periodText.value })
  if (typeFilter.value) chips.push({ filterId: 'type', label: 'Tipo', value: labelOf(typeOptions, typeFilter.value) })
  if (methodFilter.value) chips.push({ filterId: 'method', label: 'Método', value: labelOf(methodOptions, methodFilter.value) })
  if (includeVoided.value) chips.push({ filterId: 'voided', label: 'Anulados', value: 'Incluidos' })
  return chips
})
const activeFilterCount = computed(() => activeFilterChips.value.length)
function applyFilters(): void { isFilterOpen.value = false; void load() }
/** Quitar un chip vuelve ese filtro a su valor por defecto (el periodo, a hoy) y consulta al Host como "Aplicar". */
function removeFilter(filterId: string): void {
  if (filterId === 'scope') { scopeFilter.value = 'all'; officeCategoryFilter.value = '' }
  if (filterId === 'officeCategory') officeCategoryFilter.value = ''
  if (filterId === 'client') clientFilterLabel.value = ''
  if (filterId === 'period') { fromDate.value = today; fromTime.value = ''; toDate.value = today; toTime.value = '' }
  if (filterId === 'type') typeFilter.value = ''
  if (filterId === 'method') methodFilter.value = ''
  if (filterId === 'voided') includeVoided.value = false
  void load()
}
function clearAppliedFilters(): void { clearFilters(); void load() }
function clearFilters(): void {
  scopeFilter.value = 'all'; officeCategoryFilter.value = ''; clientFilterLabel.value = ''; fromDate.value = today; fromTime.value = ''; toDate.value = today; toTime.value = ''
  typeFilter.value = ''; methodFilter.value = ''; includeVoided.value = false
}

/** Avisos WSS sin contenido: con un formulario o diálogo abierto se conserva el borrador y se avisa. */
async function watchInvalidations(): Promise<void> {
  try {
    const events = await window.contapp.manageHostEvents('start')
    const version = events.movementInvalidationVersion
    if (version !== undefined && movementVersion !== undefined && version !== movementVersion && isMounted) {
      if (isFormOpen.value || pendingVoid.value || isSaving.value) hasRemoteChanges.value = true
      else await load()
    }
    if (version !== undefined) movementVersion = version
  } catch { /* El Host local no usa WSS; la vista se actualiza tras cada operación o manualmente. */ }
  if (isMounted) eventsTimer = setTimeout(() => { void watchInvalidations() }, 10000)
}

/**
 * Avisos que llevan a un movimiento (2026-10-10): cuando la lista ya lo tiene se abre su página del paginador y
 * `revealNavigationItem` lo desplaza y resalta (`data-navigation-id` en la tarjeta). Un anulado fuera de la lista
 * activa "Anulados: incluidos" y vuelve a consultar una vez; si aun así no aparece (otro periodo), se abandona.
 */
const requestedMovement = ref<{ movementId: string; shouldIncludeVoided: boolean } | null>(null)
let hasListedMovements = false
useNavigationRequest('payments', request => { requestedMovement.value = request.itemId ? { movementId: request.itemId, shouldIncludeVoided: request.view === 'voided' } : null })
watch([requestedMovement, movements, isLoading], () => {
  const requested = requestedMovement.value
  if (!requested || isLoading.value) return
  const index = movements.value.findIndex(movement => movement.movementId === requested.movementId)
  if (index >= 0) {
    requestedMovement.value = null
    movementPage.value = Math.floor(index / movementsPerPage.value)
    void revealNavigationItem(requested.movementId)
  } else if (hasListedMovements) {
    requestedMovement.value = null
    if (requested.shouldIncludeVoided && !includeVoided.value) { includeVoided.value = true; requestedMovement.value = { ...requested, shouldIncludeVoided: false }; void load() }
  }
}, { immediate: true })

onMounted(() => { void load(); void watchInvalidations() })
/**
 * Arrastrar el renglón revela sólo "Eliminar" (decisión del usuario, 2026-10-04): anula el pago con motivo y
 * contraseña, porque un folio de caja nunca se borra ni se reutiliza. Editar es un botón visible del renglón.
 * Los del despacho se editan y anulan con `officeMovements.*`; los de clientes, con `movements.*`.
 */
function canEditMovement(movement: Movement): boolean {
  if (movement.state !== 'active' || movement.access !== 'readWrite') return false
  return movement.clientId === null ? capabilities.value.canUpdateOffice : capabilities.value.canUpdate
}
/**
 * Acciones al arrastrar el renglón (o con ⋯): Imprimir, Editar y Eliminar, que anula. Desde el 2026-10-05 el renglón ya
 * no tiene botones sueltos (pedido del usuario): todo vive en el arrastre.
 */
function movementActions(movement: Movement): SwipeAction[] {
  const folio = formatFolio(movement.folio)
  const actions: SwipeAction[] = [{ actionId: 'print', label: 'Imprimir', icon: Printer, accessibleName: 'Imprimir ' + folio, isDisabled: isPreparingTicket.value, onSelect: () => printReceipt(movement) }]
  if (canEditMovement(movement)) actions.push({ actionId: 'edit', label: 'Editar', icon: Pencil, accessibleName: 'Editar ' + folio, isDisabled: isSaving.value || isFormOpen.value, onSelect: () => openEdit(movement) })
  if (movement.state !== 'active' || movement.access !== 'readWrite') return actions
  const canVoid = movement.clientId === null ? capabilities.value.canVoidOffice : capabilities.value.canVoid
  if (canVoid) actions.push({ actionId: 'delete', label: 'Eliminar', icon: Trash2, tone: 'danger', accessibleName: 'Eliminar ' + folio, isDisabled: isSaving.value || isFormOpen.value, onSelect: () => { pendingVoid.value = movement } })
  return actions
}
onBeforeUnmount(() => { isMounted = false; clearTimeout(eventsTimer); movements.value = []; summary.value = null; clients.value = [] })
</script>

<template>
  <section data-testid="movements-page">
    <div class="section-heading page-heading">
      <div>
        <div class="help-title-row">
          <h1>Pagos</h1>
          <HelpTip
            title="Cobros, gastos y origen"
            text="Cada movimiento es un cobro o un gasto de un cliente o del propio despacho; el filtro «Origen» separa unos de otros. Anular no borra: el movimiento conserva su folio y deja de sumar en los cortes."
          />
        </div>
        <p class="lede">
          Cobranza y gastos por cliente, con corte de caja por método de pago.
        </p>
      </div>
      <ActionButton
        :aria-expanded="isCashCutOpen"
        aria-controls="cash-cut"
        @click="isCashCutOpen = !isCashCutOpen"
      >
        <Calculator
          :size="16"
          aria-hidden="true"
        /> Corte de caja
      </ActionButton>
    </div>

    <InlineNotice
      v-if="error"
      title="Operación no confirmada"
      tone="error"
    >
      <p>{{ error }}</p>
    </InlineNotice>
    <InlineNotice
      v-if="hasRemoteChanges"
      title="Hay movimientos nuevos o modificados"
      tone="warning"
    >
      <p>Otro equipo cambió los movimientos. Tu captura se conserva; actualiza al terminar.</p>
    </InlineNotice>

    <section
      v-if="summary && isCashCutOpen"
      id="cash-cut"
      class="movement-summary"
      aria-label="Corte del periodo"
      data-testid="movement-summary"
    >
      <div class="summary-tile">
        <span>Cobramos</span><strong data-testid="summary-income">{{ formatMoney(summary.incomeAmount) }}</strong>
      </div>
      <div class="summary-tile">
        <span>Pagamos</span><strong data-testid="summary-expense">{{ formatMoney(summary.expenseAmount) }}</strong>
      </div>
      <div class="summary-tile summary-net">
        <span>Neto</span><strong data-testid="summary-net">{{ formatMoney(summary.netAmount) }}</strong>
      </div>
      <div class="summary-methods">
        <p class="field-help">
          {{ summary.movementCount }} movimiento(s) activos · {{ periodText }}. Los anulados no suman.
        </p>
        <ul
          v-if="summary.office && summary.byOfficeCategory.length"
          class="summary-office"
          data-testid="summary-office"
        >
          <li><strong>Despacho (incluido en el corte)</strong><span class="numeric">neto {{ formatMoney(summary.office.netAmount) }}</span></li>
          <li
            v-for="item in summary.byOfficeCategory"
            :key="item.officeCategory"
          >
            <span>{{ officeCategoryLabels[item.officeCategory] }}</span>
            <span class="numeric">{{ formatMoney(item.incomeAmount) }} / {{ formatMoney(item.expenseAmount) }} · neto {{ formatMoney(item.netAmount) }}</span>
          </li>
        </ul>
        <ul>
          <li
            v-for="item in summary.byPaymentMethod"
            :key="item.paymentMethod"
          >
            <span>{{ paymentMethodLabels[item.paymentMethod] }}</span>
            <span class="numeric">{{ formatMoney(item.incomeAmount) }} / {{ formatMoney(item.expenseAmount) }} · neto {{ formatMoney(item.netAmount) }}</span>
          </li>
        </ul>
        <div class="actions summary-actions">
          <ActionButton
            :is-loading="isPreparingTicket"
            @click="openCashCut"
          >
            <Printer
              :size="16"
              aria-hidden="true"
            /> Imprimir corte
          </ActionButton>
          <HelpTip
            title="Corte de caja por fecha y hora"
            text="Arriba se suman los movimientos activos del periodo filtrado por forma de pago (con los del despacho si puedes verlos). «Imprimir corte» te deja elegir desde y hasta qué fecha y hora, por ejemplo un turno de 08:00 a 14:00: cuenta la hora capturada en cada pago e incluye ambos extremos."
          />
        </div>
      </div>
    </section>

    <!-- Como en el original, registrar y editar un pago ocurren en un modal de captura. -->
    <FormModal
      :is-open="isFormOpen"
      :title="editor ? 'Editar pago ' + formatFolio(editor.folio) : 'Nuevo pago'"
      :description="editor ? 'Guardar pedirá tu contraseña. El historial conserva los valores anteriores.' : capabilities.canCreateOffice ? 'Cobro o gasto de un cliente asignado o del propio despacho. El folio lo asigna el Host.' : 'Cobro o gasto de un cliente asignado. El folio lo asigna el Host.'"
      :is-busy="isSaving"
      test-id="movement-modal"
      @close="isFormOpen = false"
    >
      <MovementForm
        :key="editor?.movementId ?? 'new'"
        :movement="editor"
        :client-options="capabilities.canCreate ? writableClientOptions : []"
        :can-use-office="capabilities.canCreateOffice"
        :is-busy="isSaving"
        :recent-concepts="movements.map(movement => movement.concept)"
        @submit="handleSubmit"
        @cancel="isFormOpen = false"
      />
    </FormModal>

    <div class="table-panel">
      <!-- La búsqueda consulta al Host al dejar de escribir (400 ms) o con Enter; ya no hace falta un botón. -->
      <ListToolbar
        v-model:search="search"
        class="table-toolbar"
        search-id="movement-filter-search"
        search-label="Buscar en concepto"
        label="Buscar pagos"
        placeholder="Concepto del pago"
        :filter-count="activeFilterCount"
        :search-delay-milliseconds="400"
        :is-busy="isLoading"
        @search="load()"
        @open-filters="isFilterOpen = true"
      >
        <template #leading>
          <strong class="toolbar-title">Control de caja</strong>
        </template>
        <template #actions>
          <ActionButton
            :disabled="isLoading"
            @click="showToday"
          >
            Hoy
          </ActionButton>
          <ActionButton
            :is-loading="isLoading"
            aria-label="Actualizar pagos"
            @click="load()"
          >
            <RefreshCw
              :size="16"
              aria-hidden="true"
            />
          </ActionButton>
          <ActionButton
            v-if="capabilities.canCreate || capabilities.canCreateOffice"
            variant="primary"
            :disabled="isLoading || isFormOpen || (!writableClientOptions.length && !capabilities.canCreateOffice)"
            @click="openCreate"
          >
            <Plus
              :size="16"
              aria-hidden="true"
            /> Nuevo pago
          </ActionButton>
        </template>
      </ListToolbar>
      <FilterChips
        :chips="activeFilterChips"
        fallback-focus-id="movement-filter-search"
        @remove="removeFilter"
        @clear="clearAppliedFilters"
      />
      <p
        v-if="capabilities.canCreate && !capabilities.canCreateOffice && !writableClientOptions.length && !isLoading"
        class="field-help table-note"
      >
        Necesitas un cliente con acceso de lectura y escritura para registrar.
      </p>
      <FormModal
        :is-open="isFilterOpen"
        title="Filtros"
        description="Elige qué pagos ver. La búsqueda por concepto sigue arriba."
        test-id="movement-filter-modal"
        @close="isFilterOpen = false"
      >
        <form
          id="movement-filters"
          class="movement-filters"
          aria-label="Filtros de movimientos"
          @submit.prevent="applyFilters"
        >
          <!-- Filtros en tres grupos de dos columnas, alineados arriba: la ayuda de un campo ya no desfasa a sus vecinos. -->
          <fieldset class="movement-filter-group">
            <legend>¿De quién?</legend>
            <SelectField
              v-if="capabilities.canReadOffice"
              id="movement-filter-scope"
              :model-value="scopeFilter"
              label="Origen"
              :options="scopeOptions"
              :disabled="isLoading"
              @update:model-value="scopeFilter = $event as MovementScope"
            />
            <SelectField
              v-if="scopeFilter === 'office'"
              id="movement-filter-category"
              v-model="officeCategoryFilter"
              label="Categoría"
              :options="officeCategoryOptions"
              :disabled="isLoading"
            />
            <AutocompleteField
              v-if="scopeFilter !== 'office'"
              id="movement-filter-client"
              v-model="clientFilterLabel"
              label="Cliente"
              :options="clientOptions.map(option => option.label)"
              :disabled="isLoading"
              help="Vacío muestra todos tus clientes asignados."
            />
          </fieldset>
          <!-- Periodo del corte de caja: también lo propone "Imprimir corte". La hora vacía es el día completo. -->
          <fieldset class="movement-filter-group is-period">
            <legend>Periodo del corte</legend>
            <DateTimeField
              v-model:date="fromDate"
              v-model:time="fromTime"
              date-id="movement-from"
              time-id="movement-from-time"
              label="Desde"
              time-label="Hora (opcional)"
              :max="toDate || undefined"
              :disabled="isLoading"
            />
            <DateTimeField
              v-model:date="toDate"
              v-model:time="toTime"
              date-id="movement-to"
              time-id="movement-to-time"
              label="Hasta"
              time-label="Hora (opcional)"
              :min="fromDate || undefined"
              :disabled="isLoading"
              help="Sin hora se consulta el día completo; la hora de fin incluye ese minuto."
            />
          </fieldset>
          <fieldset class="movement-filter-group">
            <legend>Movimiento</legend>
            <SelectField
              id="movement-filter-type"
              v-model="typeFilter"
              label="Tipo"
              :options="typeOptions"
              :disabled="isLoading"
            />
            <SelectField
              id="movement-filter-method"
              v-model="methodFilter"
              label="Método de pago"
              :options="methodOptions"
              :disabled="isLoading"
            />
          </fieldset>
          <CheckField
            id="movement-filter-voided"
            v-model="includeVoided"
            label="Incluir anulados en la lista"
            :disabled="isLoading"
          />
          <PageSizeField
            id="movement-filter-page-size"
            list="movements"
            label="Movimientos por página"
          />
          <div class="actions form-footer movement-filter-actions">
            <ActionButton
              type="submit"
              variant="primary"
              :is-loading="isLoading"
            >
              <Filter
                :size="16"
                aria-hidden="true"
              /> Aplicar filtros
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
      <!-- Lista animada (Animated List) con renglones deslizables (Swipe Row): Imprimir, Editar y Eliminar al arrastrar o con ⋯. -->
      <AnimatedList
        class="movement-list"
        :items="pagedMovements"
        :item-key="movement => movement.movementId"
        label="Movimientos"
        data-testid="movements-table"
      >
        <template #item="{ item: movement }">
          <SwipeRow
            :label="formatFolio(movement.folio)"
            :actions="movementActions(movement)"
          >
            <div
              class="movement-card"
              :class="{ 'is-voided': movement.state === 'voided' }"
              :data-navigation-id="movement.movementId"
            >
              <div class="movement-identity">
                <strong class="movement-folio">{{ formatFolio(movement.folio) }}</strong>
                <!-- Fecha y hora de negocio (2026-10-10): la hora va en su propio renglón para no partirse en la columna angosta. -->
                <time
                  class="field-help movement-date-time"
                  data-testid="movement-date-time"
                  :datetime="movement.movementDate + 'T' + movement.movementTime"
                >{{ formatBusinessDate(movement.movementDate) }} <span class="movement-time">{{ movement.movementTime }}</span></time>
              </div>
              <div class="movement-detail">
                <strong>{{ movement.clientDisplayName }}<template v-if="movement.officeCategory"> · {{ officeCategoryLabels[movement.officeCategory] }}</template></strong>
                <span class="movement-concept">{{ movement.concept }}</span>
                <span class="field-help movement-attended"><UserAvatar
                  :user-id="movement.createdByUserId"
                  :display-name="movement.createdByDisplayName"
                  size="small"
                  is-decorative
                />{{ paymentMethodLabels[movement.paymentMethod] }} · Atendió {{ movement.createdByDisplayName }}<template v-if="movement.updatedByDisplayName"> · modificó {{ movement.updatedByDisplayName }}</template></span>
                <span
                  v-if="movement.state === 'voided'"
                  class="field-help"
                ><StatusBadge tone="neutral">Anulado</StatusBadge> Motivo: {{ movement.voidReason }}</span>
              </div>
              <div
                class="movement-amount numeric"
                :class="movement.movementType === 'income' ? 'is-income' : 'is-expense'"
              >
                <span class="metric-label">{{ movement.movementType === 'income' ? 'Cobramos' : 'Pagamos' }}</span>
                <strong>{{ formatMoney(movement.amount) }}</strong>
              </div>
            </div>
          </SwipeRow>
        </template>
        <template #empty>
          <li
            v-if="!movements.length"
            class="movement-empty"
          >
            {{ isLoading ? 'Consultando pagos…' : error ? 'Sin datos por ahora.' : 'No hay movimientos en este periodo.' }}
            <span v-if="!isLoading && !error && capabilities.canCreate">Usa Nuevo pago para capturar el primero.</span>
          </li>
        </template>
      </AnimatedList>
      <div class="table-footer">
        <span>{{ movements.length }} movimiento(s) · {{ periodText }}</span>
        <ListPager
          v-model:page="movementPage"
          :page-count="movementPageCount"
          :total-count="movements.length"
          :page-size="movementsPerPage"
          label="movimientos"
        />
        <ActionButton
          v-if="nextCursor"
          :is-loading="isLoading"
          @click="load(true)"
        >
          Movimientos anteriores
        </ActionButton>
      </div>
    </div>

    <FormModal
      :is-open="isCashCutPrintOpen"
      title="Corte de caja"
      description="Elige desde qué fecha y hora y hasta qué fecha y hora se corta, por ejemplo un turno. Cuenta la hora capturada en cada pago."
      test-id="cash-cut-modal"
      @close="isCashCutPrintOpen = false"
    >
      <form
        class="cash-cut-form"
        aria-label="Periodo del corte de caja"
        @submit.prevent="printCashCut"
      >
        <DateTimeField
          v-model:date="cutFromDate"
          v-model:time="cutFromTime"
          date-id="cash-cut-from-date"
          time-id="cash-cut-from-time"
          label="Desde"
          date-label="Fecha de inicio"
          time-label="Hora de inicio"
          :max="cutToDate || undefined"
        />
        <DateTimeField
          v-model:date="cutToDate"
          v-model:time="cutToTime"
          date-id="cash-cut-to-date"
          time-id="cash-cut-to-time"
          label="Hasta"
          date-label="Fecha de fin"
          time-label="Hora de fin"
          :min="cutFromDate || undefined"
          :error="cutError"
        />
        <div class="actions form-footer">
          <ActionButton
            type="submit"
            variant="primary"
            :is-loading="isPreparingTicket"
          >
            <Printer
              :size="16"
              aria-hidden="true"
            /> Ver ticket del corte
          </ActionButton>
          <ActionButton @click="isCashCutPrintOpen = false">
            Cancelar
          </ActionButton>
        </div>
      </form>
    </FormModal>
    <ConfirmDialog
      :is-open="Boolean(pendingVoid)"
      :is-confirm-disabled="!voidReason.trim()"
      :is-loading="isSaving"
      title="Anular movimiento"
      hold-label="Mantén para anular"
      @close="pendingVoid = null; voidReason = ''"
      @confirm="confirmVoid"
    >
      <p v-if="pendingVoid">
        {{ formatFolio(pendingVoid.folio) }} por {{ formatMoney(pendingVoid.amount) }} dejará de sumar en los cortes. El folio no se reutiliza.
      </p>
      <TextField
        id="movement-void-reason"
        v-model="voidReason"
        label="Motivo de anulación"
        :disabled="isSaving"
      />
    </ConfirmDialog>
    <ConfirmDialog
      :is-open="Boolean(pendingReceipt)"
      title="¿Imprimir el recibo?"
      confirm-label="Ver ticket"
      @close="pendingReceipt = null"
      @confirm="pendingReceipt && printReceipt(pendingReceipt)"
    >
      <p v-if="pendingReceipt">
        {{ formatFolio(pendingReceipt.folio) }} por {{ formatMoney(pendingReceipt.amount) }} quedó registrado. Puedes imprimirlo ahora o después desde su fila.
      </p>
    </ConfirmDialog>
    <TicketPreviewDialog
      :preview="ticketPreview"
      @close="closeTicket"
    />
  </section>
</template>

<style scoped>
.movement-filters, .cash-cut-form { display: grid; gap: var(--spaceLarge); }
.movement-filter-group { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--spaceMedium); align-items: start; min-width: 0; margin: 0; padding: var(--spaceMedium) 0 0; border: 0; border-top: 2px solid var(--borderColor); }
.movement-filter-group legend { padding: 0 8px 0 0; font-family: var(--monoFontFamily); font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--mutedTextColor); }
/* El periodo va en renglones: cada extremo ya tiene fecha y hora lado a lado (DateTimeField). */
.movement-filter-group.is-period { grid-template-columns: minmax(0, 1fr); }
@container (max-width: 520px) { .movement-filter-group { grid-template-columns: minmax(0, 1fr); } }
/* Las líneas de la cuadrícula salen del hueco de 1px sobre el color de borde: no se duplican al reacomodar. */
.movement-summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1px; border: 2px solid var(--borderColor); background: var(--borderColor); margin-bottom: var(--spaceLarge); border-radius: var(--radiusNested); }
.summary-tile { padding: var(--spaceMedium); background: var(--surfaceColor); display: grid; gap: 4px; min-width: 0; }
.summary-tile span { font-family: var(--monoFontFamily); font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--mutedTextColor); }
.summary-tile strong { font-size: 24px; font-weight: 800; letter-spacing: -.03em; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.summary-net strong { color: var(--accentColor); }
.summary-methods { grid-column: 1 / -1; padding: var(--spaceMedium); background: var(--surfaceColor); }
.summary-methods ul { list-style: none; margin: 8px 0 0; padding: 0; display: grid; gap: 6px; }
.summary-office { padding-bottom: 8px; border-bottom: 1px solid var(--borderColor); }
.summary-methods li { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; font-size: 13px; }
.summary-actions { margin-top: var(--spaceMedium); }
/* Tarjeta del movimiento dentro del renglón deslizable: identidad, detalle, importe e Imprimir. */
.movement-list { border-top: 1px solid var(--borderColor); }
.movement-attended { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.movement-card { display: grid; grid-template-columns: 7.5rem minmax(0, 1fr) auto auto; gap: 16px; align-items: center; }
.movement-identity, .movement-detail { display: grid; gap: 2px; min-width: 0; }
.movement-folio { font-family: var(--monoFontFamily); font-size: 13px; }
.movement-time { display: block; font-family: var(--monoFontFamily); font-weight: 600; font-variant-numeric: tabular-nums; }
.movement-detail strong, .movement-concept { overflow-wrap: anywhere; }
.movement-amount { display: grid; gap: 2px; justify-items: end; }
.movement-amount strong { font-size: 16px; font-variant-numeric: tabular-nums; }
.movement-amount.is-income strong { color: var(--successColor); }
.movement-card.is-voided .movement-detail > strong, .movement-card.is-voided .movement-concept, .movement-card.is-voided .movement-amount strong { color: var(--mutedTextColor); text-decoration: line-through; }
.movement-empty { padding: 16px; color: var(--mutedTextColor); }
.movement-empty span { display: block; margin-top: 4px; }
@container (max-width: 640px) { .movement-card { grid-template-columns: minmax(0, 1fr) auto; } .movement-identity { grid-column: 1 / -1; grid-auto-flow: column; justify-content: start; gap: 8px; } }
@container (max-width: 640px) {
  .movement-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .summary-net { grid-column: 1 / -1; }
}
@container (max-width: 360px) {
  .movement-summary { grid-template-columns: minmax(0, 1fr); }
}
</style>
