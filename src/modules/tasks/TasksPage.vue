<script setup lang="ts">
import { handlePdfResult } from '../../shared/pdf/pdfViewerState'
import { ref, computed, nextTick, onMounted, onBeforeUnmount, watch } from 'vue'
import { StaggeredEntrance } from '../../shared/motion/staggeredEntrance'
import { Plus, Pencil, UserPlus, UserMinus, UsersRound, CalendarDays, GripVertical, RefreshCw, ArrowRight, ChevronLeft, ChevronRight, FileText, Download, Lock } from '@lucide/vue'
import { canTransitionTask, maximumReopenDays, taskStates, type AssignableUser, type Task, type TaskCapabilities, type TaskDraft, type TaskRequest, type TaskState } from '../../../shared/contracts/tasks'
import { getOfficeToday } from '../../../shared/contracts/movements'
import type { AssignedClient } from '../../../shared/contracts/clients'
import { formatBusinessDate } from '../../../shared/presentation/movementLabels'
import { formatAssignees, formatTaskFolio, isOverdueTask, isPendingTask, isReopenExpired, taskColumnFor, taskStateLabels, taskStateTones } from './taskLabels'
import TaskForm from './TaskForm.vue'
import FormModal from '../../shared/components/FormModal.vue'
import ActionButton from '../../shared/components/ActionButton.vue'
import PageSizeField from '../../shared/components/PageSizeField.vue'
import { pageSizeFor } from '../settings/localPreferencesState'
import ListToolbar from '../../shared/components/ListToolbar.vue'
import FilterChips, { type ActiveFilterChip } from '../../shared/components/FilterChips.vue'
import AutocompleteField from '../../shared/components/AutocompleteField.vue'
import SelectField from '../../shared/components/SelectField.vue'
import SearchSelectField, { type SearchSelectOption } from '../../shared/components/SearchSelectField.vue'
import AvatarStack from '../../shared/components/AvatarStack.vue'
import DateField from '../../shared/components/DateField.vue'
import ContextMenu, { type ContextMenuItem } from '../../shared/components/ContextMenu.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import StatusBadge from '../../shared/components/StatusBadge.vue'
import ConfirmDialog from '../../shared/components/ConfirmDialog.vue'
import HelpTip from '../../shared/components/HelpTip.vue'
import { useNotifications } from '../../shared/notifications/notificationStore'
import { useNavigationRequest } from '../../shared/navigation/navigationRequests'

/**
 * Tablero GLOBAL de tareas. La vista sólo arma filtros y solicitudes; el Host decide visibilidad,
 * transiciones y responsables, y devuelve las acciones permitidas por tarea. Tras cada escritura se
 * vuelve a consultar; una respuesta perdida no se reintenta automáticamente.
 */
const { notify } = useNotifications()
const today = getOfficeToday()
/**
 * Completadas desde un día (por omisión HOY, 2026-10-04: "para no sobresaturar"). Desde el 2026-10-17 el filtro
 * «Terminadas desde» trae también las de días anteriores (hasta 366 días, el límite del Host). Una terminada hace más
 * de `maximumReopenDays` ya no se puede regresar a «En proceso»: el Host lo decide y la tarjeta lo dice.
 */
const completedSince = ref(today)

/**
 * Reporte PDF de tareas terminadas (2026-10-04): se elige el día (hasta 366 días atrás, el límite del Host) y se ve en el
 * visor o se guarda. Main arma el PDF con el nombre y logo del despacho.
 */
