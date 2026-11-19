import { officeTimeZone } from '../../../shared/contracts/movements'
import { satExecutorOfflineHours, satWebServiceFallbackHours, type SatPlatformStatus, type SatScheduleSummary } from '../../../shared/contracts/satDownloadSchedules'
import type { NavigationTarget } from '../../shared/navigation/navigationRequests'

/**
 * Textos y reglas de presentación de la descarga automática (puros, sin `window`), compartidos por el modal de Fiscal,
 * los avisos (`satAutomationWatcher`) y el tablero de Inicio. Las horas se muestran en la zona del despacho.
 */
const hourMilliseconds = 3_600_000
export type PresentationTone = 'neutral' | 'info' | 'success' | 'warning' | 'error'

export function formatOfficeTime(instant: string): string {
  return new Intl.DateTimeFormat('es-MX', { timeZone: officeTimeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(instant))
}
export function formatOfficeInstant(instant: string): string {
  return new Intl.DateTimeFormat('es-MX', { timeZone: officeTimeZone, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(instant))
}

/** Estado de la plataforma: normal, pausa por fallas del SAT hasta HH:MM, o probando la conexión. */
export function describePlatform(platform: SatPlatformStatus, now: Date): { label: string; tone: PresentationTone; isPaused: boolean } {
  if (platform.state === 'closed') return { label: 'SAT normal', tone: 'success', isPaused: false }
  if (platform.state === 'open' && platform.pausedUntil && Date.parse(platform.pausedUntil) > now.getTime()) return { label: 'Pausa por fallas del SAT hasta ' + formatOfficeTime(platform.pausedUntil), tone: 'warning', isPaused: true }
  return { label: 'Probando la conexión con el SAT', tone: 'info', isPaused: true }
}
/** El equipo ejecutor no pide trabajo desde hace más de 24 h (o nunca, y la ejecución lleva 24 h vencida). */
export function isExecutorOffline(schedule: SatScheduleSummary, now: Date): boolean {
  if (!schedule.isEnabled || schedule.state === 'ownerBlocked') return false
  const limitMilliseconds = satExecutorOfflineHours * hourMilliseconds
  if (schedule.executorCheckInAt) return now.getTime() - Date.parse(schedule.executorCheckInAt) > limitMilliseconds
  return schedule.nextRunAt !== null && now.getTime() - Date.parse(schedule.nextRunAt) > limitMilliseconds
}
/**
 * Último reporte del equipo ejecutor por el canal de equipo (ADR-037), que ocurre cada minuto mientras Fiscenix está
 * abierto en ese equipo, con o sin sesión: "hace un momento", "hace N min" o la fecha y hora del despacho.
 */
export function describeExecutorCheckIn(executorCheckInAt: string | null, now: Date): string {
  if (!executorCheckInAt) return 'todavía no se reporta'
  const elapsedMinutes = Math.floor((now.getTime() - Date.parse(executorCheckInAt)) / 60_000)
  if (elapsedMinutes < 2) return 'hace un momento'
  if (elapsedMinutes < 60) return 'hace ' + elapsedMinutes + ' min'
  return formatOfficeInstant(executorCheckInAt)
}
/** Texto de "dónde corre" la descarga automática (sección Automático y su ayuda). */
export const executorRunText = 'La descarga corre en el equipo elegido siempre que Fiscenix esté abierto en él, aunque nadie haya iniciado sesión o haya otra persona (también con el Host en segundo plano). Trabaja por cuenta de quien la guardó: si esa persona pierde el permiso o la asignación, se pausa.'
/** Sugerir "Descargar con RFC y CIEC": la e.firma no se puede usar o el servicio web falla desde hace 24 h. */
export function shouldSuggestPortal(schedule: SatScheduleSummary, now: Date): boolean {
  if (schedule.state === 'credentialBlocked') return true
  return schedule.webServiceFailingSince !== null && now.getTime() - Date.parse(schedule.webServiceFailingSince) >= satWebServiceFallbackHours * hourMilliseconds
}
export const portalFallbackText = 'Mientras tanto puedes usar «Descargar con RFC y CIEC» en esta misma ventana: no usa el servicio web ni la e.firma, pero pide escribir el captcha del SAT.'

export interface AutomationAttentionItem { clientId: string; clientDisplayName: string; label: string; tone: PresentationTone; detail: string }
/** Lo que requiere atención en la descarga automática, para el tablero ("Requiere atención"). */
export function listSatAutomationAttention(schedules: readonly SatScheduleSummary[], now: Date): AutomationAttentionItem[] {
  const items: AutomationAttentionItem[] = []
  for (const schedule of schedules) {
    const base = { clientId: schedule.clientId, clientDisplayName: schedule.clientDisplayName }
    if (schedule.state === 'credentialBlocked') items.push({ ...base, label: 'e.firma no utilizable', tone: 'error', detail: schedule.lastRunMessage || 'La descarga automática está detenida.' })
    else if (schedule.state === 'ownerBlocked') items.push({ ...base, label: 'Pausada: sin acceso', tone: 'error', detail: schedule.lastRunMessage || 'Quien la configuró perdió el acceso. Guárdala de nuevo.' })
    else if (isExecutorOffline(schedule, now)) items.push({ ...base, label: 'Equipo sin conexión', tone: 'warning', detail: (schedule.executorDeviceAlias ?? 'El equipo ejecutor') + ' no se reporta desde hace más de ' + satExecutorOfflineHours + ' h.' })
    else if (shouldSuggestPortal(schedule, now)) items.push({ ...base, label: 'SAT sin responder', tone: 'warning', detail: 'El servicio web falla desde hace más de ' + satWebServiceFallbackHours + ' h.' })
    else if (schedule.lastRunOutcome === 'failed') items.push({ ...base, label: 'Última descarga con falla', tone: 'error', detail: schedule.lastRunMessage })
  }
  return items
}

/** Destino de los avisos: Fiscal del cliente con el modal de descarga del SAT abierto. */
export function satDownloadTarget(clientId: string, clientDisplayName: string): NavigationTarget {
  return { section: 'fiscal', itemId: clientId, view: 'satDownloads', label: 'la descarga del SAT de ' + clientDisplayName }
}
export interface AutomationSnapshot { runSequences: ReadonlyMap<string, number>; platformChangeSequence: number }
export interface AutomationNotice { title: string; message: string; tone: 'success' | 'info' | 'warning' | 'error'; target?: NavigationTarget }
export function toAutomationSnapshot(schedules: readonly SatScheduleSummary[], platform: SatPlatformStatus): AutomationSnapshot {
  return { runSequences: new Map(schedules.map(schedule => [schedule.clientId, schedule.runSequence])), platformChangeSequence: platform.changeSequence }
}
/**
 * Avisos por cambios entre dos consultas: ejecución terminada con XML nuevos, con falla o detenida por la e.firma, y
 * apertura o cierre del corta-circuitos. Una ejecución completa sin XML nuevos no avisa. La primera consulta sólo fija
 * la base (sin `previous` no hay avisos), así abrir Fiscenix no repite avisos viejos.
 */
export function diffAutomationSnapshots(previous: AutomationSnapshot | null, schedules: readonly SatScheduleSummary[], platform: SatPlatformStatus, now: Date): AutomationNotice[] {
  if (!previous) return []
  const notices: AutomationNotice[] = []
  for (const schedule of schedules) {
    const before = previous.runSequences.get(schedule.clientId)
    if (before === undefined || schedule.runSequence <= before) continue
    const target = satDownloadTarget(schedule.clientId, schedule.clientDisplayName)
    if (schedule.lastRunOutcome === 'ownerBlocked') notices.push({ title: 'Descarga automática pausada', message: schedule.clientDisplayName + ': ' + schedule.lastRunMessage, tone: 'error', target })
    else if (schedule.lastRunOutcome === 'completed' && schedule.lastRunImportedCount > 0) notices.push({ title: 'Descarga automática del SAT', message: schedule.clientDisplayName + ': ' + schedule.lastRunImportedCount + ' XML nuevo(s) en la biblioteca del equipo ejecutor.', tone: 'success', target })
    else if (schedule.lastRunOutcome === 'failed') notices.push({ title: 'Descarga automática con falla', message: schedule.clientDisplayName + ': ' + schedule.lastRunMessage, tone: 'error', target })
    else if (schedule.lastRunOutcome === 'credentialBlocked') notices.push({ title: 'Descarga automática detenida', message: schedule.clientDisplayName + ': ' + schedule.lastRunMessage, tone: 'error', target })
  }
  if (platform.changeSequence > previous.platformChangeSequence) {
    const state = describePlatform(platform, now)
    notices.push(state.isPaused
      ? { title: 'SAT en pausa', message: state.label + '. Las descargas se reanudan solas cuando el SAT responda.', tone: 'warning' }
      : { title: 'SAT disponible', message: 'El servicio web del SAT respondió de nuevo; las descargas continúan.', tone: 'success' })
  }
  return notices
}
