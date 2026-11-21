/**
 * Carpetas contraídas del índice de Notas: comodidad visual de este equipo, no dato de negocio.
 *
 * Se guarda en `localStorage` del renderer (permitido sólo para preferencias de interfaz, AGENTS.md) bajo una
 * clave propia. Se guardan las rutas *contraídas* para que toda carpeta nueva aparezca abierta. Si el
 * almacenamiento no existe, está bloqueado o trae algo inválido, el índice simplemente arranca todo abierto:
 * nunca falla la página por esto.
 */
const collapsedFoldersStorageKey = 'contapp.notes.collapsedFolderPaths'
/** Tope defensivo para no crecer sin límite con rutas que ya no existen. */
const maximumStoredPathCount = 500

export function readCollapsedFolderPaths(): Set<string> {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(collapsedFoldersStorageKey) ?? '[]')
    return new Set(Array.isArray(parsed) ? parsed.filter((path): path is string => typeof path === 'string') : [])
  } catch {
    return new Set()
  }
}

export function saveCollapsedFolderPaths(paths: ReadonlySet<string>): void {
  try {
    window.localStorage.setItem(collapsedFoldersStorageKey, JSON.stringify([...paths].slice(0, maximumStoredPathCount)))
  } catch {
    // Sin almacenamiento disponible el estado vive sólo mientras la página esté abierta.
  }
}
