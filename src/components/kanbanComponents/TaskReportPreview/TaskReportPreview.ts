interface TaskReportPreviewProps {
  previewUrl: string
  fileName: string
  taskCount: number
}

const props = defineProps<TaskReportPreviewProps>()
const emit = defineEmits<{ close: [] }>()

function close(): void {
  emit('close')
}

function download(): void {
  const anchor = document.createElement('a')
  anchor.href = props.previewUrl
  anchor.download = props.fileName
  anchor.click()
}
