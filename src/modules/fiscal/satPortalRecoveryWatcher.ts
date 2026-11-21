import type { SatPortalCfdiViewResult } from '../../../shared/contracts/satPortalCfdi'
import type { NotifyOptions } from '../../shared/notifications/notificationStore'

/**
 * Aviso de "la descarga puede estar lista" del portal de CFDI en cualquier sección (2026-10-17,
 * [[SAT-PORTAL#Recuperación pendiente]]). Estado EPHEMERAL de la ventana.
 *
 * Mientras el SAT prepara un paquete, Main reintenta la recuperación cada hora. Si la sesión del SAT venció, Main pide
 * el captcha (`isRecoveryLogin`); este vigilante lo nota aunque el modal de Fiscal esté cerrado y avisa
 * "La descarga de <cliente> puede estar lista: escribe el captcha para recuperarla". El aviso lleva a Fiscal con el
 * modal abierto en «RFC y CIEC» (`view: 'satPortal'`), donde está el panel del captcha. Un aviso por imagen: cada hora
 * Main pide una nueva y se vuelve a avisar. Nunca escribe el captcha.
 */
const clientNames = new Map<string, string>()
/** Nombre visible del cliente de una descarga iniciada en esta ventana (la ejecución de Main sólo trae su id). */
export function rememberPortalClientName(clientId: string, displayName: string): void { clientNames.set(clientId, displayName) }

export interface SatPortalRecoveryWatcherOptions {
  canWatch(): boolean
  notify(title: string, message: string, tone: 'warning', options?: NotifyOptions): unknown
  read?: () => Promise<SatPortalCfdiViewResult>
  intervalMilliseconds?: number
}

export function startSatPortalRecoveryWatcher(options: SatPortalRecoveryWatcherOptions): { stop(): void; checkNow(): Promise<void> } {
  const read = options.read ?? (() => window.contapp.manageSatPortalCfdi({ action: 'read' }))
  let lastNoticeKey = '', isChecking = false
  async function checkNow(): Promise<void> {
    if (!options.canWatch() || isChecking) return
    isChecking = true
    try {
      const { run } = await read()
      if (!run || run.state !== 'waitingForCaptcha' || !run.isRecoveryLogin || !run.captchaImage) return
      const key = run.runId + ':' + run.captchaImage.length + ':' + run.captchaImage.slice(-24)
      if (key === lastNoticeKey) return
      lastNoticeKey = key
      const name = clientNames.get(run.clientId) ?? 'un cliente'
      options.notify('Descarga del SAT', 'La descarga de ' + name + ' puede estar lista: escribe el captcha para recuperarla.', 'warning',
        { target: { section: 'fiscal', itemId: run.clientId, view: 'satPortal', label: 'el captcha de la descarga de ' + name } })
    } catch { /* Se reintenta en la siguiente vuelta. */ }
    finally { isChecking = false }
  }
  const timer = setInterval(() => { void checkNow() }, options.intervalMilliseconds ?? 15_000)
  return { stop: () => clearInterval(timer), checkNow }
}
