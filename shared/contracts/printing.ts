import { pairingRecord, pairingText } from './pairing'
import { ticketWidths, type TicketWidth } from './localPreferences'
import { parseLogoDataUrl } from './branding'

/**
 * Impresión LOCAL de tickets (5.4). El Renderer nunca envía el contenido a imprimir: pide a Main que
 * *prepare* un ticket a partir de datos del Host (recibo de un movimiento, corte de un periodo) o de
 * prueba, recibe la vista previa y después pide imprimir **ese** ticket por su `ticketId`, una sola vez.
 * Así lo que se ve es exactamente lo que se imprime y no se puede imprimir un recibo inventado.
 */
export const printingChannels = {
  prepareReceipt: 'printing:prepareReceipt',
  prepareCashCut: 'printing:prepareCashCut',
  prepareTest: 'printing:prepareTest',
  print: 'printing:print'
} as const

/*
 * Corte de caja por horas (2026-10-10): ya no hay una "ventana" aparte por hora de registro. El corte es un
 * `MovementFilter` con `fromTime`/`toTime` (hora de negocio de cada pago), que el Host filtra y suma igual que la lista.
 */

/** Columnas de texto por ancho de papel, como el sistema original (fuente monoespaciada). */
export const ticketColumnCounts: Record<TicketWidth, number> = { 58: 32, 80: 48 }
/** Tope de líneas de un ticket: un corte más largo se rechaza y se pide acortar el periodo. */
export const maximumTicketLines = 600
const maximumBarcodeModules = 1200

/**
 * Línea de un ticket ya maquetada en columnas fijas:
 * - `text`: texto de `columnCount` caracteres como máximo (vacío = línea en blanco); `isEmphasized`, negrita.
 * - `rule`: separador ligero (`-`) o grueso (`=`).
 * - `barcode`: Code 128 con su valor legible; `pattern` son los módulos ('1' barra, '0' espacio).
 */
export type TicketLine =
  { kind: 'text'; text: string; isEmphasized: boolean } |
  { kind: 'rule'; weight: 'light' | 'heavy' } |
  { kind: 'barcode'; value: string; pattern: string }

export interface TicketPreview {
  ticketId: string
  title: string
  widthMillimeters: TicketWidth
  columnCount: number
  printerName: string | null
  logoDataUrl: string | null
  lines: TicketLine[]
}
export interface PrintResult { status: 'sent' }

function exactKeys(data: Record<string, unknown>, keys: readonly string[]): void {
  if (Object.keys(data).sort().join() !== [...keys].sort().join()) throw new Error('Invalid ticket')
}
export function parseTicketId(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)) throw new Error('Invalid ticket')
  return value
}
function parseTicketText(value: unknown, columnCount: number): string {
  if (typeof value !== 'string' || value.length > columnCount || [...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) throw new Error('Invalid ticket text')
  return value
}
function parseTicketLine(value: unknown, columnCount: number): TicketLine {
  const data = pairingRecord(value)
  if (data.kind === 'text') {
    exactKeys(data, ['kind', 'text', 'isEmphasized'])
    if (typeof data.isEmphasized !== 'boolean') throw new Error('Invalid ticket')
    return { kind: 'text', text: parseTicketText(data.text, columnCount), isEmphasized: data.isEmphasized }
  }
  if (data.kind === 'rule') {
    exactKeys(data, ['kind', 'weight'])
    if (data.weight !== 'light' && data.weight !== 'heavy') throw new Error('Invalid ticket')
    return { kind: 'rule', weight: data.weight }
  }
  if (data.kind === 'barcode') {
    exactKeys(data, ['kind', 'value', 'pattern'])
    if (typeof data.pattern !== 'string' || !/^[01]+$/.test(data.pattern) || data.pattern.length > maximumBarcodeModules) throw new Error('Invalid ticket')
    return { kind: 'barcode', value: pairingText(data.value, 40), pattern: data.pattern }
  }
  throw new Error('Invalid ticket')
}
/** Vista previa que entrega Main; Preload la reconstruye campo por campo antes de pasarla a Vue. */
export function parseTicketPreview(value: unknown): TicketPreview {
  const data = pairingRecord(value)
  exactKeys(data, ['ticketId', 'title', 'widthMillimeters', 'columnCount', 'printerName', 'logoDataUrl', 'lines'])
  if (!ticketWidths.includes(data.widthMillimeters as TicketWidth)) throw new Error('Invalid ticket')
  const widthMillimeters = data.widthMillimeters as TicketWidth
  if (data.columnCount !== ticketColumnCounts[widthMillimeters]) throw new Error('Invalid ticket')
  const columnCount = ticketColumnCounts[widthMillimeters]
  if (!Array.isArray(data.lines) || !data.lines.length || data.lines.length > maximumTicketLines) throw new Error('Invalid ticket')
  return {
    ticketId: parseTicketId(data.ticketId), title: pairingText(data.title, 80), widthMillimeters, columnCount,
    printerName: data.printerName === null ? null : pairingText(data.printerName, 256),
    logoDataUrl: data.logoDataUrl === null ? null : parseLogoDataUrl(data.logoDataUrl),
    lines: data.lines.map(line => parseTicketLine(line, columnCount))
  }
}
export function parsePrintResult(value: unknown): PrintResult {
  const data = pairingRecord(value)
  exactKeys(data, ['status'])
  if (data.status !== 'sent') throw new Error('Invalid print result')
  return { status: 'sent' }
}
