import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { cs, ps, us, formatFechaHoraFullSQL } from '@/service/adminApp/client'
import { loadProgressively } from '@/service/adminApp/progressiveLoader'

interface CardDetailPagoConceptoProps {
  pago?: Payment
  usuario?: Payment
}
interface CardDetailPagoConceptoEmits {
  close: []
  save: [payment: Payment]
}
interface Payment {
  [key: string]: any
}
type PaymentStep = 1 | 2 | 3

const props = withDefaults(defineProps<CardDetailPagoConceptoProps>(), {
  pago: () => ({}),
  usuario: () => ({})
})
const emit = defineEmits<CardDetailPagoConceptoEmits>()
const payment = ref<Payment>({
  id_cliente: '',
  asunto: '',
  id_atendio: localStorage.getItem('userid') || props.usuario.id || '',
  cobramos: 0,
  pagamos: 0,
  ...props.pago
})
const selectedDate = ref<Date>(toDate(payment.value.fecha))
const clientes = ref<Payment[]>([])
const employees = ref<Payment[]>([])
const clientSearch = ref(String(payment.value.cliente || ''))
const employeeSearch = ref(String(payment.value.atendio || props.usuario.nombre || ''))
const loadingOptions = ref(true)
const loadError = ref('')
const saveError = ref('')
const saving = ref(false)
const errors = ref<Record<string, string>>({})
const currentStep = ref<PaymentStep>(1)
const paymentHelpOpen = ref(false)

const paymentSteps: Array<{
  index: PaymentStep
  eyebrow: string
  label: string
  description: string
}> = [
  {
    index: 1,
    eyebrow: '01',
    label: 'Relación',
    description: 'Selecciona el cliente, el concepto y quién atendió el movimiento.'
  },
  {
    index: 2,
    eyebrow: '02',
    label: 'Movimiento',
    description: 'Captura los importes y la fecha real del movimiento.'
  },
  {
    index: 3,
    eyebrow: '03',
    label: 'Confirmación',
    description: 'Revisa el resumen antes de guardar el pago.'
  }
]
const stepDescription = computed(
  () => paymentSteps[currentStep.value - 1]?.description || 'Completa el registro del pago.'
)
const paymentTutorialSteps = [
  {
    target: '.payment-steps',
    eyebrow: 'Ayuda / pagos',
    title: 'Avanza por partes',
    body: 'El registro se divide en relación, movimiento y confirmación. Los pasos completados permanecen disponibles para corregir información.'
  },
  {
    target: '.payment-step-shell',
    eyebrow: 'Ayuda / pagos',
    title: 'Completa sólo lo visible',
    body: 'Cada pantalla reúne campos relacionados. Los mensajes debajo de cada campo indican qué falta antes de continuar.'
  },
  {
    target: '.payment-step-shell .app-field-help__trigger',
    eyebrow: 'Ayuda / campos',
    title: 'Usa los signos de pregunta',
    body: 'Pulsa ? junto al nombre de cualquier campo para conocer su propósito y qué información debes capturar.'
  },
  {
    target: '.payment-form .modal-actions',
    eyebrow: 'Ayuda / navegación',
    title: 'Revisa antes de guardar',
    body: 'Usa Anterior y Continuar para moverte. El sistema sólo guarda cuando confirmas el último paso.'
  }
]

const subjectSuggestions = [
  'Pago de honorarios del mes de',
  'Cuota IMSS del mes de',
  'Préstamo de',
  'Impresión de',
  'Cita SAT',
  'Impuestos',
  'Declaración mensual',
  'Pago provisional',
  'Trámite ante el SAT',
  'Renovación de e.firma'
]

const normalize = (value: unknown) =>
  String(value || '')
    .trim()
    .toLocaleLowerCase('es-MX')
const clientLabel = (client: Payment) =>
  `${client.nombre || 'Sin nombre'}${client.rfc ? ` - ${client.rfc}` : ''}`
const employeeLabel = (employee: Payment) =>
  `${employee.nombre || 'Sin nombre'}${employee.username ? ` - ${employee.username}` : ''}`
const clientOptions = computed(() => clientes.value.map(clientLabel))
const employeeOptions = computed(() => employees.value.map(employeeLabel))
const reviewClient = computed(
  () =>
    clientes.value.find((item) => String(item.id_cliente) === String(payment.value.id_cliente))
      ?.nombre ||
    clientSearch.value ||
    'Sin cliente'
)
const reviewEmployee = computed(
  () =>
    employees.value.find((item) => String(item.id_usuario) === String(payment.value.id_atendio))
      ?.nombre ||
    employeeSearch.value ||
    'Sin responsable'
)
const netAmount = computed(
  () => (Number(payment.value.cobramos) || 0) - (Number(payment.value.pagamos) || 0)
)
const formattedSelectedDate = computed(() =>
  new Intl.DateTimeFormat('es-MX', { dateStyle: 'long', timeStyle: 'short' }).format(
    selectedDate.value
  )
)

function currency(value: unknown): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(
    Number(value) || 0
  )
}

function findClient(value: string) {
  const term = normalize(value)
  return clientes.value.find(
    (item) =>
      normalize(clientLabel(item)) === term ||
      normalize(item.nombre) === term ||
      normalize(item.rfc) === term
  )
}
function findEmployee(value: string) {
  const term = normalize(value)
  return employees.value.find(
    (item) =>
      normalize(employeeLabel(item)) === term ||
      normalize(item.nombre) === term ||
      normalize(item.username) === term
  )
}
function onClientInput(value: string) {
  payment.value.id_cliente = findClient(value)?.id_cliente || ''
  if (payment.value.id_cliente) delete errors.value.cliente
}
function onEmployeeInput(value: string) {
  payment.value.id_atendio = findEmployee(value)?.id_usuario || ''
  if (payment.value.id_atendio) delete errors.value.atendio
}

