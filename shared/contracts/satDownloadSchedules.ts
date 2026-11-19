import { parseHostId } from './discovery'
import { pairingRecord, pairingText } from './pairing'

/**
 * Descargas automáticas del SAT (2026-10-11, pedido del usuario: "automatízalo con recuperación en caso de que
 * falle la plataforma"). Contrato compartido por la vista, Main y el Host. Ver [[SAT-DOWNLOADS-AUTOMATION]].
 *
 * Datos GLOBAL (Host):
 * - **Programación por cliente** (`satDownloadSchedules`, migración 095): activar, direcciones, frecuencia, hora,
 *   día, equipo ejecutor (debe tener la e.firma sellada) y desde qué fecha cubrir.
 * - **Cobertura continua:** por dirección, la última fecha cubierta por completo (`coveredThrough`), el cursor de
 *   la ejecución en curso y la solicitud activa. Sólo avanza con `completed` o `noData`.
 * - **Salud del servicio web** (`satPlatformHealth`, migración 096): el corta-circuitos compartido por todos los
 *   equipos ejecutores.
 * Ningún dato de este contrato es secreto: la e.firma sigue sellada en el equipo (ADR-021).
 */
export const satScheduleDirections = ['issued', 'received', 'both'] as const
export type SatScheduleDirections = typeof satScheduleDirections[number]
export const satScheduleFrequencies = ['daily', 'weekly'] as const
export type SatScheduleFrequency = typeof satScheduleFrequencies[number]
/**
 * `idle` espera la siguiente hora; `running` avanza periodo por periodo; `credentialBlocked` espera una e.firma utilizable;
 * `ownerBlocked` (migración 099, ADR-037) está **pausada** porque quien la configuró perdió el acceso (usuario inactivo,
 * sin `clients.read`, `sat.download` o `xml.use`, sin asignación `readWrite`) o el cliente está inactivo. Se reanuda al
 * guardarla de nuevo con una persona con acceso. El motivo está en `lastRunMessage`.
 */
export const satScheduleStates = ['idle', 'running', 'credentialBlocked', 'ownerBlocked'] as const
export type SatScheduleState = typeof satScheduleStates[number]
export const satRunOutcomes = ['completed', 'failed', 'credentialBlocked', 'ownerBlocked'] as const
export type SatRunOutcome = typeof satRunOutcomes[number]
/**
 * Clasificación de una falla del SAT (la arma Main, `classifySatFailure`):
 * - `network`: sin respuesta (conexión, DNS, tiempo agotado). Transitoria; cuenta para el corta-circuitos.
 * - `platform`: el SAT respondió con error del servidor (HTTP 5xx, 404 "Error no controlado", 5006). Transitoria; cuenta.
 * - `requestLimit`: límites del SAT (5002 de por vida, 5005 duplicada, 5008 descargas del paquete, 5011 diario). Se
 *   reprograma a la siguiente ventana permitida sin gastar reintentos.
 * - `credential`: e.firma vencida, revocada o inválida (300, 302–305, autenticación). Detiene la programación.
 * - `expired`: la solicitud o el paquete caducó en el SAT (estado 6, 5007). Se vuelve a pedir.
 * - `periodTooLarge`: 5003, más CFDI de los que entrega una solicitud. La programación parte el periodo a la mitad.
 * - `permanent`: cualquier otra respuesta definitiva (301, 5001, rechazada, código desconocido).
 */
export const satFailureKinds = ['network', 'platform', 'requestLimit', 'credential', 'expired', 'periodTooLarge', 'permanent'] as const
export type SatFailureKind = typeof satFailureKinds[number]
export const satCircuitStates = ['closed', 'open', 'halfOpen'] as const
export type SatCircuitState = typeof satCircuitStates[number]

