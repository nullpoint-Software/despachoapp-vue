import { parseHostId } from './discovery'
import { pairingRecord } from './pairing'
import { maximumXmlBytes } from './localXml'
import { satDirections, type SatDirection } from './satDownloads'
import { normalizeCaptchaText, parseCaptchaImage } from './satPortal'

/**
 * Descarga de XML (CFDI) por el portal "Consulta y recuperación de CFDI" del SAT con RFC y CIEC (2026-10-11,
 * [[SAT-PORTAL]] y [[../changes/SAT-PORTAL-CFDI]]).
 *
 * **Automática tras el captcha** (2026-10-14, [[../../docs/decisions/ADR-040-SAT-PORTAL-BROWSER-ENGINE]]): Main maneja
 * sin ventana el Edge o Chrome del equipo, como la ContaApp anterior. La persona sólo escribe en Fiscenix el texto de la
 * imagen del captcha; después Main consulta solo cada paso (emitidas por tramos de un mes, recibidas por mes), pide el
 * paquete, lo recupera por Folio de Descarga, valida e importa los XML a la biblioteca LOCAL. El Host guarda el registro
 * en `satDownloadRequests` con `method = 'portal'` (migración 097) y los pasos terminados en `completedPeriodIds`, para
 * **retomar** sin repetirlos.
 *
 * Contratos:
 * - **Vista ↔ Main** (`satPortalCfdi:operate`): `start` (cliente, dirección y periodo), `read`, `cancel`,
 *   `submitCaptcha` y `refreshCaptcha`. La vista nunca envía ni recibe RFC, CIEC, UUID, folios ni contenido de XML.
 * - **Main ↔ Host** (acción de sesión `satPortal`): `startCfdi` autoriza, audita `ciec.portal.cfdi` y crea o retoma el
 *   registro de cada dirección (con sus pasos terminados); `reportCfdi` guarda estado, totales y los pasos nuevos
 *   terminados (`addedCompletedPeriodIds`). `splitPeriodIds` ya no se usa (va vacío).
 *
 * **Ambas direcciones:** un solo navegador y un solo captcha; primero emitidas y después recibidas. En el Host sigue
 * habiendo **un registro por dirección** (`'issued' | 'received'`, igual que la descarga masiva).
 */
export const satPortalCfdiChannel = 'satPortalCfdi:operate'
/** Periodo máximo de una ejecución. */
export const maximumPortalCfdiPeriodDays = 366
/** Tiempo máximo de una ejecución (captcha incluido); después Fiscenix la detiene y se puede retomar. */
export const satPortalCfdiTimeoutMilliseconds = 60 * 60 * 1000
/** Cada XML descargado del portal: el mismo límite que la biblioteca LOCAL. */
export const maximumPortalXmlBytes = maximumXmlBytes
/** Acción de `clientAudit` (VARCHAR(32)) del uso de la CIEC para descargar CFDI; nunca contiene la CIEC. */
export const satPortalCfdiAuditAction = 'ciec.portal.cfdi'
/** Límites de los periodos guardados en el Host (campos del modo automático; Main ya no los envía). */
export const maximumStoredPeriodCount = 4000
export const maximumReportedPeriodCount = 120

/**
 * Estados de una ejecución (EPHEMERAL, memoria de Main): `authorizing` (Host) → `preparing` (navegador y login) →
 * `waitingForCaptcha` (`captchaImage` a la vista) → `signingIn` (si el SAT rechaza el acceso, vuelve a
 * `waitingForCaptcha` con otra imagen) → `downloading` (pasos automáticos) → `completed`. `cancelled`: la persona
 * canceló; `failed`: permisos, Host, RFC o un error del SAT (lo hecho se conserva y «Reintentar» retoma).
 * `waitingForSat` (2026-10-17): el SAT registró un Folio de Descarga pero todavía prepara el paquete (puede tardar
 * horas). Fiscenix vuelve a intentar SÓLO la recuperación cada hora (`nextRecoveryAt`), hasta 72 h; si la sesión del
 * SAT ya venció, pide el captcha otra vez (`waitingForCaptcha` con `isRecoveryLogin`).
 */