function toDate(value?: unknown): Date {
  if (!value) return new Date()
  const date = value instanceof Date ? value : new Date(String(value).replace(' ', 'T'))
  return Number.isNaN(date.getTime()) ? new Date() : date
}

function close() {
  if (!saving.value) emit('close')
}
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && !paymentHelpOpen.value) close()
}

onMounted(async () => {
  document.addEventListener('keydown', onKeydown)
  document.body.classList.add('modal-open')
  const [clientResult, employeeResult] = await Promise.allSettled([
    loadProgressively<Payment>({
      pageSize: 40,
      fetchPage: async (page) => (await cs.getClientes(page)) as Payment[],
      onUpdate: (items) => {
        clientes.value = items
      }
    }),
    us.getUsuarios()
  ])
  if (employeeResult.status === 'fulfilled')
    employees.value = Array.isArray(employeeResult.value) ? (employeeResult.value as Payment[]) : []
  const selectedClient = clientes.value.find(
    (item) => String(item.id_cliente) === String(payment.value.id_cliente)
  )
  const selectedEmployee = employees.value.find(
    (item) => String(item.id_usuario) === String(payment.value.id_atendio)
  )
  if (selectedClient) clientSearch.value = clientLabel(selectedClient)
  if (selectedEmployee) employeeSearch.value = employeeLabel(selectedEmployee)
  if (!clientes.value.length || !employees.value.length)
    loadError.value =
      'No fue posible cargar todos los catálogos. Revisa la conexión e inténtalo de nuevo.'
  loadingOptions.value = false
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.classList.remove('modal-open')
})

function errorsForStep(step: PaymentStep): Record<string, string> {
  const next: Record<string, string> = {}
  if (step === 1) {
    if (!payment.value.id_cliente) next.cliente = 'Selecciona un cliente.'
    if (!String(payment.value.asunto || '').trim()) next.asunto = 'Escribe el asunto.'
    if (!payment.value.id_atendio) next.atendio = 'Selecciona quién atendió.'
  }
  if (step === 2) {
    if (
      payment.value.cobramos === '' ||
      payment.value.cobramos == null ||
      Number(payment.value.cobramos) < 0
    )
      next.cobramos = 'Indica un monto válido.'
    if (
      payment.value.pagamos === '' ||
      payment.value.pagamos == null ||
      Number(payment.value.pagamos) < 0
    )
      next.pagamos = 'Indica un monto válido.'
    if (!selectedDate.value || Number.isNaN(selectedDate.value.getTime()))
      next.fecha = 'Selecciona fecha y hora.'
  }
  return next
}

async function validateStep(step: PaymentStep): Promise<boolean> {
  const keys =
    step === 1
      ? ['cliente', 'asunto', 'atendio']
      : step === 2
        ? ['cobramos', 'pagamos', 'fecha']
        : []
  const retained = Object.fromEntries(
    Object.entries(errors.value).filter(([key]) => !keys.includes(key))
  )
  const next = errorsForStep(step)
  errors.value = { ...retained, ...next }
  if (Object.keys(next).length) {
    await nextTick()
    ;(document.querySelector('[aria-invalid="true"]') as HTMLElement | null)?.focus()
    return false
  }
  return true
}

async function nextStep(): Promise<void> {
  if (currentStep.value < 3 && (await validateStep(currentStep.value)))
    currentStep.value = (currentStep.value + 1) as PaymentStep
}

function previousStep(): void {
  if (currentStep.value > 1) currentStep.value = (currentStep.value - 1) as PaymentStep
}

function goToStep(step: PaymentStep): void {
  if (step <= currentStep.value) currentStep.value = step
}

async function validateAll(): Promise<boolean> {
  const first = errorsForStep(1)
  const second = errorsForStep(2)
  errors.value = { ...first, ...second }
  if (!Object.keys(errors.value).length) return true
  currentStep.value = Object.keys(first).length ? 1 : 2
  await nextTick()
  ;(document.querySelector('[aria-invalid="true"]') as HTMLElement | null)?.focus()
  return false
}

async function save(): Promise<void> {
  saveError.value = ''
  if (!(await validateAll())) return
  const client = clientes.value.find(
    (item) => String(item.id_cliente) === String(payment.value.id_cliente)
  )
  const employee = employees.value.find(
    (item) => String(item.id_usuario) === String(payment.value.id_atendio)
  )
  if (!client || !employee) {
    saveError.value = 'La selección ya no es válida. Actualiza los catálogos e inténtalo de nuevo.'
    currentStep.value = 1
    return
  }
  const payload: Payment = {
    ...payment.value,
    cliente: client.nombre,
    atendio: employee.nombre,
    cobramos: Number(payment.value.cobramos),
    pagamos: Number(payment.value.pagamos),
    fecha: formatFechaHoraFullSQL(selectedDate.value.toISOString())
  }
  saving.value = true
  try {
    if (payload.id) await ps.updatePagoConcepto(payload.id, payload)
    else {
      payload.id = `C-${new Date().toLocaleString('sv-SE').replace('T', '').replace(/[-: ]/g, '')}`
      payload.isnew = true
      await ps.addPagoConcepto(payload)
    }
    emit('save', payload)
  } catch (error) {
    console.error('No se pudo guardar el pago', error)
    saveError.value = 'No se pudo guardar el pago. Verifica la conexión y vuelve a intentar.'
  } finally {
    saving.value = false
  }
}
