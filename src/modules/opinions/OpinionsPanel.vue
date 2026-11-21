<script setup lang="ts">
import CountUp from '../../shared/vueBits/CountUp.vue'
import { describeTaxRegime } from '../../../shared/fiscal/taxRegimes'
import SpotlightCard from '../../shared/vueBits/SpotlightCard.vue'
import DitherProgressBar from '../../shared/components/DitherProgressBar.vue'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Download, RefreshCw, Search, X } from '@lucide/vue'
import type { ClientOpinionSummary, ComplianceOpinion, OpinionBatch, OpinionListStatus } from '../../../shared/contracts/complianceOpinions'
import ActionButton from '../../shared/components/ActionButton.vue'
import SideDrawer from '../../shared/components/SideDrawer.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import SelectField from '../../shared/components/SelectField.vue'
import StatusBadge from '../../shared/components/StatusBadge.vue'
import ListToolbar from '../../shared/components/ListToolbar.vue'
import FilterChips, { type ActiveFilterChip } from '../../shared/components/FilterChips.vue'
import SearchSelectField from '../../shared/components/SearchSelectField.vue'
import { taxRegimeOptions } from '../clients/clientPresentation'
import FormModal from '../../shared/components/FormModal.vue'
import { useNotifications, type NotifyOptions } from '../../shared/notifications/notificationStore'
import { useNavigationRequest, type NavigationTarget } from '../../shared/navigation/navigationRequests'
import { revealNavigationItem } from '../../shared/navigation/revealNavigationItem'
import { readIpcErrorMessage } from '../../shared/ipcErrorMessage'
import { formatBusinessDate } from '../../../shared/presentation/movementLabels'
import { StaggeredEntrance } from '../../shared/motion/staggeredEntrance'

/**
 * Opiniones de cumplimiento 32-D (6.4). El Host consulta al SAT (consulta pública por RFC) por lotes,
 * uno a la vez; esta vista pide el lote, muestra su avance cada 3 segundos y la lista de clientes con su
 * último resultado, vigencia, pendientes e historial. El PDF vive en el expediente del cliente (sólo el
 * último) y se guarda con el canal del expediente.
 *
 * Organización como "Cumplimiento" del original (sección propia desde el rediseño):
 * - **Panorama:** las positivas vigentes en grande con su cobertura favorable (positivas ÷ clientes
 *   consultados) y, al lado, los indicadores de la cartera.
 * - **Lista agrupada por régimen fiscal** con el detalle fijo a la derecha; una positiva muestra
 *   "Sin pendientes" y su vigencia de 30 días.
 */
const { notify } = useNotifications()
const clients = ref<ClientOpinionSummary[]>([]), batch = ref<OpinionBatch | null>(null), canQuery = ref(false)
const selected = ref<ClientOpinionSummary | null>(null), history = ref<ComplianceOpinion[]>([])
const search = ref(''), statusFilter = ref(''), isLoading = ref(false), error = ref('')
const listElement = ref<HTMLElement | null>(null)
/** Filtro de resultado en un modal (2026-10-04): la búsqueda queda a la vista; el filtro se aplica en memoria. */
const isFilterOpen = ref(false)
const rowEntrance = new StaggeredEntrance({ selector: '.opinion-row', distancePixels: 6, staggerSeconds: .012 })
let timer: ReturnType<typeof setTimeout> | undefined, isMounted = true
/** Clientes del lote que se inició desde esta vista, para el aviso de "terminada". */
let queriedClientIds: string[] = []

const statusLabels: Record<OpinionListStatus, string> = { positive: 'Positiva', negative: 'Con pendientes', suspended: 'Suspensión', withoutObligations: 'Sin obligaciones', notRegistered: 'No inscrito',
  cancelled: 'Cancelado', notLocated: 'No localizado', notPublic: 'No pública', other: 'Revisar', error: 'Con error', notQueried: 'Sin consultar' }
const statusTones: Record<OpinionListStatus, 'neutral' | 'info' | 'success' | 'warning' | 'error'> = { positive: 'success', negative: 'error', suspended: 'warning', withoutObligations: 'info', notRegistered: 'error',
  cancelled: 'error', notLocated: 'error', notPublic: 'warning', other: 'warning', error: 'error', notQueried: 'neutral' }
