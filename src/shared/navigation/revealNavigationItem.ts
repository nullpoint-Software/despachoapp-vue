/**
 * Resaltado del elemento al que lleva un aviso (2026-10-10). Gancho mínimo en las plantillas: el renglón o tarjeta
 * lleva `data-navigation-id="<id>"`; esta función lo espera, lo desplaza a la vista, le da el foco si es enfocable y le
 * pone `.is-navigation-target` unos segundos (estilo global en base.css: marco y resplandor del acento).
 *
 * Espera porque la página suele estar cargando sus datos cuando llega la solicitud: consulta el DOM en cada cuadro
 * hasta `timeoutMilliseconds` y, si el elemento no aparece (filtrado, sin permiso, borrado), no hace nada.
 * Devuelve si lo encontró, para que la página pueda decidir otro recurso (por ejemplo, abrir su página de la lista).
 */
export const navigationHighlightMilliseconds = 2400
const highlightClassName = 'is-navigation-target'
const highlightTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>()

/** Selector seguro para un id arbitrario (UUID, folio…): escapa comillas y barras. */
export function navigationItemSelector(itemId: string): string {
  return '[data-navigation-id="' + itemId.replace(/["\\]/g, '\\$&') + '"]'
}

function waitForElement(root: ParentNode, selector: string, timeoutMilliseconds: number): Promise<HTMLElement | null> {
  const deadline = performance.now() + timeoutMilliseconds
  return new Promise(resolve => {
    const check = () => {
      const element = root.querySelector<HTMLElement>(selector)
      if (element) resolve(element)
      else if (performance.now() > deadline) resolve(null)
      else requestAnimationFrame(check)
    }
    check()
  })
}

export async function revealNavigationItem(itemId: string, options: { root?: ParentNode | null; timeoutMilliseconds?: number } = {}): Promise<boolean> {
  const element = await waitForElement(options.root ?? document, navigationItemSelector(itemId), options.timeoutMilliseconds ?? 4000)
  if (!element) return false
  const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  element.scrollIntoView({ block: 'center', behavior: isReducedMotion ? 'auto' : 'smooth' })
  // Sólo se enfoca lo que ya es enfocable: no se agregan tabindex que alteren el orden de tabulación.
  if (element.matches('a[href], button, input, select, textarea, [tabindex]')) element.focus({ preventScroll: true })
  // Reiniciar la animación si el mismo elemento se resalta dos veces seguidas.
  element.classList.remove(highlightClassName)
  void element.offsetWidth
  element.classList.add(highlightClassName)
  clearTimeout(highlightTimers.get(element))
  highlightTimers.set(element, setTimeout(() => element.classList.remove(highlightClassName), navigationHighlightMilliseconds))
  return true
}
