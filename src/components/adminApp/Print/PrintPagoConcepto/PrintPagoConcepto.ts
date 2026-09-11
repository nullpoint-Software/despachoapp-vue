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

const barcodeValue = computed(() => paymentBarcodeId(props.payment))
const formattedTicket = computed(() => {
  const { row, centerText, dashLine, eqLine } = ticketTextLayout(paperWidth.value)
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
    const current = (await effectivePrinterPreferences(getPrinterPreferences())).paperWidth
    if (current !== paperWidth.value) {
      paperWidth.value = current
      throw new Error(
        'El ancho de papel cambió. Revisa la vista previa actualizada y vuelve a imprimir.'
      )
    }
    await printLocalTicket({
      paperWidth: paperWidth.value,
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