/** Días que cada ejecución vuelve a pedir antes de lo ya cubierto, por los CFDI que el SAT publica con retraso. */
export const satScheduleOverlapDays = 3
/** Un equipo ejecutor sin reportarse en este tiempo se marca "sin conexión". */
export const satExecutorOfflineHours = 24
/** Con el servicio web fallando este tiempo, se sugiere "Descargar con RFC y CIEC". */
export const satWebServiceFallbackHours = 24
/** Hasta cuántos años atrás se puede pedir la cobertura inicial. */
export const maximumSatCoverageYears = 6

export interface SatScheduleSettings {
  isEnabled: boolean; directions: SatScheduleDirections; frequency: SatScheduleFrequency; runTime: string; dayOfWeek: number
  executorDeviceId: string | null; coverageStartDate: string
}
/** Cobertura de una dirección: `coveredThrough` es la marca de agua; `cursorDate` el siguiente día por pedir en esta ejecución. */
export interface SatDirectionCoverage { direction: 'issued' | 'received'; coveredThrough: string | null; cursorDate: string | null; hasActiveRequest: boolean; waitUntil: string | null }
/** Estado del corta-circuitos: `open` pausa todas las llamadas al SAT hasta `pausedUntil`; `halfOpen` prueba la conexión. */
export interface SatPlatformStatus { state: SatCircuitState; pausedUntil: string | null; consecutiveFailureCount: number; changedAt: string | null; changeSequence: number }
/**
 * Resumen para avisos y tablero. `runSequence` crece cada vez que termina una ejecución. `isPaused`: derivado de
 * `state = 'ownerBlocked'` (quien la configuró perdió el acceso; el motivo está en `lastRunMessage`). `executorCheckInAt`: la última vez
 * que el equipo ejecutor se reportó por el canal de equipo (con o sin sesión).
 */
export interface SatScheduleSummary {
  clientId: string; clientDisplayName: string; isEnabled: boolean; state: SatScheduleState; isPaused: boolean; nextRunAt: string | null
  lastRunFinishedAt: string | null; lastRunOutcome: SatRunOutcome | null; lastRunMessage: string; lastRunImportedCount: number; runSequence: number
  executorDeviceAlias: string | null; executorCheckInAt: string | null; webServiceFailingSince: string | null
}
export interface SatScheduleDetail extends SatScheduleSummary {
  settings: SatScheduleSettings; coverage: SatDirectionCoverage[]; runStartedAt: string | null; runTargetDate: string | null
  revision: number; updatedByDisplayName: string; updatedAt: string
}

/** Acciones de la vista (pasan por `sat:operate`). Leer exige cualquier asignación; guardar y ejecutar, `readWrite`. */
export type SatScheduleViewRequest =
  { action: 'readSchedule'; clientId: string } |
  { action: 'saveSchedule'; clientId: string; revision: number | null; settings: SatScheduleSettings } |
  { action: 'runScheduleNow'; clientId: string; revision: number } |
  { action: 'listAutomation' }
export type SatScheduleResult =
  { status: 'schedule'; schedule: SatScheduleDetail | null; platform: SatPlatformStatus; canManage: boolean } |
  { status: 'automation'; schedules: SatScheduleSummary[]; platform: SatPlatformStatus }

