import type { CfdiVoucherType, XmlRejectionReason } from '../../../shared/contracts/localXml'

/** Etiquetas de presentación; los valores válidos los define el contrato compartido. */
export const voucherTypeLabels: Record<CfdiVoucherType, string> = { I: 'Ingreso', E: 'Egreso', T: 'Traslado', N: 'Nómina', P: 'Pago' }
export const rejectionLabels: Record<XmlRejectionReason, string> = {
  notXml: 'no es un XML legible', notCfdi: 'no es un CFDI con emisor, receptor, fecha y total válidos', unsupportedVersion: 'versión distinta de CFDI 3.3 o 4.0',
  missingStamp: 'no tiene UUID de timbre fiscal', tooLarge: 'supera 10 MB', unsafeContent: 'declara DTD o entidades (no permitido)', invalidZip: 'ZIP dañado, cifrado o no admitido'
}
/** "2026-09" → "sep 2026" sin reinterpretar zona horaria. */
export function formatPeriod(period: string): string {
  const [year, month] = period.split('-').map(Number) as [number, number]
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('es-MX', { timeZone: 'UTC', month: 'short', year: 'numeric' })
}
/** Fecha del CFDI tal como la emitió el SAT (hora local del emisor, sin zona). */
export function formatIssuedAt(issuedAt: string): string { return issuedAt.slice(0, 10) + ' ' + issuedAt.slice(11, 16) }
/** Total exacto sobre el texto del XML, con separadores de miles. */
export function formatTotal(total: string, currency: string): string {
  const [whole = '0', fraction = ''] = total.split('.')
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + fraction.padEnd(2, '0') + ' ' + currency
}
