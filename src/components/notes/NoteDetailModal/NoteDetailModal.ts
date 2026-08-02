interface NoteDetailModalProps {
  note: Note | null;
  isVisible: boolean;
}

import { ref, watchEffect } from 'vue';
import { marked } from 'marked';
import type { Note } from '@/composables/useNotesStore';

const props = defineProps<NoteDetailModalProps>();

defineEmits(['close']);

const renderedContent = ref('');

watchEffect(async () => {
  if (props.note?.descripcion) {
    renderedContent.value = await marked(props.note.descripcion);
  } else {
    renderedContent.value = '';
  }
});