export const satPortalCfdiRunStates = ['authorizing', 'preparing', 'waitingForCaptcha', 'signingIn', 'downloading', 'waitingForSat', 'completed', 'cancelled', 'failed'] as const
export type SatPortalCfdiRunState = typeof satPortalCfdiRunStates[number]
export const activeSatPortalCfdiRunStates: readonly SatPortalCfdiRunState[] = ['authorizing', 'preparing', 'waitingForCaptcha', 'signingIn', 'downloading', 'waitingForSat']
/** Cada cuánto se reintenta la recuperación de un paquete que el SAT aún prepara, y hasta cuándo. */
export const portalRecoveryIntervalMilliseconds = 60 * 60 * 1000
export const maximumPortalRecoveryWaitMilliseconds = 72 * 60 * 60 * 1000
/** Folios de Descarga por paso (la versión anterior aceptaba hasta 100) y recuperaciones por registro. */
export const maximumPendingFolioCount = 100
export const maximumPendingRecoveryCount = 40

/** Dirección que elige la persona: una sola o `both` (emitidas y recibidas en la misma sesión del SAT). */
export const satPortalCfdiDirections = [...satDirections, 'both'] as const
export type SatPortalCfdiDirection = typeof satPortalCfdiDirections[number]
/** Direcciones que admite una ejecución, en orden: `both` → emitidas y recibidas. */
export function expandSatPortalCfdiDirection(direction: SatPortalCfdiDirection): SatDirection[] {
  return direction === 'both' ? [...satDirections] : [direction]
}

export interface SatPortalCfdiSubmission { clientId: string; direction: SatPortalCfdiDirection; fromDate: string; toDate: string }
/** Lo que identifica un registro del Host: siempre una sola dirección. */
export interface SatPortalCfdiRecordKey { clientId: string; direction: SatDirection; fromDate: string; toDate: string }

/**
 * Estado de cada dirección (su registro del Host) dentro de la ejecución: `open` (con pasos pendientes) → al terminar
 * `completed` (tiene CFDI) o `empty` (el SAT no tenía CFDI en el periodo). `cancelled`: la persona canceló o alguien
 * canceló su registro desde el historial; `failed`: un paso falló (se retoma desde ahí).
 */
export const satPortalCfdiDirectionStates = ['open', 'completed', 'empty', 'failed', 'cancelled'] as const
export type SatPortalCfdiDirectionState = typeof satPortalCfdiDirectionStates[number]
export interface SatPortalCfdiDirectionProgress {
  direction: SatDirection
  state: SatPortalCfdiDirectionState
  /** Resultado de la dirección en español (vacío mientras está abierta); sin RFC, CIEC, UUID ni respuestas del SAT. */
  message: string
  /** Pasos (tramos o meses) terminados, incluidos los de una ejecución anterior que se retomó, y pasos en total. */
  completedStepCount: number
  totalStepCount: number
  /** Totales del registro (incluyen los de una ejecución anterior sin terminar que el Host retomó). */
  foundCount: number
  importedCount: number
  duplicateCount: number
  rejectedCount: number
}

/**
 * Ejecución vista por la persona. Los conteos de primer nivel son el **total combinado** de sus direcciones; el detalle
 * de cada una está en `directions` (una entrada, o dos en "Ambas": emitidas y recibidas).
 */
export interface SatPortalCfdiRun extends SatPortalCfdiSubmission {
  runId: string
  state: SatPortalCfdiRunState
  /** Explicación en español para la persona; nunca incluye RFC, CIEC, UUID ni respuestas del SAT. */
  message: string
  startedAt: string
  finishedAt: string | null
  foundCount: number
  importedCount: number
  duplicateCount: number
  rejectedCount: number
  directions: SatPortalCfdiDirectionProgress[]
  /** Imagen del captcha (`data:image/png;base64,…`) sólo en `waitingForCaptcha`; `null` en los demás estados. */
  captchaImage: string | null
  /** En `waitingForSat`: cuándo es el siguiente intento de recuperación; `null` en los demás estados. */
  nextRecoveryAt: string | null
  /** El captcha que se pide es para recuperar un paquete pendiente (la sesión del SAT venció mientras se esperaba). */
  isRecoveryLogin: boolean
}

/**
 * Recuperación pendiente de un paso (2026-10-17, migración 105): los Folios de Descarga que el SAT registró y aún no
 * entrega. Vive en el registro del Host (cliente, dirección y equipo del registro), así que sobrevive a cerrar Fiscenix.
 * El folio no es secreto, pero no se escribe en logs ni se muestra.
 */
