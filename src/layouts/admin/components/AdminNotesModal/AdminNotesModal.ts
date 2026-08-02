interface AdminNotesModalProps { visible: boolean }

interface AdminNotesModalEmits { close: [] }

import { Suspense } from "vue";
defineProps<AdminNotesModalProps>();
const emit = defineEmits<AdminNotesModalEmits>();
