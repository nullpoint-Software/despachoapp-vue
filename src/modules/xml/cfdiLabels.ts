import type { CfdiIssue, CfdiIssueCode } from '../../../shared/contracts/cfdi'

/** Avisos del análisis en lenguaje del despacho; ninguno impide conservar el CFDI. */
export const cfdiIssueLabels: Record<CfdiIssueCode, string> = {
  subtotalMismatch: 'El subtotal no coincide con la suma de los conceptos.',
  discountMismatch: 'El descuento no coincide con la suma de los descuentos de los conceptos.',
  totalMismatch: 'El total no coincide con subtotal − descuento + impuestos trasladados − retenidos.',
  transferredTaxMismatch: 'El total de impuestos trasladados no coincide con sus líneas.',
  withheldTaxMismatch: 'El total de impuestos retenidos no coincide con sus líneas.',
  conceptTaxMismatch: 'Los impuestos del comprobante no coinciden con los de sus conceptos.',
  paymentAmountMismatch: 'El monto de un pago no coincide con lo pagado a sus documentos.',
  nonZeroTotal: 'Un CFDI de traslado o de pago debería tener total 0.',
  missingConcepts: 'El CFDI no tiene conceptos.',
  missingExchangeRate: 'La moneda es extranjera y falta el tipo de cambio.',
  invalidAmount: 'Algún importe no tiene formato numérico válido; se tomó como 0.',
  truncatedConcepts: 'El CFDI tiene más de 1000 conceptos; sólo se analizaron los primeros.'
}
export function describeCfdiIssue(issue: CfdiIssue): string {
  const amounts = issue.declared !== null && issue.computed !== null ? ' Declarado ' + issue.declared + ', calculado ' + issue.computed + '.' : ''
  return cfdiIssueLabels[issue.code] + amounts
}
/** Catálogos del SAT que la vista muestra con nombre (los más comunes; el resto se ve por clave). */
export const taxNames: Record<string, string> = { '001': 'ISR', '002': 'IVA', '003': 'IEPS' }
export const relationTypeNames: Record<string, string> = {
  '01': 'Nota de crédito', '02': 'Nota de débito', '03': 'Devolución de mercancía', '04': 'Sustitución de CFDI previos',
  '05': 'Traslados de mercancías facturados', '06': 'Factura de traslados previos', '07': 'Aplicación de anticipo'
}
export const paymentMethodNames: Record<string, string> = { PUE: 'Pago en una sola exhibición', PPD: 'Pago en parcialidades o diferido' }
export const paymentFormNames: Record<string, string> = {
  '01': 'Efectivo', '02': 'Cheque nominativo', '03': 'Transferencia electrónica', '04': 'Tarjeta de crédito', '05': 'Monedero electrónico', '06': 'Dinero electrónico',
  '08': 'Vales de despensa', '12': 'Dación en pago', '13': 'Subrogación', '14': 'Consignación', '15': 'Condonación', '17': 'Compensación', '23': 'Novación',
  '24': 'Confusión', '25': 'Remisión de deuda', '26': 'Prescripción o caducidad', '27': 'Satisfacción del acreedor', '28': 'Tarjeta de débito', '29': 'Tarjeta de servicios',
  '30': 'Aplicación de anticipos', '31': 'Intermediario de pagos', '99': 'Por definir'
}
export function describeCode(code: string | null, names: Record<string, string>): string {
  if (!code) return '—'
  return names[code] ? code + ' · ' + names[code] : code
}
