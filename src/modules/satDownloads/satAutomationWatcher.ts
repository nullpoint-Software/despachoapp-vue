import type { SatDownloadResult } from '../../../shared/contracts/satDownloads'
import type { NotifyOptions } from '../../shared/notifications/notificationStore'
import { diffAutomationSnapshots, toAutomationSnapshot, type AutomationNotice, type AutomationSnapshot } from './satAutomationPresentation'

/**
 * Avisos de la descarga automática del SAT en cualquier sección (2026-10-11). Estado EPHEMERAL de la ventana.
 *
 * Flujo:
 * 1. Cada `intervalMilliseconds` (1 min), si `canWatch()` (sesión en el despacho con `sat.download`), consulta al Host
 *    `listAutomation`: las programaciones de los clientes asignados y el estado del corta-circuitos.
 * 2. La primera respuesta sólo fija la base; las siguientes se comparan con `diffAutomationSnapshots`.
 * 3. Cada cambio se publica con `notify`; los avisos de cliente llevan a Fiscal con el modal de descarga abierto.
 * Sin permiso o sin sesión se olvida la base, para no avisar de lo ocurrido mientras tanto como si fuera nuevo.
 * Un fallo de red se ignora: se reintenta en la siguiente vuelta.
 */
export interface SatAutomationWatcherOptions {
  canWatch(): boolean
  notify(title: string, message: string, tone: AutomationNotice['tone'], options?: NotifyOptions): unknown
  listAutomation?: () => Promise<SatDownloadResult>
  intervalMilliseconds?: number
  now?: () => Date
}

export function startSatAutomationWatcher(options: SatAutomationWatcherOptions): { stop(): void; checkNow(): Promise<void> } {
  const listAutomation = options.listAutomation ?? (() => window.contapp.manageSatDownloads({ action: 'listAutomation' }))
  let baseline: AutomationSnapshot | null = null, isChecking = false
  async function checkNow(): Promise<void> {
    if (!options.canWatch()) { baseline = null; return }
    if (isChecking) return
    isChecking = true
    try {
      const result = await listAutomation()
      if (result.status !== 'automation' || !options.canWatch()) return
      for (const notice of diffAutomationSnapshots(baseline, result.schedules, result.platform, options.now?.() ?? new Date())) {
        options.notify(notice.title, notice.message, notice.tone, notice.target ? { target: notice.target } : {})
      }
      baseline = toAutomationSnapshot(result.schedules, result.platform)
    } catch { /* Sin Host o sin permiso momentáneo: se reintenta en la siguiente vuelta. */ }
    finally { isChecking = false }
  }
  const timer = setInterval(() => { void checkNow() }, options.intervalMilliseconds ?? 60_000)
  return { stop: () => clearInterval(timer), checkNow }
}