const isReportOpen = ref(false), reportDay = ref(today), isReportBusy = ref(false), reportError = ref('')
const earliestReportDay = new Date(Date.parse(today + 'T12:00:00Z') - 366 * 86400000).toISOString().slice(0, 10)
async function openCompletedReport(action: 'preview' | 'save'): Promise<void> {
  isReportBusy.value = true; reportError.value = ''
  try {
    const result = await window.contapp.openCompletedTasksPdf({ day: reportDay.value, action })
    // "Ver" abre el visor de PDF de Fiscenix (2026-10-06); "Guardar" ya escribió el archivo en Main.
    if (handlePdfResult(result)) notify('Reporte guardado', 'El PDF de tareas terminadas se guardó donde elegiste.', 'success')
    if (result.status !== 'cancelled') isReportOpen.value = false
  } catch { reportError.value = 'No se pudo generar el reporte. Revisa tu sesión y el permiso Consultar tareas.' }
  finally { isReportBusy.value = false }
}
const clients = ref<AssignedClient[]>([])
const scope = ref<'all' | 'mine'>('all'), clientFilterLabel = ref('')
const tasks = ref<Task[]>([]), isTruncated = ref(false), capabilities = ref<TaskCapabilities>({ canCreate: false, canAssign: false })
const isLoading = ref(false), isSaving = ref(false), error = ref(''), hasRemoteChanges = ref(false), announcement = ref('')
const editor = ref<Task | null>(null), isFormOpen = ref(false), currentUserId = ref('')
const assigning = ref<Task | null>(null), assignableUsers = ref<AssignableUser[]>([]), selectedAssigneeIds = ref<string[]>([])
const draggedTaskId = ref<string | null>(null), targetColumn = ref<TaskState | null>(null)
const boardElement = ref<HTMLElement | null>(null)
const scopeOptions = [{ value: 'all', label: 'Todas las tareas visibles' }, { value: 'mine', label: 'Sólo mis tareas' }]
let isMounted = true
let taskVersion: number | undefined
let eventsTimer: ReturnType<typeof setTimeout> | undefined
const cardEntrance = new StaggeredEntrance({ selector: '.kanban-card', distancePixels: 6, staggerSeconds: .02 })

const clientOptions = computed(() => clients.value.map(client => ({ client, label: clients.value.filter(other => other.displayName === client.displayName).length > 1 ? client.displayName + ' (' + client.clientId.slice(0, 8) + ')' : client.displayName })))
const writableClientOptions = computed(() => clientOptions.value.filter(option => option.client.access === 'readWrite').map(option => ({ clientId: option.client.clientId, label: option.label })))
const selectedClientId = computed(() => clientOptions.value.find(option => option.label === clientFilterLabel.value)?.client.clientId ?? null)
/**
 * Barra común (2026-10-04): la búsqueda filtra en vivo las tarjetas ya cargadas por título, descripción, folio, cliente o
 * responsable (como el "Buscar por tarea o responsable" de la ContaApp anterior). "Mostrar" y "Cliente" van en el modal
 * de Filtros porque sí vuelven a consultar al Host.
 */
const search = ref(''), isFilterOpen = ref(false)
/**
 * Filtros activos como chips (2026-10-06) bajo la barra; el contador de "Filtros" se deriva de la misma lista. Quitar
 * un chip devuelve ese filtro a su valor por defecto y vuelve a consultar al Host, como "Aplicar filtros".
 */
const activeFilterChips = computed<ActiveFilterChip[]>(() => [
  ...(scope.value === 'mine' ? [{ filterId: 'scope', label: 'Mostrar', value: scopeOptions.find(option => option.value === scope.value)?.label ?? scope.value }] : []),
  ...(clientFilterLabel.value ? [{ filterId: 'client', label: 'Cliente', value: clientFilterLabel.value }] : []),
  ...(completedSince.value !== today ? [{ filterId: 'completedSince', label: 'Terminadas desde', value: formatBusinessDate(completedSince.value) }] : [])
])
const activeFilterCount = computed(() => activeFilterChips.value.length)
function removeFilter(filterId: string): void {
  if (filterId === 'scope') scope.value = 'all'
  if (filterId === 'client') clientFilterLabel.value = ''
  if (filterId === 'completedSince') completedSince.value = today
  void load()
}
function clearAppliedFilters(): void { clearFilters(); void load() }
const visibleTasks = computed(() => {
  const term = search.value.trim().toLocaleLowerCase('es-MX')
  if (!term) return tasks.value
  return tasks.value.filter(task => [task.title, task.description, formatTaskFolio(task.folio), task.clientDisplayName ?? '', ...task.assignees.map(assignee => assignee.displayName)]
    .some(value => value.toLocaleLowerCase('es-MX').includes(term)))
})
function applyFilters(): void { isFilterOpen.value = false; void load() }
function clearFilters(): void { scope.value = 'all'; clientFilterLabel.value = ''; completedSince.value = today }
/**
 * Limitadores (2026-10-04): cada columna muestra `cardsPerPage` tarjetas con su paginador, para que el tablero no se
 * sature con el tiempo; la descripción se recorta a tres líneas. La página se reinicia al buscar o filtrar.
 */
