interface AppEmailInputProps {
  modelValue?: string
  id?: string
  label?: string
  defaultDomain?: string
  localPlaceholder?: string
  domainPlaceholder?: string
  autocomplete?: string
  required?: boolean
  disabled?: boolean
  invalid?: boolean
  describedby?: string
  autofocus?: boolean
}

import { nextTick, onMounted, ref, watch } from 'vue'

const props = withDefaults(defineProps<AppEmailInputProps>(), {
  modelValue: '',
  id: undefined,
  label: 'Correo electrónico',
  defaultDomain: 'gmail.com',
  localPlaceholder: 'nombre.apellido',
  domainPlaceholder: 'gmail.com',
  autocomplete: 'email',
  required: false,
  disabled: false,
  invalid: false,
  describedby: undefined,
  autofocus: false
})
const emit = defineEmits<{ (event: 'update:modelValue', value: string): void }>()
const localInput = ref<HTMLInputElement | null>(null)
const localPart = ref('')
const domain = ref(props.defaultDomain)

const compact = (value: unknown) =>
  Array.from(String(value || '').trim())
    .filter((character) => character.charCodeAt(0) > 32)
    .join('')
const cleanLocal = (value: unknown) => compact(value).split('@').join('')
const cleanDomain = (value: unknown) => {
  let next = compact(value).toLowerCase().split('@').join('')
  if (next.startsWith('https://')) next = next.slice(8)
  else if (next.startsWith('http://')) next = next.slice(7)
  return next.split('/')[0]
}
function splitEmail(value: unknown) {
  const clean = compact(value)
  const separator = clean.lastIndexOf('@')
  if (separator < 0) return { local: cleanLocal(clean), domain: props.defaultDomain }
  return {
    local: cleanLocal(clean.slice(0, separator)),
    domain: cleanDomain(clean.slice(separator + 1)) || props.defaultDomain
  }
}

function syncFromModel(value: string) {
  const parsed = splitEmail(value)
  localPart.value = parsed.local
  domain.value = parsed.domain
}

function emitEmail() {
  const local = cleanLocal(localPart.value)
  const nextDomain = cleanDomain(domain.value) || props.defaultDomain
  localPart.value = local
  domain.value = nextDomain
  emit('update:modelValue', local ? local + '@' + nextDomain : '')
}

function updateLocal(event: Event) {
  const value = (event.target as HTMLInputElement).value
  if (value.includes('@')) {
    const parsed = splitEmail(value)
    localPart.value = parsed.local
    domain.value = parsed.domain
  } else {
    localPart.value = cleanLocal(value)
  }
  emitEmail()
}

function updateDomain(event: Event) {
  const value = (event.target as HTMLInputElement).value
  if (value.includes('@')) {
    const parsed = splitEmail(value)
    localPart.value = parsed.local || localPart.value
    domain.value = parsed.domain
  } else {
    domain.value = cleanDomain(value)
  }
  emitEmail()
}

function pasteEmail(event: ClipboardEvent) {
  const pasted = event.clipboardData?.getData('text')?.trim() || ''
  if (!pasted.includes('@')) return
  event.preventDefault()
  const parsed = splitEmail(pasted)
  localPart.value = parsed.local
  domain.value = parsed.domain
  emitEmail()
  localInput.value?.focus()
}

onMounted(() => {
  if (props.autofocus) nextTick(() => localInput.value?.focus())
})

watch(
  () => props.modelValue,
  (value) => {
    const current = localPart.value ? localPart.value + '@' + domain.value : ''
    if (value !== current) syncFromModel(value)
  },
  { immediate: true }
)
