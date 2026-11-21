import { pairingRecord, pairingText } from './pairing'
import { parseHostId } from './discovery'
import { parseBusinessDate } from './movements'
import type { PdfAction } from './fiscalWorkspace'
import { obligationPeriodicities, countPeriods, type ObligationPeriodicity } from '../fiscal/taxObligationSchedule'

/**
 * Obligaciones fiscales de los clientes y su cumplimiento por periodo (2026-10-18, [[modules/TAX-OBLIGATIONS]]).
 * Datos GLOBAL en el Host. Permisos verificados en el Host: consultar exige `clients.read` + `reports.read` y estar
 * asignado al cliente; dar de alta, retirar y marcar exige además `reports.manage` y asignación `readWrite`.
 *
 * - `TaxObligationDraft`: lo que se da de alta. `source` dice de dónde salió (constancia del SAT, sugerencia por
 *   régimen o captura manual); `startsOn` es la "Fecha Inicio" de la constancia (los periodos anteriores no cuentan).
 * - Cumplimiento: una fila por obligación, ejercicio y periodo, con quién y cuándo la marcó y una nota o número de acuse.
 *   Desmarcar borra la fila; ambas acciones quedan en la auditoría de sólo inserción.
 * - El estado (cumplida, pendiente, vencida) no se guarda: se calcula con `taxObligationSchedule` y el día de la oficina.
 */
export const taxObligationsChannels = { operate: 'taxObligations:operate', reportPdf: 'taxObligations:reportPdf', readStoredCertificate: 'taxObligations:readStoredCertificate' } as const
export const obligationSources = ['certificate', 'regime', 'manual'] as const
export type ObligationSource = typeof obligationSources[number]
export const maximumObligationsPerAddition = 40
export const maximumObligationNoteLength = 500
export const reportStatusFilters = ['all', 'pending', 'overdue', 'fulfilled'] as const
export type ReportStatusFilter = typeof reportStatusFilters[number]

export interface TaxObligationDraft { description: string; periodicity: ObligationPeriodicity; dueMonthsAfter: number; dueDay: number; startsOn: string | null; source: ObligationSource }
export interface TaxObligation extends TaxObligationDraft { obligationId: string; clientId: string; createdAt: string; createdByDisplayName: string }
export interface TaxObligationFulfillment { obligationId: string; fiscalYear: number; periodNumber: number; note: string; markedAt: string; markedByDisplayName: string }
/** Renglón del reporte del periodo: una obligación de un cliente asignado cuyo periodo termina en el mes elegido. */
export interface ObligationReportRow { clientId: string; clientDisplayName: string; clientRfc: string; obligation: TaxObligation; periodNumber: number; fulfillment: TaxObligationFulfillment | null }

export type TaxObligationRequest =
  { action: 'listClient'; clientId: string; fiscalYear: number } |
  { action: 'report'; fiscalYear: number; fiscalMonth: number } |
  { action: 'add'; clientId: string; obligations: TaxObligationDraft[] } |
  { action: 'retire'; obligationId: string } |
  { action: 'mark'; obligationId: string; fiscalYear: number; periodNumber: number; note: string } |
  { action: 'unmark'; obligationId: string; fiscalYear: number; periodNumber: number }
export type TaxObligationResult =
  { status: 'client'; taxRegimes: string[]; obligations: TaxObligation[]; fulfillments: TaxObligationFulfillment[]; canManage: boolean } |
  { status: 'report'; rows: ObligationReportRow[] } |
  { status: 'added'; addedCount: number; skippedCount: number } |
  { status: 'retired' } |
  { status: 'marked'; fulfillment: TaxObligationFulfillment } |
  { status: 'unmarked' }
/** PDF del reporte del periodo (Main pide el reporte al Host con los mismos permisos y aplica el filtro). */
export interface ObligationReportPdfRequest { fiscalYear: number; fiscalMonth: number; statusFilter: ReportStatusFilter; action: PdfAction }

