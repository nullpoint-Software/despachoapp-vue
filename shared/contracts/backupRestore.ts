import { parseMigrationCredentials, type MigrationCredentials } from './host'
import { pairingRecord, pairingText } from './pairing'
import { backupFileExtension, legacyBackupFileExtension, maximumBackupPasswordLength } from './backups'

/**
 * Restauración y ensayo de respaldos (7.3). Decisiones del usuario (2026-10-03, ADR-029):
 * - Se restaura en el **Host instalado** (Configuración → Respaldos, permiso `backups.restore`, contraseña de la
 *   sesión y confirmación escrita) y en una **PC nueva** durante la instalación, en lugar de crear el primer
 *   administrador (basta el archivo y la contraseña de respaldo).
 * - Siempre en una **base nueva** junto a la actual; se comprueba y sólo entonces el Host cambia a ella. La base
 *   anterior queda intacta y se puede volver a ella ("Volver a la base anterior").
 * - En una PC nueva, el Host conserva la **identidad del respaldo**: los Clientes ya vinculados se reconectan.
 * - **Probar respaldo:** restaura en una base temporal, comprueba y la borra; no toca los datos reales.
 * Con MySQL propio se pide una cuenta administradora de MySQL (crear bases y otorgar permisos) que no se guarda;
 * con el MySQL administrado, Main usa la suya.
 */
export const backupRestoreChannel = 'backups:restore'
export const restoreConfirmationWord = 'RESTAURAR'
export const restoreModes = ['trial', 'restore'] as const
export type RestoreModeName = typeof restoreModes[number]

export interface BackupArchiveInfo { path: string; backupId: string; createdAt: string; hostId: string; isFromThisHost: boolean | null }
export interface RestoreSummary { sourceBackupId: string; sourceCreatedAt: string; tableCount: number; rowCount: number; documentCount: number; canSignIn: boolean | null }
export interface BackupRestoreRecord {
  restoreId: string; mode: RestoreModeName; state: 'success' | 'error'; sourceCreatedAt: string | null; fileName: string; requestedByName: string; requestedAt: string
  tableCount: number; rowCount: number; documentCount: number; message: string
}
export interface RestoreOptions { requiresDatabaseAdministrator: boolean; canRevert: boolean }

/** Renderer → Main. */
export type BackupRestoreRequest =
  { action: 'getOptions' } |
  { action: 'chooseArchive' } |
  { action: 'trial'; archivePath: string; backupPassword: string; databaseAdministrator: MigrationCredentials | null } |
  { action: 'restore'; archivePath: string; backupPassword: string; databaseAdministrator: MigrationCredentials | null; confirmation: string } |
  { action: 'revert' } |
  { action: 'restoreAtSetup'; archivePath: string; backupPassword: string; databaseAdministrator: MigrationCredentials | null }
export type BackupRestoreResult =
  { status: 'options'; options: RestoreOptions } |
  { status: 'archive'; archive: BackupArchiveInfo | null } |
  { status: 'tried'; summary: RestoreSummary } |
  { status: 'restored'; summary: RestoreSummary; identity: 'kept' | 'renewed' } |
  { status: 'reverted' }
/** Main → Host: Main resuelve la cuenta administradora y la carpeta del expediente. */
export type BackupRestoreHostRequest =
  { action: 'trial' | 'restore'; archivePath: string; backupPassword: string; administrator: MigrationCredentials; documentRoot: string | null } |
  { action: 'authorizeRevert' } |
  { action: 'restoreAtSetup'; archivePath: string; backupPassword: string; administrator: MigrationCredentials; documentRoot: string }

/** Probar, restaurar y volver atrás piden la contraseña de la sesión; en la instalación no hay sesión. */
export function requiresRestoreReauthentication(request: BackupRestoreRequest): boolean { return request.action === 'trial' || request.action === 'restore' || request.action === 'revert' }

function exactKeys(data: Record<string, unknown>, keys: readonly string[]): void { if (Object.keys(data).sort().join() !== [...keys].sort().join()) throw new Error('Invalid restore data') }
function count(value: unknown): number { if (!Number.isSafeInteger(value) || Number(value) < 0) throw new Error('Invalid restore count'); return Number(value) }
function timestamp(value: unknown): string { if (typeof value !== 'string' || value.length > 40 || !Number.isFinite(Date.parse(value))) throw new Error('Invalid restore timestamp'); return value }
const identifierPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
function identifier(value: unknown): string { if (typeof value !== 'string' || !identifierPattern.test(value)) throw new Error('Invalid restore identifier'); return value }
/** Ruta del archivo elegido en el diálogo; Main y el Host vuelven a comprobar que se pueda leer. */
export function parseArchivePath(value: unknown): string {
  const path = pairingText(value, 1024)
  if (![backupFileExtension, legacyBackupFileExtension].some(extension => path.toLowerCase().endsWith(extension))) throw new Error('Invalid backup archive')
  return path
}
/** Para abrir un respaldo basta que no esté vacía: la longitud mínima sólo se exige al crearla. */
function archivePassword(value: unknown): string {
  if (typeof value !== 'string' || !value.length || value.length > maximumBackupPasswordLength) throw new Error('Invalid backup password')
  return value
}
function administrator(value: unknown): MigrationCredentials | null { return value === null ? null : parseMigrationCredentials(value) }

