<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onBeforeUnmount, watch } from 'vue'
import type { AssignedClient, ClientIdentity, ClientRequest, ClientSummary } from '../../../shared/contracts/clients'
import { emptyClientProfile, listProfileTaxRegimes } from '../../../shared/contracts/clientProfile'
import { describeTaxRegime } from '../../../shared/fiscal/taxRegimes'
import { hasUnsavedClientDraft } from './clientDraft'
import { describePersonType, describeRegime, formatPhoneNumber, taxRegimeOptions } from './clientPresentation'
import ClientProfileForm from './ClientProfileForm.vue'
import ClientDocumentsPanel from './ClientDocumentsPanel.vue'
import type { ClientCredentialStatus } from '../../../shared/contracts/clientCredentials'
import { withSensitiveConfirmation } from '../../shared/security/confirmSensitive'
import SearchSelectField from '../../shared/components/SearchSelectField.vue'
import ClientAssignments from './ClientAssignments.vue'
import ActionButton from '../../shared/components/ActionButton.vue'
import PageSizeField from '../../shared/components/PageSizeField.vue'
import { pageSizeFor } from '../settings/localPreferencesState'
import ListToolbar from '../../shared/components/ListToolbar.vue'
import FilterChips, { type ActiveFilterChip } from '../../shared/components/FilterChips.vue'
import ListPager from '../../shared/components/ListPager.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import StatusBadge from '../../shared/components/StatusBadge.vue'
import { Plus, RefreshCw, UserPlus, Trash2, RotateCcw, FolderOpen, Copy, Pencil, Mail } from '@lucide/vue'
import { openMailComposer } from '../mail/mailComposerState'
import { workspaceAccess } from '../workspace/sessionState'
import CheckField from '../../shared/components/CheckField.vue'
import ConfirmDialog from '../../shared/components/ConfirmDialog.vue'
import HelpTip from '../../shared/components/HelpTip.vue'
import FormModal from '../../shared/components/FormModal.vue'
import { useNotifications } from '../../shared/notifications/notificationStore'
import { useNavigationRequest } from '../../shared/navigation/navigationRequests'
import { revealNavigationItem } from '../../shared/navigation/revealNavigationItem'
import AnimatedList from '../../shared/vueBits/AnimatedList.vue'
import SwipeRow, { type SwipeAction } from '../../shared/vueBits/SwipeRow.vue'

/**
 * Clientes (rediseño 2026-10-03, ADR-032; lista completa 2026-10-04). Sin vista de ficha aparte (pedido del usuario):
 * - **Lista:** cada renglón muestra todos los datos (nombre, RFC y tipo de persona, régimen, teléfono, correo y el
 *   acceso SAT de este equipo) y sus acciones: Documentos, Copiar CIEC y Editar. Arrastrar revela Eliminar.
 * - **Documentos:** el expediente GLOBAL (ClientDocumentsPanel) en su propio modal.
 * - **CSF:** ya no es acción del renglón (2026-10-13): la consulta pública vive en la ficha como "Autocompletar con la
 *   constancia (CSF)" (ClientProfileForm) y "Obtener CSF con RFC y CIEC" en Cumplimiento → Constancias (TaxCertificatesPanel, 2026-10-17).
 * - **Asignaciones:** ClientAssignments, en el mismo modal de captura que "Nuevo pago".
 * Agregar y editar ocurren siempre en un modal con pasos (ClientProfileForm). Al guardar, la CIEC capturada se
 * guarda en este equipo después de que el Host confirma la ficha; si eso falla, la ficha queda guardada y se avisa.
 * Los cambios de otros equipos llegan por los eventos del Host; con la ficha o el modal abiertos sólo se avisa,
 * para no reemplazar lo que la persona está viendo o escribiendo.
 */
const { notify } = useNotifications()
const rows = ref<ClientIdentity[]>([]), assigned = ref<AssignedClient[]>([]), summaries = ref<ClientSummary[]>([])
const nextClientId = ref<string | null>(null), isDirectory = ref(false), isBusy = ref(false), error = ref(''), search = ref('')
/** Modal de captura (`editing` es el cliente que se edita, o null al agregar) y modal de documentos. */
const documentsTarget = ref<AssignedClient | null>(null)
/**
 * Acceso SAT de ESTE equipo por cliente (nunca el valor de la CIEC): se lee después de cada lista. Un error deja
 * `null` y el renglón dice "No se pudo consultar".
 */
