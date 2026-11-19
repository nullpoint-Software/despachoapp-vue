import { pairingRecord, pairingText } from './pairing'
import { parseHostId } from './discovery'
import { rfcPattern } from './localXml'

/**
 * Reportes fiscales y DIOT (6.2). Datos GLOBAL en el Host; el XML físico se queda en cada equipo.
 *
 * Flujo para agregar CFDI a un reporte (decisión del usuario: los datos llegan al Host al relacionar):
 * 1. La vista nombra cliente, tipo, nombre y UUID (`FiscalReportAddition`).
 * 2. Main analiza esos XML LOCAL y arma un `FiscalDocumentSnapshot` por CFDI. La vista nunca envía importes.
 * 3. El Host decide la dirección por el RFC del cliente, valida periodo y tipo, guarda los datos y
 *    registra qué equipo tiene el XML.
 *
 * Importes: texto decimal exacto, nunca `number`. La DIOT no es un registro: se calcula del reporte
 * mensual de recibidas con los ajustes de proveedor del cliente.
 */
export const fiscalReportsChannels = { operate: 'reports:operate', addDocuments: 'reports:addDocuments', exportCsv: 'reports:exportCsv', exportXlsx: 'reports:exportXlsx', exportDiot: 'reports:exportDiot' } as const
export const maximumReportDocuments = 500
export const reportTypes = ['monthly', 'annual'] as const
export const reportDirections = ['issued', 'received'] as const
export type ReportType = typeof reportTypes[number]
export type ReportDirection = typeof reportDirections[number]

export const thirdPartyTypes = ['04', '05', '15'] as const
export const operationTypes = ['02', '03', '06', '07', '08', '85', '87'] as const
export type ThirdPartyType = typeof thirdPartyTypes[number]
export type OperationType = typeof operationTypes[number]
/** Tipos de operación permitidos por tipo de tercero, según el instructivo DIOT 2025 del SAT. */
export const operationTypesByThirdParty: Record<ThirdPartyType, readonly OperationType[]> = { '04': ['02', '03', '06', '08', '85'], '05': ['02', '03', '07'], '15': ['87'] }
export const supplierRegions = ['none', 'north', 'south'] as const
export const importKinds = ['none', 'tangible', 'intangible'] as const
export const creditKinds = ['exclusive', 'proportional', 'notRequirements', 'exemptActivities', 'notSubject'] as const
export type SupplierRegion = typeof supplierRegions[number]
export type ImportKind = typeof importKinds[number]
export type CreditKind = typeof creditKinds[number]
/** RFC genérico que el SAT exige para el tercero global (15). */
export const globalSupplierRfc = 'XAXX010101000'

/** Lo que calcula Main de un XML LOCAL; la dirección la decide el Host con el RFC del cliente. */
export interface FiscalDocumentSnapshot {
  uuid: string; version: '3.3' | '4.0'; voucherType: 'I' | 'E'; issuedAt: string; series: string; folio: string
  issuerRfc: string; issuerName: string; receiverRfc: string; receiverName: string
  currency: string; exchangeRate: string | null; paymentMethod: string | null; paymentForm: string | null
  subtotal: string; discount: string; total: string; breakdown: ReportAmounts; conceptSummary: string; issueCount: number
}
/** Importes con 2 decimales: desglose de un CFDI o totales de un reporte (en MXN, egresos en negativo). */
export interface ReportAmounts {
  vatBase16: string; vat16: string; vatBase8: string; vat8: string; vatBase0: string; exemptBase: string; notSubjectBase: string
  vatWithheld: string; isrWithheld: string; iepsWithheld: string; iepsTransferred: string; otherTaxes: string
}
export const reportAmountKeys = ['vatBase16', 'vat16', 'vatBase8', 'vat8', 'vatBase0', 'exemptBase', 'notSubjectBase', 'vatWithheld', 'isrWithheld', 'iepsWithheld', 'iepsTransferred', 'otherTaxes'] as const

