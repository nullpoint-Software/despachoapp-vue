import AgnesConnectionNotice from '../AgnesConnectionNotice.vue'
import { ref, computed } from 'vue'
import { getPrinterPreferences } from '@/utils/printerSettings'
import logoAsset from '@/assets/img/logsymbolblack.png'
import { printLocalTicket, ticketBarcode } from '@/utils/localTicketPrinter'

import dayjs from 'dayjs'
import advancedFormat from 'dayjs/plugin/advancedFormat'
import localizedFormat from 'dayjs/plugin/localizedFormat'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import weekday from 'dayjs/plugin/weekday'
import utc from 'dayjs/plugin/utc'
import { formatFechaHoraFullPagoSQL } from '@/service/adminApp/client'
import { useAppToast } from '@/composables/useAppToast'

interface ConceptPaymentTicket {
  id?: string | number
  pago_id?: string | number
  folio?: string | number
  cliente?: string
  asunto?: string
  atendio?: string
  cobramos?: number | string
  pagamos?: number | string
  fecha: string
}

dayjs.extend(advancedFormat)
dayjs.extend(localizedFormat)
dayjs.extend(customParseFormat)
dayjs.extend(weekday)
dayjs.extend(utc)
const emit = defineEmits(['close'])
const toast = useAppToast()
const props = defineProps<{ payment: ConceptPaymentTicket }>()

const paperWidth = getPrinterPreferences().paperWidth
const printing = ref(false)
const agnesConnectionRevision = ref(0)
const logo = logoAsset

const totalWidth = 48
const leftCol = 14
const rightCol = totalWidth - 7 - leftCol
const dashLine = '-'.repeat(totalWidth)
const eqLine = '='.repeat(totalWidth)
const barcodeValue = computed(() => {
  const id = props.payment?.id ?? props.payment?.pago_id ?? props.payment?.folio
  if (id) return String(id)
  return `PAGO-${dayjs(props.payment?.fecha || new Date()).format('YYYYMMDDHHmmss')}`
})

function centerText(txt: unknown): string {
  const value = String(txt).slice(0, totalWidth)
  const pad = Math.max(0, Math.floor((totalWidth - value.length) / 2))
  return ' '.repeat(pad) + value + ' '.repeat(Math.max(0, totalWidth - value.length - pad))
}

function wrapText(text: unknown, width: number): string[] {
  const lines: string[] = []
  let rem = String(text ?? '')
  while (rem.length > width) {
    lines.push(rem.slice(0, width))
    rem = rem.slice(width)
  }
  lines.push(rem)
  return lines
}

function row(label: unknown, val: unknown): string {
  const lab = String(label).padEnd(leftCol).slice(0, leftCol)
  const vals = wrapText(String(val), rightCol)
  const first = `| ${lab} | ${vals[0].padEnd(rightCol)} |`
  const rest = vals
    .slice(1)
    .map((l: string) => `| ${' '.repeat(leftCol)} | ${l.padEnd(rightCol)} |`)
  return [first, ...rest].join('\n')
}

const formattedTicket = computed(() => {
  const t = props.payment
  const lines = []
  lines.push(dashLine)
  lines.push(centerText('Ticket de Pago'))
  lines.push(dashLine)
  lines.push(row('Cliente', t.cliente))
  lines.push(dashLine)
  lines.push(row('Asunto', t.asunto))
  lines.push(dashLine)
  lines.push(row('Atendio', t.atendio))
  lines.push(dashLine)
  lines.push(row('Cobramos', '$' + t.cobramos))
  lines.push(dashLine)
  lines.push(row('Pagamos', '$' + t.pagamos))
  lines.push(dashLine)
  lines.push(row('Fecha', formatFechaHoraFullPagoSQL(t.fecha)))
  lines.push(dashLine)
  lines.push(eqLine)
  lines.push(centerText('Fecha de impresion:'))
  lines.push(centerText(dayjs().format('h:mm A, ddd MMM DD')))
  lines.push(eqLine)
  lines.push(centerText('Despacho Contable Y Fiscal Sanchez'))
  lines.push('')
  lines.push(centerText('Gracias por su preferencia'))
  lines.push(centerText(':)'))
  lines.push('')
  return lines.join('\n')
})

async function doPrint() {
  if (printing.value) return
  printing.value = true
  try {
    await printLocalTicket({
      title: 'Detalle de pago',
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
