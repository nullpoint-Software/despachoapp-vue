import { ref } from 'vue'
import KanbanCardComponent from '@/components/kanbanComponents/KanbanCard/KanbanCard.vue'
import type { KanbanLane, KanbanStatus, KanbanTask } from '@/components/kanbanComponents/types'

interface KanbanColumnProps {
  lane: KanbanLane
  compact?: boolean
}

interface KanbanColumnEmits {
  (event: 'moveTask', taskId: number | string, status: KanbanStatus): void
  (event: 'selectTask', task: KanbanTask): void
}

const props = withDefaults(defineProps<KanbanColumnProps>(), { compact: false })
const emit = defineEmits<KanbanColumnEmits>()
const isDragOver = ref(false)

function handleDrop(event: DragEvent): void {
  isDragOver.value = false
  const taskId = event.dataTransfer?.getData('text/plain')
  if (!taskId) return
  const numericId = Number(taskId)
  emit('moveTask', Number.isNaN(numericId) ? taskId : numericId, props.lane.status)
}

function handleDragLeave(event: DragEvent): void {
  if (!(event.currentTarget instanceof HTMLElement)) return
  if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))
    return
  isDragOver.value = false
}
