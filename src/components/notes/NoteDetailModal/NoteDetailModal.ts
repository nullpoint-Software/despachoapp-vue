interface NoteDetailModalProps {
  note: Note | null
  isVisible: boolean
}

import { computed } from 'vue'
import type { Note } from '@/composables/useNotesStore'
import { renderMarkdown } from '@/utils/markdown'

const props = defineProps<NoteDetailModalProps>()

defineEmits(['close'])

const renderedContent = computed(() => renderMarkdown(props.note?.descripcion))