const satAccess = ref<Record<string, { ciec: ClientCredentialStatus | null; hasFiel: boolean | null }>>({})
const isCopying = ref(false)
const isFormOpen = ref(false), editing = ref<AssignedClient | null>(null), formProfile = ref(emptyClientProfile())
const assignmentTarget = ref<ClientIdentity | null>(null), isDiscardOpen = ref(false)
let isMounted = true
let invalidationVersion = 0
const hasRemoteChanges = ref(false)
let sessionTimer: ReturnType<typeof setTimeout> | undefined

/** La expiración remota retira datos de pantalla; el sondeo no renueva actividad. */
async function inspectSession(): Promise<void> {
  try {
    const session = await window.contapp.manageSession('status')
    if (isMounted && session.state === 'signedOut') {
      rows.value = []; assigned.value = []; documentsTarget.value = null; isFormOpen.value = false; assignmentTarget.value = null
      error.value = 'Tu sesión terminó. Inicia sesión otra vez para continuar.'
    }
  } catch { /* Una caída de red no descarta el borrador: cada escritura seguirá requiriendo sesión en Host. */ }
  try {
    const events = await window.contapp.manageHostEvents('start')
    if (events.invalidationVersion !== undefined && events.invalidationVersion !== invalidationVersion) {
      if (isMounted && !isBusy.value) {
        invalidationVersion = events.invalidationVersion
        if (isFormOpen.value || assignmentTarget.value || documentsTarget.value) hasRemoteChanges.value = true
        else await load()
      }
    }
  } catch { /* Host local no utiliza WSS; sigue disponible la actualización explícita. */ }
  if (isMounted) sessionTimer = setTimeout(() => { void inspectSession() }, 10000)
}
function summaryOf(clientId: string): ClientSummary | undefined { return summaries.value.find(summary => summary.clientId === clientId) }
/**
 * Eliminar un cliente es un borrado suave (decisión del usuario, 2026-10-04): se desactiva y deja de aparecer en la
 * lista, pero sus pagos, tareas, documentos y reportes se siguen consultando. "Mostrar eliminados" (en Filtros) los
 * muestra para reactivarlos. El Host exige `clients.update` y asignación de escritura.
 */
const showInactive = ref(false), regimeFilter = ref(''), isFilterOpen = ref(false)
const pendingDeletion = ref<ClientIdentity | null>(null)
const regimeOptions = taxRegimeOptions({ includeRetired: true })
/**
 * Filtros activos como chips (2026-10-06) bajo la barra; el contador de "Filtros" se deriva de la misma lista. El
 * directorio de asignaciones no filtra (sin "Filtros"), así que ahí no hay chips. Los filtros se aplican en memoria:
 * quitar un chip basta para que `visible` se recalcule.
 */
const activeFilterChips = computed<ActiveFilterChip[]>(() => isDirectory.value ? [] : [
  ...(regimeFilter.value ? [{ filterId: 'regime', label: 'Régimen fiscal', value: regimeOptions.find(option => option.value === regimeFilter.value)?.label ?? regimeFilter.value }] : []),
  ...(showInactive.value ? [{ filterId: 'inactive', label: 'Eliminados', value: 'Mostrados' }] : [])
])
const activeFilterCount = computed(() => activeFilterChips.value.length)
function removeFilter(filterId: string): void {
  if (filterId === 'regime') regimeFilter.value = ''
  if (filterId === 'inactive') showInactive.value = false
}
function clearFilters(): void { regimeFilter.value = ''; showInactive.value = false }
/**
 * Búsqueda local en la página cargada: nombre, RFC, régimen (código o nombre, también de los adicionales), teléfono o correo.
 * El filtro de régimen coincide con el principal o con cualquier régimen adicional de la ficha (migración 120).
 */