export interface SatPortalPendingRecovery { periodId: string; folios: string[]; runId: string; requestedAt: string }
/** Lo que la vista ve de un registro con recuperación pendiente en ESTE equipo (sin folios). */
export interface SatPortalCfdiRecovery { requestId: string; direction: SatDirection; fromDate: string; toDate: string; folioCount: number; requestedAt: string }

/**
 * `recoverNow` («Recuperar ahora»): en `waitingForSat`, intenta la recuperación en el acto. `listRecoveries`: las
 * recuperaciones pendientes del cliente en este equipo, para retomarlas con `start` de su periodo y dirección.
 */
export type SatPortalCfdiViewRequest = { action: 'read' } | { action: 'cancel' } | { action: 'refreshCaptcha' } | { action: 'recoverNow' } | { action: 'submitCaptcha'; captchaText: string } |
  { action: 'listRecoveries'; clientId: string } | ({ action: 'start' } & SatPortalCfdiSubmission)
/** `recoveries` sólo se llena con `listRecoveries`; en las demás acciones va vacío. */
export interface SatPortalCfdiViewResult { run: SatPortalCfdiRun | null; recoveries: SatPortalCfdiRecovery[] }

/** Estados del registro del Host que Main puede reportar (el Host pone `pending` al crear o retomar). */
/** `requested`: esperando que el SAT prepare un paquete (recuperación pendiente). */
export const satPortalCfdiReportStates = ['downloading', 'requested', 'completed', 'noData', 'failed', 'cancelled'] as const
export type SatPortalCfdiReportState = typeof satPortalCfdiReportStates[number]
export interface SatPortalCfdiProgress {
  state: SatPortalCfdiReportState
  message: string
  /** Periodos terminados o divididos desde el reporte anterior (deltas). */
  addedCompletedPeriodIds: string[]
  addedSplitPeriodIds: string[]
  /** Totales acumulados del registro (incluyen los de ejecuciones anteriores que se retomaron). */
  cfdiCount: number
  importedCount: number
  duplicateCount: number
  rejectedCount: number
  /** Recuperaciones pendientes del registro, completas (reemplazan las guardadas). */
  pendingRecoveries: SatPortalPendingRecovery[]
}
export type SatPortalCfdiHostRequest =
  ({ action: 'startCfdi' } & SatPortalCfdiSubmission) |
  { action: 'reportCfdi'; requestId: string; revision: number; progress: SatPortalCfdiProgress } |
  { action: 'listCfdiRecoveries'; clientId: string }
/**
 * Registro de una dirección que el Host creó o retomó (el último sin terminar del mismo cliente, dirección, periodo y
 * equipo), con sus totales y sus pasos terminados (`completedPeriodIds`), que Main se salta al retomar. Cada dirección
 * pedida siempre tiene un registro.
 */
export interface SatPortalCfdiRecordAuthorization {
  direction: SatDirection
  requestId: string
  revision: number
  isResumed: boolean
  completedPeriodIds: string[]
  splitPeriodIds: string[]
  cfdiCount: number
  importedCount: number
  duplicateCount: number
  rejectedCount: number
  pendingRecoveries: SatPortalPendingRecovery[]
}
/** `records`: uno por dirección pedida, en orden (emitidas antes que recibidas). */
export interface SatPortalCfdiAuthorization { status: 'cfdiAuthorized'; rfc: string; records: SatPortalCfdiRecordAuthorization[] }
export type SatPortalCfdiHostResult = SatPortalCfdiAuthorization | { status: 'missingRfc' } | { status: 'cfdiProgressSaved'; revision: number; isCancelled: boolean } |
  { status: 'cfdiRecoveries'; recoveries: SatPortalCfdiRecovery[] }

const businessDatePattern = /^\d{4}-\d{2}-\d{2}$/
/** Identificador de un periodo consultado: inicio y fin con segundos, `AAAAMMDDhhmmss-AAAAMMDDhhmmss`. */
export const portalPeriodIdPattern = /^\d{14}-\d{14}$/
const rfcShape = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/

