import { maximumLocalNotes, type LegacyImportedNote, type LocalNote, type LocalNotes, type NotesImportFile } from '../../../shared/contracts/localNotes'

export interface NotesImportSummary { added: number; skipped: number; copied: number }
type DocumentContent = Record<string, unknown>

const copySuffix = ' (importada)'
function copyTitle(title: string): string { return title.slice(0, 200 - copySuffix.length) + copySuffix }
/**
 * Misma nota: misma carpeta y documento, con el mismo título o con el de su copia importada. Así
 * reimportar un respaldo, incluso con conflictos ya resueltos como copia, no crea duplicados.
 */
function isSameNote(existing: LocalNote, incoming: LocalNote): boolean {
  return (existing.title === incoming.title || existing.title === copyTitle(incoming.title)) && existing.folder === incoming.folder && JSON.stringify(existing.content) === JSON.stringify(incoming.content)
}

/**
 * Fusión sin pérdida (decisión de 5.1): nunca borra ni sobrescribe notas del equipo.
 * - Idéntica a una existente: se omite.
 * - Con un `noteId` ya usado por otra nota distinta: se agrega como copia con identificador nuevo y
 *   el título termina en "(importada)".
 * - Nueva: se agrega tal cual, con sus marcas de fijada y archivada.
 * Las carpetas nuevas se agregan. Superar el máximo de notas rechaza toda la importación.
 */
export function mergeImportedNotes(current: LocalNotes, incoming: { folders: string[]; notes: LocalNote[] }, createId: () => string = () => crypto.randomUUID()): { next: LocalNotes; summary: NotesImportSummary } {
  const notes = [...current.notes]
  const folders = [...current.folders]
  const summary: NotesImportSummary = { added: 0, skipped: 0, copied: 0 }
  for (const folder of incoming.folders) if (!folders.includes(folder)) folders.push(folder)
  for (const note of incoming.notes) {
    if (!folders.includes(note.folder)) folders.push(note.folder)
    if (notes.some(existing => isSameNote(existing, note))) { summary.skipped++; continue }
    if (notes.some(existing => existing.noteId === note.noteId)) {
      notes.push({ ...note, noteId: createId(), title: copyTitle(note.title) }); summary.copied++
    } else { notes.push({ ...note }); summary.added++ }
  }
  if (notes.length > maximumLocalNotes) throw new Error('Too many notes')
  if (folders.length > 200) throw new Error('Too many folders')
  return { next: { revision: current.revision, folders, notes }, summary }
}

/**
 * Convierte notas heredadas (Markdown) al documento del editor. `toDocument` usa el mismo esquema del
 * editor para que el resultado sea editable; se inyecta para probar la fusión sin DOM.
 */
export function convertLegacyNotes(notes: LegacyImportedNote[], toDocument: (markdown: string) => DocumentContent, now = new Date()): LocalNote[] {
  return notes.map(note => ({ noteId: note.noteId, title: note.title, folder: note.folder, isPinned: note.isPinned, isArchived: note.isArchived, updatedAt: now.toISOString(), content: toDocument(note.markdown) }))
}

export function toIncomingNotes(file: NotesImportFile, toDocument: (markdown: string) => DocumentContent): { folders: string[]; notes: LocalNote[] } {
  if (file.kind === 'contapp') return { folders: file.folders, notes: file.notes }
  const notes = convertLegacyNotes(file.notes, toDocument)
  return { folders: [...new Set(notes.map(note => note.folder))], notes }
}
