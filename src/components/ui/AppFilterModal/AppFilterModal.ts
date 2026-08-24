interface AppFilterModalProps {
  visible: boolean
  title: string
  eyebrow: string
  titleId: string
  applyLabel?: string
  resetLabel?: string
  showReset?: boolean
  layer?: 'default' | 'nested'
}

interface AppFilterModalEmits {
  close: []
  reset: []
  apply: []
}

import { nextTick, ref, watch } from 'vue'
const props = withDefaults(defineProps<AppFilterModalProps>(), {
  applyLabel: 'Aplicar filtros',
  resetLabel: 'Restablecer',
  showReset: true,
  layer: 'default'
})

defineEmits<AppFilterModalEmits>()

const modal = ref<HTMLElement | null>(null)

watch(
  () => props.visible,
  async (visible) => {
    if (!visible) return
    await nextTick()
    modal.value?.focus()
  }
)
