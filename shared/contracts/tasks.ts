import { pairingRecord, pairingText } from './pairing'
import { parseHostId } from './discovery'
import { parseBusinessDate } from './movements'

/**
 * Tareas GLOBAL del despacho con tablero de tres estados. "Pendiente" del sistema heredado no es un
 * estado: es una tarea `available` que ya tiene responsables. Las transiciones y los permisos los
 * decide el Host (`TaskPolicy`); la vista sólo solicita una acción con la revisión que conoce.
 */
export const tasksChannel = 'tasks:operate'
export const taskStates = ['available', 'inProgress', 'completed'] as const
export type TaskState = typeof taskStates[number]
export const maximumTaskListSize = 300
export const maximumTaskAssignees = 10
export const maximumTaskTitleLength = 160
export const maximumTaskDescriptionLength = 2000
/** Días hacia atrás que se muestran de tareas completadas; las anteriores siguen en MySQL. */
export const maximumCompletedWindowDays = 366

export interface TaskAssignee { userId: string; displayName: string }
/**
 * Presencia de un trabajador para el selector de responsables (2026-10-06, como un buscador de miembros con foto y punto
 * de estado): en línea = sesión vigente con actividad en los últimos 10 minutos; ausente = sesión vigente sin actividad
 * reciente; desconectado = sin sesión vigente. La calcula el Host con `userSessions`.
 */
export const workerPresences = ['online', 'away', 'offline'] as const
export type WorkerPresence = typeof workerPresences[number]
export const workerOnlineMinutes = 10
export interface AssignableUser extends TaskAssignee { roleNames: string[]; presence: WorkerPresence }
/** Capacidades calculadas por el Host para esta tarea y este usuario; cada acción se valida de nuevo. */
export interface TaskActions { canEdit: boolean; canMove: boolean; canComplete: boolean; canAssign: boolean; canTake: boolean; canRelease: boolean }
export interface Task {
  taskId: string
  folio: number
  title: string
  description: string
  clientId: string | null
  clientDisplayName: string | null
  state: TaskState
  dueDate: string | null
  assignees: TaskAssignee[]
  revision: number
  createdByDisplayName: string
  createdAt: string
  updatedByDisplayName: string | null
  updatedAt: string | null
  completedAt: string | null
  actions: TaskActions
}
export interface TaskFilter { scope: 'all' | 'mine'; clientId: string | null; completedSince: string }
export interface TaskDraft { title: string; description: string; clientId: string | null; dueDate: string | null }
export interface TaskCapabilities { canCreate: boolean; canAssign: boolean }

export type TaskRequest =
  { action: 'list'; filter: TaskFilter } |
  { action: 'create'; draft: TaskDraft; assigneeUserIds: string[] } |
  { action: 'update'; taskId: string; revision: number; draft: TaskDraft } |
  { action: 'move'; taskId: string; revision: number; state: TaskState } |
  { action: 'assign'; taskId: string; revision: number; assigneeUserIds: string[] } |
  { action: 'take'; taskId: string; revision: number } |
  { action: 'release'; taskId: string; revision: number } |
  { action: 'listAssignableUsers'; clientId: string | null }
export type TaskResult =
  { status: 'listed'; tasks: Task[]; isTruncated: boolean; capabilities: TaskCapabilities; currentUserId: string } |
  { status: 'saved'; task: Task } |
  { status: 'assignableUsers'; users: AssignableUser[] }

/**
 * Grafo de estados: `available ⇄ inProgress ⇄ completed`. No se completa sin haber empezado y una
 * tarea completada sólo se reabre a `inProgress`. Función pura compartida por Host y pruebas.
 */
/**
 * Plazo para reabrir (2026-10-17, pedido del usuario): una tarea terminada hace más de estos días ya no regresa a un
 * estado anterior. El Host lo calcula con el reloj de MySQL (`TaskRepository`, `isReopenLocked`) y la vista sólo
 * refleja `actions.canComplete`.
 */