const visible = computed(() => {
  const term = search.value.trim().toLocaleLowerCase('es-MX')
  const filtered = isDirectory.value ? rows.value : rows.value.filter(row => (row.isActive || showInactive.value) && (!regimeFilter.value || listProfileTaxRegimes(summaryOf(row.clientId) ?? emptyClientProfile()).includes(regimeFilter.value)))
  if (!term) return filtered
  return filtered.filter(row => {
    const summary = summaryOf(row.clientId)
    const regime = describeRegime(summary?.taxRegime ?? '')
    return [row.displayName, summary?.rfc, summary?.taxRegime, regime?.name, ...(summary?.additionalTaxRegimes.map(describeTaxRegime) ?? []), summary?.phoneNumber, summary?.emailAddress].some(value => value?.toLocaleLowerCase('es-MX').includes(term))
  })
})
/** Paginador de la lista (2026-10-04): 10 clientes por página; vuelve a la primera al buscar, filtrar o recargar. */
// Renglones por página elegidos en Filtros y recordados en este equipo (2026-10-17, `PageSizeField`).
const clientsPerPage = computed(() => pageSizeFor('clients'))
const clientPage = ref(0)
const clientPageCount = computed(() => Math.max(1, Math.ceil(visible.value.length / clientsPerPage.value)))
const pagedClients = computed(() => visible.value.slice(clientPage.value * clientsPerPage.value, (clientPage.value + 1) * clientsPerPage.value))
watch([search, regimeFilter, showInactive, rows, clientsPerPage], () => { clientPage.value = 0 })
/** Listados por página, sin caché local; errores retiran resultados para no mostrar acceso antiguo como vigente. */
async function load(shouldContinue = false): Promise<void> {
  if (isBusy.value) return
  isBusy.value = true; error.value = ''; hasRemoteChanges.value = false
  try {
    const result = await window.contapp.manageClients({ action: isDirectory.value ? 'directory' : 'list', afterClientId: shouldContinue ? nextClientId.value : null })
    if (isMounted) hasListedClients = true
    if (isMounted) { rows.value = isDirectory.value ? result.directory ?? [] : result.clients; assigned.value = result.clients; summaries.value = isDirectory.value ? [] : result.summaries ?? []; nextClientId.value = result.nextClientId; search.value = '' }
    if (isMounted && !isDirectory.value) void readSatAccess(result.clients.map(client => client.clientId))
  } catch { if (isMounted) { rows.value = []; assigned.value = []; summaries.value = []; nextClientId.value = null; error.value = 'No se pudo consultar. Revisa tus permisos y la conexión con el Host. El directorio de asignaciones requiere autorización administrativa.' } }
  finally { isBusy.value = false }
}
/** Lee en paralelo el estado de la CIEC y la e.firma de este equipo para los clientes de la página. */
async function readSatAccess(clientIds: string[]): Promise<void> {
  const entries = await Promise.all(clientIds.map(async clientId => {
    let ciec: ClientCredentialStatus | null = null, hasFiel: boolean | null = null
    try { ciec = await window.contapp.manageClientCredentials({ action: 'read', clientId }) } catch { ciec = null }
    try { hasFiel = Boolean(await window.contapp.readSatCredential(clientId)) } catch { hasFiel = null }
    return [clientId, { ciec, hasFiel }] as const
  }))
  if (isMounted) satAccess.value = Object.fromEntries(entries)
}
function describeCiec(clientId: string): string {
  const access = satAccess.value[clientId]
  if (!access) return 'CIEC…'
  return access.ciec === null ? 'CIEC sin consultar' : access.ciec.isCiecSaved ? 'CIEC guardada' : 'Sin CIEC'
}
function describeFiel(clientId: string): string {
  const access = satAccess.value[clientId]
  if (!access) return 'e.firma…'
  return access.hasFiel === null ? 'e.firma sin consultar' : access.hasFiel ? 'e.firma guardada' : 'Sin e.firma'
}
function accessOf(clientId: string): AssignedClient | undefined { return assigned.value.find(row => row.clientId === clientId) }
function create(): void { editing.value = null; formProfile.value = emptyClientProfile(); isFormOpen.value = true; assignmentTarget.value = null }
/** Editar consulta la ficha vigente en el Host (con su revisión) y abre el mismo modal por pasos. */
async function edit(clientId: string): Promise<void> {
  isBusy.value = true; error.value = ''; hasRemoteChanges.value = false
  try {
    const result = await window.contapp.manageClients({ action: 'get', clientId })
    const client = result.clients[0]
    if (isMounted && client) { editing.value = client; formProfile.value = { ...(result.profile ?? emptyClientProfile()) }; isFormOpen.value = true }
  } catch { error.value = 'No se pudo abrir la ficha. Actualiza la lista y revisa tu asignación.' }
  finally { isBusy.value = false }
}
/**
 * Copiar la CIEC es zona crítica (ADR-038): el diálogo único pide la contraseña siempre; Main la pone en el portapapeles
 * (lo limpia a los 30 s) sin enviarla a la vista.
 */
