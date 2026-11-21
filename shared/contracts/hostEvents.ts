/** Estado EPHEMERAL del transporte: no representa sesión de usuario ni permisos de negocio. */
export type HostEventsState = 'idle' | 'connecting' | 'connected' | 'retrying' | 'offline' | 'unauthorized'
/** Versiones locales de invalidación: cambian al recibir un aviso, sin transportar datos del recurso. */
export interface HostEventsStatus { state: HostEventsState; attempt: number; invalidationVersion?: number; documentInvalidationVersion?: number; movementInvalidationVersion?: number; taskInvalidationVersion?: number }
export const hostEventsChannel = 'network:hostEvents'
export function parseHostEventsAction(value: unknown): 'status' | 'start' | 'stop' {
  if (value !== 'status' && value !== 'start' && value !== 'stop') throw new Error('Invalid events action')
  return value
}
export function parseHostEventsStatus(value: unknown): HostEventsStatus {
  if (!value || typeof value !== 'object' || !('state' in value) || !('attempt' in value) ||
    !['idle','connecting','connected','retrying','offline','unauthorized'].includes(String(value.state)) ||
    !Number.isInteger(value.attempt) || Number(value.attempt) < 0 || Number(value.attempt) > 4) throw new Error('Invalid events status')
  const version = 'invalidationVersion' in value ? value.invalidationVersion : undefined
  const documentVersion = 'documentInvalidationVersion' in value ? value.documentInvalidationVersion : undefined
  const movementVersion = 'movementInvalidationVersion' in value ? value.movementInvalidationVersion : undefined
  const taskVersion = 'taskInvalidationVersion' in value ? value.taskInvalidationVersion : undefined
  for (const candidate of [version, documentVersion, movementVersion, taskVersion]) if (candidate !== undefined && (typeof candidate !== 'number' || !Number.isSafeInteger(candidate) || candidate < 0)) throw new Error('Invalid event version')
  return { state: value.state as HostEventsState, attempt: Number(value.attempt), ...(version === undefined ? {} : { invalidationVersion: version as number }), ...(documentVersion === undefined ? {} : { documentInvalidationVersion: documentVersion as number }), ...(movementVersion === undefined ? {} : { movementInvalidationVersion: movementVersion as number }), ...(taskVersion === undefined ? {} : { taskInvalidationVersion: taskVersion as number }) }
}