const statusOptions = [{ value: '', label: 'Todos los resultados' }, ...(Object.keys(statusLabels) as OpinionListStatus[]).filter(key => key !== 'error').map(value => ({ value, label: statusLabels[value] }))]
/**
 * Filtro por régimen fiscal (2026-10-04) con el selector con búsqueda común; se aplica en memoria como el de resultado.
 * Coincide con el régimen principal o con cualquier adicional (2026-10-18); la agrupación sigue siendo por el principal.
 */
const regimeFilter = ref('')
const regimeOptions = taxRegimeOptions({ includeRetired: true })
/**
 * Filtros activos como chips (2026-10-06): uno por filtro distinto de su valor por defecto, con la etiqueta legible.
 * El contador de "Filtros" sale de la misma lista, así barra y chips nunca discrepan. Quitar un chip sólo vacía ese
 * filtro; como se aplican en memoria, la lista se recalcula sola.
 */
const activeFilterChips = computed<ActiveFilterChip[]>(() => [
  ...(statusFilter.value ? [{ filterId: 'status', label: 'Resultado', value: statusLabels[statusFilter.value as OpinionListStatus] ?? statusFilter.value }] : []),
  ...(regimeFilter.value ? [{ filterId: 'regime', label: 'Régimen fiscal', value: regimeOptions.find(option => option.value === regimeFilter.value)?.label ?? regimeFilter.value }] : [])
])
const activeFilterCount = computed(() => activeFilterChips.value.length)
function removeFilter(filterId: string): void {
  if (filterId === 'status') statusFilter.value = ''
  if (filterId === 'regime') regimeFilter.value = ''
}
function clearFilters(): void { statusFilter.value = ''; regimeFilter.value = '' }
const filtered = computed(() => {
  const term = search.value.trim().toLocaleLowerCase('es-MX')
  return clients.value.filter(client => (!statusFilter.value || client.status === statusFilter.value) && (!regimeFilter.value || [client.taxRegime.trim(), ...client.additionalTaxRegimes].includes(regimeFilter.value)) &&
    (!term || client.clientDisplayName.toLocaleLowerCase('es-MX').includes(term) || (client.rfc ?? '').toLowerCase().includes(term)))
})
const metrics = computed(() => {
  const reviewed = clients.value.filter(client => client.status !== 'notQueried')
  const positives = clients.value.filter(client => client.isValid).length
  return { total: clients.value.length, positives, reviewed: reviewed.length, positivePercent: reviewed.length ? Math.round(positives / reviewed.length * 100) : 0, attention: clients.value.filter(client => ['negative', 'notLocated', 'cancelled', 'notRegistered', 'suspended', 'other'].includes(client.status)).length,
    notPublic: clients.value.filter(client => client.status === 'notPublic').length, notQueried: clients.value.filter(client => client.status === 'notQueried').length }
})
/** Grupos por régimen fiscal (el texto del régimen de la ficha), ordenados por nombre. */
const groups = computed(() => {
  const byRegime = new Map<string, ClientOpinionSummary[]>()
  for (const client of filtered.value) {
    // Código y nombre del catálogo incluido (ADR-032): "626 · Régimen Simplificado de Confianza".
    const regime = client.taxRegime.trim() ? describeTaxRegime(client.taxRegime.trim()) : 'Sin régimen capturado'
    byRegime.set(regime, [...(byRegime.get(regime) ?? []), client])
  }
  return [...byRegime.entries()].sort(([first], [second]) => first.localeCompare(second, 'es-MX')).map(([regime, members]) => ({ regime, members }))
})
/**
 * Clientes que consulta el botón del lote: los de la lista **filtrada** (resultado, régimen y búsqueda) con RFC
 * (pedido del usuario, 2026-10-17: "cuando hay filtros … consultar todos sólo lo hace a esos filtros").
 */
const queryable = computed(() => filtered.value.filter(client => client.rfc))
const isListNarrowed = computed(() => activeFilterCount.value > 0 || Boolean(search.value.trim()))
const isBatchRunning = computed(() => batch.value?.state === 'running')
const formatIssuedAt = (value: string | null) => value ? formatBusinessDate(value.slice(0, 10)) + ' ' + value.slice(11, 16) : '—'

