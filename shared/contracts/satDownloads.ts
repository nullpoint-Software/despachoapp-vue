import { pairingRecord, pairingText } from './pairing'
import { parseHostId } from './discovery'
import { rfcPattern } from './localXml'
import { getOfficeToday } from './movements'
import { parseSatPlatformStatus, parseSatScheduleResult, parseSatScheduleViewRequest, satFailureKinds, type SatFailureKind, type SatPlatformStatus, type SatScheduleResult, type SatScheduleViewRequest } from './satDownloadSchedules'

/**
 * Descarga masiva de CFDI del SAT (6.3), con el servicio web oficial y la e.firma del cliente.
 * Decisiones del usuario (2026-10-01): sólo servicio web; la e.firma se queda sellada en el equipo que
 * descarga; ese mismo equipo ejecuta la solicitud y guarda los XML en su biblioteca LOCAL.
 *
 * Datos:
 * - LOCAL (Main): .cer, .key y contraseña sellados por Windows. Nunca viajan al Host ni a la vista.
 * - GLOBAL (Host): el registro de solicitudes (quién, cliente, periodo, equipo ejecutor, estado y avance)
 *   y la existencia de la e.firma por equipo (RFC, serie, vigencia). Nunca la llave ni la contraseña.
 */
export const satDownloadChannels = { operate: 'sat:operate', request: 'sat:request', readCredential: 'sat:readCredential', saveCredential: 'sat:saveCredential', deleteCredential: 'sat:deleteCredential' } as const
export const satDirections = ['issued', 'received'] as const
export type SatDirection = typeof satDirections[number]
/** pending → requested → processing → downloading → completed; o noData, failed, cancelled (finales). */
export const satDownloadStates = ['pending', 'requested', 'processing', 'downloading', 'completed', 'noData', 'failed', 'cancelled'] as const
export type SatDownloadState = typeof satDownloadStates[number]
export const activeSatDownloadStates: readonly SatDownloadState[] = ['pending', 'requested', 'processing', 'downloading']
/** El original limitaba cada solicitud a 31 días; así los paquetes quedan acotados y el SAT no la topa. */
export const maximumSatPeriodDays = 31
/** Tras 72 horas sin terminar, la solicitud se marca como fallida (los paquetes del SAT caducan). */
export const maximumSatRequestHours = 72

/**
 * Cómo se descarga (migración 097): `webService` (descarga masiva con e.firma, este módulo) o `portal` (portal del SAT
 * con RFC y CIEC, [[SAT-PORTAL]]). Comparten el historial; el trabajador del servicio web sólo toma `webService`.
 */
export const satDownloadMethods = ['webService', 'portal'] as const
export type SatDownloadMethod = typeof satDownloadMethods[number]
/**
 * Quién originó la solicitud (migración 098, ADR-037): `manual` la pidió una persona y la avanza el trabajador con su
 * sesión; `scheduled` la creó la descarga automática y la avanza el equipo ejecutor por el canal de equipo, sin sesión,
 * por cuenta de quien configuró la programación (`requestedByDisplayName`). El historial la marca "Automática".
 */
export const satDownloadOrigins = ['manual', 'scheduled'] as const
export type SatDownloadOrigin = typeof satDownloadOrigins[number]
export interface SatDownloadRequest {
  requestId: string; folio: number; clientId: string; clientDisplayName: string; direction: SatDirection; method: SatDownloadMethod; origin: SatDownloadOrigin; fromDate: string; toDate: string
  executorDeviceAlias: string; isThisDevice: boolean; state: SatDownloadState; satRequestId: string | null; satCode: number | null; satMessage: string
  cfdiCount: number | null; packageCount: number; downloadedPackageCount: number; importedCount: number; duplicateCount: number; rejectedCount: number
  attemptCount: number; nextAttemptAt: string | null; requestedByDisplayName: string; createdAt: string; updatedAt: string | null; revision: number
}
/** e.firma de un cliente en este equipo, sin secretos. */
export interface SatCredentialInfo { clientId: string; rfc: string; serialNumber: string; validFrom: string; validUntil: string; isExpired: boolean }
/** Equipo con la e.firma del cliente; `deviceId` permite elegirlo como ejecutor de la descarga automática. */
export interface SatCredentialDevice { deviceId: string; deviceAlias: string; isThisDevice: boolean; validUntil: string }

