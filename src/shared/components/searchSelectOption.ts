import type { WorkerPresence } from '../../../shared/contracts/tasks'

/**
 * Opción de un selector con búsqueda (SearchSelectField): `value` es lo que se guarda (id, código, RFC) y `label` lo que se ve.
 * - `group`: encabezado de grupo; las opciones deben venir ordenadas por grupo (2026-10-06).
 * - `person`: la opción es un trabajador; se muestra su foto con el punto de presencia (2026-10-06).
 */
export interface SearchSelectPerson { userId: string; presence?: WorkerPresence }
export interface SearchSelectOption { value: string; label: string; detail?: string; keywords?: string; group?: string; person?: SearchSelectPerson }
export const presenceLabels: Record<WorkerPresence, string> = { online: 'En línea', away: 'Ausente', offline: 'Desconectado' }