/** Tarjetas por columna elegidas en Filtros y recordadas en este equipo (2026-10-17, `PageSizeField`). */
const cardsPerPage = computed(() => pageSizeFor('tasks'))
const columnPages = ref<Partial<Record<TaskState, number>>>({})
const columns = computed(() => taskStates.map(state => {
  const all = visibleTasks.value.filter(task => taskColumnFor(task) === state)
  const pageCount = Math.max(1, Math.ceil(all.length / cardsPerPage.value))
  const page = Math.min(columnPages.value[state] ?? 0, pageCount - 1)
  return { state, title: taskStateLabels[state], tone: taskStateTones[state], totalCount: all.length, page, pageCount, tasks: all.slice(page * cardsPerPage.value, (page + 1) * cardsPerPage.value) }
}))
function changePage(state: TaskState, page: number): void { columnPages.value = { ...columnPages.value, [state]: page } }

/**
 * Autocompletado del buscador (2026-10-04): las coincidencias aparecen bajo el campo. Al elegir una se limpia la
 * búsqueda (se ve el tablero completo), se abre la página de su columna, se desplaza hasta la tarjeta, recibe el foco
 * y queda remarcada unos segundos.
 */
const searchSuggestions = computed(() => search.value.trim() ? visibleTasks.value.map(task => ({ value: task.taskId, label: task.title, detail: formatTaskFolio(task.folio) + ' · ' + taskStateLabels[task.state] + ' · ' + (task.clientDisplayName ?? 'Despacho') })) : [])
const highlightedTaskId = ref<string | null>(null)
let highlightTimer: ReturnType<typeof setTimeout> | undefined
async function goToTask(taskId: string): Promise<void> {
  const task = tasks.value.find(item => item.taskId === taskId)
  if (!task) return
  search.value = ''
  await nextTick()
  const state = taskColumnFor(task)
  const index = tasks.value.filter(item => taskColumnFor(item) === state).findIndex(item => item.taskId === taskId)
  changePage(state, Math.floor(index / cardsPerPage.value))
  highlightedTaskId.value = taskId
  await nextTick()
  const element = boardElement.value?.querySelector<HTMLElement>('[data-task-id="' + taskId + '"]')
  element?.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  element?.focus({ preventScroll: true })
  clearTimeout(highlightTimer)
  highlightTimer = setTimeout(() => { highlightedTaskId.value = null }, 2400)
}
watch([search, () => tasks.value.length], () => { if (!highlightedTaskId.value) columnPages.value = {} })
/**
 * Avisos que llevan a una tarea (2026-10-10): la solicitud se guarda hasta que el tablero tenga la tarea y entonces se
 * reutiliza `goToTask` (página de su columna, desplazamiento, foco y glow). Si tras una consulta completa la tarea no
 * está (filtrada o sin acceso), la solicitud se abandona en silencio.
 */
const requestedTaskId = ref<string | null>(null)
let hasListedTasks = false
useNavigationRequest('tasks', request => { requestedTaskId.value = request.itemId ?? null })
watch([requestedTaskId, tasks, isLoading], ([taskId]) => {
  if (!taskId) return
  if (tasks.value.some(task => task.taskId === taskId)) { requestedTaskId.value = null; void goToTask(taskId); return }
  if (hasListedTasks && !isLoading.value) requestedTaskId.value = null
}, { immediate: true })

/**
 * Menú contextual de la tarjeta (clic derecho, o Shift+F10 / tecla de menú con la tarjeta enfocada): editar, tomar,
 * soltar, asignar y mover a los estados que el Host aceptaría. El estado se ve como chip y cambia al arrastrar.
 */