function exactKeys(data: Record<string, unknown>, keys: readonly string[]): void {
  if (Object.keys(data).sort().join() !== [...keys].sort().join()) throw new Error('Invalid tax obligation data')
}
function oneOf<T extends string>(value: unknown, values: readonly T[]): T { if (!values.includes(value as T)) throw new Error('Invalid tax obligation data'); return value as T }
function integer(value: unknown, minimum: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || Number(value) < minimum || Number(value) > maximum) throw new Error('Invalid tax obligation number')
  return Number(value)
}
/** Texto libre sin caracteres de control; vacío permitido. */
function freeText(value: unknown, maximum: number): string {
  if (typeof value !== 'string' || value.length > maximum || [...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) throw new Error('Invalid tax obligation text')
  return value.trim()
}
function timestamp(value: unknown): string {
  if (typeof value !== 'string' || value.length > 40 || !Number.isFinite(Date.parse(value))) throw new Error('Invalid timestamp')
  return value
}
const fiscalYearOf = (value: unknown) => integer(value, 2000, 2100)
function list<T>(value: unknown, maximum: number, parse: (item: unknown) => T): T[] {
  if (!Array.isArray(value) || value.length > maximum) throw new Error('Invalid tax obligation list')
  return value.map(parse)
}
/** El periodo debe existir para la periodicidad: mensual 1-12, bimestral 1-6, trimestral 1-4, anual 1. */
export function assertPeriod(periodicity: ObligationPeriodicity, periodNumber: number): void {
  if (periodNumber < 1 || periodNumber > countPeriods(periodicity)) throw new Error('Invalid obligation period')
}

export function parseTaxObligationDraft(value: unknown): TaxObligationDraft {
  const data = pairingRecord(value)
  exactKeys(data, ['description', 'periodicity', 'dueMonthsAfter', 'dueDay', 'startsOn', 'source'])
  return { description: pairingText(data.description, 300), periodicity: oneOf(data.periodicity, obligationPeriodicities), dueMonthsAfter: integer(data.dueMonthsAfter, 1, 12),
    dueDay: integer(data.dueDay, 1, 31), startsOn: data.startsOn === null ? null : parseBusinessDate(data.startsOn), source: oneOf(data.source, obligationSources) }
}

/** Contrato cerrado de la vista (y de Main hacia el Host): campos de más o tipos distintos se rechazan. */
export function parseTaxObligationRequest(value: unknown): TaxObligationRequest {
  const data = pairingRecord(value)
  if (data.action === 'listClient') { exactKeys(data, ['action', 'clientId', 'fiscalYear']); return { action: 'listClient', clientId: parseHostId(data.clientId), fiscalYear: fiscalYearOf(data.fiscalYear) } }
  if (data.action === 'report') { exactKeys(data, ['action', 'fiscalYear', 'fiscalMonth']); return { action: 'report', fiscalYear: fiscalYearOf(data.fiscalYear), fiscalMonth: integer(data.fiscalMonth, 1, 12) } }
  if (data.action === 'add') {
    exactKeys(data, ['action', 'clientId', 'obligations'])
    const obligations = list(data.obligations, maximumObligationsPerAddition, parseTaxObligationDraft)
    if (!obligations.length) throw new Error('Invalid tax obligation list')
    return { action: 'add', clientId: parseHostId(data.clientId), obligations }
  }
  if (data.action === 'retire') { exactKeys(data, ['action', 'obligationId']); return { action: 'retire', obligationId: parseHostId(data.obligationId) } }
  if (data.action === 'mark') {
    exactKeys(data, ['action', 'obligationId', 'fiscalYear', 'periodNumber', 'note'])
    return { action: 'mark', obligationId: parseHostId(data.obligationId), fiscalYear: fiscalYearOf(data.fiscalYear), periodNumber: integer(data.periodNumber, 1, 12), note: freeText(data.note, maximumObligationNoteLength) }
  }
  if (data.action === 'unmark') {
    exactKeys(data, ['action', 'obligationId', 'fiscalYear', 'periodNumber'])
    return { action: 'unmark', obligationId: parseHostId(data.obligationId), fiscalYear: fiscalYearOf(data.fiscalYear), periodNumber: integer(data.periodNumber, 1, 12) }
  }
  throw new Error('Invalid tax obligation request')
}

function parseObligation(value: unknown): TaxObligation {
  const data = pairingRecord(value)
  const { obligationId, clientId, createdAt, createdByDisplayName, ...draft } = data
  return { ...parseTaxObligationDraft(draft), obligationId: parseHostId(obligationId), clientId: parseHostId(clientId), createdAt: timestamp(createdAt), createdByDisplayName: pairingText(createdByDisplayName, 200) }
}
function parseFulfillment(value: unknown): TaxObligationFulfillment {
  const data = pairingRecord(value)
  exactKeys(data, ['obligationId', 'fiscalYear', 'periodNumber', 'note', 'markedAt', 'markedByDisplayName'])
  return { obligationId: parseHostId(data.obligationId), fiscalYear: fiscalYearOf(data.fiscalYear), periodNumber: integer(data.periodNumber, 1, 12), note: freeText(data.note, maximumObligationNoteLength),
    markedAt: timestamp(data.markedAt), markedByDisplayName: pairingText(data.markedByDisplayName, 200) }
}
function parseReportRow(value: unknown): ObligationReportRow {
  const data = pairingRecord(value)
  exactKeys(data, ['clientId', 'clientDisplayName', 'clientRfc', 'obligation', 'periodNumber', 'fulfillment'])
  const obligation = parseObligation(data.obligation), periodNumber = integer(data.periodNumber, 1, 12)
  assertPeriod(obligation.periodicity, periodNumber)
  return { clientId: parseHostId(data.clientId), clientDisplayName: pairingText(data.clientDisplayName, 200), clientRfc: freeText(data.clientRfc, 13), obligation, periodNumber,
    fulfillment: data.fulfillment === null ? null : parseFulfillment(data.fulfillment) }
}

/** Preload y Main reconstruyen cada resultado campo por campo. */
export function parseTaxObligationResult(value: unknown): TaxObligationResult {
  const data = pairingRecord(value)
  if (data.status === 'client') {
    exactKeys(data, ['status', 'taxRegimes', 'obligations', 'fulfillments', 'canManage'])
    if (typeof data.canManage !== 'boolean') throw new Error('Invalid capabilities')
    return { status: 'client', taxRegimes: list(data.taxRegimes, 11, code => { if (typeof code !== 'string' || !/^[0-9]{3}$/.test(code)) throw new Error('Invalid regime'); return code }),
      obligations: list(data.obligations, 200, parseObligation), fulfillments: list(data.fulfillments, 5000, parseFulfillment), canManage: data.canManage }
  }
  if (data.status === 'report') { exactKeys(data, ['status', 'rows']); return { status: 'report', rows: list(data.rows, 20000, parseReportRow) } }
  if (data.status === 'added') { exactKeys(data, ['status', 'addedCount', 'skippedCount']); return { status: 'added', addedCount: integer(data.addedCount, 0, maximumObligationsPerAddition), skippedCount: integer(data.skippedCount, 0, maximumObligationsPerAddition) } }
  if (data.status === 'retired' || data.status === 'unmarked') { exactKeys(data, ['status']); return { status: data.status } }
  if (data.status === 'marked') { exactKeys(data, ['status', 'fulfillment']); return { status: 'marked', fulfillment: parseFulfillment(data.fulfillment) } }
  throw new Error('Invalid tax obligation result')
}

export function parseObligationReportPdfRequest(value: unknown): ObligationReportPdfRequest {
  const data = pairingRecord(value)
  exactKeys(data, ['fiscalYear', 'fiscalMonth', 'statusFilter', 'action'])
  return { fiscalYear: fiscalYearOf(data.fiscalYear), fiscalMonth: integer(data.fiscalMonth, 1, 12), statusFilter: oneOf(data.statusFilter, reportStatusFilters), action: oneOf(data.action, ['preview', 'save'] as const) }
}

/**
 * Obligaciones de la constancia (CSF) que ya está en el expediente del cliente (2026-10-19, pedido del usuario:
 * "actualizar con PDF de CSF dentro de la app"). Canal `readStoredCertificate` (Renderer → Main): Main busca la CSF más
 * reciente del expediente, la pide al Host como `view` (auditada; exige `documents.read` y asignación), lee su texto y
 * devuelve sólo el RFC impreso y las obligaciones. El PDF no llega a la ventana y sus bytes se borran en Main.
 * - `missing`: el expediente no tiene constancia;
 * - `read`: nombre y fecha del documento usado, RFC impreso (o `null`) y obligaciones (pueden ser 0 si no trae tabla).
 */
export interface StoredCertificateObligation { description: string; startsOn: string; endsOn: string | null; periodicity: ObligationPeriodicity | null; dueMonthsAfter: number | null; dueDay: number | null }
export type StoredCertificateResult =
  { status: 'missing' } |
  { status: 'read'; documentName: string; createdAt: string; rfc: string | null; obligations: StoredCertificateObligation[] }

export function parseStoredCertificateRequest(value: unknown): { clientId: string } {
  const data = pairingRecord(value)
  exactKeys(data, ['clientId'])
  return { clientId: parseHostId(data.clientId) }
}
function parseStoredCertificateObligation(value: unknown): StoredCertificateObligation {
  const data = pairingRecord(value)
  exactKeys(data, ['description', 'startsOn', 'endsOn', 'periodicity', 'dueMonthsAfter', 'dueDay'])
  const description = freeText(data.description, 300)
  if (!description) throw new Error('Invalid tax obligation text')
  return { description, startsOn: parseBusinessDate(data.startsOn), endsOn: data.endsOn === null ? null : parseBusinessDate(data.endsOn),
    periodicity: data.periodicity === null ? null : oneOf(data.periodicity, obligationPeriodicities), dueMonthsAfter: data.dueMonthsAfter === null ? null : integer(data.dueMonthsAfter, 1, 12),
    dueDay: data.dueDay === null ? null : integer(data.dueDay, 1, 31) }
}
export function parseStoredCertificateResult(value: unknown): StoredCertificateResult {
  const data = pairingRecord(value)
  if (data.status === 'missing') { exactKeys(data, ['status']); return { status: 'missing' } }
  if (data.status !== 'read') throw new Error('Invalid tax obligation result')
  exactKeys(data, ['status', 'documentName', 'createdAt', 'rfc', 'obligations'])
  const rfc = data.rfc === null ? null : freeText(data.rfc, 13)
  if (rfc !== null && !/^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/.test(rfc)) throw new Error('Invalid tax obligation data')
  return { status: 'read', documentName: pairingText(data.documentName, 200), createdAt: timestamp(data.createdAt), rfc, obligations: list(data.obligations, 100, parseStoredCertificateObligation) }
}