const businessDatePattern = /^\d{4}-\d{2}-\d{2}$/
const runTimePattern = /^([01]\d|2[0-3]):[0-5]\d$/
function exactKeys(data: Record<string, unknown>, keys: readonly string[]): void {
  if (Object.keys(data).sort().join() !== [...keys].sort().join()) throw new Error('Invalid SAT schedule data')
}
function oneOf<T extends string>(value: unknown, values: readonly T[]): T { if (!values.includes(value as T)) throw new Error('Invalid SAT schedule data'); return value as T }
function count(value: unknown, maximum = Number.MAX_SAFE_INTEGER): number { if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > maximum) throw new Error('Invalid SAT schedule count'); return Number(value) }
function bool(value: unknown): boolean { if (typeof value !== 'boolean') throw new Error('Invalid SAT schedule flag'); return value }
function businessDate(value: unknown): string {
  if (typeof value !== 'string' || !businessDatePattern.test(value) || !Number.isFinite(Date.parse(value + 'T00:00:00Z')) || new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) !== value) throw new Error('Invalid SAT schedule date')
  return value
}
function nullableBusinessDate(value: unknown): string | null { return value === null ? null : businessDate(value) }
function timestamp(value: unknown): string { if (typeof value !== 'string' || value.length > 40 || !Number.isFinite(Date.parse(value))) throw new Error('Invalid SAT schedule timestamp'); return value }
function nullableTimestamp(value: unknown): string | null { return value === null ? null : timestamp(value) }
function message(value: unknown): string {
  if (typeof value !== 'string' || value.length > 300 || [...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) throw new Error('Invalid SAT schedule text')
  return value
}

/**
 * Configuración de una programación. `today` es la fecha de negocio de quien valida (vista, Main u Host):
 * - `coverageStartDate` no puede ser futura ni de más de `maximumSatCoverageYears` años atrás;
 * - activa exige equipo ejecutor (el Host comprueba además que ese equipo tenga la e.firma vigente).
 */
export function parseSatScheduleSettings(value: unknown, today: string): SatScheduleSettings {
  const settings = readSettingsShape(value)
  const earliestDate = String(Number(today.slice(0, 4)) - maximumSatCoverageYears) + today.slice(4)
  if (settings.coverageStartDate > today || settings.coverageStartDate < earliestDate) throw new Error('Invalid SAT coverage start')
  if (settings.isEnabled && !settings.executorDeviceId) throw new Error('SAT schedule executor required')
  return settings
}
/** Forma de la configuración sin las reglas que dependen de "hoy" (respuestas del Host ya guardadas). */
function readSettingsShape(value: unknown): SatScheduleSettings {
  const data = pairingRecord(value)
  exactKeys(data, ['isEnabled', 'directions', 'frequency', 'runTime', 'dayOfWeek', 'executorDeviceId', 'coverageStartDate'])
  if (typeof data.runTime !== 'string' || !runTimePattern.test(data.runTime)) throw new Error('Invalid SAT schedule time')
  return { isEnabled: bool(data.isEnabled), directions: oneOf(data.directions, satScheduleDirections), frequency: oneOf(data.frequency, satScheduleFrequencies),
    runTime: data.runTime, dayOfWeek: count(data.dayOfWeek, 6), executorDeviceId: data.executorDeviceId === null ? null : parseHostId(data.executorDeviceId), coverageStartDate: businessDate(data.coverageStartDate) }
}
/** Devuelve `null` si no es una acción de programación (la valida entonces `parseSatViewRequest`). */
export function parseSatScheduleViewRequest(value: unknown, today: string): SatScheduleViewRequest | null {
  const data = pairingRecord(value)
  if (data.action === 'readSchedule') { exactKeys(data, ['action', 'clientId']); return { action: 'readSchedule', clientId: parseHostId(data.clientId) } }
  if (data.action === 'saveSchedule') {
    exactKeys(data, ['action', 'clientId', 'revision', 'settings'])
    return { action: 'saveSchedule', clientId: parseHostId(data.clientId), revision: data.revision === null ? null : count(data.revision), settings: parseSatScheduleSettings(data.settings, today) }
  }
  if (data.action === 'runScheduleNow') { exactKeys(data, ['action', 'clientId', 'revision']); return { action: 'runScheduleNow', clientId: parseHostId(data.clientId), revision: count(data.revision) } }
  if (data.action === 'listAutomation') { exactKeys(data, ['action']); return { action: 'listAutomation' } }
  return null
}

export function parseSatPlatformStatus(value: unknown): SatPlatformStatus {
  const data = pairingRecord(value); exactKeys(data, ['state', 'pausedUntil', 'consecutiveFailureCount', 'changedAt', 'changeSequence'])
  return { state: oneOf(data.state, satCircuitStates), pausedUntil: nullableTimestamp(data.pausedUntil), consecutiveFailureCount: count(data.consecutiveFailureCount),
    changedAt: nullableTimestamp(data.changedAt), changeSequence: count(data.changeSequence) }
}
const summaryKeys = ['clientId', 'clientDisplayName', 'isEnabled', 'state', 'isPaused', 'nextRunAt', 'lastRunFinishedAt', 'lastRunOutcome', 'lastRunMessage', 'lastRunImportedCount', 'runSequence', 'executorDeviceAlias', 'executorCheckInAt', 'webServiceFailingSince'] as const
function readSummary(data: Record<string, unknown>): SatScheduleSummary {
  return { clientId: parseHostId(data.clientId), clientDisplayName: pairingText(data.clientDisplayName, 200), isEnabled: bool(data.isEnabled), state: oneOf(data.state, satScheduleStates), isPaused: bool(data.isPaused),
    nextRunAt: nullableTimestamp(data.nextRunAt), lastRunFinishedAt: nullableTimestamp(data.lastRunFinishedAt), lastRunOutcome: data.lastRunOutcome === null ? null : oneOf(data.lastRunOutcome, satRunOutcomes),
    lastRunMessage: message(data.lastRunMessage), lastRunImportedCount: count(data.lastRunImportedCount), runSequence: count(data.runSequence),
    executorDeviceAlias: data.executorDeviceAlias === null ? null : pairingText(data.executorDeviceAlias, 100), executorCheckInAt: nullableTimestamp(data.executorCheckInAt), webServiceFailingSince: nullableTimestamp(data.webServiceFailingSince) }
}
function parseSummary(value: unknown): SatScheduleSummary { const data = pairingRecord(value); exactKeys(data, summaryKeys); return readSummary(data) }
function parseCoverage(value: unknown): SatDirectionCoverage {
  const data = pairingRecord(value); exactKeys(data, ['direction', 'coveredThrough', 'cursorDate', 'hasActiveRequest', 'waitUntil'])
  return { direction: oneOf(data.direction, ['issued', 'received'] as const), coveredThrough: nullableBusinessDate(data.coveredThrough), cursorDate: nullableBusinessDate(data.cursorDate), hasActiveRequest: bool(data.hasActiveRequest), waitUntil: nullableTimestamp(data.waitUntil) }
}
function parseDetail(value: unknown): SatScheduleDetail {
  const data = pairingRecord(value)
  exactKeys(data, [...summaryKeys, 'settings', 'coverage', 'runStartedAt', 'runTargetDate', 'revision', 'updatedByDisplayName', 'updatedAt'])
  if (!Array.isArray(data.coverage) || data.coverage.length > 2) throw new Error('Invalid SAT coverage')
  // La vista no vuelve a validar la fecha inicial contra "hoy": la guardó el Host con su propia fecha.
  return { ...readSummary(data), settings: readSettingsShape(data.settings),
    coverage: data.coverage.map(parseCoverage), runStartedAt: nullableTimestamp(data.runStartedAt), runTargetDate: nullableBusinessDate(data.runTargetDate),
    revision: count(data.revision), updatedByDisplayName: pairingText(data.updatedByDisplayName, 200), updatedAt: timestamp(data.updatedAt) }
}
/** Valida las respuestas de programación (Main y preload). Devuelve `null` si el estado no es de programación. */
export function parseSatScheduleResult(value: unknown): SatScheduleResult | null {
  const data = pairingRecord(value)
  if (data.status === 'schedule') {
    exactKeys(data, ['status', 'schedule', 'platform', 'canManage'])
    return { status: 'schedule', schedule: data.schedule === null ? null : parseDetail(data.schedule), platform: parseSatPlatformStatus(data.platform), canManage: bool(data.canManage) }
  }
  if (data.status === 'automation') {
    exactKeys(data, ['status', 'schedules', 'platform'])
    if (!Array.isArray(data.schedules) || data.schedules.length > 500) throw new Error('Invalid SAT automation list')
    return { status: 'automation', schedules: data.schedules.map(parseSummary), platform: parseSatPlatformStatus(data.platform) }
  }
  return null
}