function exactKeys(data: Record<string, unknown>, keys: readonly string[]): void {
  if (Object.keys(data).sort().join() !== [...keys].sort().join()) throw new Error('Invalid SAT portal CFDI data')
}
function count(value: unknown, maximum = Number.MAX_SAFE_INTEGER): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > maximum) throw new Error('Invalid SAT portal CFDI count')
  return Number(value)
}
function message(value: unknown, maximum: number): string {
  if (typeof value !== 'string' || value.length > maximum || [...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) throw new Error('Invalid SAT portal CFDI message')
  return value
}
function instant(value: unknown): string {
  if (typeof value !== 'string' || value.length > 40 || !Number.isFinite(Date.parse(value))) throw new Error('Invalid SAT portal CFDI date')
  return value
}
function businessDate(value: unknown): string {
  if (typeof value !== 'string' || !businessDatePattern.test(value) || !Number.isFinite(Date.parse(value + 'T00:00:00Z'))) throw new Error('Invalid SAT portal CFDI period')
  return value
}
function periodIds(value: unknown, maximum: number): string[] {
  if (!Array.isArray(value) || value.length > maximum || !value.every(item => typeof item === 'string' && portalPeriodIdPattern.test(item))) throw new Error('Invalid SAT portal CFDI periods')
  return value as string[]
}
const folioPattern = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/
/** Recuperaciones pendientes: periodo válido, 1 a 100 folios en mayúsculas sin repetir, ejecución e instante. */
export function parsePendingRecoveries(value: unknown): SatPortalPendingRecovery[] {
  if (!Array.isArray(value) || value.length > maximumPendingRecoveryCount) throw new Error('Invalid SAT portal CFDI recoveries')
  return value.map(item => {
    const data = pairingRecord(item)
    exactKeys(data, ['periodId', 'folios', 'runId', 'requestedAt'])
    if (typeof data.periodId !== 'string' || !portalPeriodIdPattern.test(data.periodId) || !Array.isArray(data.folios) || !data.folios.length || data.folios.length > maximumPendingFolioCount
      || !data.folios.every(folio => typeof folio === 'string' && folioPattern.test(folio)) || new Set(data.folios).size !== data.folios.length) throw new Error('Invalid SAT portal CFDI recoveries')
    return { periodId: data.periodId, folios: data.folios as string[], runId: parseHostId(data.runId), requestedAt: instant(data.requestedAt) }
  })
}
function parseRecovery(value: unknown): SatPortalCfdiRecovery {
  const data = pairingRecord(value)
  exactKeys(data, ['requestId', 'direction', 'fromDate', 'toDate', 'folioCount', 'requestedAt'])
  return { requestId: parseHostId(data.requestId), direction: direction(data.direction), fromDate: businessDate(data.fromDate), toDate: businessDate(data.toDate), folioCount: count(data.folioCount, 10000), requestedAt: instant(data.requestedAt) }
}
function direction(value: unknown): SatDirection {
  if (!satDirections.includes(value as SatDirection)) throw new Error('Invalid SAT portal CFDI direction')
  return value as SatDirection
}
/** Dirección al iniciar: exactamente `issued`, `received` o `both` (ni mayúsculas, ni listas, ni otro valor). */
function directionChoice(value: unknown): SatPortalCfdiDirection {
  if (typeof value !== 'string' || !(satPortalCfdiDirections as readonly string[]).includes(value)) throw new Error('Invalid SAT portal CFDI direction')
  return value as SatPortalCfdiDirection
}

/**
 * Periodo de una ejecución: fechas de negocio, inicio ≤ fin, como máximo `maximumPortalCfdiPeriodDays` días y sin fechas
 * futuras (`today` es la fecha de negocio de quien valida: la vista en Main y la del despacho en el Host).
 */
export function parseSatPortalCfdiSubmission(value: unknown, today: string): SatPortalCfdiSubmission {
  const data = pairingRecord(value)
  exactKeys(data, ['clientId', 'direction', 'fromDate', 'toDate'])
  const fromDate = businessDate(data.fromDate), toDate = businessDate(data.toDate)
  const days = (Date.parse(toDate + 'T00:00:00Z') - Date.parse(fromDate + 'T00:00:00Z')) / 86400000
  if (days < 0 || days >= maximumPortalCfdiPeriodDays || toDate > today) throw new Error('Invalid SAT portal CFDI period')
  return { clientId: parseHostId(data.clientId), direction: directionChoice(data.direction), fromDate, toDate }
}

export function parseSatPortalCfdiViewRequest(value: unknown, today: string): SatPortalCfdiViewRequest {
  const data = pairingRecord(value)
  if (data.action === 'read' || data.action === 'cancel' || data.action === 'refreshCaptcha' || data.action === 'recoverNow') { exactKeys(data, ['action']); return { action: data.action } }
  if (data.action === 'listRecoveries') { exactKeys(data, ['action', 'clientId']); return { action: 'listRecoveries', clientId: parseHostId(data.clientId) } }
  if (data.action === 'submitCaptcha') { exactKeys(data, ['action', 'captchaText']); return { action: 'submitCaptcha', captchaText: normalizeCaptchaText(data.captchaText) } }
  if (data.action === 'start') { const { action, ...submission } = data; void action; return { action: 'start', ...parseSatPortalCfdiSubmission(submission, today) } }
  throw new Error('Invalid SAT portal CFDI request')
}

function parseDirectionProgress(value: unknown): SatPortalCfdiDirectionProgress {
  const data = pairingRecord(value)
  exactKeys(data, ['direction', 'state', 'message', 'completedStepCount', 'totalStepCount', 'foundCount', 'importedCount', 'duplicateCount', 'rejectedCount'])
  if (!satPortalCfdiDirectionStates.includes(data.state as SatPortalCfdiDirectionState)) throw new Error('Invalid SAT portal CFDI run')
  return { direction: direction(data.direction), state: data.state as SatPortalCfdiDirectionState, message: message(data.message, 500), completedStepCount: count(data.completedStepCount), totalStepCount: count(data.totalStepCount),
    foundCount: count(data.foundCount), importedCount: count(data.importedCount), duplicateCount: count(data.duplicateCount), rejectedCount: count(data.rejectedCount) }
}

export function parseSatPortalCfdiRun(value: unknown): SatPortalCfdiRun {
  const data = pairingRecord(value)
  exactKeys(data, ['runId', 'clientId', 'direction', 'fromDate', 'toDate', 'state', 'message', 'startedAt', 'finishedAt', 'foundCount', 'importedCount', 'duplicateCount', 'rejectedCount', 'directions', 'captchaImage', 'nextRecoveryAt', 'isRecoveryLogin'])
  if (!satPortalCfdiRunStates.includes(data.state as SatPortalCfdiRunState) || !Array.isArray(data.directions) || typeof data.isRecoveryLogin !== 'boolean') throw new Error('Invalid SAT portal CFDI run')
  const runDirection = directionChoice(data.direction)
  const directions = data.directions.map(parseDirectionProgress)
  // Las entradas deben ser exactamente las direcciones de la ejecución, en orden.
  if (directions.map(item => item.direction).join() !== expandSatPortalCfdiDirection(runDirection).join()) throw new Error('Invalid SAT portal CFDI run')
  return { runId: parseHostId(data.runId), clientId: parseHostId(data.clientId), direction: runDirection, fromDate: businessDate(data.fromDate), toDate: businessDate(data.toDate),
    state: data.state as SatPortalCfdiRunState, message: message(data.message, 1000), startedAt: instant(data.startedAt), finishedAt: data.finishedAt === null ? null : instant(data.finishedAt),
    foundCount: count(data.foundCount), importedCount: count(data.importedCount), duplicateCount: count(data.duplicateCount), rejectedCount: count(data.rejectedCount), directions,
    captchaImage: parseCaptchaImage(data.captchaImage), nextRecoveryAt: data.nextRecoveryAt === null ? null : instant(data.nextRecoveryAt), isRecoveryLogin: data.isRecoveryLogin }
}

export function parseSatPortalCfdiViewResult(value: unknown): SatPortalCfdiViewResult {
  const data = pairingRecord(value)
  exactKeys(data, ['run', 'recoveries'])
  if (!Array.isArray(data.recoveries) || data.recoveries.length > 200) throw new Error('Invalid SAT portal CFDI result')
  return { run: data.run === null ? null : parseSatPortalCfdiRun(data.run), recoveries: data.recoveries.map(parseRecovery) }
}

function parseProgress(value: unknown): SatPortalCfdiProgress {
  const data = pairingRecord(value)
  exactKeys(data, ['state', 'message', 'addedCompletedPeriodIds', 'addedSplitPeriodIds', 'cfdiCount', 'importedCount', 'duplicateCount', 'rejectedCount', 'pendingRecoveries'])
  if (!satPortalCfdiReportStates.includes(data.state as SatPortalCfdiReportState)) throw new Error('Invalid SAT portal CFDI state')
  return { state: data.state as SatPortalCfdiReportState, message: message(data.message, 300), addedCompletedPeriodIds: periodIds(data.addedCompletedPeriodIds, maximumReportedPeriodCount),
    addedSplitPeriodIds: periodIds(data.addedSplitPeriodIds, maximumReportedPeriodCount), cfdiCount: count(data.cfdiCount), importedCount: count(data.importedCount),
    duplicateCount: count(data.duplicateCount), rejectedCount: count(data.rejectedCount), pendingRecoveries: parsePendingRecoveries(data.pendingRecoveries) }
}

/** Peticiones CFDI de la acción de sesión `satPortal` (Main las arma; el Host las vuelve a validar con su fecha). */
export function parseSatPortalCfdiHostRequest(value: unknown, today: string): SatPortalCfdiHostRequest {
  const data = pairingRecord(value)
  if (data.action === 'startCfdi') { const { action, ...submission } = data; void action; return { action: 'startCfdi', ...parseSatPortalCfdiSubmission(submission, today) } }
  if (data.action === 'reportCfdi') {
    exactKeys(data, ['action', 'requestId', 'revision', 'progress'])
    return { action: 'reportCfdi', requestId: parseHostId(data.requestId), revision: count(data.revision), progress: parseProgress(data.progress) }
  }
  if (data.action === 'listCfdiRecoveries') { exactKeys(data, ['action', 'clientId']); return { action: 'listCfdiRecoveries', clientId: parseHostId(data.clientId) } }
  throw new Error('Invalid SAT portal CFDI request')
}

export function parseSatPortalCfdiHostResult(value: unknown): SatPortalCfdiHostResult {
  const data = pairingRecord(value)
  if (data.status === 'missingRfc') { exactKeys(data, ['status']); return { status: 'missingRfc' } }
  if (data.status === 'cfdiProgressSaved') {
    exactKeys(data, ['status', 'revision', 'isCancelled'])
    if (typeof data.isCancelled !== 'boolean') throw new Error('Invalid SAT portal CFDI result')
    return { status: 'cfdiProgressSaved', revision: count(data.revision), isCancelled: data.isCancelled }
  }
  if (data.status === 'cfdiRecoveries') {
    exactKeys(data, ['status', 'recoveries'])
    if (!Array.isArray(data.recoveries) || data.recoveries.length > 200) throw new Error('Invalid SAT portal CFDI result')
    return { status: 'cfdiRecoveries', recoveries: data.recoveries.map(parseRecovery) }
  }
  exactKeys(data, ['status', 'rfc', 'records'])
  if (data.status !== 'cfdiAuthorized' || typeof data.rfc !== 'string' || !rfcShape.test(data.rfc) || !Array.isArray(data.records)) throw new Error('Invalid SAT portal CFDI result')
  const records = data.records.map(parseRecordAuthorization)
  // Una o dos direcciones, sin repetir y en orden (emitidas antes que recibidas), con registros distintos.
  const order = records.map(record => satDirections.indexOf(record.direction))
  if (!records.length || records.length > satDirections.length || order.some((position, index) => index > 0 && position <= order[index - 1]!)
    || new Set(records.map(record => record.requestId)).size !== records.length) throw new Error('Invalid SAT portal CFDI result')
  return { status: 'cfdiAuthorized', rfc: data.rfc, records }
}

function parseRecordAuthorization(value: unknown): SatPortalCfdiRecordAuthorization {
  const data = pairingRecord(value)
  exactKeys(data, ['direction', 'requestId', 'revision', 'isResumed', 'completedPeriodIds', 'splitPeriodIds', 'cfdiCount', 'importedCount', 'duplicateCount', 'rejectedCount', 'pendingRecoveries'])
  if (typeof data.isResumed !== 'boolean') throw new Error('Invalid SAT portal CFDI result')
  return { direction: direction(data.direction), requestId: parseHostId(data.requestId), revision: count(data.revision), isResumed: data.isResumed,
    completedPeriodIds: periodIds(data.completedPeriodIds, maximumStoredPeriodCount), splitPeriodIds: periodIds(data.splitPeriodIds, maximumStoredPeriodCount),
    cfdiCount: count(data.cfdiCount), importedCount: count(data.importedCount), duplicateCount: count(data.duplicateCount), rejectedCount: count(data.rejectedCount),
    pendingRecoveries: parsePendingRecoveries(data.pendingRecoveries) }
}