export const maximumReopenDays = 5
const transitions: Record<TaskState, readonly TaskState[]> = { available: ['inProgress'], inProgress: ['available', 'completed'], completed: ['inProgress'] }
export function canTransitionTask(from: TaskState, to: TaskState): boolean { return transitions[from].includes(to) }

function exactKeys(data: Record<string, unknown>, keys: readonly string[]): void {
  if (Object.keys(data).sort().join() !== [...keys].sort().join()) throw new Error('Invalid task request')
}
function parseState(value: unknown): TaskState {
  if (!taskStates.includes(value as TaskState)) throw new Error('Invalid task state')
  return value as TaskState
}
function parseRevision(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) throw new Error('Invalid task revision')
  return Number(value)
}
/** Descripción multilínea: admite saltos de línea y tabulador, ningún otro carácter de control. */
export function parseTaskDescription(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Invalid task description')
  // Los saltos de Windows se normalizan antes de validar para no contarlos como caracteres de control.
  const text = value.replace(/\r\n?/g, '\n')
  if (text.length > maximumTaskDescriptionLength || [...text].some(character => { const code = character.charCodeAt(0); return (code < 32 && code !== 10 && code !== 9) || code === 127 })) throw new Error('Invalid task description')
  return text.trim()
}
/** Lista sin repetidos y acotada; el Host valida después que cada usuario pueda ver la tarea. */
export function parseAssigneeUserIds(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > maximumTaskAssignees) throw new Error('Invalid task assignees')
  const userIds = value.map(parseHostId)
  if (new Set(userIds).size !== userIds.length) throw new Error('Invalid task assignees')
  return userIds
}
export function parseTaskDraft(value: unknown): TaskDraft {
  const data = pairingRecord(value)
  exactKeys(data, ['title', 'description', 'clientId', 'dueDate'])
  return { title: pairingText(data.title, maximumTaskTitleLength), description: parseTaskDescription(data.description),
    clientId: data.clientId === null ? null : parseHostId(data.clientId), dueDate: data.dueDate === null ? null : parseBusinessDate(data.dueDate) }
}
export function parseTaskFilter(value: unknown): TaskFilter {
  const data = pairingRecord(value)
  exactKeys(data, ['scope', 'clientId', 'completedSince'])
  if (data.scope !== 'all' && data.scope !== 'mine') throw new Error('Invalid task scope')
  return { scope: data.scope, clientId: data.clientId === null ? null : parseHostId(data.clientId), completedSince: parseBusinessDate(data.completedSince) }
}

/** Contrato cerrado: nunca acepta actor, folio, estado inicial, autores ni capacidades calculadas por la vista. */
export function parseTaskRequest(value: unknown): TaskRequest {
  const data = pairingRecord(value)
  const change = () => ({ taskId: parseHostId(data.taskId), revision: parseRevision(data.revision) })
  if (data.action === 'list') { exactKeys(data, ['action', 'filter']); return { action: 'list', filter: parseTaskFilter(data.filter) } }
  if (data.action === 'create') { exactKeys(data, ['action', 'draft', 'assigneeUserIds']); return { action: 'create', draft: parseTaskDraft(data.draft), assigneeUserIds: parseAssigneeUserIds(data.assigneeUserIds) } }
  if (data.action === 'update') { exactKeys(data, ['action', 'taskId', 'revision', 'draft']); return { action: 'update', ...change(), draft: parseTaskDraft(data.draft) } }
  if (data.action === 'move') { exactKeys(data, ['action', 'taskId', 'revision', 'state']); return { action: 'move', ...change(), state: parseState(data.state) } }
  if (data.action === 'assign') { exactKeys(data, ['action', 'taskId', 'revision', 'assigneeUserIds']); return { action: 'assign', ...change(), assigneeUserIds: parseAssigneeUserIds(data.assigneeUserIds) } }
  if (data.action === 'take' || data.action === 'release') { exactKeys(data, ['action', 'taskId', 'revision']); return { action: data.action, ...change() } }
  if (data.action === 'listAssignableUsers') { exactKeys(data, ['action', 'clientId']); return { action: 'listAssignableUsers', clientId: data.clientId === null ? null : parseHostId(data.clientId) } }
  throw new Error('Invalid task request')
}

