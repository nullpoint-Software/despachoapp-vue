import Button from '@/components/ui/AppButton/AppButton.vue'
import ThermalTicketPreview from '../ThermalTicketPreview.vue'
import { ticketTextLayout, paymentBarcodeId } from '@/utils/ticketLayout'
import AgnesConnectionNotice from '../AgnesConnectionNotice.vue'
import { ref, computed, onMounted } from 'vue'
import { getPrinterPreferences, effectivePrinterPreferences } from '@/utils/printerSettings'
import logoAsset from '@/assets/img/logsymbolblack.png'
import { printLocalTicket } from '@/utils/localTicketPrinter'

import dayjs from 'dayjs'
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
const money = (value: unknown) =>
  Number(value || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
const formattedTicket = computed(() => {
  const { row, centerText, dashLine, eqLine } = ticketTextLayout(paperWidth.value)
  const t = props.ticket
  const lines = [
    centerText('DESPACHO CONTABLE Y FISCAL'),
    centerText('SÁNCHEZ'),
    '',
    centerText('PAGO DE MENSUALIDAD'),
    dashLine,
    row('Cliente', t.cliente),
    dashLine,
    row('Concepto', t.asunto),
    dashLine,
    row('Atendió', t.atendio),
    dashLine,
    row('Periodo', dayjs(t.mes_ano).format('MM/YYYY')),
    dashLine,
    row('Fecha pago', dayjs(t.fechapago).format('DD/MM/YYYY HH:mm')),
    eqLine,
    row('Honorarios', money(t.honorarios), 'right'),
    eqLine,
    centerText('Impreso: ' + dayjs().format('DD/MM/YYYY HH:mm')),
    '',
    centerText('Gracias por su preferencia :)')
  ]
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
