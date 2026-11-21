import type { Directive } from 'vue'
import { gsap } from 'gsap'

/**
 * Un contexto por elemento; libera tweens/listeners al desmontar y revierte al activar movimiento reducido.
 * Al presionar, las tarjetas bajan a 0.99. Los botones no se animan aquí: su gesto de presión es CSS (ADR-034).
 */
const cleanups = new WeakMap<HTMLElement, () => void>()
export const motionDirective: Directive<HTMLElement, 'interactive' | 'card' | 'reveal' | 'spin'> = {
  mounted(element, binding) {
    // La cabecera y el menú conservan su posición incluso al pulsarlos.
    if (element.closest('.application-header, .sidebar')) return
    // Brutalismo (ADR-034): los botones se hunden con CSS (:active, translate y sombra); una transformación en
    // línea de GSAP lo anularía, así que 'interactive' ya no anima.
    if (binding.value === 'interactive') return
    const media = gsap.matchMedia()
    media.add('(prefers-reduced-motion: no-preference)', () => {
      if (binding.value === 'spin') {
        const tween = gsap.to(element, { rotation: 360, duration: 1, repeat: -1, ease: 'none' })
        const updateVisibility = () => { tween.paused(document.hidden) }
        document.addEventListener('visibilitychange', updateVisibility)
        updateVisibility()
        return () => document.removeEventListener('visibilitychange', updateVisibility)
      }
      if (binding.value === 'reveal') {
        gsap.from(element, { y: 6, opacity: 0, duration: .24, ease: 'power2.out', clearProps: 'transform,opacity' })
        return
      }
      const setScale = gsap.quickTo(element, 'scale', { duration: .11, ease: 'power2.out' })
      const setY = gsap.quickTo(element, 'y', { duration: .11, ease: 'power2.out' })
      const animate = (scale: number, y: number) => {
        if (element.matches(':disabled') && (scale !== 1 || y !== 0)) return
        setScale(scale); setY(y)
      }
      const events: Array<[string, EventListener]> = [
        ['pointerenter', () => animate(1, binding.value === 'card' ? -2 : 0)], ['pointerleave', () => animate(1, 0)],
        ['pointercancel', () => animate(1, 0)],
        ['pointerdown', () => animate(binding.value === 'card' ? .99 : .96, 0)], ['pointerup', () => animate(1, 0)],
        ['focus', () => animate(1, 0)], ['blur', () => animate(1, 0)]
      ]
      events.forEach(([name, listener]) => element.addEventListener(name, listener))
      return () => events.forEach(([name, listener]) => element.removeEventListener(name, listener))
    })
    cleanups.set(element, () => media.revert())
  },
  beforeUnmount(element) { cleanups.get(element)?.(); cleanups.delete(element) }
}