async function copyCiec(client: AssignedClient): Promise<void> {
  if (isCopying.value) return
  isCopying.value = true
  try {
    const result = await withSensitiveConfirmation({ operation: 'credential.copy', title: 'Copiar CIEC', description: client.displayName + ': la CIEC se copia al portapapeles y se borra de él en 30 segundos.' },
      proof => window.contapp.manageClientCredentials({ action: 'copy', clientId: client.clientId }, proof))
    if (!result) return
    notify('CIEC copiada', 'Pégala donde la necesites. El portapapeles se limpia en 30 segundos.', 'success')
  } catch (failure) { notify('No se copió la CIEC', failure instanceof Error ? failure.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : 'No se pudo copiar la CIEC.', 'error') }
  finally { isCopying.value = false }
}
function closeForm(): void { if (hasUnsavedClientDraft.value) isDiscardOpen.value = true; else isFormOpen.value = false }
async function save(request: ClientRequest, ciec: string | null): Promise<void> {
  isBusy.value = true; error.value = ''
  let clientId: string | null = null
  try {
    const result = await window.contapp.manageClients(request)
    clientId = result.clients[0]?.clientId ?? null
    if (isMounted) {
      hasUnsavedClientDraft.value = false; isFormOpen.value = false
      const savedName = result.clients[0]?.displayName
      notify('Ficha guardada', 'Los datos se guardaron en el Host.', 'success', clientId ? { target: { section: 'clients', itemId: clientId, label: savedName ? 'la ficha de ' + savedName : 'la ficha' } } : {})
    }
  } catch { if (isMounted) error.value = 'No se pudo confirmar el guardado. Conservamos el borrador. Revisa permisos, RFC duplicado o cambios de otro equipo; consulta la ficha actual antes de volver a guardar.' }
  finally { isBusy.value = false }
  if (!isMounted || !clientId) return
  if (ciec) {
    try { await window.contapp.manageClientCredentials({ action: 'save', clientId, ciec }) }
    catch { notify('CIEC no guardada', 'La ficha se guardó, pero la CIEC no. Edita la ficha para capturarla otra vez.', 'warning') }
  }
  // Tras guardar se vuelve a consultar la lista (y el acceso SAT de este equipo), con la ficha ya actualizada.
  await load()
}
/**
 * Avisos que llevan a un cliente (2026-10-10): cuando la lista ya lo tiene, se limpia la búsqueda, se muestran los
 * eliminados si el aviso lo pide (`view: 'inactive'`), se abre su página y `revealNavigationItem` resalta el renglón
 * (`data-navigation-id`). `view: 'documents'` abre además su expediente (avisos de ClientDocumentsPanel) y
 * `view: 'editCiec'` su ficha para capturar la CIEC (SatPortalAction).
 * Se espera un ciclo antes de elegir la página porque cambiar filtros reinicia el paginador.
 */
