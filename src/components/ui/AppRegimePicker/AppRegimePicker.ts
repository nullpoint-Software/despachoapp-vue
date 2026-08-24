import { computed, ref, useId, watch } from 'vue'
import AppFilterModal from '@/components/ui/AppFilterModal/AppFilterModal.vue'
import AppFilterOptions from '@/components/ui/AppFilterOptions/AppFilterOptions.vue'

interface RegimeOption {
  label: string
  value: string
}

interface AppRegimePickerProps {
  modelValue?: string | readonly string[] | null
  options: readonly RegimeOption[]
  id?: string
  placeholder?: string
  title?: string
  eyebrow?: string
  disabled?: boolean
  required?: boolean
  invalid?: boolean
  describedby?: string
  emptyValue?: string
  resetLabel?: string
  applyLabel?: string
  legend?: string
  multiple?: boolean
  layer?: 'default' | 'nested'
}

interface AppRegimePickerEmits {
  'update:modelValue': [value: string | string[]]
}

const props = withDefaults(defineProps<AppRegimePickerProps>(), {
  modelValue: '',
  placeholder: 'Selecciona el régimen',
  title: 'Seleccionar régimen fiscal',
  eyebrow: 'RÉGIMEN FISCAL / SELECCIÓN',
  disabled: false,
  required: false,
  invalid: false,
  describedby: undefined,
  emptyValue: '',
  resetLabel: 'Quitar selección',
  applyLabel: 'Seleccionar régimen',
  legend: 'Elige una opción',
  multiple: false,
  layer: 'default'
})
const emit = defineEmits<AppRegimePickerEmits>()

const generatedId = useId()
const visible = ref(false)
const draftValue = ref<string | string[]>(currentValue())
const controlId = computed(() => props.id || `regime-picker-${generatedId}`)
const titleId = computed(() => `${controlId.value}-title`)
const selectedValues = computed(() => (Array.isArray(props.modelValue) ? props.modelValue : []))
const selectedOption = computed(() =>
  props.multiple ? undefined : props.options.find((option) => option.value === props.modelValue)
)
const hasSelection = computed(() =>
  props.multiple ? selectedValues.value.length > 0 : Boolean(selectedOption.value)
)
const selectedLabel = computed(() => {
  if (!props.multiple) return selectedOption.value?.label || props.placeholder
  if (!selectedValues.value.length) return props.placeholder
  if (selectedValues.value.length === 1) {
    return (
      props.options.find((option) => option.value === selectedValues.value[0])?.label ||
      selectedValues.value[0]
    )
  }
  return `${selectedValues.value.length} regímenes seleccionados`
})
const selectionCaption = computed(() =>
  props.multiple
    ? 'Selección actual'
    : selectedOption.value
      ? 'Régimen seleccionado'
      : 'Selecciona una opción'
)

function currentValue(): string | string[] {
  if (props.multiple) {
    return Array.isArray(props.modelValue) ? [...props.modelValue] : []
  }
  return Array.isArray(props.modelValue)
    ? String(props.modelValue[0] || props.emptyValue)
    : String(props.modelValue || props.emptyValue)
}

watch(
  () => props.modelValue,
  () => {
    if (!visible.value) draftValue.value = currentValue()
  },
  { deep: true }
)

function openPicker() {
  if (props.disabled) return
  draftValue.value = currentValue()
  visible.value = true
}

function closePicker() {
  visible.value = false
}

function resetPicker() {
  draftValue.value = props.multiple ? [] : props.emptyValue
}

function applyPicker() {
  emit(
    'update:modelValue',
    Array.isArray(draftValue.value) ? [...draftValue.value] : draftValue.value
  )
  closePicker()
}
