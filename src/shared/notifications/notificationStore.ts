import { readonly, ref } from 'vue'
import type { NavigationTarget } from '../navigation/navigationRequests'
/**
 * `target` (2026-10-10): destino opcional del aviso. Si existe, el aviso se puede activar (clic o Enter) y lleva a esa
 * sección y elemento mediante `requestNavigation` (ver `NotificationRegion` y [[TOASTS-DRAWERS-BUTTONS]]).
 * `action` (2026-10-17, pedido del usuario: "en la notificación toast, que se pueda descargar con un botón"): botón
 * propio del aviso (por ejemplo «Descargar» la opinión o la CSF recién obtenidas). Ejecuta `run` y cierra el aviso.
 */
export interface NotificationAction { label: string; run: () => void | Promise<void> }
export interface Notification { notificationId: number; title: string; message: string; tone: 'success' | 'info' | 'warning' | 'error'; target?: NavigationTarget; action?: NotificationAction }
export interface NotifyOptions { target?: NavigationTarget; action?: NotificationAction }
const notifications = ref<Notification[]>([])
let nextNotificationId = 0
/** Avisos temporales visibles a la vez, contando el nuevo; los errores no cuentan y nunca se descartan solos. */
const maximumTransientNotificationCount = 3
/** Estado EPHEMERAL: deduplicar avisos; los errores sólo se retiran por cierre explícito. */
export function useNotifications() {
  function dismiss(notificationId: number): void { notifications.value = notifications.value.filter(item => item.notificationId !== notificationId) }
  /**
   * Publica un aviso y devuelve su id para que quien lo emitió pueda retirarlo cuando deje de ser cierto
   * (por ejemplo, "Sesión terminada" al volver a entrar). Si ya existe uno idéntico, devuelve el existente.
   * Al llegar al límite se retiran los temporales más antiguos para no tapar el contenido con una pila.
   * `options.target` hace que el aviso lleve a su elemento al activarlo; el destino se copia (sin proxies).
   */
  function notify(title: string, message: string, tone: Notification['tone'] = 'info', options: NotifyOptions = {}): number {
    const existing = notifications.value.find(item => item.title === title && item.message === message)
    if (existing) return existing.notificationId
    const transients = notifications.value.filter(item => item.tone !== 'error')
    const retainedTransients = new Set(transients.slice(Math.max(0, transients.length - (maximumTransientNotificationCount - 1))))
    const notification: Notification = { notificationId: ++nextNotificationId, title, message, tone, ...(options.target ? { target: { ...options.target } } : {}), ...(options.action ? { action: options.action } : {}) }
    notifications.value = [...notifications.value.filter(item => item.tone === 'error' || retainedTransients.has(item)), notification]
    return notification.notificationId
  }
  return { notifications: readonly(notifications), notify, dismiss }
}