const requestedClient = ref<{ clientId: string; view: string | null } | null>(null)
let hasListedClients = false
useNavigationRequest('clients', request => { requestedClient.value = request.itemId ? { clientId: request.itemId, view: request.view ?? null } : null })
async function revealRequestedClient(clientId: string, view: string | null): Promise<void> {
  search.value = ''
  if (view === 'inactive' && !isDirectory.value) showInactive.value = true
  if (view === 'documents' && !isDirectory.value) documentsTarget.value = accessOf(clientId) ?? null
  // `editCiec` (portal del SAT con CIEC, SatPortalAction): sin CIEC en este equipo, abre "Editar ficha" para capturarla.
  if (view === 'editCiec' && !isDirectory.value && accessOf(clientId)?.access === 'readWrite') { documentsTarget.value = null; void edit(clientId) }
  await nextTick()
  const index = visible.value.findIndex(row => row.clientId === clientId)
  if (index < 0) return
  clientPage.value = Math.floor(index / clientsPerPage.value)
  void revealNavigationItem(clientId)
}
watch([requestedClient, rows, isBusy], () => {
  const requested = requestedClient.value
  if (!requested || isBusy.value) return
  // Tras una consulta completa sin el cliente (otra página del Host o sin acceso), la solicitud se abandona.
  if (!rows.value.some(row => row.clientId === requested.clientId)) { if (hasListedClients) requestedClient.value = null; return }
  requestedClient.value = null
  void revealRequestedClient(requested.clientId, requested.view)
}, { immediate: true })
function switchList(value: boolean): void { isDirectory.value = value; assignmentTarget.value = null; void load() }
onMounted(() => { void load(); void inspectSession() })
/** Acción del renglón deslizable: en el directorio, asignar acceso; en la lista, sólo Eliminar (los botones visibles hacen el resto). */
function clientActions(client: ClientIdentity): SwipeAction[] {
  if (isDirectory.value) return [{ actionId: 'assign', label: 'Acceso', icon: UserPlus, isDisabled: isBusy.value, accessibleName: 'Asignar acceso a ' + client.displayName + ' (menú)', onSelect: () => { assignmentTarget.value = rows.value.find(row => row.clientId === client.clientId) ?? null } }]
  // Todas las acciones del renglón viven en el arrastre (o en ⋯), sin botones sueltos (pedido del usuario, 2026-10-05).
  const assigned = accessOf(client.clientId), canWrite = assigned?.access === 'readWrite'
  const actions: SwipeAction[] = [{ actionId: 'documents', label: 'Documentos', icon: FolderOpen, isDisabled: isBusy.value, accessibleName: 'Documentos de ' + client.displayName, onSelect: () => { documentsTarget.value = assigned ?? null } }]
  // Correo (2026-10-17, [[MAIL]]): con `mail.send`; basta la asignación de lectura.
  if (workspaceAccess.value.canSendMail && client.isActive) actions.push({ actionId: 'mail', label: 'Correo', icon: Mail, isDisabled: isBusy.value, accessibleName: 'Enviar correo a ' + client.displayName, onSelect: () => openMailComposer({ clientId: client.clientId, clientName: client.displayName }) })
  if (canWrite && satAccess.value[client.clientId]?.ciec?.isCiecSaved) actions.push({ actionId: 'ciec', label: 'CIEC', icon: Copy, isDisabled: isBusy.value, accessibleName: 'Copiar CIEC de ' + client.displayName, onSelect: () => { if (assigned) void copyCiec(assigned) } })
  if (canWrite) actions.push({ actionId: 'edit', label: 'Editar', icon: Pencil, isDisabled: isBusy.value, accessibleName: 'Editar ' + client.displayName, onSelect: () => { void edit(client.clientId) } })
  if (canWrite && !client.isActive) actions.push({ actionId: 'restore', label: 'Reactivar', icon: RotateCcw, isDisabled: isBusy.value, accessibleName: 'Reactivar ' + client.displayName, onSelect: () => { void setClientActive(client, true) } })
  if (canWrite && client.isActive) actions.push({ actionId: 'delete', label: 'Eliminar', icon: Trash2, tone: 'danger', isDisabled: isBusy.value, accessibleName: 'Eliminar ' + client.displayName, onSelect: () => { pendingDeletion.value = client } })
  return actions
}
/** Desactiva (elimina de la lista) o reactiva un cliente sin tocar su perfil ni lo relacionado. */
async function setClientActive(client: ClientIdentity, isActive: boolean): Promise<void> {
  isBusy.value = true; error.value = ''
  try {
    const request = { action: 'update', clientId: client.clientId, revision: client.revision, displayName: client.displayName, isActive } as const
    // Eliminar es zona crítica (`clients.delete`): siempre pide la contraseña en el modal compartido; reactivar no.
    if (isActive) await window.contapp.manageClients(request)
    else if (!await withSensitiveConfirmation({ operation: 'clients.delete', title: 'Eliminar cliente', description: client.displayName + ' dejará de aparecer en la lista; lo relacionado se conserva.' }, proof => window.contapp.manageClients(request, proof))) return
    // El aviso lleva al renglón; uno eliminado se ve con "Mostrar eliminados" (`view: 'inactive'`).
    notify(isActive ? 'Cliente reactivado' : 'Cliente eliminado', isActive ? client.displayName + ' vuelve a la lista.' : client.displayName + ' ya no aparece en la lista; lo relacionado se conserva. Puedes reactivarlo desde Filtros.', 'success',
      { target: { section: 'clients', itemId: client.clientId, label: client.displayName, ...(isActive ? {} : { view: 'inactive' }) } })
  } catch { error.value = 'No se pudo cambiar el cliente. Revisa tu permiso de editar clientes y actualiza la lista: pudo cambiar en otro equipo.' }
  finally { isBusy.value = false; pendingDeletion.value = null }
  if (isMounted) await load()
}
onBeforeUnmount(() => { isMounted = false; clearTimeout(sessionTimer); rows.value = []; assigned.value = []; summaries.value = []; satAccess.value = {}; hasUnsavedClientDraft.value = false })
</script>
<template>
  <section data-testid="clients-page">
    <div class="section-heading page-heading">
      <div>
        <div class="help-title-row">
          <h1>Clientes</h1>
          <HelpTip
            title="Expedientes de clientes"
            text="Cada cliente es un expediente que guarda el Host con sus datos, documentos y accesos. Sólo ves los clientes que te asignaron, en modo de sólo lectura o de lectura y escritura; el Host revisa ese acceso en cada cambio."
          />
        </div>
        <p class="lede">
          Expedientes, datos de contacto y acceso por usuario.
        </p>
      </div>
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
      title="Hay cambios en el despacho"
      tone="warning"
    >
      <p>Otro equipo cambió clientes. Termina lo que estás haciendo y actualiza la lista; el Host rechazará una versión antigua.</p>
    </InlineNotice>
    <div class="table-panel">
      <ListToolbar
        v-model:search="search"
        class="table-toolbar"
        search-id="client-search"
        search-label="Buscar clientes"
        :placeholder="isDirectory ? 'Buscar nombre' : 'Nombre, RFC, régimen o contacto'"
        :filter-count="isDirectory ? null : activeFilterCount"
        :is-busy="isBusy"
        @open-filters="isFilterOpen = true"
      >
        <template #leading>
          <div
            v-sliding-tabs
            class="segmented-tabs"
            role="tablist"
            aria-label="Lista de clientes"
          >
            <button
              type="button"
              role="tab"
              :aria-selected="!isDirectory"
              :disabled="isBusy"
              @click="switchList(false)"
            >
              Mis clientes
            </button>
            <button
              type="button"
              role="tab"
              :aria-selected="isDirectory"
              :disabled="isBusy"
              @click="switchList(true)"
            >
              Administrar asignaciones
            </button>
          </div>
        </template>
        <template #actions>
          <ActionButton
            :is-loading="isBusy"
            aria-label="Actualizar clientes"
            @click="load()"
          >
            <RefreshCw
              :size="16"
              aria-hidden="true"
            />
          </ActionButton>
          <ActionButton
            variant="primary"
            :disabled="isBusy"
            @click="create"
          >
            <Plus
              :size="16"
              aria-hidden="true"
            /> Nuevo cliente
          </ActionButton>
        </template>
      </ListToolbar>
      <FilterChips
        :chips="activeFilterChips"
        fallback-focus-id="client-search"
        @remove="removeFilter"
        @clear="clearFilters"
      />
      <p
        v-if="isDirectory"
        class="field-help table-note"
      >
        Directorio administrativo: permite asignar acceso sin mostrar datos fiscales o de contacto.
      </p>
      <div
        v-else-if="visible.length"
        class="client-columns"
        aria-hidden="true"
      >
        <span>Cliente</span><span>Régimen fiscal</span><span>Contacto</span><span>Acceso SAT en este equipo</span><span />
      </div>
      <!-- Lista animada (Animated List) con renglones deslizables (Swipe Row); la acción principal queda visible. -->
      <AnimatedList
        class="client-list"
        :items="pagedClients"
        :item-key="client => client.clientId"
        :label="isDirectory ? 'Clientes para asignar acceso' : 'Clientes asignados'"
        data-testid="clients-table"
      >
        <template #item="{ item: client }">
          <SwipeRow
            :label="client.displayName"
            :actions="clientActions(client)"
          >
            <div
              class="client-row"
              :class="{ 'is-directory': isDirectory }"
              :data-navigation-id="client.clientId"
            >
              <!-- Datos completos en el renglón (sin vista de ficha): identidad, régimen, contacto y acceso SAT. -->
              <div class="client-identity">
                <strong>{{ client.displayName }}</strong>
                <span
                  v-if="!isDirectory"
                  class="client-rfc"
                >{{ summaryOf(client.clientId)?.rfc || 'Sin RFC' }}<template v-if="describePersonType(summaryOf(client.clientId)?.rfc ?? '')"> · {{ describePersonType(summaryOf(client.clientId)?.rfc ?? '') }}</template></span>
              </div>
              <div
                v-if="!isDirectory"
                class="client-regime"
              >
                <template v-if="describeRegime(summaryOf(client.clientId)?.taxRegime ?? '')">
                  <span
                    v-if="describeRegime(summaryOf(client.clientId)?.taxRegime ?? '')!.code"
                    class="client-code"
                  >{{ describeRegime(summaryOf(client.clientId)?.taxRegime ?? '')!.code }}</span>
                  <span class="client-regime-name">{{ describeRegime(summaryOf(client.clientId)?.taxRegime ?? '')!.name }}</span>
                  <!-- Regímenes adicionales como "+N"; el detalle completo va en el título y la etiqueta accesible. -->
                  <span
                    v-if="summaryOf(client.clientId)?.additionalTaxRegimes.length"
                    class="client-code"
                    :title="summaryOf(client.clientId)!.additionalTaxRegimes.map(describeTaxRegime).join(' / ')"
                    :aria-label="'Regímenes adicionales: ' + summaryOf(client.clientId)!.additionalTaxRegimes.map(describeTaxRegime).join(' / ')"
                  >+{{ summaryOf(client.clientId)!.additionalTaxRegimes.length }}</span>
                </template>
                <span
                  v-else
                  class="client-muted"
                >Sin régimen</span>
              </div>
              <div
                v-if="!isDirectory"
                class="client-contact"
              >
                <span class="client-phone">{{ formatPhoneNumber(summaryOf(client.clientId)?.phoneNumber ?? '') || 'Sin teléfono' }}</span>
                <span :class="{ 'client-muted': !summaryOf(client.clientId)?.emailAddress }">{{ summaryOf(client.clientId)?.emailAddress || 'Sin correo' }}</span>
              </div>
              <div
                v-if="!isDirectory"
                class="client-sat"
              >
                <span
                  class="client-chip"
                  :class="{ 'is-on': satAccess[client.clientId]?.ciec?.isCiecSaved }"
                >{{ describeCiec(client.clientId) }}</span>
                <span
                  class="client-chip"
                  :class="{ 'is-on': satAccess[client.clientId]?.hasFiel }"
                >{{ describeFiel(client.clientId) }}</span>
              </div>
              <div class="client-end">
                <StatusBadge
                  v-if="!client.isActive"
                  tone="neutral"
                >
                  Eliminado
                </StatusBadge>
                <StatusBadge
                  v-if="!isDirectory && accessOf(client.clientId)?.access === 'readOnly'"
                  tone="info"
                >
                  Solo lectura
                </StatusBadge>
                <ActionButton
                  v-if="isDirectory"
                  :disabled="isBusy"
                  :aria-label="'Asignar acceso a ' + client.displayName"
                  @click="assignmentTarget = client"
                >
                  Asignar acceso
                </ActionButton>
              </div>
            </div>
          </SwipeRow>
        </template>
        <template #empty>
          <li
            v-if="!isBusy && !visible.length"
            class="client-empty"
          >
            <strong>{{ error ? 'Sin datos por ahora' : search ? 'Sin coincidencias' : 'Todavía no hay clientes' }}</strong>
            <span>{{ error ? 'Actualiza cuando el Host esté disponible.' : search ? 'Prueba con otro nombre, RFC o régimen.' : 'Agrega el primero con “Nuevo cliente”.' }}</span>
          </li>
        </template>
      </AnimatedList>
      <div class="table-footer">
        <span>{{ visible.length === rows.length ? rows.length + (rows.length === 1 ? ' cliente' : ' clientes') : visible.length + ' de ' + rows.length + ' en esta página' }}</span>
        <ListPager
          v-model:page="clientPage"
          :page-count="clientPageCount"
          :total-count="visible.length"
          :page-size="clientsPerPage"
          label="clientes"
        />
        <ActionButton
          v-if="nextClientId"
          :disabled="isBusy"
          @click="load(true)"
        >
          Más clientes del Host
        </ActionButton>
      </div>
    </div>
    <!-- Agregar y editar: siempre en el modal por pasos. -->
    <FormModal
      :is-open="isFormOpen"
      :title="editing ? 'Editar ficha' : 'Nuevo cliente'"
      :description="editing ? editing.displayName : 'El RFC no puede repetirse en el despacho.'"
      :is-busy="isBusy"
      test-id="client-modal"
      @close="closeForm"
    >
      <ClientProfileForm
        :client="editing"
        :profile="formProfile"
        :is-busy="isBusy"
        @save="save"
        @cancel="closeForm"
      />
    </FormModal>
    <!-- Documentos del cliente en su propio modal (antes era una pestaña de la ficha). -->
    <FormModal
      :is-open="Boolean(documentsTarget)"
      title="Documentos"
      :description="documentsTarget?.displayName"
      test-id="documents-modal"
      @close="documentsTarget = null"
    >
      <ClientDocumentsPanel
        v-if="documentsTarget"
        :key="documentsTarget.clientId"
        :client="documentsTarget"
      />
    </FormModal>
    <!-- Asignar acceso también es una captura: mismo modal que "Nuevo pago". -->
    <FormModal
      :is-open="Boolean(assignmentTarget)"
      title="Asignar acceso"
      :description="assignmentTarget?.displayName"
      test-id="assignment-modal"
      @close="assignmentTarget = null; load()"
    >
      <ClientAssignments
        v-if="assignmentTarget"
        :key="assignmentTarget.clientId"
        :client="assignmentTarget"
        @close="assignmentTarget = null; load()"
      />
    </FormModal>
    <FormModal
      :is-open="isFilterOpen"
      title="Filtros"
      description="Elige qué clientes ver. La búsqueda sigue arriba."
      test-id="client-filter-modal"
      @close="isFilterOpen = false"
    >
      <form
        class="client-filters"
        @submit.prevent="isFilterOpen = false"
      >
        <SearchSelectField
          id="client-filter-regime"
          v-model="regimeFilter"
          label="Régimen fiscal"
          placeholder="Código o nombre del régimen"
          empty-label="Todos los regímenes"
          :options="regimeOptions"
        />
        <CheckField
          id="client-filter-inactive"
          v-model="showInactive"
          label="Mostrar eliminados"
        />
        <PageSizeField
          id="client-filter-page-size"
          list="clients"
          label="Clientes por página"
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
    <ConfirmDialog
      :is-open="Boolean(pendingDeletion)"
      title="Eliminar cliente"
      hold-label="Mantén para eliminar"
      :is-loading="isBusy"
      @close="pendingDeletion = null"
      @confirm="pendingDeletion && setClientActive(pendingDeletion, false)"
    >
      <p>{{ pendingDeletion?.displayName }} dejará de aparecer en la lista. Sus pagos, tareas, documentos y reportes se conservan y se pueden consultar; puedes reactivarlo desde Filtros → Mostrar eliminados.</p>
    </ConfirmDialog>
    <ConfirmDialog
      :is-open="isDiscardOpen"
      title="Descartar cambios de la ficha"
      @close="isDiscardOpen = false"
      @confirm="isFormOpen = false; isDiscardOpen = false"
    >
      <p>Hay cambios sin guardar. Cerrar la ficha los descartará.</p>
    </ConfirmDialog>
  </section>
