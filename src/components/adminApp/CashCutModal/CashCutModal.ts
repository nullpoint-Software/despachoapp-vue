interface CashCutModalEmits {
  close: []
}

import { computed, onMounted, ref } from 'vue'
import { ps } from '@/service/adminApp/client'
const emit = defineEmits<CashCutModalEmits>()
const now = new Date()
const start = new Date(now)
start.setHours(0, 0, 0, 0)
const from = ref<Date>(start),
  to = ref<Date>(now),
  payments = ref<any[]>([]),
  loading = ref(true),
  loadError = ref(''),
  printerVisible = ref(false),
  periodVisible = ref(false)
const error = computed(
  () =>
    loadError.value ||
    (from.value > to.value ? 'La hora inicial debe ser anterior a la hora final.' : '')
)
function asDate(value: any) {
  if (value instanceof Date) return value
  const normalized = String(value || '').replace(' ', 'T')
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}
const filtered = computed(() =>
  payments.value.filter((item) => {
    const date = asDate(item.fecha)
    return date && date >= from.value && date <= to.value
  })
)
const totalCollected = computed(() =>
  filtered.value.reduce((sum, item) => sum + Number(item.cobramos || 0), 0)
)
const totalPaid = computed(() =>
  filtered.value.reduce((sum, item) => sum + Number(item.pagamos || 0), 0)
)
const money = (value: any) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value || 0))
const formatPeriod = (value: Date) =>
  new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'medium' }).format(value)
function applyPeriod(startDate: Date, endDate: Date) {
  from.value = startDate
  to.value = endDate
  periodVisible.value = false
}
onMounted(async () => {
  try {
    const data = await ps.getPagoConcepto()
    payments.value = Array.isArray(data) ? data : []
  } catch (e) {
    console.error(e)
    loadError.value = 'No se pudieron cargar los movimientos.'
  } finally {
    loading.value = false
  }
})
