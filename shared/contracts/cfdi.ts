import { cfdiVoucherTypes, rfcPattern, type CfdiVoucherType } from './localXml'

/**
 * Análisis estructurado de un CFDI (6.1). Se calcula en Main a partir del XML LOCAL cada vez que se
 * pide: no se guarda ni se envía al Host. Los datos derivados sólo llegarán al Host cuando el CFDI se
 * relacione con un reporte (6.2, decisión del usuario del 2026-10-01).
 *
 * Importes: siempre texto decimal exacto, nunca `number`.
 * - Los del XML (`amount`, `total`) conservan sus decimales originales.
 * - Los derivados (`breakdown`) llevan 2 decimales, redondeados a la mitad hacia arriba.
 *
 * Las incidencias (`issues`) son avisos: un CFDI que no cuadra se conserva y se muestra con su aviso.
 */
export const maximumAnalyzedConcepts = 1000
export const maximumAnalyzedPayments = 500

export type CfdiTaxCode = '001' | '002' | '003'
export interface CfdiTaxLine { taxCode: string; factorType: 'Tasa' | 'Cuota' | 'Exento' | string; rate: string | null; base: string | null; amount: string | null }
export interface CfdiConcept {
  productCode: string; identification: string; description: string; quantity: string; unitCode: string; unit: string
  unitValue: string; amount: string; discount: string | null; taxObject: string | null
  transfers: CfdiTaxLine[]; withholdings: CfdiTaxLine[]
}
export interface CfdiParty { rfc: string; name: string; taxRegime: string | null }
export interface CfdiRelation { relationType: string; uuids: string[] }
export interface CfdiPaymentDocument { uuid: string; installment: string | null; previousBalance: string | null; paidAmount: string; remainingBalance: string | null; currency: string | null }
export interface CfdiPayment { paidAt: string; paymentForm: string; currency: string; exchangeRate: string | null; amount: string; documents: CfdiPaymentDocument[] }
/** Desglose como en el sistema original: IVA por tasa, exento, no objeto, retenciones e IEPS. */
export interface CfdiTaxBreakdown {
  vatBase16: string; vat16: string; vatBase8: string; vat8: string; vatBase0: string; exemptBase: string; notSubjectBase: string
  vatWithheld: string; isrWithheld: string; iepsWithheld: string; iepsTransferred: string; otherTaxes: string
}
export const cfdiIssueCodes = ['subtotalMismatch', 'discountMismatch', 'totalMismatch', 'transferredTaxMismatch', 'withheldTaxMismatch', 'conceptTaxMismatch',
  'paymentAmountMismatch', 'nonZeroTotal', 'missingConcepts', 'missingExchangeRate', 'invalidAmount', 'truncatedConcepts'] as const
export type CfdiIssueCode = typeof cfdiIssueCodes[number]
/** Aviso con los importes que no cuadran (declarado y calculado), para explicarlo al usuario. */
export interface CfdiIssue { code: CfdiIssueCode; declared: string | null; computed: string | null }

export interface CfdiAnalysis {
  uuid: string; version: '3.3' | '4.0'; voucherType: CfdiVoucherType
  series: string; folio: string; issuedAt: string; stampedAt: string | null
  currency: string; exchangeRate: string | null; paymentForm: string | null; paymentMethod: string | null; usage: string | null; exportation: string | null
  issuer: CfdiParty; receiver: CfdiParty
  subtotal: string; discount: string | null; total: string; transferredTaxTotal: string | null; withheldTaxTotal: string | null
  concepts: CfdiConcept[]; relations: CfdiRelation[]; payments: CfdiPayment[]
  breakdown: CfdiTaxBreakdown; issues: CfdiIssue[]
}

