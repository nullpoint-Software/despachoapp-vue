const SURFACE_SELECTOR = [
  '[role="dialog"][aria-modal="true"]',
  '.notes-frame',
  '.notes-modal-frame',
  '.ticket-printer-modal',
  '.thermal-modal'
].join(',')
const FALLBACK_SURFACE_SELECTOR =
  '[class*="modal"]:not([class*="overlay"]), [class*="dialog"]:not([class*="overlay"]), [class*="drawer"], [class*="frame"], [class*="panel"]'

function isVisible(element: HTMLElement) {
  const style = window.getComputedStyle(element)
  return (
    style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0
  )
}

function stackingLevel(element: HTMLElement) {
  let level = 0
  let current: HTMLElement | null = element
  while (current) {
    const value = Number.parseInt(window.getComputedStyle(current).zIndex, 10)
    if (Number.isFinite(value)) level = Math.max(level, value)
    current = current.parentElement
  }
  return level
}

function topModalSurface() {
  const semanticSurfaces = [...document.querySelectorAll<HTMLElement>(SURFACE_SELECTOR)]
  const overlaySurfaces = [...document.querySelectorAll<HTMLElement>('[class*="overlay"]')]
    .map((overlay) =>
      overlay.querySelector<HTMLElement>(`${SURFACE_SELECTOR}, ${FALLBACK_SURFACE_SELECTOR}`)
    )
    .filter((surface): surface is HTMLElement => Boolean(surface))
  const ordered = [...new Set([...semanticSurfaces, ...overlaySurfaces])]
    .filter(isVisible)
    .map((element, index) => ({ element, index, level: stackingLevel(element) }))
    .sort((left, right) => left.level - right.level || left.index - right.index)
  return ordered.length ? ordered[ordered.length - 1].element : null
}

function closeTopModal(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  const surface = topModalSurface()
  if (!surface) return
  const container = surface.closest('[class*="overlay"]') || surface
  const closeButton = container.querySelector<HTMLButtonElement>(
    [
      '[data-modal-close]',
      'button[aria-label*="cerrar" i]',
      '.standard-modal-close',
      '.notes-close',
      '.notes-modal-close'
    ].join(',')
  )
  if (!closeButton || closeButton.disabled) return
  event.preventDefault()
  event.stopImmediatePropagation()
  closeButton.click()
}

let installed = false

export function installModalInteractions() {
  if (installed || typeof document === 'undefined') return
  installed = true
  window.addEventListener('keydown', closeTopModal, true)
}
