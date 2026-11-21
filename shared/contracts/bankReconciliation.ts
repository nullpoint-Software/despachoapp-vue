import { pairingRecord, pairingText } from './pairing'
import { parseHostId } from './discovery'
import { rfcPattern } from './localXml'

/**
 * Conciliación bancaria (6.5). Decisiones del usuario (2026-10-01, ADR-023):
 * - el estado de cuenta (PDF con texto, CSV/TXT o XML) se lee en memoria en el equipo y NO se guarda;
 * - los movimientos extraídos, la conciliación y la revisión humana se guardan en el Host (GLOBAL);
 * - un lector genérico, sin perfiles por banco.
 *
 * Flujo: la vista pide conciliar un cliente y mes → Main abre el archivo (diálogo nativo), extrae los
 * movimientos y junta los complementos de pago de su biblioteca LOCAL → el Host arma lo esperado con
 * los reportes mensuales del cliente, concilia y guarda. La vista nunca envía movimientos ni importes.
 *
 * Resultados: `matched` (coincide), `requiresReview` (revisar), `bankOnly` (sólo en el banco) y
 * `fiscalOnly` (sólo en los CFDI). Importes en texto con 2 decimales, siempre positivos; el tipo dice
 * si es abono (`credit`) o cargo (`debit`).
 */
export const bankReconciliationChannels = { operate: 'bank:operate', reconcile: 'bank:reconcile', exportCsv: 'bank:exportCsv' } as const
export const statementFormats = ['pdf', 'csv', 'xml'] as const
export type StatementFormat = typeof statementFormats[number]
export const reconciliationStatuses = ['matched', 'requiresReview', 'bankOnly', 'fiscalOnly'] as const
export type ReconciliationStatus = typeof reconciliationStatuses[number]
export type BankMovementType = 'credit' | 'debit'
export const maximumStatementMovements = 5000
export const maximumPaymentEvidence = 5000
export const maximumStatementBytes = 15 * 1024 * 1024

/** Movimiento leído del estado de cuenta. */
export interface StatementMovement { date: string; amount: string; type: BankMovementType; description: string; reference: string }
/** Pago de un complemento (P) de la biblioteca LOCAL hacia un documento relacionado. */
export interface PaymentEvidence { complementUuid: string; documentUuid: string; paidAt: string; paymentForm: string; amount: string; issuerRfc: string; receiverRfc: string }
/** Movimiento que se espera ver en el banco por un CFDI o un pago. */
export interface ExpectedMovement {
  uuid: string; date: string; amount: string; type: BankMovementType; counterpartRfc: string; counterpartName: string; folio: string
  source: 'pue' | 'creditNote' | 'payment'
}
export interface ReconciliationItem {
  itemId: string; status: ReconciliationStatus; isManual: boolean; isConfirmed: boolean; score: number; reason: string; note: string
  bankMovements: StatementMovement[]; fiscalMovements: ExpectedMovement[]
}
export interface ReconciliationSummary {
  bankCredits: string; bankDebits: string; fiscalCredits: string; fiscalDebits: string
  matchedCount: number; reviewCount: number; bankOnlyCount: number; fiscalOnlyCount: number
  /** Porcentaje de movimientos del banco ya conciliados (sólo `matched`; el original contaba también "revisar"). */
  coveragePercent: number
  excludedOutsidePeriodCount: number; cashExcludedCount: number; unpaidPpdCount: number
}
export interface ReconciliationDetail {
  reconciliationId: string; clientId: string; clientDisplayName: string; fiscalYear: number; fiscalMonth: number; format: StatementFormat; fileName: string
  tolerance: string; dateWindowDays: number; createdAt: string; createdByDisplayName: string; revision: number; summary: ReconciliationSummary; items: ReconciliationItem[]
}

