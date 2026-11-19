import type { LocalNote } from '../../../shared/contracts/localNotes'

/** Vista del directorio: todas, ancladas, archivadas o una carpeta por su nombre. */
export type NotesView = 'all' | 'pinned' | 'archive' | string
/** Nombres que una carpeta no puede usar porque identifican vistas del directorio. */
export const reservedViewNames = ['all', 'pinned', 'archive']
/** Tipo propio del arrastre de filas, para no aceptar texto o archivos soltados desde fuera. */
export const noteDragType = 'application/x-contapp-note'

/**
 * Notas de una vista, filtradas por la búsqueda sobre título, texto y carpeta (como el original).
 * Ancladas primero y después la más reciente.
 */
export function filterNotes(notes: LocalNote[], view: NotesView, query: string, readText: (note: LocalNote) => string): LocalNote[] {
  const search = query.trim().toLocaleLowerCase()
  return notes.filter(note =>
    (view === 'archive' ? note.isArchived : !note.isArchived) &&
    (view === 'all' || view === 'archive' || (view === 'pinned' ? note.isPinned : note.folder === view)) &&
    (!search || (note.title + ' ' + readText(note) + ' ' + note.folder).toLocaleLowerCase().includes(search))
  ).sort((left, right) => Number(right.isPinned) - Number(left.isPinned) || right.updatedAt.localeCompare(left.updatedAt))
}

/** Título de la vista para la ruta del directorio. */
export function describeView(view: NotesView): string {
  if (view === 'all') return 'Todas'
  if (view === 'pinned') return 'Ancladas'
  if (view === 'archive') return 'Archivadas'
  return view
}
