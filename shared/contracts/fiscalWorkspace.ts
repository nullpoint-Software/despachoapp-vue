import { reportAmountKeys, type ReportAmounts } from './fiscalReports'
import { cfdiVoucherTypes, rfcPattern, type CfdiVoucherType } from './localXml'
import { parseHostId } from './discovery'

/**
 * Fiscal por cliente (2026-10-04, pedido del usuario siguiendo la ContaApp anterior): al entrar se elige el cliente y
 * todo lo demás (XML, resumen, tabla de datos, reportes y PDF) es de ese cliente.
 * - `fiscal:table` (Renderer → Main): los XML LOCAL de este equipo donde el RFC del cliente es emisor (emitidas) o
 *   receptor (recibidas) en el ejercicio o mes, con el desglose que Main calcula del XML cifrado (bases, IVA,
 *   retenciones). Nada sale del equipo; Main exige `xml.use`.
 *   Como la tabla de la ContaApp anterior (2026-10-05), cada renglón trae además:
 *   - `paymentStatus`: pagada, parcial o pendiente para ingresos; complemento, nómina, nota de crédito o traslado para
 *     los demás tipos;
 *   - `paidAmount` y `pendingAmount` (Abonado y Pendiente): un ingreso PUE está pagado completo; uno PPD suma lo que
 *     pagan los complementos de pago LOCALES del cliente, sin pasar del total. Los demás tipos llevan 0;
 *   - `appliedDocuments`: en un complemento de pago, las facturas que paga y cuánto a cada una;
 *   - `reportWarning`: inclusión excepcional que conviene revisar antes de reportar (nómina, forma 99, efectivo
 *     mayor a $2,000 o gasolina en efectivo).
 * - `fiscal:reportPdf`: PDF de uno o dos reportes del mismo periodo (el mensual junta emitidas y recibidas), con los
 *   datos que el Host devuelve para la sesión. `fiscal:cfdiPdf`: representación impresa de un CFDI de este equipo.
 *   `preview` lo abre en el visor de Fiscenix (pdfViewer.ts, desde 2026-10-06); `save` lo escribe donde la persona elija.
 */
export const fiscalWorkspaceChannels = { table: 'fiscal:table', reportPdf: 'fiscal:reportPdf', cfdiPdf: 'fiscal:cfdiPdf' } as const
export const maximumFiscalTableRows = 500
export type FiscalDirection = 'issued' | 'received'
export interface FiscalTableRequest { clientRfc: string; fiscalYear: number; fiscalMonth: number | null }
export const fiscalPaymentStatuses = ['paid', 'partial', 'pending', 'paymentComplement', 'payroll', 'creditNote', 'transfer'] as const
export type FiscalPaymentStatus = typeof fiscalPaymentStatuses[number]
export const maximumAppliedDocuments = 50
export interface FiscalAppliedDocument { uuid: string; paidAmount: string }
export interface FiscalTableRow {
  uuid: string; direction: FiscalDirection; voucherType: CfdiVoucherType; issuedAt: string
  counterpartRfc: string; counterpartName: string; paymentForm: string | null; paymentMethod: string | null
  currency: string; exchangeRate: string | null; subtotal: string; discount: string; total: string; breakdown: ReportAmounts; issueCount: number
  paymentStatus: FiscalPaymentStatus; paidAmount: string; pendingAmount: string; appliedDocuments: FiscalAppliedDocument[]; reportWarning: string | null
}
export interface FiscalTableResult { rows: FiscalTableRow[]; isTruncated: boolean; unreadableCount: number }
export type PdfAction = 'preview' | 'save'
export interface ReportPdfRequest { reportIds: string[]; action: PdfAction }
export interface CfdiPdfRequest { uuid: string; action: PdfAction }

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const decimalPattern = /^-?\d{1,18}(\.\d{1,6})?$/
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid fiscal data')
  return value as Record<string, unknown>
}
function exactKeys(data: Record<string, unknown>, keys: readonly string[]): void { if (Object.keys(data).sort().join() !== [...keys].sort().join()) throw new Error('Invalid fiscal data') }
function text(value: unknown, maximum: number): string {
  if (typeof value !== 'string' || value.length > maximum || [...value].some(character => character.charCodeAt(0) < 32)) throw new Error('Invalid fiscal text')
  return value
}
function optionalText(value: unknown, maximum: number): string | null { return value === null ? null : text(value, maximum) }
function decimal(value: unknown): string { if (typeof value !== 'string' || !decimalPattern.test(value)) throw new Error('Invalid fiscal amount'); return value }
function action(value: unknown): PdfAction { if (value !== 'preview' && value !== 'save') throw new Error('Invalid PDF action'); return value }