/** Lo que pide la vista a Main para conciliar; Main agrega el archivo, los movimientos y los pagos. */
export interface ReconciliationRunRequest { clientId: string; fiscalYear: number; fiscalMonth: number; tolerance: string; dateWindowDays: number; pdfPassword: string | null }
export type ReconciliationViewRequest =
  { action: 'get'; clientId: string; fiscalYear: number; fiscalMonth: number } |
  { action: 'confirm'; reconciliationId: string; revision: number; itemId: string } |
  { action: 'dismiss'; reconciliationId: string; revision: number; itemId: string } |
  { action: 'link'; reconciliationId: string; revision: number; bankItemId: string; fiscalItemId: string } |
  { action: 'unlink'; reconciliationId: string; revision: number; itemId: string } |
  { action: 'note'; reconciliationId: string; revision: number; itemId: string; note: string } |
  { action: 'delete'; reconciliationId: string; revision: number }
/** `run` sólo lo arma Main con lo que leyó del archivo; reemplaza la conciliación del mes. */
export type ReconciliationHostRequest = ReconciliationViewRequest | {
  action: 'run'; clientId: string; fiscalYear: number; fiscalMonth: number; format: StatementFormat; fileName: string; tolerance: string; dateWindowDays: number
  movements: StatementMovement[]; payments: PaymentEvidence[]; excludedOutsidePeriodCount: number
}
export type ReconciliationResult = { status: 'reconciliation'; reconciliation: ReconciliationDetail | null; canReconcile: boolean } | { status: 'deleted' }

const datePattern = /^\d{4}-\d{2}-\d{2}$/
const amountPattern = /^\d{1,15}\.\d{2}$/
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
function exactKeys(data: Record<string, unknown>, keys: readonly string[]): void { if (Object.keys(data).sort().join() !== [...keys].sort().join()) throw new Error('Invalid reconciliation data') }
function oneOf<T extends string>(value: unknown, values: readonly T[]): T { if (!values.includes(value as T)) throw new Error('Invalid reconciliation data'); return value as T }
function text(value: unknown, maximum: number): string {
  if (typeof value !== 'string' || value.length > maximum || [...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) throw new Error('Invalid reconciliation text')
  return value
}
function count(value: unknown, maximum = Number.MAX_SAFE_INTEGER): number { if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > maximum) throw new Error('Invalid count'); return Number(value) }
function date(value: unknown): string { if (typeof value !== 'string' || !datePattern.test(value) || !Number.isFinite(Date.parse(value + 'T00:00:00Z'))) throw new Error('Invalid date'); return value }
function amount(value: unknown): string { if (typeof value !== 'string' || !amountPattern.test(value)) throw new Error('Invalid amount'); return value }
function uuid(value: unknown): string { if (typeof value !== 'string' || !uuidPattern.test(value)) throw new Error('Invalid UUID'); return value }
function rfc(value: unknown): string { if (typeof value !== 'string' || !rfcPattern.test(value)) throw new Error('Invalid RFC'); return value }
function period(data: Record<string, unknown>): { fiscalYear: number; fiscalMonth: number } {
  const fiscalYear = count(data.fiscalYear, 2100), fiscalMonth = count(data.fiscalMonth, 12)
  if (fiscalYear < 2000 || fiscalMonth < 1) throw new Error('Invalid period')
  return { fiscalYear, fiscalMonth }
}
/** Tolerancia de importe: de 0.00 a 1000.00 (el original usaba 1 peso por omisión). */
function tolerance(value: unknown): string { const parsed = amount(value); if (Number(parsed) > 1000) throw new Error('Invalid tolerance'); return parsed }

