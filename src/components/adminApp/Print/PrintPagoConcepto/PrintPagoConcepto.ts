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
const money = (value: unknown) =>
  Number(value || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
const formattedTicket = computed(() => {
  const { row, centerText, dashLine, eqLine } = ticketTextLayout(paperWidth.value)
  const t = props.payment
  const lines = [
    centerText('DESPACHO CONTABLE Y FISCAL'),
    centerText('SÁNCHEZ'),
    '',
    centerText('TICKET DE PAGO'),
    dashLine,
    row('Cliente', t.cliente),
    dashLine,
    row('Concepto', t.asunto),
    dashLine,
    row('Atendió', t.atendio),
    dashLine,
    row('Fecha', dayjs(t.fecha).format('DD/MM/YYYY HH:mm')),
    eqLine,
    row('Cobrado', money(t.cobramos), 'right'),
    row('Pagado', money(t.pagamos), 'right'),
    eqLine,
    centerText('Impreso: ' + dayjs().format('DD/MM/YYYY HH:mm')),
    '',
    centerText('Gracias por su preferencia :)')
  ]
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
