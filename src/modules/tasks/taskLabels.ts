import { maximumReopenDays, type Task, type TaskState } from '../../../shared/contracts/tasks'

/** Etiquetas de presentación; los estados válidos y sus transiciones los define el contrato compartido. */
export const taskStateLabels: Record<TaskState, string> = { available: 'Disponible', inProgress: 'En progreso', completed: 'Completada' }
export const taskStateTones: Record<TaskState, 'warning' | 'info' | 'success'> = { available: 'warning', inProgress: 'info', completed: 'success' }

/** Columna del tablero. "Pendiente" no es columna: es una tarea disponible que ya tiene responsables. */
export function taskColumnFor(task: Pick<Task, 'state'>): TaskState { return task.state }
export function isPendingTask(task: Pick<Task, 'state' | 'assignees'>): boolean { return task.state === 'available' && task.assignees.length > 0 }
/** Vencida si tiene fecha límite anterior a hoy (día del despacho) y no está completada. */
export function isOverdueTask(task: Pick<Task, 'state' | 'dueDate'>, today: string): boolean { return task.state !== 'completed' && task.dueDate !== null && task.dueDate < today }
/**
 * Aviso de la tarjeta (2026-10-17): terminada hace más de `maximumReopenDays` días ya no se reabre. Sólo informa con el
 * reloj del equipo; quien decide es el Host (`actions.canComplete`).
 */
export function isReopenExpired(task: Pick<Task, 'state' | 'completedAt'>, nowMilliseconds = Date.now()): boolean {
  return task.state === 'completed' && task.completedAt !== null && nowMilliseconds - Date.parse(task.completedAt) > maximumReopenDays * 86400000
}
export function formatTaskFolio(folio: number): string { return 'T-' + String(folio).padStart(6, '0') }
export function formatAssignees(task: Pick<Task, 'assignees'>): string { return task.assignees.length ? task.assignees.map(assignee => assignee.displayName).join(', ') : 'Sin responsable' }
