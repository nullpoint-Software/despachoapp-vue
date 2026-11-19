import { pairingRecord, pairingText } from './pairing'
import { parseHostId } from './discovery'
import { emptyClientProfile, parseClientProfile } from './clientProfile'

/**
 * Opiniones de cumplimiento 32-D del SAT (6.4). Decisiones del usuario (2026-10-01):
 * - sólo la consulta pública por RFC (sin credenciales; requiere que el cliente haya autorizado publicarla);
 * - el Host consulta y guarda, porque opiniones y PDF son GLOBAL;
 * - se conserva sólo el último PDF de cada cliente, en su expediente; el historial guarda cada resultado.
 *
 * Las consultas siempre son lotes (uno o varios clientes) que el Host ejecuta uno tras otro. Así la
 * programación automática de 7.1 creará lotes con este mismo contrato.
 *
 * Desde 2026-10-11 ([[SAT-PORTAL]]) una opinión también puede llegar del portal del SAT con RFC y CIEC: la captura
 * Main en una ventana aparte (la persona escribe el captcha) y el Host la registra sin lote. `origin` distingue
 * `public` (consulta pública del Host) de `portal` (con CIEC desde un equipo); migración 094.
 */
export const opinionOrigins = ['public', 'portal'] as const
export type OpinionOrigin = typeof opinionOrigins[number]
export const complianceOpinionsChannel = 'opinions:operate'
export const opinionStatuses = ['positive', 'negative', 'suspended', 'withoutObligations', 'notRegistered', 'cancelled', 'notLocated', 'notPublic', 'other', 'error'] as const
export type OpinionStatus = typeof opinionStatuses[number]
/** Cliente sin consultas todavía (sólo en la lista, nunca guardado). */
export type OpinionListStatus = OpinionStatus | 'notQueried'
export const opinionBatchStates = ['running', 'completed', 'cancelled'] as const
export type OpinionBatchState = typeof opinionBatchStates[number]
export const maximumOpinionBatchClients = 1000
/** La opinión positiva vale 30 días naturales desde su emisión. */
export const opinionValidityDays = 30

export interface OpinionPendingItem { code: 'declarations' | 'credits' | 'location' | 'presumption69B' | 'taxCrime' | 'authorizePublic' | 'reviewDetail'; label: string; isConfirmed: boolean }
export interface ComplianceOpinion {
  opinionId: string; status: OpinionStatus; issuedAt: string | null; validUntil: string | null; folio: string | null; message: string
  pendingItems: OpinionPendingItem[]; documentId: string | null; isCurrentDocument: boolean; queriedAt: string; requestedByDisplayName: string
  origin: OpinionOrigin
}
/** Fila de la lista: el último resultado útil del cliente y el último error si fue posterior. */
export interface ClientOpinionSummary {
  clientId: string; clientDisplayName: string; rfc: string | null; taxRegime: string; additionalTaxRegimes: string[]; status: OpinionListStatus; isValid: boolean
  latest: ComplianceOpinion | null; lastErrorMessage: string | null; lastErrorAt: string | null
}
export interface OpinionBatch {
  batchId: string; state: OpinionBatchState; totalCount: number; processedCount: number; answeredCount: number; failedCount: number
  requestedByDisplayName: string; createdAt: string; finishedAt: string | null
}

export type OpinionRequest =
  { action: 'list' } |
  { action: 'history'; clientId: string } |
  { action: 'query'; clientIds: string[] } |
  { action: 'batchStatus' } |
  { action: 'cancelBatch'; batchId: string }
export type OpinionResult =
  { status: 'listed'; clients: ClientOpinionSummary[]; canQuery: boolean; batch: OpinionBatch | null } |
  { status: 'history'; clientId: string; opinions: ComplianceOpinion[] } |
  { status: 'batch'; batch: OpinionBatch | null }

const timestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/
function exactKeys(data: Record<string, unknown>, keys: readonly string[]): void {
  if (Object.keys(data).sort().join() !== [...keys].sort().join()) throw new Error('Invalid opinion data')
}
function oneOf<T extends string>(value: unknown, values: readonly T[]): T { if (!values.includes(value as T)) throw new Error('Invalid opinion data'); return value as T }
function text(value: unknown, maximum: number): string {
  if (typeof value !== 'string' || value.length > maximum || [...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) throw new Error('Invalid opinion text')
  return value
}
function count(value: unknown): number { if (!Number.isSafeInteger(value) || Number(value) < 0) throw new Error('Invalid count'); return Number(value) }
function instant(value: unknown): string { if (typeof value !== 'string' || value.length > 40 || !Number.isFinite(Date.parse(value))) throw new Error('Invalid timestamp'); return value }

export function parseOpinionRequest(value: unknown): OpinionRequest {
  const data = pairingRecord(value)
  if (data.action === 'list' || data.action === 'batchStatus') { exactKeys(data, ['action']); return { action: data.action } }
  if (data.action === 'history') { exactKeys(data, ['action', 'clientId']); return { action: 'history', clientId: parseHostId(data.clientId) } }
  if (data.action === 'cancelBatch') { exactKeys(data, ['action', 'batchId']); return { action: 'cancelBatch', batchId: parseHostId(data.batchId) } }
  if (data.action === 'query') {
    exactKeys(data, ['action', 'clientIds'])
    if (!Array.isArray(data.clientIds) || !data.clientIds.length || data.clientIds.length > maximumOpinionBatchClients) throw new Error('Invalid opinion selection')
    const clientIds = data.clientIds.map(parseHostId)
    if (new Set(clientIds).size !== clientIds.length) throw new Error('Invalid opinion selection')
    return { action: 'query', clientIds }
  }
  throw new Error('Invalid opinion request')
}

function parseOpinion(value: unknown): ComplianceOpinion {
  const data = pairingRecord(value)
  exactKeys(data, ['opinionId', 'status', 'issuedAt', 'validUntil', 'folio', 'message', 'pendingItems', 'documentId', 'isCurrentDocument', 'queriedAt', 'requestedByDisplayName', 'origin'])
  if (data.issuedAt !== null && (typeof data.issuedAt !== 'string' || !timestampPattern.test(data.issuedAt))) throw new Error('Invalid issue date')
  if (data.validUntil !== null && (typeof data.validUntil !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.validUntil))) throw new Error('Invalid validity')
  if (typeof data.isCurrentDocument !== 'boolean' || !Array.isArray(data.pendingItems) || data.pendingItems.length > 20) throw new Error('Invalid opinion')
  return { opinionId: parseHostId(data.opinionId), status: oneOf(data.status, opinionStatuses), issuedAt: data.issuedAt as string | null, validUntil: data.validUntil as string | null,
    folio: data.folio === null ? null : text(data.folio, 40), message: text(data.message, 500), documentId: data.documentId === null ? null : parseHostId(data.documentId), isCurrentDocument: data.isCurrentDocument,
    pendingItems: data.pendingItems.map(item => {
      const entry = pairingRecord(item); exactKeys(entry, ['code', 'label', 'isConfirmed'])
      if (typeof entry.isConfirmed !== 'boolean') throw new Error('Invalid pending item')
      return { code: oneOf(entry.code, ['declarations', 'credits', 'location', 'presumption69B', 'taxCrime', 'authorizePublic', 'reviewDetail'] as const), label: text(entry.label, 200), isConfirmed: entry.isConfirmed }
    }),
    queriedAt: instant(data.queriedAt), requestedByDisplayName: pairingText(data.requestedByDisplayName, 200), origin: oneOf(data.origin, opinionOrigins) }
}
function parseBatch(value: unknown): OpinionBatch | null {
  if (value === null) return null
  const data = pairingRecord(value)
  exactKeys(data, ['batchId', 'state', 'totalCount', 'processedCount', 'answeredCount', 'failedCount', 'requestedByDisplayName', 'createdAt', 'finishedAt'])
  return { batchId: parseHostId(data.batchId), state: oneOf(data.state, opinionBatchStates), totalCount: count(data.totalCount), processedCount: count(data.processedCount), answeredCount: count(data.answeredCount),
    failedCount: count(data.failedCount), requestedByDisplayName: pairingText(data.requestedByDisplayName, 200), createdAt: instant(data.createdAt), finishedAt: data.finishedAt === null ? null : instant(data.finishedAt) }
}
export function parseOpinionResult(value: unknown): OpinionResult {
  const data = pairingRecord(value)
  if (data.status === 'listed') {
    exactKeys(data, ['status', 'clients', 'canQuery', 'batch'])
    if (!Array.isArray(data.clients) || data.clients.length > 5000 || typeof data.canQuery !== 'boolean') throw new Error('Invalid opinion list')
    return { status: 'listed', canQuery: data.canQuery, batch: parseBatch(data.batch), clients: data.clients.map(item => {
      const entry = pairingRecord(item)
      exactKeys(entry, ['clientId', 'clientDisplayName', 'rfc', 'taxRegime', 'additionalTaxRegimes', 'status', 'isValid', 'latest', 'lastErrorMessage', 'lastErrorAt'])
      if (typeof entry.isValid !== 'boolean') throw new Error('Invalid opinion list')
      return { clientId: parseHostId(entry.clientId), clientDisplayName: pairingText(entry.clientDisplayName, 200), rfc: entry.rfc === null ? null : text(entry.rfc, 13), taxRegime: text(entry.taxRegime, 100),
        additionalTaxRegimes: parseClientProfile({ ...emptyClientProfile(), additionalTaxRegimes: entry.additionalTaxRegimes }).additionalTaxRegimes, status: oneOf(entry.status, [...opinionStatuses, 'notQueried'] as const), isValid: entry.isValid, latest: entry.latest === null ? null : parseOpinion(entry.latest),
        lastErrorMessage: entry.lastErrorMessage === null ? null : text(entry.lastErrorMessage, 500), lastErrorAt: entry.lastErrorAt === null ? null : instant(entry.lastErrorAt) }
    }) }
  }
  if (data.status === 'history') {
    exactKeys(data, ['status', 'clientId', 'opinions'])
    if (!Array.isArray(data.opinions) || data.opinions.length > 100) throw new Error('Invalid history')
    return { status: 'history', clientId: parseHostId(data.clientId), opinions: data.opinions.map(parseOpinion) }
  }
  if (data.status === 'batch') { exactKeys(data, ['status', 'batch']); return { status: 'batch', batch: parseBatch(data.batch) } }
  throw new Error('Invalid opinion result')
}
