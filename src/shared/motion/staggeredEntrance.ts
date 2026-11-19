import { nextTick } from 'vue'
import { gsap } from 'gsap'

/**
 * Entrada escalonada compartida para filas, tarjetas y bloques de una vista (ver 15-DESIGN-GUIDELINES:
 * entradas de 240 ms y movimiento reducido).
 *
 * - Cada `play` espera al render, revierte la entrada anterior y anima sólo los elementos que coinciden
 *   con `selector` dentro del contenedor, nunca fuera de él. El contenedor se pide con una función porque
 *   puede aparecer en ese mismo render (por ejemplo, la lista tras la primera carga).
 * - Con `prefers-reduced-motion: reduce` no se anima nada: `gsap.matchMedia` no ejecuta el bloque y
 *   revierte el que estuviera activo si el sistema cambia de preferencia.
 * - `clearProps` devuelve los estilos al terminar: la vista en reposo no conserva transformaciones.
 * - Las filas de tabla (`isTableRow`) sólo cambian de opacidad, porque transformar un `<tr>` descuadra
 *   las columnas.
 */
export interface StaggeredEntranceOptions {
  selector: string
  isTableRow?: boolean
  distancePixels?: number
  staggerSeconds?: number
}

export class StaggeredEntrance {
  private media: gsap.MatchMedia | undefined
  constructor(private readonly options: StaggeredEntranceOptions) {}

  async play(readScope: () => HTMLElement | null): Promise<void> {
    await nextTick()
    const scope = readScope()
    this.media?.revert()
    this.media = undefined
    if (!scope) return
    const { selector, isTableRow = false, distancePixels = 8, staggerSeconds = .03 } = this.options
    this.media = gsap.matchMedia()
    this.media.add('(prefers-reduced-motion: no-preference)', () => {
      const elements = scope.querySelectorAll(selector)
      if (!elements.length) return
      gsap.from(elements, isTableRow
        ? { autoAlpha: 0, duration: .2, stagger: staggerSeconds, ease: 'power2.out', clearProps: 'opacity,visibility' }
        : { y: distancePixels, autoAlpha: 0, duration: .24, stagger: staggerSeconds, ease: 'power2.out', clearProps: 'transform,opacity,visibility' })
    })
  }

  /** Detiene la entrada en curso; se llama al desmontar la vista. */
  dispose(): void { this.media?.revert(); this.media = undefined }
}
