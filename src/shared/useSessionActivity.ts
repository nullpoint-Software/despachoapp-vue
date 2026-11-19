import { onMounted, onBeforeUnmount } from 'vue'
/** Señalar interacción sin transmitir teclas, contenido ni rutas; máximo una solicitud por minuto. */
export function useSessionActivity(): void {
  let lastAttemptAt = 0
  const report = (event: Event): void => {
    if (!event.isTrusted || Date.now() - lastAttemptAt < 60000) return
    lastAttemptAt = Date.now()
    void window.contapp.manageSession('activity').catch(() => { /* No bloquear trabajo LOCAL por indisponibilidad. */ })
  }
  onMounted(() => { window.addEventListener('pointerdown', report); window.addEventListener('keydown', report) })
  onBeforeUnmount(() => { window.removeEventListener('pointerdown', report); window.removeEventListener('keydown', report) })
}
