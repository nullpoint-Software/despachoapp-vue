import type { InjectionKey, Ref } from 'vue'

/**
 * Contrato entre `NoteFolderTree` (dueño del estado del árbol) y cada `NoteFolderNode` recursivo.
 * El árbol lo provee una vez; así los nodos no reenvían eventos nivel por nivel. Los nodos sólo leen el
 * estado y llaman intenciones: abrir/cerrar, elegir, enfocar, soltar una nota o quitar una carpeta.
 */
export interface NoteFolderTreeContext {
  /** Vista elegida en el directorio (la ruta de la carpeta cuando es una carpeta). */
  selectedView: Readonly<Ref<string>>
  /** Nodo con `tabindex="0"` (tabindex itinerante del patrón tree de WAI-ARIA). */
  focusedPath: Readonly<Ref<string>>
  /** Carpeta sobre la que se está arrastrando una nota. */
  dropTargetPath: Readonly<Ref<string | null>>
  isExpanded: (path: string) => boolean
  toggleFolder: (path: string) => void
  selectFolder: (path: string) => void
  registerItemElement: (path: string, element: HTMLElement | null) => void
  allowNoteDrop: (event: DragEvent, path: string) => void
  leaveNoteDrop: (path: string) => void
  dropNote: (event: DragEvent, path: string) => void
  deleteFolder: (path: string) => void
  /** Clic derecho en un renglón (2026-10-10): pide el menú contextual de la carpeta en (`x`, `y`) de la ventana. */
  openFolderMenu: (path: string, x: number, y: number) => void
}

export const noteFolderTreeContextKey: InjectionKey<NoteFolderTreeContext> = Symbol('noteFolderTreeContext')

/** Ruta legible (`A / B`) para títulos y nombres accesibles. */
export function formatFolderPath(path: string): string {
  return path.replaceAll('/', ' / ')
}

/** "1 documento" / "N documentos" para nombres accesibles. */
export function describeDocumentCount(count: number): string {
  return count === 1 ? '1 documento' : count + ' documentos'
}