export function parseBackupRestoreRequest(value: unknown): BackupRestoreRequest {
  const data = pairingRecord(value)
  if (data.action === 'getOptions' || data.action === 'chooseArchive' || data.action === 'revert') { exactKeys(data, ['action']); return { action: data.action } }
  if (data.action === 'trial' || data.action === 'restoreAtSetup') {
    exactKeys(data, ['action', 'archivePath', 'backupPassword', 'databaseAdministrator'])
    return { action: data.action, archivePath: parseArchivePath(data.archivePath), backupPassword: archivePassword(data.backupPassword), databaseAdministrator: administrator(data.databaseAdministrator) }
  }
  if (data.action === 'restore') {
    exactKeys(data, ['action', 'archivePath', 'backupPassword', 'databaseAdministrator', 'confirmation'])
    // Confirmación explícita: hay que escribir la palabra, no basta un clic.
    if (data.confirmation !== restoreConfirmationWord) throw new Error('Restore confirmation required')
    return { action: 'restore', archivePath: parseArchivePath(data.archivePath), backupPassword: archivePassword(data.backupPassword), databaseAdministrator: administrator(data.databaseAdministrator), confirmation: restoreConfirmationWord }
  }
  throw new Error('Invalid restore request')
}
export function parseBackupRestoreHostRequest(value: unknown): BackupRestoreHostRequest {
  const data = pairingRecord(value)
  if (data.action === 'authorizeRevert') { exactKeys(data, ['action']); return { action: 'authorizeRevert' } }
  exactKeys(data, ['action', 'archivePath', 'backupPassword', 'administrator', 'documentRoot'])
  const base = { archivePath: parseArchivePath(data.archivePath), backupPassword: archivePassword(data.backupPassword), administrator: parseMigrationCredentials(data.administrator) }
  if (data.action === 'restoreAtSetup') return { action: 'restoreAtSetup', ...base, documentRoot: pairingText(data.documentRoot, 1024) }
  if (data.action !== 'trial' && data.action !== 'restore') throw new Error('Invalid restore request')
  return { action: data.action, ...base, documentRoot: data.documentRoot === null ? null : pairingText(data.documentRoot, 1024) }
}

export function parseRestoreSummary(value: unknown): RestoreSummary {
  const data = pairingRecord(value)
  exactKeys(data, ['sourceBackupId', 'sourceCreatedAt', 'tableCount', 'rowCount', 'documentCount', 'canSignIn'])
  if (data.canSignIn !== null && typeof data.canSignIn !== 'boolean') throw new Error('Invalid restore summary')
  return { sourceBackupId: identifier(data.sourceBackupId), sourceCreatedAt: timestamp(data.sourceCreatedAt), tableCount: count(data.tableCount), rowCount: count(data.rowCount), documentCount: count(data.documentCount), canSignIn: data.canSignIn }
}
export function parseBackupRestoreRecord(value: unknown): BackupRestoreRecord {
  const data = pairingRecord(value)
  exactKeys(data, ['restoreId', 'mode', 'state', 'sourceCreatedAt', 'fileName', 'requestedByName', 'requestedAt', 'tableCount', 'rowCount', 'documentCount', 'message'])
  if (!restoreModes.includes(data.mode as RestoreModeName) || (data.state !== 'success' && data.state !== 'error') || typeof data.fileName !== 'string' || data.fileName.length > 255 ||
    typeof data.requestedByName !== 'string' || data.requestedByName.length > 100 || typeof data.message !== 'string' || data.message.length > 500) throw new Error('Invalid restore record')
  return { restoreId: identifier(data.restoreId), mode: data.mode as RestoreModeName, state: data.state, sourceCreatedAt: data.sourceCreatedAt === null ? null : timestamp(data.sourceCreatedAt), fileName: data.fileName,
    requestedByName: data.requestedByName, requestedAt: timestamp(data.requestedAt), tableCount: count(data.tableCount), rowCount: count(data.rowCount), documentCount: count(data.documentCount), message: data.message }
}
export function parseBackupRestoreResult(value: unknown): BackupRestoreResult {
  const data = pairingRecord(value)
  if (data.status === 'options') {
    exactKeys(data, ['status', 'options'])
    const options = pairingRecord(data.options); exactKeys(options, ['requiresDatabaseAdministrator', 'canRevert'])
    if (typeof options.requiresDatabaseAdministrator !== 'boolean' || typeof options.canRevert !== 'boolean') throw new Error('Invalid restore options')
    return { status: 'options', options: { requiresDatabaseAdministrator: options.requiresDatabaseAdministrator, canRevert: options.canRevert } }
  }
  if (data.status === 'archive') {
    exactKeys(data, ['status', 'archive'])
    if (data.archive === null) return { status: 'archive', archive: null }
    const archive = pairingRecord(data.archive); exactKeys(archive, ['path', 'backupId', 'createdAt', 'hostId', 'isFromThisHost'])
    if (archive.isFromThisHost !== null && typeof archive.isFromThisHost !== 'boolean') throw new Error('Invalid backup archive')
    return { status: 'archive', archive: { path: parseArchivePath(archive.path), backupId: identifier(archive.backupId), createdAt: timestamp(archive.createdAt), hostId: identifier(archive.hostId), isFromThisHost: archive.isFromThisHost } }
  }
  if (data.status === 'tried') { exactKeys(data, ['status', 'summary']); return { status: 'tried', summary: parseRestoreSummary(data.summary) } }
  if (data.status === 'restored') {
    exactKeys(data, ['status', 'summary', 'identity'])
    if (data.identity !== 'kept' && data.identity !== 'renewed') throw new Error('Invalid restore result')
    return { status: 'restored', summary: parseRestoreSummary(data.summary), identity: data.identity }
  }
  if (data.status === 'reverted') { exactKeys(data, ['status']); return { status: 'reverted' } }
  throw new Error('Invalid restore result')
}