const contextMenu = ref<{ task: Task; x: number; y: number } | null>(null)
function openContextMenu(task: Task, x: number, y: number): void { contextMenu.value = { task, x, y } }
function openContextMenuFromKeyboard(event: KeyboardEvent, task: Task): void {
  if (event.key !== 'ContextMenu' && !(event.key === 'F10' && event.shiftKey)) return
  event.preventDefault()
  const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect()
  openContextMenu(task, bounds.left + 16, bounds.top + 16)
}
const contextItems = computed<ContextMenuItem[]>(() => {
  const task = contextMenu.value?.task
  if (!task) return []
  const items: ContextMenuItem[] = []
  if (task.actions.canEdit) items.push({ itemId: 'edit', label: 'Editar', icon: Pencil, isDisabled: isSaving.value || isFormOpen.value, onSelect: () => openEdit(task) })
  if (task.actions.canTake) items.push({ itemId: 'take', label: 'Tomar', icon: UserPlus, isDisabled: isSaving.value, onSelect: () => { void perform({ action: 'take', taskId: task.taskId, revision: task.revision }, 'Tarea tomada') } })
  if (task.actions.canRelease) items.push({ itemId: 'release', label: 'Soltar', icon: UserMinus, isDisabled: isSaving.value, onSelect: () => { void perform({ action: 'release', taskId: task.taskId, revision: task.revision }, 'Tarea liberada') } })
  if (task.actions.canAssign) items.push({ itemId: 'assign', label: 'Asignar responsables', icon: UsersRound, isDisabled: isSaving.value, onSelect: () => { void openAssign(task) } })
  for (const state of targetsFor(task)) items.push({ itemId: 'move-' + state, label: taskStateLabels[state], icon: ArrowRight, group: 'Mover a', isDisabled: isSaving.value, onSelect: () => { void moveTask(task, state) } })
  return items
})
/**
 * Responsables con foto, presencia y puesto (2026-10-06): agrupados por su primer rol y, dentro, en línea primero.
 */
const presenceOrder = { online: 0, away: 1, offline: 2 } as const
const assigneeOptions = computed<SearchSelectOption[]>(() => [...assignableUsers.value]
  .map(user => ({ user, group: user.roleNames[0] ?? 'Sin rol' }))
  .sort((first, second) => first.group.localeCompare(second.group, 'es-MX') || presenceOrder[first.user.presence] - presenceOrder[second.user.presence] || first.user.displayName.localeCompare(second.user.displayName, 'es-MX'))
  .map(({ user, group }) => ({ value: user.userId, label: user.displayName, detail: user.roleNames.join(' · ') || 'Sin rol', group, keywords: user.roleNames.join(' '), person: { userId: user.userId, presence: user.presence } })))

/** Destinos que el Host aceptaría según el grafo y las acciones calculadas para esta tarea. */
function targetsFor(task: Task): TaskState[] {
  return taskStates.filter(state => canTransitionTask(task.state, state) && (state === 'completed' || task.state === 'completed' ? task.actions.canComplete : task.actions.canMove))
}

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


/** Un error retira el tablero para no mostrar un acceso antiguo como vigente. */
async function load(writeError = ''): Promise<void> {
  if (isLoading.value) return
  isLoading.value = true; error.value = writeError; hasRemoteChanges.value = false
  try {
    // Sin permiso de contribuyentes el tablero sigue mostrando las tareas del despacho.
    if (!clients.value.length) await loadClients().catch(() => undefined)
    const result = await window.contapp.manageTasks({ action: 'list', filter: { scope: scope.value, clientId: selectedClientId.value, completedSince: completedSince.value || today } })
    if (result.status !== 'listed' || !isMounted) return
    hasListedTasks = true
    tasks.value = result.tasks; isTruncated.value = result.isTruncated; capabilities.value = result.capabilities; currentUserId.value = result.currentUserId
    void cardEntrance.play(() => boardElement.value)
  } catch {
    if (isMounted) { tasks.value = []; error.value = 'No se pudo consultar. Revisa el permiso Consultar tareas, tus asignaciones y la conexión con el Host.' }
  } finally { isLoading.value = false }
}

/** Envía una escritura como objeto plano (los proxies reactivos no cruzan contextBridge) y devuelve el error o ''. */
async function run(request: TaskRequest, successTitle: string): Promise<string> {
  isSaving.value = true; error.value = ''
  try {
    const result = await window.contapp.manageTasks(JSON.parse(JSON.stringify(request)) as TaskRequest)
    if (result.status === 'saved' && isMounted) {
      notify(successTitle, formatTaskFolio(result.task.folio) + ' · ' + result.task.title, 'success', { target: { section: 'tasks', itemId: result.task.taskId, label: 'la tarea ' + formatTaskFolio(result.task.folio) } })
      announcement.value = result.task.title + ': ' + taskStateLabels[result.task.state]
    }
    return ''
  } catch {
    return 'No se confirmó la tarea. Revisa permisos, asignación o cambios de otro equipo; el tablero se actualizó con la versión vigente.'
  } finally { isSaving.value = false }
}
async function perform(request: TaskRequest, successTitle: string): Promise<boolean> {
  const failure = await run(request, successTitle)
  await load(failure)
  return !failure
}