export function parseStatementMovement(value: unknown): StatementMovement {
  const data = pairingRecord(value); exactKeys(data, ['date', 'amount', 'type', 'description', 'reference'])
  return { date: date(data.date), amount: amount(data.amount), type: oneOf(data.type, ['credit', 'debit'] as const), description: text(data.description, 300), reference: text(data.reference, 100) }
}
function parsePayment(value: unknown): PaymentEvidence {
  const data = pairingRecord(value); exactKeys(data, ['complementUuid', 'documentUuid', 'paidAt', 'paymentForm', 'amount', 'issuerRfc', 'receiverRfc'])
  return { complementUuid: uuid(data.complementUuid), documentUuid: uuid(data.documentUuid), paidAt: date(data.paidAt), paymentForm: text(data.paymentForm, 2), amount: amount(data.amount), issuerRfc: rfc(data.issuerRfc), receiverRfc: rfc(data.receiverRfc) }
}
export function parseReconciliationRunRequest(value: unknown): ReconciliationRunRequest {
  const data = pairingRecord(value); exactKeys(data, ['clientId', 'fiscalYear', 'fiscalMonth', 'tolerance', 'dateWindowDays', 'pdfPassword'])
  if (data.pdfPassword !== null && (typeof data.pdfPassword !== 'string' || !data.pdfPassword || data.pdfPassword.length > 128)) throw new Error('Invalid PDF password')
  return { clientId: parseHostId(data.clientId), ...period(data), tolerance: tolerance(data.tolerance), dateWindowDays: count(data.dateWindowDays, 31), pdfPassword: data.pdfPassword as string | null }
}
export function parseReconciliationViewRequest(value: unknown): ReconciliationViewRequest {
  const data = pairingRecord(value)
  if (data.action === 'get') { exactKeys(data, ['action', 'clientId', 'fiscalYear', 'fiscalMonth']); return { action: 'get', clientId: parseHostId(data.clientId), ...period(data) } }
  if (data.action === 'delete') { exactKeys(data, ['action', 'reconciliationId', 'revision']); return { action: 'delete', reconciliationId: parseHostId(data.reconciliationId), revision: count(data.revision) } }
  if (data.action === 'link') {
    exactKeys(data, ['action', 'reconciliationId', 'revision', 'bankItemId', 'fiscalItemId'])
    return { action: 'link', reconciliationId: parseHostId(data.reconciliationId), revision: count(data.revision), bankItemId: parseHostId(data.bankItemId), fiscalItemId: parseHostId(data.fiscalItemId) }
  }
  if (data.action === 'note') {
    exactKeys(data, ['action', 'reconciliationId', 'revision', 'itemId', 'note'])
    return { action: 'note', reconciliationId: parseHostId(data.reconciliationId), revision: count(data.revision), itemId: parseHostId(data.itemId), note: text(data.note, 500).trim() }
  }
  if (data.action === 'confirm' || data.action === 'dismiss' || data.action === 'unlink') {
    exactKeys(data, ['action', 'reconciliationId', 'revision', 'itemId'])
    return { action: data.action, reconciliationId: parseHostId(data.reconciliationId), revision: count(data.revision), itemId: parseHostId(data.itemId) }
  }
  throw new Error('Invalid reconciliation request')
}
export function parseReconciliationHostRequest(value: unknown): ReconciliationHostRequest {
  const data = pairingRecord(value)
  if (data.action !== 'run') return parseReconciliationViewRequest(value)
  exactKeys(data, ['action', 'clientId', 'fiscalYear', 'fiscalMonth', 'format', 'fileName', 'tolerance', 'dateWindowDays', 'movements', 'payments', 'excludedOutsidePeriodCount'])
  if (!Array.isArray(data.movements) || !data.movements.length || data.movements.length > maximumStatementMovements) throw new Error('Invalid statement movements')
  if (!Array.isArray(data.payments) || data.payments.length > maximumPaymentEvidence) throw new Error('Invalid payments')
  return { action: 'run', clientId: parseHostId(data.clientId), ...period(data), format: oneOf(data.format, statementFormats), fileName: text(data.fileName, 200), tolerance: tolerance(data.tolerance),
    dateWindowDays: count(data.dateWindowDays, 31), movements: data.movements.map(parseStatementMovement), payments: data.payments.map(parsePayment), excludedOutsidePeriodCount: count(data.excludedOutsidePeriodCount) }
}

