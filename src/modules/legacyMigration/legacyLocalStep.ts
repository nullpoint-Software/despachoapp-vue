import type { LegacyLocalOutcome } from '../../../shared/contracts/legacyMigration'
import type { LegacyImportedNote } from '../../../shared/contracts/localNotes'
import { markdownToDocument } from '../notes/markdownDocument'
import { convertLegacyNotes, mergeImportedNotes, type NotesImportSummary } from '../notes/notesImport'
import { hasUnsavedNotes, loadNotes, notesState, saveNotes } from '../notes/notesState'

/**
 * Parte del paso LOCAL de la migración que vive en el Renderer: fusionar las notas heredadas en la biblioteca de este
 * equipo (las CIEC ya las guardó Main). La fusión es idempotente: una nota idéntica (título, carpeta y contenido) se
 * omite, así que repetir `execute` y "Reintentar lo local" no la duplica.
 * Igual que la importación de Notas: con una nota sin guardar no se fusiona (para no mezclar cambios) y si el guardado
 * falla el estado vuelve a lo que había.
 */
export async function mergeLegacyNotes(notes: LegacyImportedNote[]): Promise<NotesImportSummary> {
  await loadNotes()
  if (!notes.length) return { added: 0, skipped: 0, copied: 0 }
  if (hasUnsavedNotes.value) throw new Error('Unsaved notes')
  const previous = JSON.stringify(notesState.value)
  const converted = convertLegacyNotes(notes, markdownToDocument)
  try {
    const { next, summary } = mergeImportedNotes(notesState.value, { folders: [...new Set(converted.map(note => note.folder))], notes: converted })
    notesState.value = next; hasUnsavedNotes.value = true
    await saveNotes()
    return summary
  } catch (error) {
    notesState.value = JSON.parse(previous); hasUnsavedNotes.value = false
    throw error
  }
}

export interface LegacyLocalStepResult { local: LegacyLocalOutcome; notesSummary: NotesImportSummary | null; notesError: string }

/** Fusiona las notas devueltas por `executed`/`localRetried`; un fallo de notas no oculta el resultado de las CIEC. */
export async function completeLegacyLocalStep(local: LegacyLocalOutcome, notes: LegacyImportedNote[]): Promise<LegacyLocalStepResult> {
  try { return { local, notesSummary: await mergeLegacyNotes(notes), notesError: '' } }
  catch (error) {
    const notesError = error instanceof Error && error.message === 'Unsaved notes'
      ? 'Hay una nota sin guardar en Notas. Guárdala y usa «Reintentar lo local».'
      : 'No se pudieron guardar las notas en este equipo. Usa «Reintentar lo local».'
    return { local, notesSummary: null, notesError }
  }
}

/**
 * "Reintentar lo local": Main sólo lee el archivo elegido en esta sesión, así que sin ruta (por ejemplo tras reiniciar)
 * primero se abre el diálogo. Resuelve `null` si la persona cancela el diálogo.
 */
export async function retryLegacyLocalStep(dumpPath: string | null): Promise<{ dumpPath: string; result: LegacyLocalStepResult } | null> {
  let path = dumpPath
  if (!path) {
    const chosen = await window.contapp.runLegacyMigration({ action: 'chooseDump' })
    if (chosen.status !== 'dump' || !chosen.dumpPath) return null
    path = chosen.dumpPath
  }
  const retried = await window.contapp.runLegacyMigration({ action: 'retryLocal', dumpPath: path })
  if (retried.status !== 'localRetried') throw new Error('Unexpected legacy migration result')
  return { dumpPath: path, result: await completeLegacyLocalStep(retried.local, retried.notes) }
}