export interface DiotSupplierSettings {
  thirdPartyType: ThirdPartyType; operationType: OperationType; foreignTaxId: string; countryCode: string; jurisdiction: string
  region: SupplierRegion; importKind: ImportKind; creditKind: CreditKind; creditProportion: string; hasFiscalEffect: boolean
}
export interface DiotSupplier extends DiotSupplierSettings { rfc: string; displayName: string; revision: number | null }
export const defaultSupplierSettings: DiotSupplierSettings = { thirdPartyType: '04', operationType: '85', foreignTaxId: '', countryCode: '', jurisdiction: '', region: 'none', importKind: 'none', creditKind: 'exclusive', creditProportion: '1.0000', hasFiscalEffect: true }

/** Lo que pide la vista; Main lo completa con los análisis LOCAL antes de enviarlo al Host. */
export interface FiscalReportAddition { clientId: string; reportType: ReportType; displayName: string; uuids: string[] }
export type FiscalReportRequest =
  { action: 'list'; clientId: string | null; fiscalYear: number } |
  { action: 'get'; reportId: string } |
  { action: 'diot'; reportId: string } |
  { action: 'removeDocument'; reportId: string; revision: number; uuid: string } |
  { action: 'delete'; reportId: string; revision: number } |
  { action: 'saveSupplier'; clientId: string; rfc: string; revision: number | null; settings: DiotSupplierSettings }
/** Sólo Main la arma (canal `reports:addDocuments`); la vista no puede enviar `documents`. */
export type FiscalReportHostRequest = FiscalReportRequest |
  { action: 'addDocuments'; clientId: string; reportType: ReportType; displayName: string; documents: FiscalDocumentSnapshot[] }

export interface FiscalReportSummary {
  reportId: string; folio: number; clientId: string; clientDisplayName: string; reportType: ReportType; direction: ReportDirection
  fiscalYear: number; fiscalMonth: number; displayName: string; documentCount: number; revision: number; createdAt: string
}
export interface DocumentAvailability { deviceAlias: string; isThisDevice: boolean }
export interface FiscalReportDocument {
  uuid: string; voucherType: 'I' | 'E'; issuedAt: string; series: string; folio: string; counterpartRfc: string; counterpartName: string
  currency: string; exchangeRate: string | null; paymentMethod: string | null; paymentForm: string | null
  subtotal: string; discount: string; total: string; totalMxn: string; breakdown: ReportAmounts; conceptSummary: string; issueCount: number
  availability: DocumentAvailability[]
}
export interface FiscalReportTotals extends ReportAmounts { subtotal: string; discount: string; total: string; documentCount: number }
export interface FiscalReportDetail { report: FiscalReportSummary; documents: FiscalReportDocument[]; totals: FiscalReportTotals; hasDiot: boolean; canManage: boolean }

export const diotFieldCount = 54
export const diotIssueCodes = ['missingExchangeRate', 'vat8WithoutRegion', 'refundExceedsValue', 'amountTooLarge', 'missingForeignTaxId', 'missingCountry', 'missingJurisdiction', 'negativeAmountClamped'] as const
export type DiotIssueCode = typeof diotIssueCodes[number]
/** `isBlocking`: el TXT no se puede exportar hasta resolverlo; los demás son avisos. */
export interface DiotIssue { code: DiotIssueCode; rfc: string; isBlocking: boolean }
export interface DiotRow { key: string; supplierRfc: string; displayName: string; documentCount: number; fields: string[] }
export interface DiotResult { reportId: string; fileName: string; rows: DiotRow[]; suppliers: DiotSupplier[]; issues: DiotIssue[]; canExport: boolean; canManage: boolean }

export type FiscalReportResult =
  { status: 'listed'; reports: FiscalReportSummary[]; canManage: boolean } |
  { status: 'detail'; detail: FiscalReportDetail } |
  { status: 'diot'; diot: DiotResult } |
  { status: 'added'; report: FiscalReportSummary; addedCount: number; isNewReport: boolean } |
  { status: 'removed'; isReportDeleted: boolean } |
  { status: 'deleted' } |
  { status: 'supplierSaved'; supplier: DiotSupplier }