function parseExpected(value: unknown): ExpectedMovement {
  const data = pairingRecord(value); exactKeys(data, ['uuid', 'date', 'amount', 'type', 'counterpartRfc', 'counterpartName', 'folio', 'source'])
  return { uuid: uuid(data.uuid), date: date(data.date), amount: amount(data.amount), type: oneOf(data.type, ['credit', 'debit'] as const), counterpartRfc: rfc(data.counterpartRfc),
    counterpartName: text(data.counterpartName, 300), folio: text(data.folio, 70), source: oneOf(data.source, ['pue', 'creditNote', 'payment'] as const) }
}
function parseDetail(value: unknown): ReconciliationDetail {
  const data = pairingRecord(value)
  exactKeys(data, ['reconciliationId', 'clientId', 'clientDisplayName', 'fiscalYear', 'fiscalMonth', 'format', 'fileName', 'tolerance', 'dateWindowDays', 'createdAt', 'createdByDisplayName', 'revision', 'summary', 'items'])
  const summary = pairingRecord(data.summary)
  exactKeys(summary, ['bankCredits', 'bankDebits', 'fiscalCredits', 'fiscalDebits', 'matchedCount', 'reviewCount', 'bankOnlyCount', 'fiscalOnlyCount', 'coveragePercent', 'excludedOutsidePeriodCount', 'cashExcludedCount', 'unpaidPpdCount'])
  if (!Array.isArray(data.items) || data.items.length > maximumStatementMovements * 2) throw new Error('Invalid items')
  if (typeof data.createdAt !== 'string' || !Number.isFinite(Date.parse(data.createdAt))) throw new Error('Invalid timestamp')
  return { reconciliationId: parseHostId(data.reconciliationId), clientId: parseHostId(data.clientId), clientDisplayName: pairingText(data.clientDisplayName, 200), ...period(data),
    format: oneOf(data.format, statementFormats), fileName: text(data.fileName, 200), tolerance: tolerance(data.tolerance), dateWindowDays: count(data.dateWindowDays, 31), createdAt: data.createdAt,
    createdByDisplayName: pairingText(data.createdByDisplayName, 200), revision: count(data.revision),
    summary: { bankCredits: amount(summary.bankCredits), bankDebits: amount(summary.bankDebits), fiscalCredits: amount(summary.fiscalCredits), fiscalDebits: amount(summary.fiscalDebits),
      matchedCount: count(summary.matchedCount), reviewCount: count(summary.reviewCount), bankOnlyCount: count(summary.bankOnlyCount), fiscalOnlyCount: count(summary.fiscalOnlyCount),
      coveragePercent: count(summary.coveragePercent, 100), excludedOutsidePeriodCount: count(summary.excludedOutsidePeriodCount), cashExcludedCount: count(summary.cashExcludedCount), unpaidPpdCount: count(summary.unpaidPpdCount) },
    items: data.items.map(item => {
      const entry = pairingRecord(item)
      exactKeys(entry, ['itemId', 'status', 'isManual', 'isConfirmed', 'score', 'reason', 'note', 'bankMovements', 'fiscalMovements'])
      if (typeof entry.isManual !== 'boolean' || typeof entry.isConfirmed !== 'boolean' || !Array.isArray(entry.bankMovements) || !Array.isArray(entry.fiscalMovements) || entry.bankMovements.length > 10 || entry.fiscalMovements.length > 10) throw new Error('Invalid item')
      return { itemId: parseHostId(entry.itemId), status: oneOf(entry.status, reconciliationStatuses), isManual: entry.isManual, isConfirmed: entry.isConfirmed, score: count(entry.score, 100),
        reason: text(entry.reason, 300), note: text(entry.note, 500), bankMovements: entry.bankMovements.map(parseStatementMovement), fiscalMovements: entry.fiscalMovements.map(parseExpected) }
    }) }
}
export function parseReconciliationResult(value: unknown): ReconciliationResult {
  const data = pairingRecord(value)
  if (data.status === 'deleted') { exactKeys(data, ['status']); return { status: 'deleted' } }
  if (data.status !== 'reconciliation') throw new Error('Invalid reconciliation result')
  exactKeys(data, ['status', 'reconciliation', 'canReconcile'])
  if (typeof data.canReconcile !== 'boolean') throw new Error('Invalid reconciliation result')
  return { status: 'reconciliation', reconciliation: data.reconciliation === null ? null : parseDetail(data.reconciliation), canReconcile: data.canReconcile }
}

/** Respuesta de `bank:reconcile`: el usuario puede cancelar el diálogo del archivo. */
export type ReconciliationRunOutcome = { status: 'cancelled' } | ReconciliationResult
export function parseReconciliationRunOutcome(value: unknown): ReconciliationRunOutcome {
  const data = pairingRecord(value)
  if (data.status === 'cancelled') { exactKeys(data, ['status']); return { status: 'cancelled' } }
  return parseReconciliationResult(value)
}
