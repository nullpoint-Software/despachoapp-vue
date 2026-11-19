import { nextTick, onBeforeUnmount, ref, watch, type Ref } from 'vue'

/**
 * Lista desplegable en la capa superior (2026-10-10 en `SearchSelectField`; compartida desde 2026-10-20 con
 * `AutocompleteField` y `RecipientChipsField`, pedido del usuario: dentro de un modal la lista ensanchaba el área con
 * desplazamiento y aparecía una barra).
 *
 * El menú es un `popover="manual"`: el navegador lo dibuja encima de todo, también de un `<dialog>` modal, sin salir del
 * DOM del campo (el foco y `aria-controls` siguen igual), así que ya no cuenta para el desplazamiento del modal. Se
 * coloca con `position: fixed` bajo el campo (o arriba si abajo no cabe) y su alto se ajusta al espacio libre de la
 * ventana (`--menuListHeight`). Se recoloca al desplazar o redimensionar mientras está abierto.
 * El CSS común está en `base.css` (`.autocomplete-menu[popover]`).
 */
const menuGapPixels = 4, viewportMarginPixels = 12, preferredListHeightPixels = 420, minimumListHeightPixels = 160

export function usePopoverMenu(control: Ref<HTMLElement | null>, menu: Ref<HTMLElement | null>, isOpen: Readonly<Ref<boolean>>): { menuStyle: Ref<Record<string, string>> } {
  const menuStyle = ref<Record<string, string>>({})
  function placeMenu(): void {
    const box = control.value?.getBoundingClientRect()
    if (!box) return
    const spaceBelow = window.innerHeight - box.bottom - viewportMarginPixels, spaceAbove = box.top - viewportMarginPixels
    const isBelow = spaceBelow >= Math.min(preferredListHeightPixels, 260) || spaceBelow >= spaceAbove
    // 48 px para la ayuda de teclado al pie del menú.
    const listHeight = Math.max(minimumListHeightPixels, Math.min(preferredListHeightPixels, (isBelow ? spaceBelow : spaceAbove) - menuGapPixels - 48))
    menuStyle.value = {
      left: Math.max(viewportMarginPixels, box.left) + 'px',
      width: Math.min(box.width, window.innerWidth - viewportMarginPixels * 2) + 'px',
      ...(isBelow ? { top: box.bottom + menuGapPixels + 'px' } : { bottom: window.innerHeight - box.top + menuGapPixels + 'px' }),
      '--menuListHeight': listHeight + 'px'
    }
  }
  function onViewportChange(): void { if (isOpen.value) placeMenu() }
  function stopListening(): void { window.removeEventListener('resize', onViewportChange); window.removeEventListener('scroll', onViewportChange, true) }
  watch(isOpen, async isMenuOpen => {
    if (!isMenuOpen) { stopListening(); return }
    placeMenu()
    await nextTick()
    try { if (menu.value && !menu.value.matches(':popover-open')) menu.value.showPopover() } catch { /* sin Popover API: queda en su lugar */ }
    window.addEventListener('resize', onViewportChange)
    window.addEventListener('scroll', onViewportChange, true)
  })
  onBeforeUnmount(stopListening)
  return { menuStyle }
}

/**
 * Tab entre sugerencias (2026-10-20, pedido del usuario): con la lista abierta y después de escribir o recorrer con
 * flechas, Tab pasa a la siguiente sugerencia y Mayús+Tab a la anterior. En la última (o la primera) Tab sale del campo
 * como siempre, así que el teclado nunca queda atrapado; tampoco al sólo pasar por el campo sin escribir.
 * Devuelve el nuevo índice activo, o `null` si Tab debe seguir su camino normal.
 */
export function moveWithTab(event: KeyboardEvent, activeIndex: number, optionCount: number, isNavigating: boolean): number | null {
  if (!isNavigating || !optionCount) return null
  const nextIndex = activeIndex + (event.shiftKey ? -1 : 1)
  if (nextIndex < 0 || nextIndex >= optionCount) return null
  event.preventDefault()
  return nextIndex
}
