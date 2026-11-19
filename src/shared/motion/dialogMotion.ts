import { ref, type Ref } from 'vue'

/**
 * Apertura y cierre de `<dialog>` con la transición "Modal open / close" de transitions.dev (pulido 2026-10-04):
 * - abre: `showModal()` y, en el cuadro siguiente, `.is-open` (de 0.96 a 1 con opacidad, 250 ms, curva suave);
 * - cierra: `.is-closing` (de 1 a 0.96, 150 ms, más corto que la apertura) y después `close()`.
 * `isRendered` sigue en `true` mientras dura el cierre, para que el contenido no desaparezca antes que la tarjeta.
 * Reabrir durante un cierre lo cancela. Con movimiento reducido no hay transición (regla global en base.css) y el
 * cierre ocurre sin esperar.
 */
export function useDialogMotion(dialog: Ref<HTMLDialogElement | null>, closeVariable = '--durationQuick'): { isRendered: Ref<boolean>; open(): void; close(): void } {
  const isRendered = ref(false)
  let closeTimer: ReturnType<typeof setTimeout> | undefined
  let openFrame = 0
  const closeMilliseconds = () => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 0
    return Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue(closeVariable)) || 150
  }
  function open(): void {
    const element = dialog.value
    if (!element) return
    clearTimeout(closeTimer); cancelAnimationFrame(openFrame)
    isRendered.value = true
    element.classList.remove('is-closing')
    if (!element.open) element.showModal()
    // Un cuadro después, para que el navegador pinte el estado inicial y la transición ocurra.
    openFrame = requestAnimationFrame(() => element.classList.add('is-open'))
  }
  function close(): void {
    const element = dialog.value
    cancelAnimationFrame(openFrame)
    if (!element?.open) { isRendered.value = false; return }
    element.classList.remove('is-open'); element.classList.add('is-closing')
    clearTimeout(closeTimer)
    closeTimer = setTimeout(() => {
      element.classList.remove('is-closing')
      if (element.open) element.close()
      isRendered.value = false
    }, closeMilliseconds())
  }
  return { isRendered, open, close }
}