export type FileSaveResult = 'saved' | 'cancelled'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const decimalPattern = /^-?\d{1,18}(\.\d{1,6})?$/
const centsPattern = /^-?\d{1,18}\.\d{2}$/
function exactKeys(data: Record<string, unknown>, keys: readonly string[]): void {
  if (Object.keys(data).sort().join() !== [...keys].sort().join()) throw new Error('Invalid fiscal report data')
}
function oneOf<T extends string>(value: unknown, values: readonly T[]): T { if (!values.includes(value as T)) throw new Error('Invalid fiscal report data'); return value as T }
function text(value: unknown, maximum: number, isEmptyAllowed = true): string {
  if (typeof value !== 'string' || value.length > maximum || (!isEmptyAllowed && !value.trim()) || [...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) throw new Error('Invalid fiscal report text')
  return value
}
function optionalText(value: unknown, maximum: number): string | null { return value === null ? null : text(value, maximum) }
function decimal(value: unknown): string { if (typeof value !== 'string' || !decimalPattern.test(value)) throw new Error('Invalid fiscal amount'); return value }
function optionalDecimal(value: unknown): string | null { return value === null ? null : decimal(value) }
function cents(value: unknown): string { if (typeof value !== 'string' || !centsPattern.test(value)) throw new Error('Invalid fiscal amount'); return value }
function count(value: unknown, maximum = Number.MAX_SAFE_INTEGER): number { if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > maximum) throw new Error('Invalid count'); return Number(value) }
function revision(value: unknown): number { return count(value) }
export function parseCfdiUuid(value: unknown): string { if (typeof value !== 'string' || !uuidPattern.test(value)) throw new Error('Invalid CFDI UUID'); return value }
export function parseRfc(value: unknown): string { if (typeof value !== 'string' || !rfcPattern.test(value)) throw new Error('Invalid RFC'); return value }
function list<T>(value: unknown, maximum: number, parse: (item: unknown) => T): T[] {
  if (!Array.isArray(value) || value.length > maximum) throw new Error('Invalid fiscal report list')
  return value.map(parse)
}
function parseAmounts(value: unknown): ReportAmounts {
  const data = pairingRecord(value); exactKeys(data, reportAmountKeys)
  return Object.fromEntries(reportAmountKeys.map(key => [key, cents(data[key])])) as unknown as ReportAmounts
}
function parseDisplayName(value: unknown): string { return text(value, 180, false).trim() }

export function parseSupplierSettings(value: unknown): DiotSupplierSettings {
  const data = pairingRecord(value)
  exactKeys(data, Object.keys(defaultSupplierSettings))
  const thirdPartyType = oneOf(data.thirdPartyType, thirdPartyTypes)
  const operationType = oneOf(data.operationType, operationTypes)
  if (!operationTypesByThirdParty[thirdPartyType].includes(operationType)) throw new Error('Invalid DIOT operation type')
  if (typeof data.creditProportion !== 'string' || !/^(0(\.\d{1,4})?|1(\.0{1,4})?)$/.test(data.creditProportion)) throw new Error('Invalid credit proportion')
  if (typeof data.hasFiscalEffect !== 'boolean') throw new Error('Invalid fiscal effect')
  const countryCode = text(data.countryCode, 3).toUpperCase()
  if (countryCode && !/^[A-Z]{3}$/.test(countryCode)) throw new Error('Invalid country code')
  return { thirdPartyType, operationType, foreignTaxId: text(data.foreignTaxId, 40).trim(), countryCode, jurisdiction: text(data.jurisdiction, 300).trim(),
    region: oneOf(data.region, supplierRegions), importKind: oneOf(data.importKind, importKinds), creditKind: oneOf(data.creditKind, creditKinds),
    creditProportion: Number(data.creditProportion).toFixed(4), hasFiscalEffect: data.hasFiscalEffect }
}

