import { pairingRecord, pairingText } from './pairing'
import { parseBackupRestoreRecord, type BackupRestoreRecord } from './backupRestore'

/**
 * Respaldos del Host (7.2). Decisiones del usuario (2026-10-03, ADR-028):
 * - **Destino:** una carpeta que elige el administrador en el equipo Host (disco externo, USB o carpeta de red).
 * - **Contraseña de respaldo:** cifra cada archivo e incluye las claves del Host (expediente y TLS), así que el
 *   respaldo se puede restaurar en otra PC. Sin esa contraseña no se recupera nada.
 * - **Programa:** diario a las 02:00 (zona del despacho) con el scheduler de 7.1; se conservan los últimos
 *   7 días y 4 semanas. Además, "Respaldar ahora".
 * - **Permiso `backups.manage`.** Se configura sólo desde el equipo Host: la carpeta es de ese equipo.
 */
export const backupsChannel = 'backups:operate'
export const backupRunStates = ['pending', 'running', 'success', 'error', 'pruned'] as const
export type BackupRunState = typeof backupRunStates[number]
export const backupRunTriggers = ['scheduled', 'manual'] as const
export type BackupRunTrigger = typeof backupRunTriggers[number]
/** `missing`: hay configuración, pero este Host no tiene la clave sellada que le corresponde (perfil reinstalado). */
export const backupKeyAvailabilities = ['unconfigured', 'ready', 'missing'] as const
export type BackupKeyAvailability = typeof backupKeyAvailabilities[number]
export const backupRunTime = '02:00'
export const backupRetention = { dailyCount: 7, weeklyCount: 4 } as const
export const minimumBackupPasswordLength = 12
export const maximumBackupPasswordLength = 200
export const maximumBackupDestinationLength = 1024
/** Extensión de los respaldos terminados; mientras se escriben llevan además `.partial`. */
export const backupFileExtension = '.fiscenix-backup'
/** Respaldos hechos cuando la app se llamaba ContApp (ADR-042): se siguen abriendo, restaurando y rotando. */
export const legacyBackupFileExtension = '.contapp-backup'

export interface BackupRun {
  backupId: string; trigger: BackupRunTrigger; state: BackupRunState; requestedAt: string; startedAt: string | null; finishedAt: string | null
  fileName: string | null; sizeBytes: number | null; tableCount: number; rowCount: number; documentCount: number; message: string; requestedByDisplayName: string | null
}
export interface BackupStatus {
  isConfigured: boolean; destination: string | null; keyAvailability: BackupKeyAvailability; isEnabled: boolean; runTime: string; nextRunAt: string | null
  revision: number; updatedByDisplayName: string | null; updatedAt: string | null; isBusy: boolean; runs: BackupRun[]
  /** Restauraciones y ensayos registrados en la base en uso (7.3) y si la sesión tiene `backups.restore`. */
  restores: BackupRestoreRecord[]; canRestore: boolean
}

/** Renderer → Main. `chooseDestination` lo resuelve Main con el diálogo nativo; lo demás va al Host. */
export type BackupRequest =
  { action: 'get' } |
  { action: 'chooseDestination' } |
  { action: 'configure'; revision: number; destination: string; backupPassword: string } |
  { action: 'setEnabled'; revision: number; isEnabled: boolean } |
  { action: 'runNow' }
/** Main → Host: al configurar, Main agrega la clave de respaldo nueva (`keyId`, `key`) que sellará si el Host acepta. */
export type BackupHostRequest = Exclude<BackupRequest, { action: 'chooseDestination' | 'configure' }> |
  { action: 'configure'; revision: number; destination: string; backupPassword: string; keyId: string; key: string }
export type BackupResult = { status: 'backups'; backups: BackupStatus } | { status: 'destination'; destination: string | null }

/** Sólo configurar exige la contraseña de la sesión: cambia destino y cifrado de todos los respaldos siguientes. */
export function requiresBackupReauthentication(request: BackupRequest): boolean { return request.action === 'configure' }

function exactKeys(data: Record<string, unknown>, keys: readonly string[]): void { if (Object.keys(data).sort().join() !== [...keys].sort().join()) throw new Error('Invalid backup data') }
function oneOf<T extends string>(value: unknown, values: readonly T[]): T { if (!values.includes(value as T)) throw new Error('Invalid backup data'); return value as T }
function count(value: unknown): number { if (!Number.isSafeInteger(value) || Number(value) < 0) throw new Error('Invalid backup count'); return Number(value) }
function timestamp(value: unknown): string { if (typeof value !== 'string' || value.length > 40 || !Number.isFinite(Date.parse(value))) throw new Error('Invalid backup timestamp'); return value }
function optionalTimestamp(value: unknown): string | null { return value === null ? null : timestamp(value) }
function optionalText(value: unknown, maximum: number): string | null { return value === null ? null : pairingText(value, maximum) }
const identifierPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/** Carpeta del equipo Host: texto sin caracteres de control. El Host comprueba que sea absoluta y escribible. */
export function parseBackupDestination(value: unknown): string { return pairingText(value, maximumBackupDestinationLength) }
/** La contraseña de respaldo no se recorta: los espacios cuentan. */
export function parseBackupPassword(value: unknown): string {
  if (typeof value !== 'string' || value.length < minimumBackupPasswordLength || value.length > maximumBackupPasswordLength) throw new Error('Invalid backup password')
  return value
}
function revision(value: unknown): number { return count(value) }