</template>
<style scoped>
/* Columnas de la lista: la misma rejilla en el encabezado y en cada renglón. */
.client-columns, .client-row { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, .8fr) auto; gap: 16px; align-items: center; }
.client-columns { padding: 8px 20px; border-top: 1px solid var(--borderColor); font-size: 12px; font-weight: 500; color: var(--mutedTextColor); }
.client-row.is-directory { grid-template-columns: minmax(0, 1fr) auto; }
.client-list { border-top: 1px solid var(--borderColor); }
.client-identity, .client-contact { display: grid; gap: 2px; min-width: 0; overflow-wrap: anywhere; }
.client-identity strong { font-size: 15px; font-weight: 600; }
.client-rfc { font-family: var(--monoFontFamily); font-size: 13px; color: var(--mutedTextColor); font-variant-numeric: tabular-nums; }
.client-regime { display: flex; align-items: baseline; gap: 8px; min-width: 0; font-size: 14px; }
.client-code { flex: none; padding: 1px 8px; border-radius: 0; background: var(--subtleColor); font-family: var(--monoFontFamily); font-size: 12px; }
.client-regime-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.client-contact { font-size: 14px; }
.client-contact span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.client-muted { color: var(--mutedTextColor); }
.client-end { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 8px; }
.client-phone { font-family: var(--monoFontFamily); font-variant-numeric: tabular-nums; }
.client-sat { display: flex; flex-wrap: wrap; gap: 6px; min-width: 0; }
.client-chip { padding: 1px 6px; border: 2px solid var(--hairlineColor); font-family: var(--monoFontFamily); font-size: 11px; font-weight: 700; white-space: nowrap; color: var(--mutedTextColor); }
.client-chip.is-on { border-color: var(--borderColor); color: var(--textColor); }
.client-filters { display: grid; gap: var(--spaceMedium); }
.client-empty { display: grid; gap: 4px; justify-items: center; padding: 40px 16px; text-align: center; color: var(--mutedTextColor); }
.client-empty strong { color: var(--textColor); font-weight: 600; }
@container (max-width: 820px) {
  .client-columns { display: none; }
  .client-row { grid-template-columns: minmax(0, 1fr) auto; row-gap: 6px; }
  .client-regime, .client-contact, .client-sat { grid-column: 1; }
  .client-end { grid-column: 2; grid-row: 1; }
}
</style>