const decimalPattern = /^-?\d{1,18}(\.\d{1,6})?$/
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid CFDI analysis')
  return value as Record<string, unknown>
}
function exactKeys(data: Record<string, unknown>, keys: readonly string[]): void {
  if (Object.keys(data).sort().join() !== [...keys].sort().join()) throw new Error('Invalid CFDI analysis')
}
function text(value: unknown, maximum: number): string {
  if (typeof value !== 'string' || value.length > maximum || [...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) throw new Error('Invalid CFDI analysis')
  return value
}
function optionalText(value: unknown, maximum: number): string | null { return value === null ? null : text(value, maximum) }
function amount(value: unknown): string { if (typeof value !== 'string' || !decimalPattern.test(value)) throw new Error('Invalid CFDI amount'); return value }
function optionalAmount(value: unknown): string | null { return value === null ? null : amount(value) }
function list<T>(value: unknown, maximum: number, parse: (item: unknown) => T): T[] {
  if (!Array.isArray(value) || value.length > maximum) throw new Error('Invalid CFDI analysis')
  return value.map(parse)
}
function taxLine(value: unknown): CfdiTaxLine {
  const data = record(value); exactKeys(data, ['taxCode', 'factorType', 'rate', 'base', 'amount'])
  return { taxCode: text(data.taxCode, 3), factorType: text(data.factorType, 10), rate: optionalAmount(data.rate), base: optionalAmount(data.base), amount: optionalAmount(data.amount) }
}
function party(value: unknown): CfdiParty {
  const data = record(value); exactKeys(data, ['rfc', 'name', 'taxRegime'])
  const rfc = text(data.rfc, 13)
  if (!rfcPattern.test(rfc)) throw new Error('Invalid CFDI RFC')
  return { rfc, name: text(data.name, 300), taxRegime: optionalText(data.taxRegime, 3) }
}

/** Preload reconstruye el análisis campo por campo: la vista no recibe objetos arbitrarios. */
export function parseCfdiAnalysis(value: unknown): CfdiAnalysis {
  const data = record(value)
  exactKeys(data, ['uuid', 'version', 'voucherType', 'series', 'folio', 'issuedAt', 'stampedAt', 'currency', 'exchangeRate', 'paymentForm', 'paymentMethod', 'usage', 'exportation',
    'issuer', 'receiver', 'subtotal', 'discount', 'total', 'transferredTaxTotal', 'withheldTaxTotal', 'concepts', 'relations', 'payments', 'breakdown', 'issues'])
  if (typeof data.uuid !== 'string' || !uuidPattern.test(data.uuid)) throw new Error('Invalid CFDI UUID')
  if (data.version !== '3.3' && data.version !== '4.0') throw new Error('Invalid CFDI version')
  if (!cfdiVoucherTypes.includes(data.voucherType as CfdiVoucherType)) throw new Error('Invalid CFDI type')
  const breakdown = record(data.breakdown)
  const breakdownKeys = ['vatBase16', 'vat16', 'vatBase8', 'vat8', 'vatBase0', 'exemptBase', 'notSubjectBase', 'vatWithheld', 'isrWithheld', 'iepsWithheld', 'iepsTransferred', 'otherTaxes'] as const
  exactKeys(breakdown, breakdownKeys)
  return {
    uuid: data.uuid, version: data.version, voucherType: data.voucherType as CfdiVoucherType,
    series: text(data.series, 25), folio: text(data.folio, 40), issuedAt: text(data.issuedAt, 19), stampedAt: optionalText(data.stampedAt, 19),
    currency: text(data.currency, 10), exchangeRate: optionalAmount(data.exchangeRate), paymentForm: optionalText(data.paymentForm, 2), paymentMethod: optionalText(data.paymentMethod, 3),
    usage: optionalText(data.usage, 4), exportation: optionalText(data.exportation, 2),
    issuer: party(data.issuer), receiver: party(data.receiver),
    subtotal: amount(data.subtotal), discount: optionalAmount(data.discount), total: amount(data.total),
    transferredTaxTotal: optionalAmount(data.transferredTaxTotal), withheldTaxTotal: optionalAmount(data.withheldTaxTotal),
    concepts: list(data.concepts, maximumAnalyzedConcepts, item => {
      const concept = record(item)
      exactKeys(concept, ['productCode', 'identification', 'description', 'quantity', 'unitCode', 'unit', 'unitValue', 'amount', 'discount', 'taxObject', 'transfers', 'withholdings'])
      return { productCode: text(concept.productCode, 8), identification: text(concept.identification, 100), description: text(concept.description, 1000), quantity: amount(concept.quantity),
        unitCode: text(concept.unitCode, 3), unit: text(concept.unit, 20), unitValue: amount(concept.unitValue), amount: amount(concept.amount), discount: optionalAmount(concept.discount),
        taxObject: optionalText(concept.taxObject, 2), transfers: list(concept.transfers, 20, taxLine), withholdings: list(concept.withholdings, 20, taxLine) }
    }),
    relations: list(data.relations, 50, item => {
      const relation = record(item); exactKeys(relation, ['relationType', 'uuids'])
      return { relationType: text(relation.relationType, 2), uuids: list(relation.uuids, 500, uuid => { if (typeof uuid !== 'string' || !uuidPattern.test(uuid)) throw new Error('Invalid CFDI UUID'); return uuid }) }
    }),
    payments: list(data.payments, maximumAnalyzedPayments, item => {
      const payment = record(item); exactKeys(payment, ['paidAt', 'paymentForm', 'currency', 'exchangeRate', 'amount', 'documents'])
      return { paidAt: text(payment.paidAt, 19), paymentForm: text(payment.paymentForm, 2), currency: text(payment.currency, 10), exchangeRate: optionalAmount(payment.exchangeRate), amount: amount(payment.amount),
        documents: list(payment.documents, 500, document => {
          const entry = record(document); exactKeys(entry, ['uuid', 'installment', 'previousBalance', 'paidAmount', 'remainingBalance', 'currency'])
          if (typeof entry.uuid !== 'string' || !uuidPattern.test(entry.uuid)) throw new Error('Invalid CFDI UUID')
          return { uuid: entry.uuid, installment: optionalText(entry.installment, 10), previousBalance: optionalAmount(entry.previousBalance), paidAmount: amount(entry.paidAmount), remainingBalance: optionalAmount(entry.remainingBalance), currency: optionalText(entry.currency, 10) }
        }) }
    }),
    breakdown: Object.fromEntries(breakdownKeys.map(key => [key, amount(breakdown[key])])) as unknown as CfdiTaxBreakdown,
    issues: list(data.issues, 50, item => {
      const issue = record(item); exactKeys(issue, ['code', 'declared', 'computed'])
      if (!cfdiIssueCodes.includes(issue.code as CfdiIssueCode)) throw new Error('Invalid CFDI issue')
      return { code: issue.code as CfdiIssueCode, declared: optionalAmount(issue.declared), computed: optionalAmount(issue.computed) }
    })
  }
}