async function load(): Promise<void> {
  isLoading.value = true; error.value = ''
  try {
    const result = await window.contapp.manageOpinions({ action: 'list' })
    if (result.status !== 'listed' || !isMounted) return
    hasListedOpinions = true
    clients.value = result.clients; canQuery.value = result.canQuery; batch.value = result.batch
    if (selected.value) selected.value = result.clients.find(client => client.clientId === selected.value!.clientId) ?? null
    void rowEntrance.play(() => listElement.value)
    schedulePoll()
  } catch (caught) { if (isMounted) error.value = readIpcErrorMessage(caught, 'No se pudieron consultar las opiniones.') }
  finally { isLoading.value = false }
}
/** Mientras el lote está en curso se pregunta su avance; al terminar se recarga la lista. */
function schedulePoll(): void {
  clearTimeout(timer)
  if (!isBatchRunning.value || !isMounted) return
  timer = setTimeout(async () => {
    try {
      const result = await window.contapp.manageOpinions({ action: 'batchStatus' })
      if (result.status === 'batch' && isMounted) {
        batch.value = result.batch
        if (result.batch?.state !== 'running') {
          // Aviso al terminar el lote iniciado aquí (2026-10-10): lleva a Cumplimiento; con un solo cliente, a su opinión.
          const finishedBatch = result.batch, finishedClientIds = queriedClientIds
          queriedClientIds = []
          await load(); if (selected.value) await openHistory(selected.value)
          // Se avisa después de recargar: con un solo cliente, el aviso ofrece «Descargar» su opinión nueva (2026-10-17).
          if (finishedBatch?.state === 'completed' && finishedClientIds.length) {
            notify('Consulta de opiniones terminada', finishedBatch.answeredCount + ' respondida(s) y ' + finishedBatch.failedCount + ' con error.', 'success', { target: opinionTarget(finishedClientIds), ...downloadActionFor(finishedClientIds) })
          }
          return
        }
      }
    } catch { /* Se reintenta en el siguiente ciclo. */ }
    schedulePoll()
  }, 3000)
}
async function query(clientIds: string[]): Promise<void> {
  if (!clientIds.length) return
  error.value = ''
  try {
    const result = await window.contapp.manageOpinions({ action: 'query', clientIds })
    if (result.status === 'batch') { batch.value = result.batch; queriedClientIds = [...clientIds]; notify('Consulta iniciada', clientIds.length + ' cliente(s). El Host consulta al SAT uno por uno; puedes seguir trabajando.', 'success', { target: opinionTarget(clientIds) }); schedulePoll() }
  } catch (caught) { error.value = readIpcErrorMessage(caught, 'No se inició la consulta.') }
}
async function cancelBatch(): Promise<void> {
  if (!batch.value) return
  try { const result = await window.contapp.manageOpinions({ action: 'cancelBatch', batchId: batch.value.batchId }); if (result.status === 'batch') batch.value = result.batch; await load() }
  catch (caught) { error.value = readIpcErrorMessage(caught, 'No se canceló la consulta.') }
}
async function openHistory(client: ClientOpinionSummary): Promise<void> {
  selected.value = client
  try { const result = await window.contapp.manageOpinions({ action: 'history', clientId: client.clientId }); if (result.status === 'history' && isMounted) history.value = result.opinions }
  catch (caught) { error.value = readIpcErrorMessage(caught, 'No se pudo consultar el historial.') }
}
async function savePdf(client: ClientOpinionSummary, opinion: ComplianceOpinion): Promise<void> {
  if (!opinion.documentId) return
  try {
    const result = await window.contapp.manageDocuments({ action: 'saveCopy', clientId: client.clientId, documentId: opinion.documentId })
    if (result.status === 'saved') notify('PDF guardado', 'La copia de la opinión se guardó donde elegiste.', 'success')
  } catch (caught) { error.value = readIpcErrorMessage(caught, 'No se guardó el PDF. Se necesita el permiso para consultar el expediente del cliente.') }
}