export function parseFiscalTableRequest(value: unknown): FiscalTableRequest {
  const data = record(value); exactKeys(data, ['clientRfc', 'fiscalYear', 'fiscalMonth'])
  if (typeof data.clientRfc !== 'string' || !rfcPattern.test(data.clientRfc)) throw new Error('Invalid RFC')
  if (!Number.isSafeInteger(data.fiscalYear) || Number(data.fiscalYear) < 2000 || Number(data.fiscalYear) > 2100) throw new Error('Invalid fiscal year')
  if (data.fiscalMonth !== null && (!Number.isSafeInteger(data.fiscalMonth) || Number(data.fiscalMonth) < 1 || Number(data.fiscalMonth) > 12)) throw new Error('Invalid fiscal month')
  return { clientRfc: data.clientRfc, fiscalYear: Number(data.fiscalYear), fiscalMonth: data.fiscalMonth === null ? null : Number(data.fiscalMonth) }
}
export function parseFiscalTableResult(value: unknown): FiscalTableResult {
  const data = record(value); exactKeys(data, ['rows', 'isTruncated', 'unreadableCount'])
  if (!Array.isArray(data.rows) || data.rows.length > maximumFiscalTableRows || typeof data.isTruncated !== 'boolean' || !Number.isSafeInteger(data.unreadableCount)) throw new Error('Invalid fiscal table')
  return {
    isTruncated: data.isTruncated, unreadableCount: Number(data.unreadableCount),
    rows: data.rows.map(item => {
      const row = record(item)
      exactKeys(row, ['uuid', 'direction', 'voucherType', 'issuedAt', 'counterpartRfc', 'counterpartName', 'paymentForm', 'paymentMethod', 'currency', 'exchangeRate', 'subtotal', 'discount', 'total', 'breakdown', 'issueCount', 'paymentStatus', 'paidAmount', 'pendingAmount', 'appliedDocuments', 'reportWarning'])
      if (typeof row.uuid !== 'string' || !uuidPattern.test(row.uuid)) throw new Error('Invalid CFDI UUID')
      if (row.direction !== 'issued' && row.direction !== 'received') throw new Error('Invalid direction')
      if (!cfdiVoucherTypes.includes(row.voucherType as CfdiVoucherType)) throw new Error('Invalid voucher type')
      const breakdown = record(row.breakdown); exactKeys(breakdown, reportAmountKeys)
      if (!fiscalPaymentStatuses.includes(row.paymentStatus as FiscalPaymentStatus)) throw new Error('Invalid payment status')
      if (!Array.isArray(row.appliedDocuments) || row.appliedDocuments.length > maximumAppliedDocuments) throw new Error('Invalid applied documents')
      const appliedDocuments = row.appliedDocuments.map(item => {
        const document = record(item); exactKeys(document, ['uuid', 'paidAmount'])
        if (typeof document.uuid !== 'string' || !uuidPattern.test(document.uuid)) throw new Error('Invalid CFDI UUID')
        return { uuid: document.uuid, paidAmount: decimal(document.paidAmount) }
      })
      return {
        uuid: row.uuid, direction: row.direction, voucherType: row.voucherType as CfdiVoucherType, issuedAt: text(row.issuedAt, 32),
        counterpartRfc: text(row.counterpartRfc, 13), counterpartName: text(row.counterpartName, 300), paymentForm: optionalText(row.paymentForm, 4), paymentMethod: optionalText(row.paymentMethod, 4),
        currency: text(row.currency, 4), exchangeRate: row.exchangeRate === null ? null : decimal(row.exchangeRate), subtotal: decimal(row.subtotal), discount: decimal(row.discount), total: decimal(row.total),
        breakdown: Object.fromEntries(reportAmountKeys.map(key => [key, decimal(breakdown[key])])) as unknown as ReportAmounts,
        issueCount: Number.isSafeInteger(row.issueCount) ? Number(row.issueCount) : (() => { throw new Error('Invalid issue count') })(),
        paymentStatus: row.paymentStatus as FiscalPaymentStatus, paidAmount: decimal(row.paidAmount), pendingAmount: decimal(row.pendingAmount), appliedDocuments,
        reportWarning: optionalText(row.reportWarning, 200)
      }
    })
  }
}
export function parseReportPdfRequest(value: unknown): ReportPdfRequest {
  const data = record(value); exactKeys(data, ['reportIds', 'action'])
  if (!Array.isArray(data.reportIds) || data.reportIds.length < 1 || data.reportIds.length > 2) throw new Error('Invalid report PDF request')
  const reportIds = data.reportIds.map(parseHostId)
  if (new Set(reportIds).size !== reportIds.length) throw new Error('Invalid report PDF request')
  return { reportIds, action: action(data.action) }
}
export function parseCfdiPdfRequest(value: unknown): CfdiPdfRequest {
  const data = record(value); exactKeys(data, ['uuid', 'action'])
  if (typeof data.uuid !== 'string' || !uuidPattern.test(data.uuid)) throw new Error('Invalid CFDI UUID')
  return { uuid: data.uuid, action: action(data.action) }
}
