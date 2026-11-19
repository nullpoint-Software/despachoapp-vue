import type { MovementType, OfficeCategory, PaymentMethod } from '../contracts/movements'

/**
 * Etiquetas y formatos de presentación de movimientos, compartidos por la vista (Renderer) y los tickets
 * que maqueta Main (5.4). Los valores válidos los define el contrato compartido.
 */
export const movementTypeLabels: Record<MovementType, string> = { income: 'Ingreso', expense: 'Gasto' }
/** Categorías de los cobros y gastos del despacho (4.3a). */
export const officeCategoryLabels: Record<OfficeCategory, string> = { rent: 'Renta', utilities: 'Servicios (luz, agua, teléfono)', stationery: 'Papelería', payroll: 'Nómina', taxes: 'Impuestos', services: 'Servicios profesionales', interest: 'Intereses', refund: 'Reembolsos', other: 'Otros' }
export const paymentMethodLabels: Record<PaymentMethod, string> = { cash: 'Efectivo', transfer: 'Transferencia', card: 'Tarjeta', other: 'Otro' }
/** Conceptos frecuentes que sugiere el campo "Concepto"; sólo son sugerencias, se puede escribir cualquier otro. */
export const commonMovementConcepts = ['PAGO MENSUAL', 'HONORARIOS', 'CSF', 'IMSS', 'INFONAVIT', 'DECLARACIÓN MENSUAL', 'DECLARACIÓN ANUAL', 'OPINIÓN DE CUMPLIMIENTO', 'E.FIRMA', 'FACTURACIÓN', 'NÓMINA', 'ALTA EN EL SAT', 'CONTRASEÑA DEL SAT', 'ASESORÍA']

/**
 * Formato de moneda sin convertir a número: separa miles sobre el texto decimal exacto que entrega
 * el Host ("-1234567.50" → "-$1,234,567.50"), por lo que nunca introduce errores de coma flotante.
 */
export function formatMoney(amount: string): string {
  const isNegative = amount.startsWith('-')
  const [whole = '0', fraction = '00'] = amount.replace('-', '').split('.')
  return (isNegative ? '-$' : '$') + whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + fraction.padEnd(2, '0').slice(0, 2)
}

/** Fecha de negocio "YYYY-MM-DD" legible, sin reinterpretarla en la zona horaria del equipo. */
export function formatBusinessDate(businessDate: string): string {
  const [year, month, day] = businessDate.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('es-MX', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' })
}

/** Fecha y hora de negocio legibles ("10 oct 2026 · 14:30"); la hora ya está en la zona del despacho. */
export function formatBusinessDateTime(businessDate: string, businessTime: string): string {
  return formatBusinessDate(businessDate) + ' · ' + businessTime
}

/** Folio de recibo con ancho fijo; el número lo asigna el Host y no se reutiliza. */
export function formatFolio(folio: number): string { return 'F-' + String(folio).padStart(6, '0') }
