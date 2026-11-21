/**
 * Confirmación de operaciones sensibles con la contraseña del actor (ADR-038).
 * - Fuente única de la clasificación: el Host la aplica (`SessionRepository.withPermissions`) y la UI la refleja
 *   (`src/shared/security/confirmSensitive.ts`) sólo para decidir si abre el diálogo; manda siempre el Host.
 * - Crítica: pide la contraseña siempre. No crítica: sin contraseña se acepta mientras la sesión tenga la gracia de
 *   10 minutos que abre una contraseña correcta (columna `userSessions.sensitiveConfirmedUntil`, reloj del Host).
 */
export const sensitiveOperations = ['access.manage', 'clients.assign', 'clients.delete', 'credential.copy', 'documents.delete', 'devices.link', 'branding.save', 'backups.restore', 'backups.configure', 'movements.update', 'movements.void', 'migration.run'] as const
export type SensitiveOperation = typeof sensitiveOperations[number]
/**
 * Zona crítica ("cancelar, eliminar y configuraciones siempre serán zona crítica"): toda cancelación, anulación o baja y
 * todo cambio de configuración (acceso, equipos, respaldos y restauración, identidad del despacho), más copiar la CIEC.
 * Lo que queda fuera es crear o editar registros ordinarios (hoy sólo editar un movimiento).
 * `clients.delete` queda reservada: hoy no existe baja de clientes.
 */
export const criticalSensitiveOperations: readonly SensitiveOperation[] = ['access.manage', 'clients.assign', 'clients.delete', 'credential.copy', 'documents.delete', 'devices.link', 'branding.save', 'backups.restore', 'backups.configure', 'movements.void', 'migration.run']
export const sensitiveGraceMinutes = 10
export function isCriticalSensitiveOperation(operation: SensitiveOperation): boolean { return criticalSensitiveOperations.includes(operation) }

/** Operación + contraseña; `password: null` sólo para una no crítica (el Host exige entonces la gracia vigente). */
export interface SensitiveConfirmation { operation: SensitiveOperation; password: string | null }

/** Contraseña del actor para una sola operación; Main la valida antes de reenviarla. */
export function parseReauthentication(value: unknown): string {
  if (typeof value !== 'string' || !value.length || value.length > 128) throw new Error(reauthenticationFailures.required)
  return value
}
/** Sin prueba: crítica → rechazo; no crítica → se deja a la gracia de la sesión, que el Host revisa en la transacción. */
export function parseSensitiveConfirmation(operation: SensitiveOperation, value: unknown): SensitiveConfirmation {
  if (value === undefined && !isCriticalSensitiveOperation(operation)) return { operation, password: null }
  return { operation, password: parseReauthentication(value) }
}

/**
 * Rechazos distinguibles de punta a punta (Host → RPC/HTTPS → Main → Renderer) para que el diálogo sepa qué hacer:
 * `required` (falta contraseña o venció la gracia), `denied` (contraseña incorrecta), `locked` (cinco fallos, 15 min).
 * No llevan datos del usuario ni de la operación.
 */
export const reauthenticationFailures = { required: 'Reauthentication required', denied: 'Reauthentication denied', locked: 'Reauthentication locked' } as const
export type ReauthenticationFailure = keyof typeof reauthenticationFailures
/** Estado HTTP de cada rechazo en `/session` y `/documents`; el Cliente lo convierte de nuevo en el mensaje. */
export const reauthenticationStatusCodes: Record<ReauthenticationFailure, number> = { required: 428, denied: 401, locked: 423 }

/** Busca el rechazo en el mensaje o en la cadena `cause` (los IPC de Main envuelven los errores). */
export function readReauthenticationFailure(error: unknown): ReauthenticationFailure | null {
  for (let current = error, depth = 0; current instanceof Error && depth < 5; current = current.cause, depth++) {
    for (const [failure, message] of Object.entries(reauthenticationFailures)) if (current.message.includes(message)) return failure as ReauthenticationFailure
  }
  return null
}
/** Para los `catch` de Main: deja pasar el rechazo de reautenticación sin el mensaje genérico del canal. */
export function rethrowReauthenticationFailure(error: unknown): void {
  const failure = readReauthenticationFailure(error)
  if (failure) throw new Error(reauthenticationFailures[failure])
}
