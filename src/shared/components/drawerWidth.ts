/**
 * Ancho de los cajones laterales (SideDrawer) redimensionables con el ratón o el teclado (2026-10-10, pedido del
 * usuario: "los drawer poder redimensionarlos con el mouse").
 *
 * - Límites: al menos `minimumDrawerWidthPixels` y como máximo el menor entre el 90 % de la ventana y
 *   `maximumDrawerWidthPixels`. En ventanas muy angostas el mínimo cede ante el máximo (nunca más ancho que la ventana).
 * - El ancho elegido se recuerda por cajón en `localStorage` (preferencia LOCAL de comodidad, no dato de negocio). Todo
 *   acceso va en try/catch: sin almacenamiento disponible el cajón funciona con su ancho por omisión.
 */
/** 480 px (antes 360; 2026-10-10, "el tamaño mínimo un poquito más grande"): tablas y formularios siguen legibles. */
export const minimumDrawerWidthPixels = 480
export const maximumDrawerWidthPixels = 1400
export const maximumDrawerViewportRatio = 0.9
/** Paso del teclado (flechas); con Shift se multiplica. */
export const drawerKeyboardStepPixels = 32
export const drawerKeyboardLargeStepMultiplier = 3
const storagePrefix = 'contapp.drawerWidth.'

export interface DrawerWidthBounds { minimumWidth: number; maximumWidth: number }

/** Límites vigentes para una ventana de `viewportWidth` píxeles. */
export function computeDrawerWidthBounds(viewportWidth: number): DrawerWidthBounds {
  const maximumWidth = Math.max(0, Math.floor(Math.min(viewportWidth * maximumDrawerViewportRatio, maximumDrawerWidthPixels)))
  return { minimumWidth: Math.min(minimumDrawerWidthPixels, maximumWidth), maximumWidth }
}

/** Ajusta un ancho a los límites de la ventana y lo redondea a píxeles enteros. */
export function clampDrawerWidth(width: number, viewportWidth: number): number {
  const { minimumWidth, maximumWidth } = computeDrawerWidthBounds(viewportWidth)
  if (!Number.isFinite(width)) return maximumWidth
  return Math.round(Math.min(maximumWidth, Math.max(minimumWidth, width)))
}

/** Ancho guardado para `drawerKey`, o `null` si no hay uno válido (o no hay almacenamiento). */
export function readStoredDrawerWidth(drawerKey: string): number | null {
  try {
    const storedValue = window.localStorage.getItem(storagePrefix + drawerKey)
    const width = storedValue === null ? Number.NaN : Number(storedValue)
    return Number.isFinite(width) && width > 0 ? width : null
  } catch { return null }
}

/** Guarda (o, con `null`, olvida) el ancho de `drawerKey`. Un fallo del almacenamiento se ignora. */
export function storeDrawerWidth(drawerKey: string, width: number | null): void {
  try {
    if (width === null) window.localStorage.removeItem(storagePrefix + drawerKey)
    else window.localStorage.setItem(storagePrefix + drawerKey, String(Math.round(width)))
  } catch { /* Sin almacenamiento: el ancho dura sólo mientras el cajón está abierto. */ }
}
