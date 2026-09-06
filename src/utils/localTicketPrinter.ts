import JsBarcode from 'jsbarcode'
import {
  getPrinterPreferences,
  effectivePrinterPreferences,
  printerRequest
} from './printerSettings'
import { rasterTicket } from './ticketRaster'

export interface LocalTicket {
  title: string
  text: string
  logo: string
  barcode: string
}

/** Creates a real Code 128 symbol; customer data never becomes HTML. */
export function ticketBarcode(value: string): string {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  JsBarcode(svg, value, {
    format: 'CODE128',
    displayValue: true,
    fontSize: 14,
    height: 55,
    margin: 12
  })
  return new XMLSerializer().serializeToString(svg)
}

let sending = false

export async function printLocalTicket(ticket: LocalTicket): Promise<void> {
  if (sending) throw new Error('Ya se está enviando un ticket. Espera a que termine.')
  let settings = getPrinterPreferences()
  if (!settings.token) {
    throw new Error('Selecciona y guarda tu impresora en Configuración > Impresora de este equipo.')
  }
  sending = true
  try {
    settings = await effectivePrinterPreferences(settings)
    const pages = await rasterTicket(ticket, settings.paperWidth)
    const result = await printerRequest<{ status: string }>('/print', settings.token, {
      id: crypto.randomUUID(),
      printer: settings.printer,
      paperWidth: settings.paperWidth,
      pages
    })
    if (result.status !== 'queued')
      throw new Error('El agente no confirmó el envío. Revisa la cola antes de reintentar.')
  } finally {
    sending = false
  }
}
