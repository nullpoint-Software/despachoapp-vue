import { ref } from 'vue'
import type { LocalNotes } from '../../../shared/contracts/localNotes'
// Estado compartido sólo en el dispositivo; los borradores sobreviven al cambio de pantalla.
export const notesState = ref<LocalNotes>({ revision: 0, folders: ['General'], notes: [] })
export const isNotesLoaded = ref(false)
export const activeNoteId = ref<string | null>(null)
export const hasUnsavedNotes = ref(false)
export async function loadNotes(): Promise<void> {
  if (isNotesLoaded.value) return
  notesState.value = await window.contapp.readLocalNotes()
  isNotesLoaded.value = true
}
let isSaving = false
export async function saveNotes(): Promise<void> {
  if (isSaving) throw new Error('Save in progress')
  isSaving = true
  const snapshot = JSON.stringify(notesState.value)
  try {
    const saved = await window.contapp.saveLocalNotes(JSON.parse(snapshot))
    // No sustituir ediciones nuevas que ocurrieron durante el viaje IPC.
    const hasNewChanges = JSON.stringify(notesState.value) !== snapshot
    notesState.value.revision = saved.revision
    hasUnsavedNotes.value = hasNewChanges
  } finally { isSaving = false }
}