/**
 * Lo que pide la vista. Crear una solicitud pasa por Main (`sat:request`), que comprueba la e.firma local.
 * Las acciones de la descarga automática (`readSchedule`, `saveSchedule`, `runScheduleNow`, `listAutomation`) están en
 * `satDownloadSchedules.ts`.
 */
export type SatDownloadViewRequest =
  { action: 'list'; clientId: string | null } |
  { action: 'cancel'; requestId: string; revision: number } |
  { action: 'listCredentialDevices'; clientId: string } |
  SatScheduleViewRequest
export interface SatDownloadSubmission { clientId: string; direction: SatDirection; fromDate: string; toDate: string }
/**
 * Avance que reporta el equipo ejecutor; el Host sólo lo acepta de ese equipo y con la revisión vigente.
 * - `failureKind`: clasificación de la falla de este paso (null si no hubo), ver `satFailureKinds`.
 * - `isPlatformAvailable`: true si el SAT respondió, false si no respondió o respondió con error del servidor,
 *   null si este paso no llegó al SAT (por ejemplo, la e.firma no está en el equipo). Alimenta el corta-circuitos.
 */
export interface SatDownloadProgress {
  state: SatDownloadState; satRequestId: string | null; satCode: number | null; satMessage: string; cfdiCount: number | null
  packageIds: string[]; downloadedPackageIds: string[]; importedCount: number; duplicateCount: number; rejectedCount: number; attemptCount: number; retryInMinutes: number | null
  failureKind: SatFailureKind | null; isPlatformAvailable: boolean | null
}
/** Petición que acepta el Host: la de la vista o las que sólo arma Main (crear, avance, e.firma, pendientes). */
export type SatDownloadHostRequest = SatDownloadViewRequest |
  ({ action: 'create' } & SatDownloadSubmission) |
  { action: 'listAssigned' } |
  { action: 'reportProgress'; requestId: string; revision: number; progress: SatDownloadProgress } |
  { action: 'reportProbe'; isAvailable: boolean } |
  { action: 'registerCredential'; clientId: string; rfc: string; serialNumber: string; validUntil: string } |
  { action: 'unregisterCredential'; clientId: string }
/** Trabajo pendiente del equipo: incluye los paquetes ya conocidos para retomar tras reiniciar. */
export interface SatAssignedRequest { requestId: string; clientId: string; clientRfc: string; direction: SatDirection; fromDate: string; toDate: string; state: SatDownloadState; satRequestId: string | null; packageIds: string[]; downloadedPackageIds: string[]; importedCount: number; duplicateCount: number; rejectedCount: number; attemptCount: number; createdAt: string; revision: number }

/**
 * `assigned` incluye el estado del corta-circuitos: con el SAT en pausa no hay trabajo, y con `shouldProbe` este equipo
 * hace la prueba de conexión barata (sin e.firma) y la informa con `reportProbe`.
 */
export type SatDownloadResult =
  { status: 'listed'; requests: SatDownloadRequest[]; canDownload: boolean } |
  { status: 'created'; request: SatDownloadRequest; isExisting: boolean } |
  { status: 'cancelled' } |
  { status: 'credentialDevices'; devices: SatCredentialDevice[] } |
  { status: 'assigned'; requests: SatAssignedRequest[]; platform: SatPlatformStatus; shouldProbe: boolean } |
  { status: 'progressSaved'; revision: number; isCancelled: boolean } |
  { status: 'probeSaved'; platform: SatPlatformStatus } |
  { status: 'credentialRegistered' } |
  SatScheduleResult

const businessDatePattern = /^\d{4}-\d{2}-\d{2}$/
function exactKeys(data: Record<string, unknown>, keys: readonly string[]): void {
  if (Object.keys(data).sort().join() !== [...keys].sort().join()) throw new Error('Invalid SAT download data')
}
function oneOf<T extends string>(value: unknown, values: readonly T[]): T { if (!values.includes(value as T)) throw new Error('Invalid SAT download data'); return value as T }
function count(value: unknown, maximum = Number.MAX_SAFE_INTEGER): number { if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > maximum) throw new Error('Invalid count'); return Number(value) }
function text(value: unknown, maximum: number): string {
  if (typeof value !== 'string' || value.length > maximum || [...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) throw new Error('Invalid SAT text')
  return value
}
function timestamp(value: unknown): string { if (typeof value !== 'string' || value.length > 40 || !Number.isFinite(Date.parse(value))) throw new Error('Invalid timestamp'); return value }
function nullableTimestamp(value: unknown): string | null { return value === null ? null : timestamp(value) }
/** UUID de solicitud o de paquete del SAT: letras, dígitos, guiones y guion bajo. */
function satIdentifier(value: unknown): string { if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(value)) throw new Error('Invalid SAT identifier'); return value }
function identifiers(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 2000) throw new Error('Invalid SAT identifiers')
  return value.map(satIdentifier)
}
export function parseSatRfc(value: unknown): string { if (typeof value !== 'string' || !rfcPattern.test(value)) throw new Error('Invalid RFC'); return value }

