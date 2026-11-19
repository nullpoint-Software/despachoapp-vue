import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

/**
 * Mide el ancho y alto en píxeles de un elemento y los mantiene al día con `ResizeObserver`.
 *
 * Lo usan las gráficas SVG del tablero (bento, 2026-10-06): su `viewBox` se iguala al tamaño medido, así una unidad
 * del SVG es un píxel de pantalla y los rótulos de 12 px se ven a 12 px en cualquier mosaico. Antes el `viewBox`
 * era fijo (640 de ancho) y en un mosaico angosto los rótulos se encogían a ~8 px.
 *
 * Mientras no hay medida (primer pintado, pruebas sin layout) devuelve los valores de respaldo.
 */
export function useMeasuredSize(element: Ref<HTMLElement | null>, fallbackWidth: number, fallbackHeight: number) {
  const width = ref(fallbackWidth), height = ref(fallbackHeight)
  let observer: ResizeObserver | null = null

  function applySize(measuredWidth: number, measuredHeight: number): void {
    // Se redondea para no repintar por fracciones de píxel; un cero (elemento oculto) conserva la medida anterior.
    if (measuredWidth > 0) width.value = Math.round(measuredWidth)
    if (measuredHeight > 0) height.value = Math.round(measuredHeight)
  }

  onMounted(() => {
    const target = element.value
    if (!target) return
    applySize(target.clientWidth, target.clientHeight)
    if (typeof ResizeObserver === 'undefined') return
    observer = new ResizeObserver(entries => { const box = entries[0]?.contentRect; if (box) applySize(box.width, box.height) })
    observer.observe(target)
  })
  onBeforeUnmount(() => { observer?.disconnect(); observer = null })

  return { width, height }
}
