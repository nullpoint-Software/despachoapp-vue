import AgnesConnectionNotice from '../AgnesConnectionNotice.vue'
import { computed, ref } from 'vue'
import dayjs from 'dayjs'
import { printLocalTicket, ticketBarcode } from '@/utils/localTicketPrinter'
import { getPrinterPreferences } from '@/utils/printerSettings'
import logoAsset from '@/assets/img/logsymbolblack.png'
import { useAppToast } from '@/composables/useAppToast'

interface CashMovement {
  cliente?: string
  cobramos?: number | string
  pagamos?: number | string
}
interface CashCutTicketProps {
  movements: CashMovement[]
  from: Date
  to: Date
}

const logo = logoAsset
const props = defineProps<CashCutTicketProps>()
const emit = defineEmits(['close'])
const toast = useAppToast()
const paperWidth = getPrinterPreferences().paperWidth
const printing = ref(false)
const agnesConnectionRevision = ref(0)
const width = 48,
  line = '-'.repeat(width),
  doubleLine = '='.repeat(width)
const center = (text: unknown): string => {
  const value = String(text).slice(0, width)
  const left = Math.max(0, Math.floor((width - value.length) / 2))
  return ' '.repeat(left) + value
}
const amount = (value: unknown): string =>
  Number(value || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const valueRow = (label: unknown, value: unknown): string => {
  const right = String(value).slice(0, width)
  const safeLabel = String(label).slice(0, Math.max(1, width - right.length - 1))
  const available = Math.max(1, width - safeLabel.length)
  return safeLabel + ' '.repeat(Math.max(1, available - right.length)) + right
}
const netTotal = computed(() =>
  props.movements.reduce(
    (total, item) => total + Number(item.cobramos || 0) - Number(item.pagamos || 0),
    0
  )
)
const barcodeValue = computed(
  () =>
    `CORTE-${dayjs(props.from).format('YYYYMMDDHHmm')}-${dayjs(props.to).format('YYYYMMDDHHmm')}`
)
const formattedTicket = computed(() => {
  const rows = [
    line,
    center('CORTE DE CAJA'),
    line,
    `INICIO: ${dayjs(props.from).format('DD/MM/YYYY HH:mm:ss')}`,
    `FIN:    ${dayjs(props.to).format('DD/MM/YYYY HH:mm:ss')}`,
    doubleLine
  ]
  props.movements.forEach((item, index) => {
    rows.push(
      `${String(index + 1).padStart(2, '0')} ${String(item.cliente || 'Sin cliente').slice(0, width - 3)}`
    )
    if (Number(item.cobramos || 0) !== 0)
      rows.push(valueRow('  COBRO (+)', `+$${amount(item.cobramos)}`))
    if (Number(item.pagamos || 0) !== 0)
      rows.push(valueRow('  PAGO  (-)', `-$${amount(item.pagamos)}`))
    rows.push(line)
  })
  if (!props.movements.length) rows.push(center('SIN MOVIMIENTOS'), line)
  rows.push(
    valueRow('TOTAL NETO', `${netTotal.value < 0 ? '-' : '+'}$${amount(Math.abs(netTotal.value))}`),
    doubleLine,
    center(`IMPRESO ${dayjs().format('DD/MM/YYYY HH:mm')}`),
    '',
    ''
  )
  return rows.join('\n')
})
async function doPrint() {
  if (printing.value) return
  printing.value = true
  try {
    await printLocalTicket({
      title: 'Corte de caja',
      text: formattedTicket.value,
      logo,
      barcode: barcodeValue.value
    })
    toast.add({
      severity: 'success',
      summary: 'Ticket enviado',
      detail: 'El agente envió el ticket a la cola de impresión.',
      life: 3500
    })
  } catch (error) {
    agnesConnectionRevision.value++
    toast.add({
      severity: 'error',
      summary: 'No se pudo enviar el ticket',
      detail: error instanceof Error ? error.message : String(error),
      life: 6000
    })
  } finally {
    printing.value = false
  }
}

const barcodeImage = computed(() => {
  try {
    return (
      'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(ticketBarcode(barcodeValue.value))
    )
  } catch {
    return ''
  }
})
