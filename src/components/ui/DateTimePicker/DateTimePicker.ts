interface DateTimePickerProps {
  modelValue: Date
  showTime?: boolean
  monthOnly?: boolean
  modal?: boolean
  title?: string
}

interface DateTimePickerEmits {
  (event: 'update:modelValue', value: Date): void
}

import { computed, ref, watch } from 'vue'

const props = withDefaults(defineProps<DateTimePickerProps>(), {
  showTime: true,
  monthOnly: false,
  modal: false,
  title: 'Seleccionar fecha'
})
const emit = defineEmits<DateTimePickerEmits>()
const open = ref(false)
const draft = ref(new Date(props.modelValue))
const hours = ref(draft.value.getHours())
const minutes = ref(draft.value.getMinutes())
const seconds = ref(draft.value.getSeconds())
const months = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre'
]
const weekDays = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do']
const pad = (value: number) => String(value).padStart(2, '0')
const dateLabel = computed(
  () =>
    `${pad(props.modelValue.getDate())}/${pad(props.modelValue.getMonth() + 1)}/${props.modelValue.getFullYear()}`
)
const formattedValue = computed(() =>
  props.monthOnly
    ? `${months[props.modelValue.getMonth()]} ${props.modelValue.getFullYear()}`
    : props.showTime
      ? `${dateLabel.value} — ${pad(props.modelValue.getHours())}:${pad(props.modelValue.getMinutes())}:${pad(props.modelValue.getSeconds())}`
      : dateLabel.value
)
const monthLabel = computed(() => `${months[draft.value.getMonth()]} ${draft.value.getFullYear()}`)
const daysInMonth = computed(() =>
  new Date(draft.value.getFullYear(), draft.value.getMonth() + 1, 0).getDate()
)
const leadingBlanks = computed(() => {
  const day = new Date(draft.value.getFullYear(), draft.value.getMonth(), 1).getDay()
  return day === 0 ? 6 : day - 1
})
watch(
  () => props.modelValue,
  (value) => {
    if (!open.value) syncDraft(value)
  }
)
function syncDraft(value: Date) {
  draft.value = new Date(value)
  hours.value = draft.value.getHours()
  minutes.value = draft.value.getMinutes()
  seconds.value = draft.value.getSeconds()
}
function toggle() {
  if (!open.value) syncDraft(props.modelValue)
  open.value = !open.value
}
function changeMonth(step: number) {
  const next = new Date(draft.value)
  next.setDate(1)
  next.setMonth(next.getMonth() + step)
  draft.value = next
}
function dayLabel(day: number) {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'full' }).format(
    new Date(draft.value.getFullYear(), draft.value.getMonth(), day)
  )
}
function selectDay(day: number) {
  const next = new Date(draft.value)
  next.setDate(day)
  draft.value = next
}
function limitFor(unit: 'hours' | 'minutes' | 'seconds') {
  return unit === 'hours' ? 23 : 59
}
function valueRef(unit: 'hours' | 'minutes' | 'seconds') {
  return unit === 'hours' ? hours : unit === 'minutes' ? minutes : seconds
}
function spin(unit: 'hours' | 'minutes' | 'seconds', step: number) {
  const target = valueRef(unit),
    max = limitFor(unit)
  target.value = (Number(target.value) + step + max + 1) % (max + 1)
}
function normalize(unit: 'hours' | 'minutes' | 'seconds') {
  const target = valueRef(unit),
    max = limitFor(unit)
  target.value = Math.min(max, Math.max(0, Number(target.value) || 0))
}
function cancel() {
  syncDraft(props.modelValue)
  open.value = false
}
function apply() {
  const next = new Date(draft.value)
  if (props.monthOnly) next.setDate(1)
  if (props.showTime && !props.monthOnly)
    next.setHours(hours.value, minutes.value, seconds.value, 0)
  else next.setHours(0, 0, 0, 0)
  emit('update:modelValue', next)
  open.value = false
}