/** Periodo de fechas de negocio: inicio ≤ fin, como máximo 31 días y sin fechas futuras. */
export function parseSatSubmission(value: unknown, today: string): SatDownloadSubmission {
  const data = pairingRecord(value); exactKeys(data, ['clientId', 'direction', 'fromDate', 'toDate'])
  for (const key of ['fromDate', 'toDate'] as const) if (typeof data[key] !== 'string' || !businessDatePattern.test(data[key] as string) || !Number.isFinite(Date.parse(data[key] + 'T00:00:00Z'))) throw new Error('Invalid SAT period')
  const fromDate = data.fromDate as string, toDate = data.toDate as string
  const days = (Date.parse(toDate + 'T00:00:00Z') - Date.parse(fromDate + 'T00:00:00Z')) / 86400000
  if (days < 0 || days >= maximumSatPeriodDays || toDate > today) throw new Error('Invalid SAT period')
  return { clientId: parseHostId(data.clientId), direction: oneOf(data.direction, satDirections), fromDate, toDate }
}
export function parseSatViewRequest(value: unknown, today = getOfficeToday()): SatDownloadViewRequest {
  const schedule = parseSatScheduleViewRequest(value, today)
  if (schedule) return schedule
  const data = pairingRecord(value)
  if (data.action === 'list') { exactKeys(data, ['action', 'clientId']); return { action: 'list', clientId: data.clientId === null ? null : parseHostId(data.clientId) } }
  if (data.action === 'cancel') { exactKeys(data, ['action', 'requestId', 'revision']); return { action: 'cancel', requestId: parseHostId(data.requestId), revision: count(data.revision) } }
  if (data.action === 'listCredentialDevices') { exactKeys(data, ['action', 'clientId']); return { action: 'listCredentialDevices', clientId: parseHostId(data.clientId) } }
  throw new Error('Invalid SAT download request')
}
/** Avance de un paso; lo comparten el canal de sesión y el canal de equipo (`satDeviceWork.ts`). */
export function parseSatDownloadProgress(value: unknown): SatDownloadProgress {
  const data = pairingRecord(value)
  exactKeys(data, ['state', 'satRequestId', 'satCode', 'satMessage', 'cfdiCount', 'packageIds', 'downloadedPackageIds', 'importedCount', 'duplicateCount', 'rejectedCount', 'attemptCount', 'retryInMinutes', 'failureKind', 'isPlatformAvailable'])
  if (data.isPlatformAvailable !== null && typeof data.isPlatformAvailable !== 'boolean') throw new Error('Invalid SAT progress')
  return { state: oneOf(data.state, satDownloadStates), satRequestId: data.satRequestId === null ? null : satIdentifier(data.satRequestId), satCode: data.satCode === null ? null : count(data.satCode, 99999),
    satMessage: text(data.satMessage, 300), cfdiCount: data.cfdiCount === null ? null : count(data.cfdiCount), packageIds: identifiers(data.packageIds), downloadedPackageIds: identifiers(data.downloadedPackageIds),
    importedCount: count(data.importedCount), duplicateCount: count(data.duplicateCount), rejectedCount: count(data.rejectedCount), attemptCount: count(data.attemptCount, 10000),
    retryInMinutes: data.retryInMinutes === null ? null : count(data.retryInMinutes, 1440), failureKind: data.failureKind === null ? null : oneOf(data.failureKind, satFailureKinds),
    isPlatformAvailable: data.isPlatformAvailable as boolean | null }
}
/** El Host acepta lo de la vista y lo que sólo arma Main; `today` es la fecha de negocio del Host. */
export function parseSatHostRequest(value: unknown, today: string): SatDownloadHostRequest {
  const data = pairingRecord(value)
  if (data.action === 'create') { const { action, ...submission } = data; void action; return { action: 'create', ...parseSatSubmission(submission, today) } }
  if (data.action === 'listAssigned') { exactKeys(data, ['action']); return { action: 'listAssigned' } }
  if (data.action === 'reportProbe') { exactKeys(data, ['action', 'isAvailable']); if (typeof data.isAvailable !== 'boolean') throw new Error('Invalid SAT probe'); return { action: 'reportProbe', isAvailable: data.isAvailable } }
  if (data.action === 'reportProgress') { exactKeys(data, ['action', 'requestId', 'revision', 'progress']); return { action: 'reportProgress', requestId: parseHostId(data.requestId), revision: count(data.revision), progress: parseSatDownloadProgress(data.progress) } }
  if (data.action === 'registerCredential') {
    exactKeys(data, ['action', 'clientId', 'rfc', 'serialNumber', 'validUntil'])
    return { action: 'registerCredential', clientId: parseHostId(data.clientId), rfc: parseSatRfc(data.rfc), serialNumber: satIdentifier(data.serialNumber), validUntil: timestamp(data.validUntil) }
  }
  if (data.action === 'unregisterCredential') { exactKeys(data, ['action', 'clientId']); return { action: 'unregisterCredential', clientId: parseHostId(data.clientId) } }
  return parseSatViewRequest(value, today)
}

