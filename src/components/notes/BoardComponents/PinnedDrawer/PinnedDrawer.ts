interface PinnedDrawerProps {
  notes: NoteType[]
  searchQuery?: string
  open?: boolean
}

interface PinnedDrawerEmits {
  (e: 'close'): void
  (e: 'open-note', note: NoteType): void
  (e: 'toggle-pin', id: number): void
  (e: 'delete-note', note: NoteType): void
  (e: 'store-note', id: number): void
}

import type { Note as NoteType } from '@/composables/useNotesStore'
const props = defineProps<PinnedDrawerProps>()
const emit = defineEmits<PinnedDrawerEmits>()