function parseTimestamp(value: unknown): string {
  if (typeof value !== 'string' || value.length > 40 || !Number.isFinite(Date.parse(value))) throw new Error('Invalid timestamp')
  return new Date(Date.parse(value)).toISOString()
}
function parseAssignee(value: unknown): TaskAssignee {
  const data = pairingRecord(value)
  return { userId: parseHostId(data.userId), displayName: pairingText(data.displayName) }
}
function parseAssignableUser(value: unknown): AssignableUser {
  const data = pairingRecord(value)
  exactKeys(data, ['userId', 'displayName', 'roleNames', 'presence'])
  if (!Array.isArray(data.roleNames) || data.roleNames.length > 20) throw new Error('Invalid roles')
  if (!workerPresences.includes(data.presence as WorkerPresence)) throw new Error('Invalid presence')
  return { ...parseAssignee({ userId: data.userId, displayName: data.displayName }), roleNames: data.roleNames.map(role => pairingText(role)), presence: data.presence as WorkerPresence }
}
function parseFlags<T extends string>(value: unknown, keys: readonly T[]): Record<T, boolean> {
  const data = pairingRecord(value)
  exactKeys(data, keys)
  if (!keys.every(key => typeof data[key] === 'boolean')) throw new Error('Invalid task capabilities')
  return Object.fromEntries(keys.map(key => [key, data[key]])) as Record<T, boolean>
}
const actionKeys = ['canEdit', 'canMove', 'canComplete', 'canAssign', 'canTake', 'canRelease'] as const
export function parseTask(value: unknown): Task {
  const data = pairingRecord(value)
  if (!Number.isSafeInteger(data.folio) || Number(data.folio) < 1) throw new Error('Invalid folio')
  if (!Array.isArray(data.assignees) || data.assignees.length > maximumTaskAssignees) throw new Error('Invalid task assignees')
  const clientId = data.clientId === null ? null : parseHostId(data.clientId)
  return { taskId: parseHostId(data.taskId), folio: Number(data.folio), title: pairingText(data.title, maximumTaskTitleLength), description: parseTaskDescription(data.description),
    clientId, clientDisplayName: clientId === null ? null : pairingText(data.clientDisplayName), state: parseState(data.state),
    dueDate: data.dueDate === null ? null : parseBusinessDate(data.dueDate), assignees: data.assignees.map(parseAssignee), revision: parseRevision(data.revision),
    createdByDisplayName: pairingText(data.createdByDisplayName), createdAt: parseTimestamp(data.createdAt),
    updatedByDisplayName: data.updatedByDisplayName === null ? null : pairingText(data.updatedByDisplayName), updatedAt: data.updatedAt === null ? null : parseTimestamp(data.updatedAt),
    completedAt: data.completedAt === null ? null : parseTimestamp(data.completedAt), actions: parseFlags(data.actions, actionKeys) }
}
/** Reconstruye el resultado campo por campo: columnas extra no llegan a la vista. */
export function parseTaskResult(value: unknown): TaskResult {
  const data = pairingRecord(value)
  if (data.status === 'listed') {
    exactKeys(data, ['status', 'tasks', 'isTruncated', 'capabilities', 'currentUserId'])
    if (!Array.isArray(data.tasks) || data.tasks.length > maximumTaskListSize || typeof data.isTruncated !== 'boolean') throw new Error('Invalid task list')
    return { status: 'listed', tasks: data.tasks.map(parseTask), isTruncated: data.isTruncated, capabilities: parseFlags(data.capabilities, ['canCreate', 'canAssign'] as const), currentUserId: parseHostId(data.currentUserId) }
  }
  if (data.status === 'saved') { exactKeys(data, ['status', 'task']); return { status: 'saved', task: parseTask(data.task) } }
  if (data.status === 'assignableUsers') {
    exactKeys(data, ['status', 'users'])
    if (!Array.isArray(data.users) || data.users.length > 500) throw new Error('Invalid assignable users')
    return { status: 'assignableUsers', users: data.users.map(parseAssignableUser) }
  }
  throw new Error('Invalid task result')
}
