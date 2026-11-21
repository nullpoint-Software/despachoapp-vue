import type { Directive } from 'vue'

/**
 * `v-sliding-tabs` (pulido 2026-10-04, transitions.dev "Tabs sliding") para `.segmented-tabs`:
 * - Agrega al final del carril una píldora (`.segmented-pill`) que se mueve y cambia de tamaño hacia la opción con
 *   `aria-selected="true"` o `aria-current="page"` (250 ms, curva suave). La opción activa pierde su propio fondo.
 * - La primera posición y los cambios de tamaño se aplican sin transición, para que la píldora no entre volando.
 * - Un MutationObserver detecta el cambio de opción, aunque lo haga otro componente; un ResizeObserver la recoloca.
 * - Con carriles que se doblan en dos renglones también funciona: se usa la posición vertical de la opción.
 * Con movimiento reducido la regla global de base.css quita la transición.
 */
const cleanups = new WeakMap<HTMLElement, () => void>()

export const slidingTabsDirective: Directive<HTMLElement> = {
  mounted(element) {
    const pill = document.createElement('span')
    pill.className = 'segmented-pill'
    pill.setAttribute('aria-hidden', 'true')
    element.append(pill)
    element.classList.add('has-sliding-pill')
    let hasPosition = false, frame = 0
    const place = (target: HTMLElement) => {
      pill.style.transform = 'translate(' + target.offsetLeft + 'px, ' + target.offsetTop + 'px)'
      pill.style.width = target.offsetWidth + 'px'
      pill.style.height = target.offsetHeight + 'px'
    }
    const move = (shouldAnimate: boolean) => {
      const active = element.querySelector<HTMLElement>(':scope > [aria-selected="true"], :scope > [aria-current="page"]')
      if (!active) { pill.style.opacity = '0'; hasPosition = false; return }
      pill.style.opacity = '1'
      if (shouldAnimate && hasPosition) { place(active); return }
      pill.style.transition = 'none'
      place(active)
      void pill.offsetWidth
      pill.style.transition = ''
      hasPosition = true
    }
    const schedule = (shouldAnimate: boolean) => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => move(shouldAnimate)) }
    const mutations = new MutationObserver(() => schedule(true))
    mutations.observe(element, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-selected', 'aria-current'] })
    const resize = new ResizeObserver(() => schedule(false))
    resize.observe(element)
    schedule(false)
    cleanups.set(element, () => { cancelAnimationFrame(frame); mutations.disconnect(); resize.disconnect(); pill.remove() })
  },
  beforeUnmount(element) { cleanups.get(element)?.(); cleanups.delete(element) }
}
