import { ref, watch } from 'vue'

export type BackgroundMotionState = 'running' | 'paused' | 'static' | 'unavailable'
interface BackgroundMotionOptions {
  /** Preferencia "Pausar fondo animado". */
  isPaused: () => boolean
  /** Intervalo mínimo entre cuadros: acota el costo de CPU/GPU (~24 fps Dither, ~20 fps patrones Canvas 2D). */
  frameIntervalMilliseconds: number
  /** Falso si el lienzo no se pudo crear (p. ej. sin WebGL): se publica `unavailable` y no se dibuja. */
  isAvailable: () => boolean
  render: (timeMilliseconds: number) => void
  /** Cambio de tema (`data-theme`) o de color principal (tokens en línea, atributo `style`) en <html>: releer tokens y redibujar. */
  onAppearanceChange: () => void
}

/**
 * Ciclo de animación compartido por los fondos de la mesa (ADR-025 y ADR-039): un solo lugar decide cuándo se mueven.
 * - Corre sólo si la preferencia no lo pausa, la ventana está visible y el sistema no pide movimiento reducido; si no,
 *   queda el último cuadro fijo (`paused`, o `static` con movimiento reducido).
 * - `motionState` se publica en `data-motion` para las pruebas de escritorio.
 * `start()` va en `onMounted` (después de crear el lienzo) y `stop()` en `onBeforeUnmount`.
 */
export function useBackgroundMotion(options: BackgroundMotionOptions) {
  const motionState = ref<BackgroundMotionState>('static')
  let frameRequest = 0
  let lastFrameTime = 0
  let reducedMotionQuery: MediaQueryList | null = null
  let appearanceObserver: MutationObserver | null = null

  function shouldAnimate(): boolean { return !options.isPaused() && !document.hidden && !reducedMotionQuery?.matches }
  function loop(time: number): void {
    frameRequest = requestAnimationFrame(loop)
    // Sin foco (otra ventana encima) se saltan cuadros sin cambiar `motionState`: costo cero mientras el usuario está en otra app.
    if (time - lastFrameTime < options.frameIntervalMilliseconds || !document.hasFocus()) return
    lastFrameTime = time
    options.render(time)
  }
  /** Redibuja el cuadro vigente sin avanzar el tiempo (al redimensionar, cambiar de tema o pausar). */
  function renderStill(): void { if (options.isAvailable()) options.render(lastFrameTime) }
  function syncMotion(): void {
    if (!options.isAvailable()) { motionState.value = 'unavailable'; return }
    cancelAnimationFrame(frameRequest)
    if (shouldAnimate()) { motionState.value = 'running'; frameRequest = requestAnimationFrame(loop) }
    else { motionState.value = reducedMotionQuery?.matches ? 'static' : 'paused'; renderStill() }
  }
  function onAppearanceChange(): void { if (options.isAvailable()) options.onAppearanceChange() }
  function start(): void {
    reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    reducedMotionQuery.addEventListener('change', syncMotion)
    document.addEventListener('visibilitychange', syncMotion)
    appearanceObserver = new MutationObserver(onAppearanceChange)
    appearanceObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style'] })
    syncMotion()
  }
  function stop(): void {
    cancelAnimationFrame(frameRequest)
    reducedMotionQuery?.removeEventListener('change', syncMotion)
    document.removeEventListener('visibilitychange', syncMotion)
    appearanceObserver?.disconnect()
  }
  watch(options.isPaused, syncMotion)
  return { motionState, start, stop, renderStill }
}

/** Valor de un token de color de <html> (hexadecimal en base.css), con respaldo si todavía no hay estilos. */
export function readColorToken(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}
