import ThermalTicketPreview from '../ThermalTicketPreview.vue'
import { ticketTextLayout } from '@/utils/ticketLayout'
import AgnesConnectionNotice from '../AgnesConnectionNotice.vue'
import { computed, ref, onMounted } from 'vue'
import dayjs from 'dayjs'
import { printLocalTicket } from '@/utils/localTicketPrinter'
import { getPrinterPreferences, effectivePrinterPreferences } from '@/utils/printerSettings'
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
const paperWidth = ref(getPrinterPreferences().paperWidth)
onMounted(async () => {
  try {
    paperWidth.value = (await effectivePrinterPreferences(getPrinterPreferences())).paperWidth
  } catch {
    /* Connection notice provides setup actions. */
  }
})
const printing = ref(false)
const agnesConnectionRevision = ref(0)
const amount = (value: unknown): string =>
  Number(value || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const valueRow = (label: unknown, value: unknown): string => {
  const width = ticketTextLayout(paperWidth.value).width
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
  const {
    width,
    dashLine: line,
    eqLine: doubleLine,
    centerText: center
  } = ticketTextLayout(paperWidth.value)
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
    const current = (await effectivePrinterPreferences(getPrinterPreferences())).paperWidth
    if (current !== paperWidth.value) {
      paperWidth.value = current
      throw new Error(
        'El ancho de papel cambió. Revisa la vista previa actualizada y vuelve a imprimir.'
      )
    }
    await printLocalTicket({
      paperWidth: paperWidth.value,
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
