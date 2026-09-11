import ThermalTicketPreview from '../ThermalTicketPreview.vue'
import { ticketTextLayout, paymentBarcodeId } from '@/utils/ticketLayout'
import AgnesConnectionNotice from '../AgnesConnectionNotice.vue'
import { ref, computed, onMounted } from 'vue'
import { getPrinterPreferences, effectivePrinterPreferences } from '@/utils/printerSettings'
import logoAsset from '@/assets/img/logsymbolblack.png'
import { printLocalTicket } from '@/utils/localTicketPrinter'

import dayjs from 'dayjs'
import advancedFormat from 'dayjs/plugin/advancedFormat'
import localizedFormat from 'dayjs/plugin/localizedFormat'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import weekday from 'dayjs/plugin/weekday'
import utc from 'dayjs/plugin/utc'
import { formatFechaHoraFullPagoSQL, formatFechaMesAnoSQL } from '@/service/adminApp/client'
import { useAppToast } from '@/composables/useAppToast'

interface MonthlyPaymentTicket {
  id?: string | number
  folio?: string | number
  cliente?: string
  asunto?: string
  atendio?: string
  honorarios?: number | string
  mes_ano: string
  fechapago: string
}

dayjs.extend(advancedFormat)
dayjs.extend(localizedFormat)
dayjs.extend(customParseFormat)
dayjs.extend(weekday)
dayjs.extend(utc)

// permite emitir 'close'
const emit = defineEmits(['close'])
const toast = useAppToast()

// estado
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
const logo = logoAsset
// props
const props = defineProps<{ ticket: MonthlyPaymentTicket }>()

// ASCII params
const barcodeValue = computed(() => paymentBarcodeId(props.ticket))
const formattedTicket = computed(() => {
  const { row, centerText, dashLine, eqLine } = ticketTextLayout(paperWidth.value)
  const t = props.ticket
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
  lines.push(row('Honorarios', '$' + t.honorarios))
  lines.push(dashLine)
  lines.push(row('Mes y Ano', formatFechaMesAnoSQL(t.mes_ano)))
  lines.push(dashLine)
  lines.push(row('Fecha pago', formatFechaHoraFullPagoSQL(t.fechapago)))
  lines.push(dashLine)
  lines.push('')
  lines.push(eqLine)
  lines.push(centerText('Fecha de impresion:'))
  const now = dayjs()
  lines.push(centerText(now.format('h:mm A, ddd MMM DD')))
  lines.push(eqLine)
  lines.push(centerText('Despacho Contable Y Fiscal Sanchez'))
  lines.push('')
  lines.push(centerText('Gracias por su preferencia'))
  lines.push(centerText(':)'))
  lines.push('')
  return lines.join('\n')
})

// imprimir
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
      title: 'Ticket de pago',
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