function parseRequest(value: unknown): SatDownloadRequest {
  const data = pairingRecord(value)
  exactKeys(data, ['requestId', 'folio', 'clientId', 'clientDisplayName', 'direction', 'method', 'origin', 'fromDate', 'toDate', 'executorDeviceAlias', 'isThisDevice', 'state', 'satRequestId', 'satCode', 'satMessage', 'cfdiCount',
    'packageCount', 'downloadedPackageCount', 'importedCount', 'duplicateCount', 'rejectedCount', 'attemptCount', 'nextAttemptAt', 'requestedByDisplayName', 'createdAt', 'updatedAt', 'revision'])
  if (typeof data.isThisDevice !== 'boolean') throw new Error('Invalid SAT download')
  for (const key of ['fromDate', 'toDate'] as const) if (typeof data[key] !== 'string' || !businessDatePattern.test(data[key] as string)) throw new Error('Invalid SAT period')
  return { requestId: parseHostId(data.requestId), folio: count(data.folio), clientId: parseHostId(data.clientId), clientDisplayName: pairingText(data.clientDisplayName, 200), direction: oneOf(data.direction, satDirections), method: oneOf(data.method, satDownloadMethods), origin: oneOf(data.origin, satDownloadOrigins),
    fromDate: data.fromDate as string, toDate: data.toDate as string, executorDeviceAlias: text(data.executorDeviceAlias, 100), isThisDevice: data.isThisDevice, state: oneOf(data.state, satDownloadStates),
    satRequestId: data.satRequestId === null ? null : satIdentifier(data.satRequestId), satCode: data.satCode === null ? null : count(data.satCode, 99999), satMessage: text(data.satMessage, 300),
    cfdiCount: data.cfdiCount === null ? null : count(data.cfdiCount), packageCount: count(data.packageCount), downloadedPackageCount: count(data.downloadedPackageCount), importedCount: count(data.importedCount),
    duplicateCount: count(data.duplicateCount), rejectedCount: count(data.rejectedCount), attemptCount: count(data.attemptCount), nextAttemptAt: nullableTimestamp(data.nextAttemptAt),
    requestedByDisplayName: pairingText(data.requestedByDisplayName, 200), createdAt: timestamp(data.createdAt), updatedAt: nullableTimestamp(data.updatedAt), revision: count(data.revision) }
}
export function parseSatAssignedRequest(value: unknown): SatAssignedRequest {
  const data = pairingRecord(value)
  exactKeys(data, ['requestId', 'clientId', 'clientRfc', 'direction', 'fromDate', 'toDate', 'state', 'satRequestId', 'packageIds', 'downloadedPackageIds', 'importedCount', 'duplicateCount', 'rejectedCount', 'attemptCount', 'createdAt', 'revision'])
  for (const key of ['fromDate', 'toDate'] as const) if (typeof data[key] !== 'string' || !businessDatePattern.test(data[key] as string)) throw new Error('Invalid SAT period')
  return { requestId: parseHostId(data.requestId), clientId: parseHostId(data.clientId), clientRfc: parseSatRfc(data.clientRfc), direction: oneOf(data.direction, satDirections), fromDate: data.fromDate as string, toDate: data.toDate as string,
    state: oneOf(data.state, satDownloadStates), satRequestId: data.satRequestId === null ? null : satIdentifier(data.satRequestId), packageIds: identifiers(data.packageIds), downloadedPackageIds: identifiers(data.downloadedPackageIds),
    importedCount: count(data.importedCount), duplicateCount: count(data.duplicateCount), rejectedCount: count(data.rejectedCount), attemptCount: count(data.attemptCount), createdAt: timestamp(data.createdAt), revision: count(data.revision) }
}
export function parseSatDownloadResult(value: unknown): SatDownloadResult {
  const data = pairingRecord(value)
  if (data.status === 'listed') { exactKeys(data, ['status', 'requests', 'canDownload']); if (!Array.isArray(data.requests) || data.requests.length > 500 || typeof data.canDownload !== 'boolean') throw new Error('Invalid SAT list'); return { status: 'listed', requests: data.requests.map(parseRequest), canDownload: data.canDownload } }
  if (data.status === 'created') { exactKeys(data, ['status', 'request', 'isExisting']); if (typeof data.isExisting !== 'boolean') throw new Error('Invalid result'); return { status: 'created', request: parseRequest(data.request), isExisting: data.isExisting } }
  if (data.status === 'cancelled') { exactKeys(data, ['status']); return { status: 'cancelled' } }
  if (data.status === 'credentialDevices') {
    exactKeys(data, ['status', 'devices'])
    if (!Array.isArray(data.devices) || data.devices.length > 100) throw new Error('Invalid devices')
    return { status: 'credentialDevices', devices: data.devices.map(item => { const entry = pairingRecord(item); exactKeys(entry, ['deviceId', 'deviceAlias', 'isThisDevice', 'validUntil']); if (typeof entry.isThisDevice !== 'boolean') throw new Error('Invalid device'); return { deviceId: parseHostId(entry.deviceId), deviceAlias: text(entry.deviceAlias, 100), isThisDevice: entry.isThisDevice, validUntil: timestamp(entry.validUntil) } }) }
  }
  if (data.status === 'assigned') {
    exactKeys(data, ['status', 'requests', 'platform', 'shouldProbe'])
    if (!Array.isArray(data.requests) || data.requests.length > 100 || typeof data.shouldProbe !== 'boolean') throw new Error('Invalid assigned')
    return { status: 'assigned', requests: data.requests.map(parseSatAssignedRequest), platform: parseSatPlatformStatus(data.platform), shouldProbe: data.shouldProbe }
  }
  if (data.status === 'probeSaved') { exactKeys(data, ['status', 'platform']); return { status: 'probeSaved', platform: parseSatPlatformStatus(data.platform) } }
  if (data.status === 'progressSaved') { exactKeys(data, ['status', 'revision', 'isCancelled']); if (typeof data.isCancelled !== 'boolean') throw new Error('Invalid result'); return { status: 'progressSaved', revision: count(data.revision), isCancelled: data.isCancelled } }
  if (data.status === 'credentialRegistered') { exactKeys(data, ['status']); return { status: 'credentialRegistered' } }
  const schedule = parseSatScheduleResult(value)
  if (schedule) return schedule
  throw new Error('Invalid SAT download result')
}
export function parseSatCredentialInfo(value: unknown): SatCredentialInfo | null {
  if (value === null) return null
  const data = pairingRecord(value); exactKeys(data, ['clientId', 'rfc', 'serialNumber', 'validFrom', 'validUntil', 'isExpired'])
  if (typeof data.isExpired !== 'boolean') throw new Error('Invalid credential')
  return { clientId: parseHostId(data.clientId), rfc: parseSatRfc(data.rfc), serialNumber: satIdentifier(data.serialNumber), validFrom: timestamp(data.validFrom), validUntil: timestamp(data.validUntil), isExpired: data.isExpired }
}
/** Contraseña de la llave privada: sólo se valida su forma; nunca se registra ni se devuelve. */
export function parseCredentialPassword(value: unknown): string {
  if (typeof value !== 'string' || !value || value.length > 256) throw new Error('Invalid credential password')
  return value
}
