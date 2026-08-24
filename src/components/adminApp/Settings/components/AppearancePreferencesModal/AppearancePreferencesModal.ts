import { useFontSize } from '@/composables/useFontSize'
import { useFontFamily } from '@/composables/useFontFamily'
import { onBeforeUnmount, watch } from 'vue'

const props = defineProps<{ visible: boolean }>()

const emit = defineEmits<{
  close: []
}>()

const {
  selectedTextScale,
  minTextScale,
  maxTextScale,
  textScaleStep,
  applyTextScale,
  decreaseTextScale,
  increaseTextScale
} = useFontSize()

const { fontFamilies, selectedFontFamily, applyFontFamily } = useFontFamily()

function updateTextScaleFromInput(event: Event): void {
  applyTextScale(Number((event.target as HTMLInputElement).value))
}

function close(): void {
  emit('close')
}

watch(
  () => props.visible,
  (visible) => document.body.classList.toggle('modal-open', visible),
  { immediate: true }
)

onBeforeUnmount(() => document.body.classList.remove('modal-open'))