export function parseFiscalReportAddition(value: unknown): FiscalReportAddition {
  const data = pairingRecord(value); exactKeys(data, ['clientId', 'reportType', 'displayName', 'uuids'])
  const uuids = list(data.uuids, maximumReportDocuments, parseCfdiUuid)
  if (!uuids.length || new Set(uuids).size !== uuids.length) throw new Error('Invalid CFDI selection')
  return { clientId: parseHostId(data.clientId), reportType: oneOf(data.reportType, reportTypes), displayName: parseDisplayName(data.displayName), uuids }
}

/** Contrato cerrado de la vista: nunca acepta importes, dirección ni periodo calculados por la vista. */
export function parseFiscalReportRequest(value: unknown): FiscalReportRequest {
  const data = pairingRecord(value)
  if (data.action === 'list') {
    exactKeys(data, ['action', 'clientId', 'fiscalYear'])
    const fiscalYear = count(data.fiscalYear, 2100)
    if (fiscalYear < 2000) throw new Error('Invalid fiscal year')
    return { action: 'list', clientId: data.clientId === null ? null : parseHostId(data.clientId), fiscalYear }
  }
  if (data.action === 'get' || data.action === 'diot') { exactKeys(data, ['action', 'reportId']); return { action: data.action, reportId: parseHostId(data.reportId) } }
  if (data.action === 'removeDocument') { exactKeys(data, ['action', 'reportId', 'revision', 'uuid']); return { action: 'removeDocument', reportId: parseHostId(data.reportId), revision: revision(data.revision), uuid: parseCfdiUuid(data.uuid) } }
  if (data.action === 'delete') { exactKeys(data, ['action', 'reportId', 'revision']); return { action: 'delete', reportId: parseHostId(data.reportId), revision: revision(data.revision) } }
  if (data.action === 'saveSupplier') {
    exactKeys(data, ['action', 'clientId', 'rfc', 'revision', 'settings'])
    return { action: 'saveSupplier', clientId: parseHostId(data.clientId), rfc: parseRfc(data.rfc), revision: data.revision === null ? null : revision(data.revision), settings: parseSupplierSettings(data.settings) }
  }
  throw new Error('Invalid fiscal report request')
}

export function parseFiscalDocumentSnapshot(value: unknown): FiscalDocumentSnapshot {
  const data = pairingRecord(value)
  exactKeys(data, ['uuid', 'version', 'voucherType', 'issuedAt', 'series', 'folio', 'issuerRfc', 'issuerName', 'receiverRfc', 'receiverName', 'currency', 'exchangeRate', 'paymentMethod', 'paymentForm',
    'subtotal', 'discount', 'total', 'breakdown', 'conceptSummary', 'issueCount'])
  if (typeof data.issuedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(data.issuedAt)) throw new Error('Invalid issue date')
  return { uuid: parseCfdiUuid(data.uuid), version: oneOf(data.version, ['3.3', '4.0'] as const), voucherType: oneOf(data.voucherType, ['I', 'E'] as const), issuedAt: data.issuedAt,
    series: text(data.series, 25), folio: text(data.folio, 40), issuerRfc: parseRfc(data.issuerRfc), issuerName: text(data.issuerName, 300), receiverRfc: parseRfc(data.receiverRfc), receiverName: text(data.receiverName, 300),
    currency: text(data.currency, 10, false), exchangeRate: optionalDecimal(data.exchangeRate), paymentMethod: optionalText(data.paymentMethod, 3), paymentForm: optionalText(data.paymentForm, 2),
    subtotal: decimal(data.subtotal), discount: decimal(data.discount), total: decimal(data.total), breakdown: parseAmounts(data.breakdown), conceptSummary: text(data.conceptSummary, 500), issueCount: count(data.issueCount, 50) }
}
/** Lo que el Host acepta: la petición de la vista o `addDocuments`, que sólo arma Main. */
export function parseFiscalReportHostRequest(value: unknown): FiscalReportHostRequest {
  const data = pairingRecord(value)
  if (data.action !== 'addDocuments') return parseFiscalReportRequest(value)
  exactKeys(data, ['action', 'clientId', 'reportType', 'displayName', 'documents'])
  const documents = list(data.documents, maximumReportDocuments, parseFiscalDocumentSnapshot)
  if (!documents.length || new Set(documents.map(item => item.uuid)).size !== documents.length) throw new Error('Invalid CFDI selection')
  return { action: 'addDocuments', clientId: parseHostId(data.clientId), reportType: oneOf(data.reportType, reportTypes), displayName: parseDisplayName(data.displayName), documents }
}

