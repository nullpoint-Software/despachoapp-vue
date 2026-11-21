import { pairingRecord, pairingText } from './pairing'

/**
 * Programaciones del Host (7.1). Decisiones del usuario (2026-10-03):
 * - Scheduler genérico en el Host; la primera tarea es la consulta de opiniones (`complianceOpinions`),
 *   con frecuencia, hora, día y regímenes como el original. Los respaldos (`backups`, 7.2) usan el mismo scheduler.
 * - Si el Host estaba apagado a la hora programada, al encender ejecuta **una sola vez** la pendiente de las
 *   últimas 24 h ("recuperada"); más atrás se registra como omitida.
 * - Reintentos por cliente a los 5, 15, 30 y 60 minutos sólo para fallas de red o del SAT.
 * - Configurar exige el permiso `schedules.manage` (además de `opinions.query`); consultar, `opinions.read`.
 * Hora y días están en la zona del despacho (America/Mexico_City).
 */
export const schedulesChannel = 'schedules:operate'
export const scheduleFrequencies = ['daily', 'weekdays', 'weekly'] as const
export type ScheduleFrequency = typeof scheduleFrequencies[number]
/** Programaciones que se configuran desde `schedules:operate` (Cumplimiento). */
export const scheduledJobKeys = ['complianceOpinions'] as const
export type ScheduledJobKey = typeof scheduledJobKeys[number]
/** Todas las tareas que ejecuta el scheduler del Host; `backups` (7.2) se configura desde `backups:operate`. */
export const hostJobKeys = [...scheduledJobKeys, 'backups'] as const
export type HostJobKey = typeof hostJobKeys[number]
export const scheduleRunStates = ['running', 'success', 'partial', 'error', 'cancelled', 'skipped'] as const
export type ScheduleRunState = typeof scheduleRunStates[number]
export const scheduleRunTriggers = ['scheduled', 'recovered', 'skipped'] as const
export type ScheduleRunTrigger = typeof scheduleRunTriggers[number]
/** Esperas de reintento del original, en minutos. */
export const opinionRetryDelaysMinutes = [5, 15, 30, 60] as const
export const maximumScheduleRegimes = 30

export interface ScheduleSettings { isEnabled: boolean; frequency: ScheduleFrequency; runTime: string; dayOfWeek: number; regimes: string[] }
export interface ScheduleRun { runId: string; scheduledFor: string; startedAt: string; finishedAt: string | null; runTrigger: ScheduleRunTrigger; state: ScheduleRunState; message: string; totalCount: number; answeredCount: number; failedCount: number }
export interface ScheduleDetail {
  jobKey: ScheduledJobKey; settings: ScheduleSettings; nextRunAt: string | null; revision: number; updatedByDisplayName: string | null; updatedAt: string | null
  runs: ScheduleRun[]; pendingRetryCount: number; exhaustedRetryCount: number; availableRegimes: string[]; canManage: boolean
}
export type ScheduleRequest = { action: 'get'; jobKey: ScheduledJobKey } | { action: 'save'; jobKey: ScheduledJobKey; revision: number; settings: ScheduleSettings }
export type ScheduleResult = { status: 'schedule'; schedule: ScheduleDetail }

const runTimePattern = /^([01]\d|2[0-3]):[0-5]\d$/
function exactKeys(data: Record<string, unknown>, keys: readonly string[]): void { if (Object.keys(data).sort().join() !== [...keys].sort().join()) throw new Error('Invalid schedule data') }
function oneOf<T extends string>(value: unknown, values: readonly T[]): T { if (!values.includes(value as T)) throw new Error('Invalid schedule data'); return value as T }
function count(value: unknown, maximum = Number.MAX_SAFE_INTEGER): number { if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > maximum) throw new Error('Invalid schedule count'); return Number(value) }
function timestamp(value: unknown): string { if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error('Invalid schedule timestamp'); return value }
function optionalTimestamp(value: unknown): string | null { return value === null ? null : timestamp(value) }
function regimes(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > maximumScheduleRegimes) throw new Error('Invalid schedule regimes')
  return [...new Set(value.map(item => pairingText(item, 100)))]
}

export function parseScheduleSettings(value: unknown): ScheduleSettings {
  const data = pairingRecord(value); exactKeys(data, ['isEnabled', 'frequency', 'runTime', 'dayOfWeek', 'regimes'])
  if (typeof data.isEnabled !== 'boolean' || typeof data.runTime !== 'string' || !runTimePattern.test(data.runTime)) throw new Error('Invalid schedule settings')
  return { isEnabled: data.isEnabled, frequency: oneOf(data.frequency, scheduleFrequencies), runTime: data.runTime, dayOfWeek: count(data.dayOfWeek, 6), regimes: regimes(data.regimes) }
}
export function parseScheduleRequest(value: unknown): ScheduleRequest {
  const data = pairingRecord(value)
  if (data.action === 'get') { exactKeys(data, ['action', 'jobKey']); return { action: 'get', jobKey: oneOf(data.jobKey, scheduledJobKeys) } }
  if (data.action === 'save') {
    exactKeys(data, ['action', 'jobKey', 'revision', 'settings'])
    return { action: 'save', jobKey: oneOf(data.jobKey, scheduledJobKeys), revision: count(data.revision), settings: parseScheduleSettings(data.settings) }
  }
  throw new Error('Invalid schedule request')
}
export function parseScheduleResult(value: unknown): ScheduleResult {
  const data = pairingRecord(value); exactKeys(data, ['status', 'schedule'])
  if (data.status !== 'schedule') throw new Error('Invalid schedule result')
  const detail = pairingRecord(data.schedule)
  exactKeys(detail, ['jobKey', 'settings', 'nextRunAt', 'revision', 'updatedByDisplayName', 'updatedAt', 'runs', 'pendingRetryCount', 'exhaustedRetryCount', 'availableRegimes', 'canManage'])
  if (!Array.isArray(detail.runs) || detail.runs.length > 50 || !Array.isArray(detail.availableRegimes) || detail.availableRegimes.length > 200 || typeof detail.canManage !== 'boolean') throw new Error('Invalid schedule detail')
  return { status: 'schedule', schedule: {
    jobKey: oneOf(detail.jobKey, scheduledJobKeys), settings: parseScheduleSettings(detail.settings), nextRunAt: optionalTimestamp(detail.nextRunAt), revision: count(detail.revision),
    updatedByDisplayName: detail.updatedByDisplayName === null ? null : pairingText(detail.updatedByDisplayName, 100), updatedAt: optionalTimestamp(detail.updatedAt),
    runs: detail.runs.map(item => {
      const run = pairingRecord(item)
      exactKeys(run, ['runId', 'scheduledFor', 'startedAt', 'finishedAt', 'runTrigger', 'state', 'message', 'totalCount', 'answeredCount', 'failedCount'])
      if (typeof run.message !== 'string' || run.message.length > 500) throw new Error('Invalid schedule run')
      return { runId: pairingText(run.runId, 36), scheduledFor: timestamp(run.scheduledFor), startedAt: timestamp(run.startedAt), finishedAt: optionalTimestamp(run.finishedAt),
        runTrigger: oneOf(run.runTrigger, scheduleRunTriggers), state: oneOf(run.state, scheduleRunStates), message: run.message, totalCount: count(run.totalCount), answeredCount: count(run.answeredCount), failedCount: count(run.failedCount) }
    }),
    pendingRetryCount: count(detail.pendingRetryCount), exhaustedRetryCount: count(detail.exhaustedRetryCount), availableRegimes: detail.availableRegimes.map(item => pairingText(item, 100)), canManage: detail.canManage
  } }
}
