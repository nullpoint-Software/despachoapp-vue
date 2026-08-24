interface PinnedNotesWindowEmits {
  (event: 'open-notes'): void
}

import { computed, ref } from 'vue'
import { useDraggable } from '@vueuse/core'
import { useNotesStore } from '@/composables/useNotesStore'

const emit = defineEmits<PinnedNotesWindowEmits>()
const {
  pinnedNotes: storedPinnedNotes,
  isPinnedWindowVisible,
  togglePinnedWindow,
  updateNote
} = useNotesStore()
const floatingWindow = ref<HTMLElement | null>(null)
const dragHandle = ref<HTMLElement | null>(null)
const searchQuery = ref('')
const updatingId = ref<number | null>(null)
const initialPosition = {
  x: typeof window !== 'undefined' && window.innerWidth < 640 ? 12 : 40,
  y: typeof window !== 'undefined' && window.innerWidth < 640 ? 76 : 104
}
const { style } = useDraggable(floatingWindow, {
  initialValue: initialPosition,
  handle: dragHandle,
  preventDefault: true
})
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-MX')
const notePreview = (value: string) => {
  const plain = value
    .replace(/```[\s\S]*?```/g, ' bloque de código ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_`~\[\]()!-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return plain.length > 170 ? `${plain.slice(0, 167).trim()}...` : plain || 'Sin contenido'
}
const pinnedNoteHighlights = (value: string) => {
  const highlighted = [...value.matchAll(/<u\b[^>]*>([\s\S]*?)<\/u>/gi)]
    .map((match) => notePreview(match[1] || ''))
    .filter((text) => text !== 'Sin contenido')
  return highlighted.length ? highlighted : ['Sin texto resaltado']
}
const pinnedNotes = storedPinnedNotes
const filteredNotes = computed(() => {
  const term = normalize(searchQuery.value.trim())
  const matches = term
    ? storedPinnedNotes.value.filter((note) =>
        normalize(`${note.titulo} ${note.descripcion} ${note.folderPath || ''}`).includes(term)
      )
    : storedPinnedNotes.value
  return matches.map((note) => ({ ...note, highlights: pinnedNoteHighlights(note.descripcion) }))
})
async function unpinNote(noteId: number) {
  updatingId.value = noteId
  try {
    await updateNote(noteId, { pinned: false })
  } finally {
    updatingId.value = null
  }
}
function openNotesBoard() {
  togglePinnedWindow()
  emit('open-notes')
}