function parseSummary(value: unknown): FiscalReportSummary {
  const data = pairingRecord(value)
  exactKeys(data, ['reportId', 'folio', 'clientId', 'clientDisplayName', 'reportType', 'direction', 'fiscalYear', 'fiscalMonth', 'displayName', 'documentCount', 'revision', 'createdAt'])
  if (typeof data.createdAt !== 'string' || !Number.isFinite(Date.parse(data.createdAt))) throw new Error('Invalid timestamp')
  return { reportId: parseHostId(data.reportId), folio: count(data.folio), clientId: parseHostId(data.clientId), clientDisplayName: pairingText(data.clientDisplayName, 200),
    reportType: oneOf(data.reportType, reportTypes), direction: oneOf(data.direction, reportDirections), fiscalYear: count(data.fiscalYear, 2100), fiscalMonth: count(data.fiscalMonth, 12),
    displayName: parseDisplayName(data.displayName), documentCount: count(data.documentCount, 100000), revision: revision(data.revision), createdAt: data.createdAt }
}
function parseSupplier(value: unknown): DiotSupplier {
  const data = pairingRecord(value)
  const { rfc, displayName, revision: supplierRevision, ...settings } = data
  return { rfc: parseRfc(rfc), displayName: text(displayName, 300), revision: supplierRevision === null ? null : revision(supplierRevision), ...parseSupplierSettings(settings) }
}
function parseDocument(value: unknown): FiscalReportDocument {
  const data = pairingRecord(value)
  exactKeys(data, ['uuid', 'voucherType', 'issuedAt', 'series', 'folio', 'counterpartRfc', 'counterpartName', 'currency', 'exchangeRate', 'paymentMethod', 'paymentForm', 'subtotal', 'discount', 'total', 'totalMxn', 'breakdown', 'conceptSummary', 'issueCount', 'availability'])
  return { uuid: parseCfdiUuid(data.uuid), voucherType: oneOf(data.voucherType, ['I', 'E'] as const), issuedAt: text(data.issuedAt, 19, false), series: text(data.series, 25), folio: text(data.folio, 40),
    counterpartRfc: parseRfc(data.counterpartRfc), counterpartName: text(data.counterpartName, 300), currency: text(data.currency, 10, false), exchangeRate: optionalDecimal(data.exchangeRate),
    paymentMethod: optionalText(data.paymentMethod, 3), paymentForm: optionalText(data.paymentForm, 2), subtotal: decimal(data.subtotal), discount: decimal(data.discount), total: decimal(data.total), totalMxn: cents(data.totalMxn),
    breakdown: parseAmounts(data.breakdown), conceptSummary: text(data.conceptSummary, 500), issueCount: count(data.issueCount, 50),
    availability: list(data.availability, 100, item => { const entry = pairingRecord(item); exactKeys(entry, ['deviceAlias', 'isThisDevice']); if (typeof entry.isThisDevice !== 'boolean') throw new Error('Invalid availability'); return { deviceAlias: text(entry.deviceAlias, 100), isThisDevice: entry.isThisDevice } }) }
}
function parseDiot(value: unknown): DiotResult {
  const data = pairingRecord(value); exactKeys(data, ['reportId', 'fileName', 'rows', 'suppliers', 'issues', 'canExport', 'canManage'])
  if (typeof data.canExport !== 'boolean' || typeof data.canManage !== 'boolean') throw new Error('Invalid DIOT')
  if (typeof data.fileName !== 'string' || !/^DIOT_[A-ZÑ&0-9]{12,13}_\d{4}_\d{2}\.txt$/.test(data.fileName)) throw new Error('Invalid DIOT file name')
  return { reportId: parseHostId(data.reportId), fileName: data.fileName, canExport: data.canExport, canManage: data.canManage,
    rows: list(data.rows, 5000, item => {
      const row = pairingRecord(item); exactKeys(row, ['key', 'supplierRfc', 'displayName', 'documentCount', 'fields'])
      const fields = list(row.fields, diotFieldCount, field => text(field, 300))
      if (fields.length !== diotFieldCount) throw new Error('Invalid DIOT row')
      return { key: text(row.key, 400), supplierRfc: text(row.supplierRfc, 13), displayName: text(row.displayName, 300), documentCount: count(row.documentCount), fields }
    }),
    suppliers: list(data.suppliers, 5000, parseSupplier),
    issues: list(data.issues, 20000, item => { const issue = pairingRecord(item); exactKeys(issue, ['code', 'rfc', 'isBlocking']); if (typeof issue.isBlocking !== 'boolean') throw new Error('Invalid DIOT issue'); return { code: oneOf(issue.code, diotIssueCodes), rfc: text(issue.rfc, 13), isBlocking: issue.isBlocking } }) }
}
/** Preload reconstruye cada resultado campo por campo; claves de más o tipos distintos se rechazan. */
export function parseFiscalReportResult(value: unknown): FiscalReportResult {
  const data = pairingRecord(value)
  if (data.status === 'listed') { exactKeys(data, ['status', 'reports', 'canManage']); if (typeof data.canManage !== 'boolean') throw new Error('Invalid capabilities'); return { status: 'listed', reports: list(data.reports, 1000, parseSummary), canManage: data.canManage } }
  if (data.status === 'detail') {
    exactKeys(data, ['status', 'detail'])
    const detail = pairingRecord(data.detail); exactKeys(detail, ['report', 'documents', 'totals', 'hasDiot', 'canManage'])
    const totals = pairingRecord(detail.totals)
    const { subtotal, discount, total, documentCount, ...amounts } = totals
    if (typeof detail.hasDiot !== 'boolean' || typeof detail.canManage !== 'boolean') throw new Error('Invalid report detail')
    return { status: 'detail', detail: { report: parseSummary(detail.report), documents: list(detail.documents, 100000, parseDocument), hasDiot: detail.hasDiot, canManage: detail.canManage,
      totals: { ...parseAmounts(amounts), subtotal: cents(subtotal), discount: cents(discount), total: cents(total), documentCount: count(documentCount) } } }
  }
  if (data.status === 'diot') { exactKeys(data, ['status', 'diot']); return { status: 'diot', diot: parseDiot(data.diot) } }
  if (data.status === 'added') {
    exactKeys(data, ['status', 'report', 'addedCount', 'isNewReport'])
    if (typeof data.isNewReport !== 'boolean') throw new Error('Invalid result')
    return { status: 'added', report: parseSummary(data.report), addedCount: count(data.addedCount, maximumReportDocuments), isNewReport: data.isNewReport }
  }
  if (data.status === 'removed') { exactKeys(data, ['status', 'isReportDeleted']); if (typeof data.isReportDeleted !== 'boolean') throw new Error('Invalid result'); return { status: 'removed', isReportDeleted: data.isReportDeleted } }
  if (data.status === 'deleted') { exactKeys(data, ['status']); return { status: 'deleted' } }
  if (data.status === 'supplierSaved') { exactKeys(data, ['status', 'supplier']); return { status: 'supplierSaved', supplier: parseSupplier(data.supplier) } }
  throw new Error('Invalid fiscal report result')
}
export function parseFileSaveResult(value: unknown): FileSaveResult { if (value !== 'saved' && value !== 'cancelled') throw new Error('Invalid save result'); return value }