function openCreate(): void { editor.value = null; isFormOpen.value = true }
function openEdit(task: Task): void { editor.value = task; isFormOpen.value = true }
async function handleSubmit(value: { draft: TaskDraft; shouldAssignSelf: boolean }): Promise<void> {
  const current = editor.value
  const request: TaskRequest = current
    ? { action: 'update', taskId: current.taskId, revision: current.revision, draft: value.draft }
    : { action: 'create', draft: value.draft, assigneeUserIds: value.shouldAssignSelf ? [currentUserId.value] : [] }
  if (await perform(request, current ? 'Tarea actualizada' : 'Tarea creada')) isFormOpen.value = false
}
async function moveTask(task: Task, state: TaskState): Promise<void> {
  if (!targetsFor(task).includes(state)) { announcement.value = 'Movimiento no permitido para ' + task.title; return }
  await perform({ action: 'move', taskId: task.taskId, revision: task.revision, state }, 'Tarea movida a ' + taskStateLabels[state].toLowerCase())
}
function dropOn(state: TaskState): void {
  const task = tasks.value.find(item => item.taskId === draggedTaskId.value)
  draggedTaskId.value = null; targetColumn.value = null
  if (task && task.state !== state) void moveTask(task, state)
}
function startDrag(event: DragEvent, task: Task): void {
  draggedTaskId.value = task.taskId
  if (event.dataTransfer) { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', task.taskId) }
}
async function openAssign(task: Task): Promise<void> {
  error.value = ''
  try {
    const result = await window.contapp.manageTasks({ action: 'listAssignableUsers', clientId: task.clientId })
    if (result.status !== 'assignableUsers' || !isMounted) return
    assignableUsers.value = result.users; selectedAssigneeIds.value = task.assignees.map(assignee => assignee.userId); assigning.value = task
  } catch { error.value = 'No se pudo consultar quién puede ver esta tarea. Revisa el permiso Asignar tareas.' }
}
async function confirmAssign(): Promise<void> {
  const task = assigning.value
  if (!task) return
  assigning.value = null
  await perform({ action: 'assign', taskId: task.taskId, revision: task.revision, assigneeUserIds: selectedAssigneeIds.value }, 'Responsables actualizados')
}

/** Avisos WSS sin contenido: con captura o diálogo abiertos se conserva el borrador y se avisa. */
async function watchInvalidations(): Promise<void> {
  try {
    const events = await window.contapp.manageHostEvents('start')
    const version = events.taskInvalidationVersion
    if (version !== undefined && taskVersion !== undefined && version !== taskVersion && isMounted) {
      if (isFormOpen.value || assigning.value || contextMenu.value || isSaving.value) hasRemoteChanges.value = true
      else await load()
    }
    if (version !== undefined) taskVersion = version
  } catch { /* El Host local no usa WSS; el tablero se actualiza tras cada operación o manualmente. */ }
  if (isMounted) eventsTimer = setTimeout(() => { void watchInvalidations() }, 10000)
}

onMounted(() => { void load(); void watchInvalidations() })
onBeforeUnmount(() => { clearTimeout(highlightTimer); isMounted = false; clearTimeout(eventsTimer); cardEntrance.dispose(); tasks.value = []; clients.value = [] })
</script>

<template>
  <section data-testid="tasks-page">
    <!-- Ayuda "?" junto al título (2026-10-10): estados y qué significa "Pendiente". -->
    <div class="help-title-row">
      <h1>Tareas</h1>
      <HelpTip
        title="Estados de una tarea"
        text="Una tarea pasa de Disponible a En progreso y de ahí a Completada; una completada sólo se reabre a En progreso. «Pendiente» no es un estado: es una tarea disponible que ya tiene responsable. Muévela arrastrando la tarjeta o desde su menú."
      />
    </div>
    <p class="lede">
      Trabajo del despacho y de tus clientes. Una tarea disponible con responsable está pendiente de esa persona.
    </p>
    <p
      class="sr-only"
      role="status"
    >
      {{ announcement }}
    </p>

    <InlineNotice
      v-if="error"
      title="Operación no confirmada"
      tone="error"
    >
      <p>{{ error }}</p>
    </InlineNotice>
    <InlineNotice
      v-if="hasRemoteChanges"
      title="Hay tareas nuevas o modificadas"
      tone="warning"
    >
      <p>Otro equipo cambió el tablero. Tu captura se conserva; actualiza al terminar.</p>
    </InlineNotice>
    <InlineNotice
      v-if="isTruncated"
      title="Tablero parcial"
      tone="warning"
    >
      <p>Hay más tareas de las que se muestran. Filtra por cliente o por tus tareas.</p>
    </InlineNotice>

    <FormModal
      :is-open="isFilterOpen"
      title="Filtros"
      description="Qué tareas trae el tablero desde el Host."
      test-id="task-filter-modal"
      @close="isFilterOpen = false"
    >
      <form
        class="task-filter-form"
        aria-label="Filtros de tareas"
        @submit.prevent="applyFilters"
      >
        <SelectField
          id="task-filter-scope"
          v-model="scope"
          label="Mostrar"
          :options="scopeOptions"
          :disabled="isLoading"
        />
        <AutocompleteField
          id="task-filter-client"
          v-model="clientFilterLabel"
          label="Cliente"
          :options="clientOptions.map(option => option.label)"
          :disabled="isLoading"
          help="Vacío muestra también las tareas del despacho."
        />
        <DateField
          id="task-filter-completed-since"
          v-model="completedSince"
          label="Terminadas desde"
          :min="earliestReportDay"
          :max="today"
          help="Hoy por omisión. Elige un día anterior para ver también las terminadas desde entonces."
        />
        <PageSizeField
          id="task-filter-page-size"
          list="tasks"
          label="Tarjetas por columna"
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
    <ListToolbar
      v-model:search="search"
      class="surface-panel toolbar-panel"
      search-id="task-search"
      :suggestions="searchSuggestions"
      search-label="Buscar tareas"
      placeholder="Tarea, cliente o responsable"
      :filter-count="activeFilterCount"
      :is-busy="isLoading"
      @pick="goToTask"
      @open-filters="isFilterOpen = true"
    >
      <template #actions>
        <ActionButton
          aria-label="Reporte de tareas terminadas"
          @click="isReportOpen = true; reportError = ''"
        >
          <FileText
            :size="16"
            aria-hidden="true"
          /> Reporte
        </ActionButton>
        <ActionButton
          :is-loading="isLoading"
          aria-label="Actualizar tablero"
          @click="load()"
        >
          <RefreshCw
            :size="16"
            aria-hidden="true"
          />
        </ActionButton>
        <ActionButton
          v-if="capabilities.canCreate"
          variant="primary"
          :disabled="isLoading || isFormOpen"
          @click="openCreate"
        >
          <Plus
            :size="16"
            aria-hidden="true"
          /> Nueva tarea
        </ActionButton>
      </template>
    </ListToolbar>
    <FilterChips
      :chips="activeFilterChips"
      fallback-focus-id="task-search"
      is-standalone
      @remove="removeFilter"
      @clear="clearAppliedFilters"
    />
    <p class="field-help task-board-note">
      La columna Completada muestra las terminadas desde el día elegido en Filtros (hoy por omisión); el reporte PDF tiene las de cualquier día.
    </p>

    <!-- Como en el original, crear y editar una tarea ocurren en un modal de captura. -->
    <FormModal
      :is-open="isFormOpen"
      :title="editor ? 'Editar tarea' : 'Nueva tarea'"
      description="Define el trabajo, el cliente y la fecha límite. El Host valida permisos y asignaciones."
      :is-busy="isSaving"
      test-id="task-modal"
      @close="isFormOpen = false"
    >
      <TaskForm
        :key="editor?.taskId ?? 'new'"
        :task="editor"
        :client-options="writableClientOptions"
        :is-busy="isSaving"
        @submit="handleSubmit"
        @cancel="isFormOpen = false"
      />
    </FormModal>

    <div
      ref="boardElement"
      class="kanban-board"
    >
      <section
        v-for="column in columns"
        :key="column.state"
        class="kanban-column"
        :class="['column-' + column.tone, { 'is-drop-target': targetColumn === column.state }]"
        :aria-label="column.title"
        :data-state="column.state"
        @dragover.prevent="targetColumn = column.state"
        @dragleave.self="targetColumn = null"
        @drop.prevent="dropOn(column.state)"
      >
        <header>
          <StatusBadge :tone="column.tone">
            {{ column.title }}
          </StatusBadge><span class="card-count">{{ column.totalCount }}</span>
        </header>
        <article
          v-for="task in column.tasks"
          :key="task.taskId"
          v-motion="'card'"
          class="kanban-card"
          :class="{ 'is-highlighted': highlightedTaskId === task.taskId }"
          :data-task-id="task.taskId"
          :draggable="targetsFor(task).length > 0"
          tabindex="0"
          :aria-label="formatTaskFolio(task.folio) + ' ' + task.title + ', ' + taskStateLabels[task.state] + '. Clic derecho o Shift+F10 para ver acciones.'"
          @dragstart="startDrag($event, task)"
          @dragend="draggedTaskId = null; targetColumn = null"
          @contextmenu.prevent="openContextMenu(task, $event.clientX, $event.clientY)"
          @keydown="openContextMenuFromKeyboard($event, task)"
        >
          <div class="card-heading">
            <span class="field-help">{{ formatTaskFolio(task.folio) }}</span>
            <span
              class="task-state-chip"
              :class="'tone-' + taskStateTones[task.state]"
            >{{ taskStateLabels[task.state] }}</span>
            <GripVertical
              v-if="targetsFor(task).length"
              class="task-grip"
              :size="18"
              aria-hidden="true"
            />
          </div>
          <h2>{{ task.title }}</h2>
          <p>{{ task.clientDisplayName ?? 'Despacho' }}</p>
          <p
            v-if="task.description"
            class="task-description"
          >
            {{ task.description }}
          </p>
          <div class="task-badges">
            <StatusBadge
              v-if="isPendingTask(task)"
              tone="warning"
            >
              Pendiente
            </StatusBadge>
            <StatusBadge
              v-if="isOverdueTask(task, today)"
              tone="error"
            >
              Vencida
            </StatusBadge>
          </div>
          <!-- Fotos de los responsables (uno o varios); sin responsable queda el icono. -->
          <div class="card-meta">
            <AvatarStack
              v-if="task.assignees.length"
              :users="task.assignees"
            /><UsersRound
              v-else
              :size="15"
              aria-hidden="true"
            /><span>{{ formatAssignees(task) }}</span>
          </div>
          <div class="card-meta">
            <CalendarDays
              :size="15"
              aria-hidden="true"
            /><span>{{ task.dueDate ? 'Fecha límite ' + formatBusinessDate(task.dueDate) : 'Sin fecha límite' }}</span>
          </div>
          <div
            v-if="isReopenExpired(task)"
            class="card-meta"
          >
            <Lock
              :size="15"
              aria-hidden="true"
            /><span>Terminada hace más de {{ maximumReopenDays }} días: ya no se reabre</span>
          </div>
        </article>
        <p
          v-if="!column.tasks.length"
          class="kanban-empty"
        >
          {{ isLoading ? 'Consultando…' : 'Sin tareas.' }}
        </p>
        <nav
          v-if="column.pageCount > 1"
          class="column-pager"
          :aria-label="'Páginas de ' + column.title"
        >
          <button
            type="button"
            class="icon-button"
            :disabled="column.page === 0"
            :aria-label="'Página anterior de ' + column.title"
            @click="changePage(column.state, column.page - 1)"
          >
            <ChevronLeft
              :size="16"
              aria-hidden="true"
            />
          </button>
          <span>{{ column.page + 1 }} / {{ column.pageCount }}</span>
          <button
            type="button"
            class="icon-button"
            :disabled="column.page >= column.pageCount - 1"
            :aria-label="'Página siguiente de ' + column.title"
            @click="changePage(column.state, column.page + 1)"
          >
            <ChevronRight
              :size="16"
              aria-hidden="true"
            />
          </button>
        </nav>
      </section>
    </div>

    <ConfirmDialog
      :is-open="Boolean(assigning)"
      :is-loading="isSaving"
      :is-confirm-disabled="assigning?.state !== 'available' && !selectedAssigneeIds.length"
      title="Responsables de la tarea"
      @close="assigning = null"
      @confirm="confirmAssign"
    >
      <p v-if="assigning">
        {{ formatTaskFolio(assigning.folio) }} · {{ assigning.title }}. Sólo aparecen usuarios que pueden ver la tarea.
      </p>
      <p
        v-if="!assignableUsers.length"
        class="field-help"
      >
        Nadie más puede ver esta tarea. Revisa permisos y asignaciones del cliente.
      </p>
      <!-- Mismo selector con búsqueda que el de clientes, en modo múltiple: chips con × y ✓ en la lista. -->
      <SearchSelectField
        v-if="assigning && assignableUsers.length"
        id="task-assignees"
        v-model="selectedAssigneeIds"
        label="Responsables"
        placeholder="Nombre del usuario"
        :options="assigneeOptions"
        multiple
      />
    </ConfirmDialog>
    <FormModal
      :is-open="isReportOpen"
      title="Mis tareas terminadas"
      description="PDF con el nombre y logo del despacho y las tareas que terminaste el día elegido."
      :is-busy="isReportBusy"
      test-id="task-report-modal"
      @close="isReportOpen = false"
    >
      <div class="task-report-form">
        <DateField
          id="task-report-day"
          v-model="reportDay"
          label="Día"
          :min="earliestReportDay"
          :max="today"
          :error="reportError"
        />
        <div class="actions form-footer">
          <ActionButton
            :disabled="!reportDay || isReportBusy"
            @click="openCompletedReport('save')"
          >
            <Download
              :size="16"
              aria-hidden="true"
            /> Guardar PDF
          </ActionButton>
          <ActionButton
            variant="primary"
            :is-loading="isReportBusy"
            :disabled="!reportDay"
            @click="openCompletedReport('preview')"
          >
            <FileText
              :size="16"
              aria-hidden="true"
            /> Ver PDF
          </ActionButton>
        </div>
      </div>
    </FormModal>
    <ContextMenu
      :is-open="Boolean(contextMenu)"
      :x="contextMenu?.x ?? 0"
      :y="contextMenu?.y ?? 0"
      :title="contextMenu ? formatTaskFolio(contextMenu.task.folio) + ' · ' + contextMenu.task.title : ''"
      :items="contextItems"
      @close="contextMenu = null"
    />
  </section>
</template>

<style scoped>
.task-filter-form { display: grid; gap: var(--spaceMedium); }
.task-report-form { display: grid; gap: var(--spaceMedium); }
.task-board-note { margin: calc(var(--spaceSmall, 8px) * -1) 0 var(--spaceMedium); }
.task-description { white-space: pre-line; display: -webkit-box; -webkit-line-clamp: 3; line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.card-heading { display: flex; align-items: center; gap: 8px; }
.card-heading .field-help { margin: 0; margin-right: auto; font-family: var(--monoFontFamily); }
.task-state-chip { padding: 1px 6px; border: 2px solid currentColor; font-family: var(--monoFontFamily); font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; white-space: nowrap; }
.task-state-chip.tone-info { color: var(--accentColor); }
.task-state-chip.tone-warning { color: var(--warningText, var(--warningColor)); }
.task-state-chip.tone-success { color: var(--successText, var(--successColor)); }
.task-state-chip.tone-error { color: var(--errorText, var(--errorColor)); }
.task-state-chip.tone-neutral { color: var(--mutedTextColor); }
.task-grip { color: var(--mutedTextColor); cursor: grab; }
.kanban-card:focus-visible { outline: 3px solid var(--focusColor); outline-offset: 2px; }
/* Tarjeta elegida desde el buscador (pedido del usuario: un "glow"): marco del acento; se retira sola. */
/* Desde el 2026-10-17 el "glow" es el anillo con dithering procedural de DitherFocusRing (resaltado). */
.kanban-card.is-highlighted { position: relative; z-index: 1; border-color: var(--accentColor); }
.kanban-card.is-highlighted:focus-visible { outline: none; }
.column-pager { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 8px; font-family: var(--monoFontFamily); font-size: 12px; font-weight: 700; }
.task-badges { display: flex; flex-wrap: wrap; gap: 6px; }
</style>