/** «Descargar» del aviso: sólo con un cliente y si su última opinión trae PDF en el expediente. */
function downloadActionFor(clientIds: readonly string[]): Pick<NotifyOptions, 'action'> {
  const client = clientIds.length === 1 ? clients.value.find(item => item.clientId === clientIds[0]) : undefined
  const opinion = client?.latest
  return client && opinion?.documentId ? { action: { label: 'Descargar', run: () => savePdf(client, opinion) } } : {}
}
/** Destino de los avisos de opiniones: la opinión del cliente si el lote fue de uno, si no la sección. */
function opinionTarget(clientIds: readonly string[]): NavigationTarget {
  const onlyClient = clientIds.length === 1 ? clients.value.find(client => client.clientId === clientIds[0]) : undefined
  return onlyClient ? { section: 'compliance', itemId: onlyClient.clientId, label: 'la opinión de ' + onlyClient.clientDisplayName } : { section: 'compliance' }
}
/**
 * Avisos que llevan a una opinión (2026-10-10): cuando la lista ya tiene al cliente se vacían búsqueda y filtros (para
 * que su renglón se vea), se abre su detalle e historial y `revealNavigationItem` resalta el renglón.
 */
const requestedClientId = ref<string | null>(null)
let hasListedOpinions = false
useNavigationRequest('compliance', request => { requestedClientId.value = request.itemId ?? null })
watch([requestedClientId, clients, isLoading], () => {
  const clientId = requestedClientId.value
  if (!clientId || isLoading.value) return
  const client = clients.value.find(item => item.clientId === clientId)
  if (!client) { if (hasListedOpinions) requestedClientId.value = null; return }
  requestedClientId.value = null
  search.value = ''; clearFilters()
  void openHistory(client)
  void revealNavigationItem(clientId)
}, { immediate: true })
onMounted(() => { void load() })
onBeforeUnmount(() => { isMounted = false; clearTimeout(timer); rowEntrance.dispose() })
</script>
<template>
  <section
    class="opinions-panel"
    data-testid="opinions-panel"
  >
    <InlineNotice
      v-if="error"
      title="Operación no completada"
      tone="error"
    >
      <p>{{ error }}</p>
    </InlineNotice>

    <div
      class="opinion-panorama"
      data-testid="opinion-metrics"
    >
      <section
        class="opinion-positive"
        aria-label="Opiniones positivas"
      >
        <p class="metric-label">
          Resultado principal
        </p>
        <p class="opinion-positive-count">
          <strong><CountUp :value="metrics.positives" /></strong> <span>Positivas vigentes</span>
        </p>
        <p class="field-help">
          De {{ metrics.reviewed }} cliente(s) con una consulta registrada.
        </p>
        <div class="opinion-coverage">
          <span class="metric-label">Cobertura favorable</span><strong><CountUp :value="metrics.positivePercent" /> %</strong>
          <meter
            min="0"
            max="100"
            :value="metrics.positivePercent"
            aria-label="Cobertura favorable"
          />
        </div>
      </section>
      <dl class="opinion-metrics">
        <SpotlightCard><dt>Clientes</dt><dd><CountUp :value="metrics.total" /></dd></SpotlightCard>
        <SpotlightCard><dt>Requieren atención</dt><dd><CountUp :value="metrics.attention" /></dd></SpotlightCard>
        <SpotlightCard><dt>No públicas</dt><dd><CountUp :value="metrics.notPublic" /></dd></SpotlightCard>
        <SpotlightCard><dt>Sin consultar</dt><dd><CountUp :value="metrics.notQueried" /></dd></SpotlightCard>
      </dl>
    </div>

    <div
      v-if="batch && isBatchRunning"
      class="surface-panel opinion-batch"
      role="status"
      data-testid="opinion-batch"
    >
      <DitherProgressBar
        :value="batch.processedCount"
        :max="batch.totalCount"
        :label="'Consultando al SAT: ' + batch.processedCount + ' de ' + batch.totalCount + ' · ' + batch.answeredCount + ' respondieron, ' + batch.failedCount + ' con error'"
        is-active
      />
      <ActionButton
        v-if="canQuery"
        @click="cancelBatch"
      >
        <X
          :size="15"
          aria-hidden="true"
        /> Cancelar
      </ActionButton>
    </div>
    <p
      v-else-if="batch"
      class="field-help"
    >
      Última consulta: {{ batch.answeredCount }} de {{ batch.totalCount }} respondieron{{ batch.state === 'cancelled' ? ' (cancelada)' : '' }} · {{ batch.requestedByDisplayName }}.
    </p>

    <FormModal
      :is-open="isFilterOpen"
      title="Filtros"
      description="Muestra sólo los clientes con un resultado o un régimen fiscal."
      test-id="opinion-filter-modal"
      @close="isFilterOpen = false"
    >
      <form
        class="opinion-filter-form"
        aria-label="Filtros de opiniones"
        @submit.prevent="isFilterOpen = false"
      >
        <SelectField
          id="opinion-status"
          v-model="statusFilter"
          label="Resultado"
          :options="statusOptions"
        />
        <SearchSelectField
          id="opinion-regime"
          v-model="regimeFilter"
          label="Régimen fiscal"
          placeholder="Código o nombre del régimen"
          empty-label="Todos los regímenes"
          :options="regimeOptions"
        />
        <div class="actions form-footer">
          <ActionButton
            type="submit"
            variant="primary"
          >
            Aplicar filtros
          </ActionButton>
          <ActionButton @click="clearFilters">
            Limpiar
          </ActionButton>
        </div>
      </form>
    </FormModal>
    <ListToolbar
      v-model:search="search"
      class="surface-panel toolbar-panel"
      search-id="opinion-search"
      search-label="Buscar cliente o RFC"
      placeholder="Cliente o RFC"
      :filter-count="activeFilterCount"
      @open-filters="isFilterOpen = true"
    >
      <template #actions>
        <ActionButton
          :is-loading="isLoading"
          aria-label="Actualizar opiniones"
          @click="load"
        >
          <RefreshCw
            :size="16"
            aria-hidden="true"
          />
        </ActionButton>
        <ActionButton
          v-if="canQuery"
          variant="primary"
          :disabled="isBatchRunning || !queryable.length"
          @click="query(queryable.map(client => client.clientId))"
        >
          <Search
            :size="16"
            aria-hidden="true"
          /> {{ isListNarrowed ? 'Consultar filtrados' : 'Consultar todos' }} ({{ queryable.length }})
        </ActionButton>
      </template>
    </ListToolbar>
    <FilterChips
      :chips="activeFilterChips"
      fallback-focus-id="opinion-search"
      is-standalone
      @remove="removeFilter"
      @clear="clearFilters"
    />

    <div class="opinion-layout">
      <div
        ref="listElement"
        class="opinion-list"
        role="list"
        aria-label="Opiniones por cliente"
      >
        <section
          v-for="group in groups"
          :key="group.regime"
          class="opinion-group"
          role="listitem"
        >
          <h3 class="opinion-group-heading">
            {{ group.regime }} <span>· {{ group.members.length }} cliente(s)</span>
          </h3>
          <ul :aria-label="group.regime">
            <li
              v-for="client in group.members"
              :key="client.clientId"
              class="opinion-row"
              :class="{ 'is-selected': selected?.clientId === client.clientId, 'is-positive': client.isValid }"
            >
              <button
                type="button"
                :aria-label="'Ver opinión de ' + client.clientDisplayName"
                :data-navigation-id="client.clientId"
                @click="openHistory(client)"
              >
                <span class="opinion-name"><strong>{{ client.clientDisplayName }}</strong><span class="field-help">{{ client.rfc ?? 'Sin RFC' }}</span></span>
                <StatusBadge :tone="statusTones[client.status]">
                  {{ statusLabels[client.status] }}
                </StatusBadge>
                <span class="field-help opinion-date">{{ client.latest ? formatIssuedAt(client.latest.issuedAt) : '—' }}</span>
              </button>
            </li>
          </ul>
        </section>
        <p
          v-if="!filtered.length"
          class="field-help opinion-empty"
        >
          {{ isLoading ? 'Consultando…' : 'No hay clientes con ese filtro.' }}
        </p>
      </div>
    </div>
    <!-- Detalle en un cajón (2026-10-17, pedido del usuario): se abre al elegir un cliente; cerrarlo lo deselecciona. -->
    <SideDrawer
      :is-open="Boolean(selected)"
      :title="selected ? 'Opinión de ' + selected.clientDisplayName : 'Opinión'"
      test-id="opinion-drawer"
      @close="selected = null"
    >
      <div
        v-if="selected"
        class="opinion-detail"
        data-testid="opinion-detail"
        :aria-label="'Opinión de ' + selected.clientDisplayName"
      >
        <div class="section-heading">
          <h3>{{ selected.clientDisplayName }}</h3>
          <ActionButton
            v-if="canQuery && selected.rfc"
            :disabled="isBatchRunning"
            @click="query([selected.clientId])"
          >
            <Search
              :size="15"
              aria-hidden="true"
            /> Consultar
          </ActionButton>
        </div>
        <InlineNotice
          v-if="selected.lastErrorMessage"
          title="El último intento no reemplazó esta opinión"
          tone="warning"
        >
          <p>{{ selected.lastErrorMessage }}</p>
        </InlineNotice>
        <template v-if="selected.latest">
          <dl class="opinion-facts">
            <div>
              <dt>Resultado</dt><dd>
                <StatusBadge :tone="statusTones[selected.latest.status]">
                  {{ statusLabels[selected.latest.status] }}
                </StatusBadge>
              </dd>
            </div>
            <div><dt>Emitida por el SAT</dt><dd>{{ formatIssuedAt(selected.latest.issuedAt) }}</dd></div>
            <div><dt>Vigencia</dt><dd>{{ selected.latest.validUntil ? (selected.isValid ? 'Hasta ' : 'Venció ') + formatBusinessDate(selected.latest.validUntil) : '—' }}</dd></div>
            <div><dt>Folio</dt><dd>{{ selected.latest.folio ?? '—' }}</dd></div>
          </dl>
          <div
            v-if="selected.isValid"
            class="opinion-all-clear"
          >
            <p class="metric-label">
              Resultado SAT · Sin pendientes
            </p>
            <strong>Opinión positiva a la fecha de emisión</strong>
            <p class="field-help">
              La opinión positiva tiene una vigencia general de 30 días naturales desde su emisión.
            </p>
          </div>
          <p class="field-help">
            {{ selected.latest.message }}
          </p>
          <ul
            v-if="selected.latest.pendingItems.length"
            class="opinion-pending"
          >
            <li
              v-for="item in selected.latest.pendingItems"
              :key="item.code"
            >
              {{ item.label }} <span class="field-help">· {{ item.isConfirmed ? 'Confirmado por el SAT' : 'Requiere verificación' }}</span>
            </li>
          </ul>
          <p
            v-if="selected.latest.status === 'notPublic'"
            class="field-help"
          >
            Pide al cliente que autorice en el portal del SAT que su opinión de cumplimiento sea pública (trámite 37836); después vuelve a consultar.
          </p>
          <p
            v-if="selected.latest.origin === 'portal'"
            class="field-help"
            data-testid="opinion-origin"
          >
            Obtenida en el portal del SAT con RFC y CIEC.
          </p>
          <ActionButton
            v-if="selected.latest.documentId && selected.latest.isCurrentDocument"
            @click="savePdf(selected, selected.latest)"
          >
            <Download
              :size="15"
              aria-hidden="true"
            /> Guardar PDF
          </ActionButton>
        </template>
        <p
          v-else
          class="field-help"
        >
          Todavía no hay una opinión de este cliente.
        </p>
        <h4>Historial</h4>
        <ul
          class="opinion-history"
          aria-label="Historial de opiniones"
        >
          <li
            v-for="opinion in history"
            :key="opinion.opinionId"
          >
            <StatusBadge :tone="statusTones[opinion.status]">
              {{ statusLabels[opinion.status] }}
            </StatusBadge>
            <span>{{ new Date(opinion.queriedAt).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) }} · {{ opinion.requestedByDisplayName }}{{ opinion.origin === 'portal' ? ' · con RFC y CIEC' : '' }}</span>
            <span class="field-help">{{ opinion.status === 'error' ? opinion.message : (opinion.documentId ? (opinion.isCurrentDocument ? 'PDF vigente en el expediente' : 'PDF reemplazado') : 'Sin PDF') }}</span>
          </li>
        </ul>
      </div>
    </SideDrawer>
  </section>
