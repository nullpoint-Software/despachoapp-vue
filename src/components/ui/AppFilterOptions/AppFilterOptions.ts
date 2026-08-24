interface AppFilterOptionsProps {
  legend: string
  name: string
  modelValue: string | readonly string[]
  options: readonly { label: string; value: string }[]
  multiple?: boolean
}

interface AppFilterOptionsEmits {
  'update:modelValue': [value: string | string[]]
}

const props = withDefaults(defineProps<AppFilterOptionsProps>(), {
  multiple: false
})

const emit = defineEmits<AppFilterOptionsEmits>()

function isSelected(value: string) {
  return Array.isArray(props.modelValue)
    ? props.modelValue.includes(value)
    : props.modelValue === value
}

function selectOption(value: string) {
  if (!props.multiple) {
    emit('update:modelValue', value)
    return
  }

  const selectedValues = Array.isArray(props.modelValue) ? [...props.modelValue] : []
  emit(
    'update:modelValue',
    selectedValues.includes(value)
      ? selectedValues.filter((item) => item !== value)
      : [...selectedValues, value]
  )
}
