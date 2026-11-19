export interface LocalNote {
  noteId: string; title: string; folder: string; isPinned: boolean; isArchived: boolean
  content: Record<string, unknown>; updatedAt: string
}
export interface LocalNotes { revision: number; folders: string[]; notes: LocalNote[] }
export const localNotesChannels = { read: 'notes:readLocal', save: 'notes:saveLocal', export: 'notes:exportLocal', import: 'notes:chooseImport' } as const
/** Payload local acotado; los IDs nunca son rutas y el contenido se interpreta con un esquema de editor. */
export function parseLocalNotes(value: unknown): LocalNotes {
  if (!value || typeof value !== 'object' || JSON.stringify(value).length > 20000000) throw new Error('Invalid notes')
  const data = value as Record<string, unknown>
  if (!Number.isSafeInteger(data.revision) || Number(data.revision) < 0 || !Array.isArray(data.folders) || !Array.isArray(data.notes) || data.notes.length > maximumLocalNotes || data.folders.length > 200) throw new Error('Invalid notes')
  const folders = data.folders.map(folder => {
    if (typeof folder !== 'string' || !folder.trim() || folder.length > 120 || [...folder].some(character => character.charCodeAt(0) < 32)) throw new Error('Invalid folder')
    return folder
  })
  const notes = data.notes.map(value => {
    if (!value || typeof value !== 'object') throw new Error('Invalid note')
    const note = value as Record<string, unknown>
    if (typeof note.noteId !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(note.noteId) ||
      typeof note.title !== 'string' || !note.title.trim() || note.title.length > 200 ||
      typeof note.folder !== 'string' || !folders.includes(note.folder) ||
      typeof note.isPinned !== 'boolean' || typeof note.isArchived !== 'boolean' ||
      typeof note.updatedAt !== 'string' || !Number.isFinite(Date.parse(note.updatedAt)) ||
      !note.content || typeof note.content !== 'object' || Array.isArray(note.content) ||
      (note.content as Record<string, unknown>).type !== 'doc' || JSON.stringify(note.content).length > 5000000) throw new Error('Invalid note')
    return { noteId: note.noteId, title: note.title, folder: note.folder, isPinned: note.isPinned, isArchived: note.isArchived, updatedAt: note.updatedAt, content: note.content as Record<string, unknown> }
  })
  if (new Set(notes.map(note => note.noteId)).size !== notes.length || new Set(folders).size !== folders.length) throw new Error('Duplicate notes')
  return { revision: Number(data.revision), folders, notes }
}
/** Formato del respaldo que exporta Fiscenix; se vuelve a importar sin pérdida del documento enriquecido. */
export const notesBackupFormat = 'contapp.localNotes'
export const notesBackupVersion = 1
export const maximumNotesImportBytes = 25 * 1024 * 1024
export const maximumLocalNotes = 1000
export interface NotesBackup { format: typeof notesBackupFormat; version: typeof notesBackupVersion; exportedAt: string; folders: string[]; notes: LocalNote[] }
/**
 * Nota del sistema heredado ya normalizada. Su contenido sigue en Markdown: el Renderer lo convierte al
 * esquema del editor. `layout` y `color` del tablero anterior se descartan porque no existen aquí.
 */
export interface LegacyImportedNote { noteId: string; title: string; markdown: string; folder: string; isPinned: boolean; isArchived: boolean }
export type NotesImportFile = { kind: 'contapp'; folders: string[]; notes: LocalNote[] } | { kind: 'legacy'; notes: LegacyImportedNote[] }
export type NotesExportResult = { status: 'exported' } | { status: 'cancelled' }
export type NotesImportResult = { status: 'cancelled' } | { status: 'selected'; file: NotesImportFile }

/** Carpeta heredada (`folderPath`) aceptable como carpeta local; si no lo es se usa General. */
function toLegacyFolder(value: unknown): string {
  if (typeof value !== 'string') return 'General'
  const folder = [...value].filter(character => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127).join('').trim()
  return folder && folder.length <= 120 ? folder : 'General'
}
/**
 * Exportación JSON de despachoapp-vue (`notesFullState`): arreglo de notas con `id` numérico, `titulo`,
 * `descripcion` en Markdown, `pinned`, `status` ('canvas', 'pinned' o 'storage') y `folderPath`.
 * La identidad importada combina origen y ID (`legacy-<id>`); nunca se fusiona sólo por ID.
 */