</template>
<style scoped>
.opinions-panel { display: grid; gap: var(--spaceMedium); min-width: 0; container-type: inline-size; }
/* Panorama: positivas en grande a la izquierda e indicadores de la cartera a la derecha. */
.opinion-panorama { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); gap: var(--spaceMedium); }
.opinion-positive { display: grid; gap: 8px; align-content: start; padding: 20px; border-radius: var(--radiusCard); background: var(--successFill); color: var(--successText); }
.opinion-positive .metric-label, .opinion-positive .field-help { color: inherit; opacity: .85; margin: 0; }
.opinion-positive-count { display: flex; align-items: baseline; gap: 10px; margin: 0; }
.opinion-positive-count strong { font-size: 48px; line-height: 1.1; font-weight: 600; letter-spacing: -.05em; }
.opinion-positive-count > span { font-size: 16px; font-weight: 500; }
.opinion-coverage { display: grid; grid-template-columns: 1fr auto; gap: 6px 12px; align-items: center; margin-top: 8px; }
.opinion-coverage strong { font-size: 18px; }
.opinion-coverage meter { grid-column: 1 / -1; width: 100%; height: 8px; accent-color: var(--successText); }
.opinion-metrics { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--spaceMedium); margin: 0; }
.opinion-metrics div { display: grid; gap: 4px; padding: 14px 16px; border: 2px solid var(--borderColor); background: var(--surfaceColor); box-shadow: var(--buttonShadow); align-content: start; }
.opinion-metrics dt { font-family: var(--monoFontFamily); font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--mutedTextColor); }
.opinion-metrics dd { margin: 0; font-size: 32px; line-height: 1.15; font-weight: 800; letter-spacing: -.03em; font-variant-numeric: tabular-nums; }
.opinion-batch { display: flex; flex-wrap: wrap; gap: var(--spaceMedium); align-items: center; }
.opinion-batch .dither-progress { flex: 1 1 320px; }
/* Filtros a la izquierda y acciones juntas a la derecha, alineadas con el pie de los campos. */
.opinion-filter-form { display: grid; gap: var(--spaceMedium); }
/* Lista y detalle lado a lado si caben; el detalle queda fijo al desplazar. */
/* La lista ocupa todo el ancho; el detalle va en el cajón (2026-10-17). */
.opinion-layout { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--spaceMedium); }
.opinion-list { display: grid; border: 0; background: var(--surfaceColor); border-radius: var(--radiusCard); box-shadow: var(--cardShadow); overflow: hidden; }
.opinion-group ul { list-style: none; margin: 0; padding: 0; }
.opinion-group-heading { margin: 0; padding: 10px 16px; background: var(--sidebarColor); border-bottom: 1px solid var(--borderColor); font-family: var(--monoFontFamily); font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--mutedTextColor); }
.opinion-group-heading span { text-transform: none; letter-spacing: 0; }
.opinion-row button { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 10px; align-items: center; width: 100%; padding: 10px 16px; border: 0; border-bottom: 1px solid var(--borderColor); background: transparent; color: var(--textColor); font: inherit; text-align: left; cursor: pointer; }
.opinion-row button:hover { background: var(--subtleColor); }
.opinion-row.is-positive button { box-shadow: inset 3px 0 0 var(--successColor); }
.opinion-row.is-selected button { background: var(--subtleColor); box-shadow: inset 3px 0 0 var(--textColor); }
.opinion-empty { padding: 16px; margin: 0; }
.opinion-name { display: grid; gap: 2px; min-width: 0; overflow-wrap: anywhere; }
.opinion-detail { display: grid; gap: var(--spaceMedium); min-width: 0; }
.opinion-detail h3, .opinion-detail h4 { margin: 0; }
.opinion-all-clear { display: grid; gap: 4px; padding: 14px 16px; border-radius: var(--radiusNested); background: var(--successFill); color: var(--successText); }
.opinion-all-clear .metric-label, .opinion-all-clear .field-help { color: inherit; margin: 0; }
.opinion-facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 150px), 1fr)); gap: 10px; margin: 0; }
.opinion-facts dt { font-family: var(--monoFontFamily); font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--mutedTextColor); }
.opinion-facts dd { margin: 4px 0 0; }
.opinion-pending, .opinion-history { margin: 0; padding-left: 18px; display: grid; gap: 6px; }
.opinion-history { list-style: none; padding: 0; }
.opinion-history li { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 4px 10px; align-items: center; }
.opinion-history li .field-help { grid-column: 2; }
</style>