export function parseBackupRequest(value: unknown): BackupRequest {
  const data = pairingRecord(value)
  if (data.action === 'get' || data.action === 'chooseDestination' || data.action === 'runNow') { exactKeys(data, ['action']); return { action: data.action } }
  if (data.action === 'configure') {
    exactKeys(data, ['action', 'revision', 'destination', 'backupPassword'])
    return { action: 'configure', revision: revision(data.revision), destination: parseBackupDestination(data.destination), backupPassword: parseBackupPassword(data.backupPassword) }
  }
  if (data.action === 'setEnabled') {
    exactKeys(data, ['action', 'revision', 'isEnabled'])
    if (typeof data.isEnabled !== 'boolean') throw new Error('Invalid backup request')
    return { action: 'setEnabled', revision: revision(data.revision), isEnabled: data.isEnabled }
  }
  throw new Error('Invalid backup request')
}
export function parseBackupHostRequest(value: unknown): BackupHostRequest {
  const data = pairingRecord(value)
  if (data.action === 'configure') {
    exactKeys(data, ['action', 'revision', 'destination', 'backupPassword', 'keyId', 'key'])
    if (typeof data.keyId !== 'string' || !identifierPattern.test(data.keyId) || typeof data.key !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(data.key)) throw new Error('Invalid backup key')
    return { action: 'configure', revision: revision(data.revision), destination: parseBackupDestination(data.destination), backupPassword: parseBackupPassword(data.backupPassword), keyId: data.keyId, key: data.key }
  }
  const request = parseBackupRequest(value)
  if (request.action === 'chooseDestination' || request.action === 'configure') throw new Error('Invalid backup request')
  return request
}

function parseBackupRun(value: unknown): BackupRun {
  const run = pairingRecord(value)
  exactKeys(run, ['backupId', 'trigger', 'state', 'requestedAt', 'startedAt', 'finishedAt', 'fileName', 'sizeBytes', 'tableCount', 'rowCount', 'documentCount', 'message', 'requestedByDisplayName'])
  if (typeof run.backupId !== 'string' || !identifierPattern.test(run.backupId) || typeof run.message !== 'string' || run.message.length > 500) throw new Error('Invalid backup run')
  return { backupId: run.backupId, trigger: oneOf(run.trigger, backupRunTriggers), state: oneOf(run.state, backupRunStates), requestedAt: timestamp(run.requestedAt),
    startedAt: optionalTimestamp(run.startedAt), finishedAt: optionalTimestamp(run.finishedAt), fileName: optionalText(run.fileName, 255),
    sizeBytes: run.sizeBytes === null ? null : count(run.sizeBytes), tableCount: count(run.tableCount), rowCount: count(run.rowCount), documentCount: count(run.documentCount),
    message: run.message, requestedByDisplayName: optionalText(run.requestedByDisplayName, 100) }
}
export function parseBackupResult(value: unknown): BackupResult {
  const data = pairingRecord(value)
  if (data.status === 'destination') {
    exactKeys(data, ['status', 'destination'])
    return { status: 'destination', destination: data.destination === null ? null : parseBackupDestination(data.destination) }
  }
  exactKeys(data, ['status', 'backups'])
  if (data.status !== 'backups') throw new Error('Invalid backup result')
  const status = pairingRecord(data.backups)
  exactKeys(status, ['isConfigured', 'destination', 'keyAvailability', 'isEnabled', 'runTime', 'nextRunAt', 'revision', 'updatedByDisplayName', 'updatedAt', 'isBusy', 'runs', 'restores', 'canRestore'])
  if (typeof status.isConfigured !== 'boolean' || typeof status.isEnabled !== 'boolean' || typeof status.isBusy !== 'boolean' || status.runTime !== backupRunTime || !Array.isArray(status.runs) || status.runs.length > 50 || !Array.isArray(status.restores) || status.restores.length > 50 || typeof status.canRestore !== 'boolean') throw new Error('Invalid backup status')
  return { status: 'backups', backups: {
    isConfigured: status.isConfigured, destination: status.destination === null ? null : parseBackupDestination(status.destination), keyAvailability: oneOf(status.keyAvailability, backupKeyAvailabilities),
    isEnabled: status.isEnabled, runTime: backupRunTime, nextRunAt: optionalTimestamp(status.nextRunAt), revision: revision(status.revision),
    updatedByDisplayName: optionalText(status.updatedByDisplayName, 100), updatedAt: optionalTimestamp(status.updatedAt), isBusy: status.isBusy, runs: status.runs.map(parseBackupRun), restores: status.restores.map(parseBackupRestoreRecord), canRestore: status.canRestore
  } }
}
