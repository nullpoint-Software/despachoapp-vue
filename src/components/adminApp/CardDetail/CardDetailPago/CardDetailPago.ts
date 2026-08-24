import { ref, watch } from 'vue'

interface PaymentDetail {
  id: string
  nombreCompleto: string
  asunto: string
  atendio: string
  cobramos: string
  pagamos: string
  saldo: string
}

type MoneyField = 'cobramos' | 'pagamos' | 'saldo'
const props = defineProps({
  pago: {
    type: Object,
    default: () => ({
      id: '',
      nombreCompleto: '',
      asunto: '',
      atendio: '',
      cobramos: '',
      pagamos: '',
      saldo: ''
    })
  },
  usuario: {
    type: Object,
    default: () => ({
      id: '',
      nombre: '',
      foto: ''
    })
  }
})
const emit = defineEmits(['close', 'save'])

const pago = ref<PaymentDetail>({ ...props.pago } as PaymentDetail)
const errors = ref({
  nombreCompleto: '',
  asunto: '',
  atendio: '',
  cobramos: '',
  pagamos: '',
  saldo: ''
})

watch(
  () => props.pago,
  (newVal) => {
    pago.value = { ...newVal } as PaymentDetail
    errors.value = {
      nombreCompleto: '',
      asunto: '',
      atendio: '',
      cobramos: '',
      pagamos: '',
      saldo: ''
    }
  }
)

/* VALIDACIÓN */
const validate = () => {
  let valid = true
  errors.value = {
    nombreCompleto: '',
    asunto: '',
    atendio: '',
    cobramos: '',
    pagamos: '',
    saldo: ''
  }

  if (!pago.value.nombreCompleto.trim()) {
    errors.value.nombreCompleto = 'El nombre completo es obligatorio.'
    valid = false
  }
  if (!pago.value.asunto.trim()) {
    errors.value.asunto = 'El asunto o trámite es obligatorio.'
    valid = false
  }
  if (!pago.value.atendio.trim()) {
    errors.value.atendio = "El campo 'quien atendió' es obligatorio."
    valid = false
  }
  if (!pago.value.cobramos.trim()) {
    errors.value.cobramos = 'El monto cobrado es obligatorio.'
    valid = false
  }
  if (!pago.value.pagamos.trim()) {
    errors.value.pagamos = 'El monto pagado es obligatorio.'
    valid = false
  }
  if (!pago.value.saldo.trim()) {
    errors.value.saldo = 'El saldo es obligatorio.'
    valid = false
  }
  return valid
}

/* FORMATEO DE MONTO (SOLO NÚMEROS Y DECIMALES) */
const onMoneyInput = (field: MoneyField): void => {
  pago.value[field] = pago.value[field].replace(/[^0-9.]/g, '')
  const parts = pago.value[field].split('.')
  if (parts.length > 2) {
    pago.value[field] = parts[0] + '.' + parts.slice(1).join('')
  }
}

const onMoneyBlur = (field: MoneyField): void => {
  const num = parseFloat(pago.value[field])
  if (!isNaN(num)) {
    // Formatea con separador de miles y hasta 2 decimales
    pago.value[field] = num.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    })
  }
}

/* AGREGA EL SIGNO DE $ SOLO AL INICIO (SI NO EXISTE) */
const addDollarPrefix = (value: string): string => {
  if (typeof value === 'string' && !value.startsWith('$')) {
    return '$' + value
  }
  return value
}

/* CIERRE DEL MODAL */
const close = () => {
  emit('close')
}

/* GUARDAR */
const save = () => {
  if (validate()) {
    // Al guardar, se asegura que los campos monetarios tengan $ al inicio
    pago.value.cobramos = addDollarPrefix(pago.value.cobramos)
    pago.value.pagamos = addDollarPrefix(pago.value.pagamos)
    pago.value.saldo = addDollarPrefix(pago.value.saldo)
    emit('save', { ...pago.value })
  }
}