export function parseLegacyNotesExport(value: unknown): LegacyImportedNote[] {
  if (!Array.isArray(value) || value.length > maximumLocalNotes) throw new Error('Invalid legacy notes')
  const notes = value.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Invalid legacy note')
    const note = item as Record<string, unknown>
    const id = Number(note.id)
    if (!Number.isSafeInteger(id) || id < 0) throw new Error('Invalid legacy note')
    if (typeof note.descripcion !== 'string' || note.descripcion.length > 1000000 || (note.titulo !== undefined && typeof note.titulo !== 'string')) throw new Error('Invalid legacy note')
    const title = [...String(note.titulo ?? '')].filter(character => character.charCodeAt(0) >= 32).join('').trim().slice(0, 200) || 'Nota sin título'
    return { noteId: 'legacy-' + id, title, markdown: note.descripcion, folder: toLegacyFolder(note.folderPath), isPinned: Boolean(Number(note.pinned)) || note.status === 'pinned', isArchived: note.status === 'storage' }
  })
  if (new Set(notes.map(note => note.noteId)).size !== notes.length) throw new Error('Duplicate legacy notes')
  return notes
}
/** Reconoce el archivo elegido: respaldo Fiscenix (objeto con `format`) o exportación heredada (arreglo). */
export function parseNotesImportFile(value: unknown): NotesImportFile {
  if (Array.isArray(value)) return { kind: 'legacy', notes: parseLegacyNotesExport(value) }
  if (!value || typeof value !== 'object') throw new Error('Invalid notes file')
  const data = value as Record<string, unknown>
  if (data.format !== notesBackupFormat || data.version !== notesBackupVersion) throw new Error('Unsupported notes file')
  const parsed = parseLocalNotes({ revision: 0, folders: data.folders, notes: data.notes })
  return { kind: 'contapp', folders: parsed.folders, notes: parsed.notes }
}
export function parseNotesImportResult(value: unknown): NotesImportResult {
  if (!value || typeof value !== 'object') throw new Error('Invalid notes import')
  const data = value as Record<string, unknown>
  if (data.status === 'cancelled' && Object.keys(data).length === 1) return { status: 'cancelled' }
  if (data.status !== 'selected' || Object.keys(data).length !== 2 || !data.file || typeof data.file !== 'object') throw new Error('Invalid notes import')
  const file = data.file as Record<string, unknown>
  if (file.kind === 'legacy') {
    if (!Array.isArray(file.notes) || file.notes.length > maximumLocalNotes) throw new Error('Invalid notes import')
    const notes = file.notes.map(item => {
      const note = (item ?? {}) as Record<string, unknown>
      if (typeof note.noteId !== 'string' || !/^legacy-\d{1,16}$/.test(note.noteId) || typeof note.title !== 'string' || !note.title || note.title.length > 200 ||
        typeof note.markdown !== 'string' || note.markdown.length > 1000000 || typeof note.folder !== 'string' || !note.folder || note.folder.length > 120 ||
        typeof note.isPinned !== 'boolean' || typeof note.isArchived !== 'boolean') throw new Error('Invalid notes import')
      return { noteId: note.noteId, title: note.title, markdown: note.markdown, folder: note.folder, isPinned: note.isPinned, isArchived: note.isArchived }
    })
    return { status: 'selected', file: { kind: 'legacy', notes } }
  }
  if (file.kind !== 'contapp') throw new Error('Invalid notes import')
  const parsed = parseLocalNotes({ revision: 0, folders: file.folders, notes: file.notes })
  return { status: 'selected', file: { kind: 'contapp', folders: parsed.folders, notes: parsed.notes } }
}
export function parseNotesExportResult(value: unknown): NotesExportResult {
  if (!value || typeof value !== 'object' || Object.keys(value).length !== 1) throw new Error('Invalid notes export')
  const status = (value as Record<string, unknown>).status
  if (status !== 'exported' && status !== 'cancelled') throw new Error('Invalid notes export')
  return { status }
}
