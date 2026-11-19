import { pairingRecord } from './pairing'
import { parseHostId } from './discovery'
import type { ClientAccess } from './clients'
import { parsePdfView, type PdfView } from './pdfViewer'

/**
 * Contratos del expediente GLOBAL por contribuyente.
 * Existen dos niveles: la vista (Renderer ↔ Main) nunca transporta rutas y sólo transporta bytes en `viewed`
 * (el PDF para el visor de Fiscenix, en memoria); el nivel Host (Main ↔ Host) transporta el PDF como base64 acotado.
 * Ninguno acepta el usuario actor ni rutas físicas.
 */
export const documentsChannel = 'documents:operate'
export const maximumDocumentBytes = 20 * 1024 * 1024
/** Longitud base64 del máximo permitido; limita memoria antes de decodificar. */
export const maximumDocumentBase64Length = Math.ceil(maximumDocumentBytes / 3) * 4
export const documentPageSize = 50
export const documentCategories = ['taxStatusCertificate', 'complianceOpinion', 'contract', 'identification', 'taxDocument', 'other'] as const
export type DocumentCategory = typeof documentCategories[number]
/** `ready`: clave verificada. `unconfigured`: el Host aún no recibió clave. `keyMismatch`: la clave local no corresponde al registro GLOBAL. */
export type DocumentAvailability = 'ready' | 'unconfigured' | 'keyMismatch'

export interface ClientDocument {
  documentId: string
  clientId: string
  displayName: string
  category: DocumentCategory
  sizeBytes: number
  sha256: string
  createdAt: string
  createdByDisplayName: string
  /** Resultado de la comprobación del archivo cifrado en el Host al listar; `false` conserva la fila para recuperación. */
  hasStoredFile: boolean
}
/**
 * Resumen de coordinación: sólo conteos, nunca nombres de archivos ni rutas del Host.
 * `pendingOperationCount` corresponde a este contribuyente. `unreferencedFileCount` es global y sólo
 * se informa a quien administra el despacho; para el resto es `null` y no revela actividad ajena.
 */
export interface DocumentRecoverySummary { pendingOperationCount: number; unreferencedFileCount: number | null }
export interface DocumentListResult {
  availability: DocumentAvailability
  clientId: string
  access: ClientAccess
  canUpload: boolean
  canDelete: boolean
  documents: ClientDocument[]
  nextCursor: number | null
  recovery: DocumentRecoverySummary | null
}

/**
 * Operaciones que la vista puede solicitar. `upload` y `saveCopy` abren diálogos nativos en Main.
 * `view` (2026-10-11) abre el PDF en el visor de Fiscenix: Main lo pide al Host (auditoría `view`) y devuelve un
 * `PdfView` de tipo `stored`; el PDF no sale de Fiscenix, por eso no requiere contraseña, igual que `saveCopy`.
 */
export type DocumentViewRequest =
  { action: 'list'; clientId: string; beforeCursor: number | null } |
  { action: 'upload'; clientId: string; category: DocumentCategory } |
  { action: 'view'; clientId: string; documentId: string } |
  { action: 'saveCopy'; clientId: string; documentId: string } |
  { action: 'delete'; clientId: string; documentId: string }
export type DocumentViewResult =
  { status: 'listed'; list: DocumentListResult } |
  { status: 'uploaded'; document: ClientDocument } |
  { status: 'viewed'; view: PdfView } |
  { status: 'saved' } | { status: 'deleted' } | { status: 'cancelled' }

/**
 * Operaciones que Main envía al Host después de leer el archivo elegido por el usuario.
 * `download` (copia fuera de Fiscenix) y `view` (visor de Fiscenix) exigen lo mismo y devuelven `downloaded`;
 * sólo cambia la acción que el Host audita, para distinguir quién consultó de quién se llevó una copia.
 * `recordPortalCertificate` (2026-10-11, [[SAT-PORTAL]]): la constancia (CSF) que Main obtuvo en el portal del SAT con
 * RFC y CIEC. Viaja por este canal porque `/session` acepta sólo 8 KB. El Host comprueba que sea una CSF del RFC del
 * cliente (idCIF y RFC impresos) y la sube con la carga normal (`upload`, categoría `taxStatusCertificate`). La acción de
 * la opinión con CIEC (`recordPortalOpinion`) se retiró el 2026-10-17.
 */
export type DocumentHostRequest =
  { action: 'list'; clientId: string; beforeCursor: number | null } |
  { action: 'upload'; clientId: string; category: DocumentCategory; displayName: string; content: string } |
  { action: 'download'; clientId: string; documentId: string } |
  { action: 'view'; clientId: string; documentId: string } |
  { action: 'delete'; clientId: string; documentId: string } |
  { action: 'recordPortalCertificate'; clientId: string; content: string }
/**
 * Resultado de registrar un PDF del portal (en ningún caso distinto de `recorded` se guarda nada):
 * - `recorded`: guardado;
 * - `rfcUnreadable` (decisión del usuario, 2026-10-11): el PDF no trae un RFC legible (vacío, escaneado u otro
 *   documento), así que el Host no puede confirmar que sea del cliente y lo rechaza;
 * - `rfcMismatch`: el RFC impreso es de otro contribuyente;
 * - `unreadable`: sólo para la CSF, trae el RFC del cliente pero no el idCIF (no es una constancia útil).
 */
export type PortalPdfOutcome = 'recorded' | 'rfcUnreadable' | 'rfcMismatch' | 'unreadable'
export const portalPdfOutcomes: readonly PortalPdfOutcome[] = ['recorded', 'rfcUnreadable', 'rfcMismatch', 'unreadable']
export type DocumentHostResult =
  { status: 'listed'; list: DocumentListResult } |
  { status: 'uploaded'; document: ClientDocument } |
  { status: 'downloaded'; document: ClientDocument; content: string } |
  { status: 'deleted' } |
  { status: 'portalCertificate'; outcome: PortalPdfOutcome; document: ClientDocument | null }

function exactKeys(data: Record<string, unknown>, keys: readonly string[]): void {
  if (Object.keys(data).sort().join() !== [...keys].sort().join()) throw new Error('Invalid document request')
}
function parseCategory(value: unknown): DocumentCategory {
  if (!documentCategories.includes(value as DocumentCategory)) throw new Error('Invalid document category')
  return value as DocumentCategory
}
function parseCursor(value: unknown): number | null {
  if (value === null) return null
  if (!Number.isSafeInteger(value) || Number(value) < 1) throw new Error('Invalid document cursor')
  return Number(value)
}
function parseCount(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) throw new Error('Invalid document count')
  return Number(value)
}

/**
 * Nombre visible del documento, derivado del nombre elegido por el usuario. No es una ruta:
 * se rechazan separadores y caracteres de control para que nunca se interprete como ubicación.
 */
export function parseDocumentDisplayName(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Invalid document name')
  const name = value.trim()
  if (!name || name.length > 160 || /[\\/]/.test(name) || [...name].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) throw new Error('Invalid document name')
  return name
}

/** Acepta sólo base64 canónico y acotado; el tamaño real y el formato PDF se validan al decodificar en Host. */
export function parseDocumentContent(value: unknown): string {
  if (typeof value !== 'string' || !value.length || value.length > maximumDocumentBase64Length || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new Error('Invalid document content')
  return value
}

export function parseDocumentViewRequest(value: unknown): DocumentViewRequest {
  const data = pairingRecord(value)
  if (data.action === 'list') { exactKeys(data, ['action', 'clientId', 'beforeCursor']); return { action: 'list', clientId: parseHostId(data.clientId), beforeCursor: parseCursor(data.beforeCursor) } }
  if (data.action === 'upload') { exactKeys(data, ['action', 'clientId', 'category']); return { action: 'upload', clientId: parseHostId(data.clientId), category: parseCategory(data.category) } }
  if (data.action === 'view' || data.action === 'saveCopy' || data.action === 'delete') { exactKeys(data, ['action', 'clientId', 'documentId']); return { action: data.action, clientId: parseHostId(data.clientId), documentId: parseHostId(data.documentId) } }
  throw new Error('Invalid document request')
}

export function parseDocumentHostRequest(value: unknown): DocumentHostRequest {
  const data = pairingRecord(value)
  if (data.action === 'list') { exactKeys(data, ['action', 'clientId', 'beforeCursor']); return { action: 'list', clientId: parseHostId(data.clientId), beforeCursor: parseCursor(data.beforeCursor) } }
  if (data.action === 'upload') {
    exactKeys(data, ['action', 'clientId', 'category', 'displayName', 'content'])
    return { action: 'upload', clientId: parseHostId(data.clientId), category: parseCategory(data.category), displayName: parseDocumentDisplayName(data.displayName), content: parseDocumentContent(data.content) }
  }
  if (data.action === 'download' || data.action === 'view' || data.action === 'delete') { exactKeys(data, ['action', 'clientId', 'documentId']); return { action: data.action, clientId: parseHostId(data.clientId), documentId: parseHostId(data.documentId) } }
  if (data.action === 'recordPortalCertificate') { exactKeys(data, ['action', 'clientId', 'content']); return { action: data.action, clientId: parseHostId(data.clientId), content: parseDocumentContent(data.content) } }
  throw new Error('Invalid document request')
}

function parsePortalPdfOutcome(value: unknown): PortalPdfOutcome {
  if (!portalPdfOutcomes.includes(value as PortalPdfOutcome)) throw new Error('Invalid document result')
  return value as PortalPdfOutcome
}

/** Reconstruye el DTO público; columnas SQL adicionales o rutas nunca atraviesan el contrato. */
export function parseClientDocument(value: unknown): ClientDocument {
  const data = pairingRecord(value)
  if (!Number.isSafeInteger(data.sizeBytes) || Number(data.sizeBytes) < 1 || Number(data.sizeBytes) > maximumDocumentBytes) throw new Error('Invalid document size')
  if (typeof data.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(data.sha256)) throw new Error('Invalid document hash')
  if (typeof data.createdAt !== 'string' || data.createdAt.length > 40 || !Number.isFinite(Date.parse(data.createdAt))) throw new Error('Invalid document date')
  if (typeof data.createdByDisplayName !== 'string' || !data.createdByDisplayName.trim() || data.createdByDisplayName.length > 100) throw new Error('Invalid document author')
  if (typeof data.hasStoredFile !== 'boolean') throw new Error('Invalid document file state')
  return { documentId: parseHostId(data.documentId), clientId: parseHostId(data.clientId), displayName: parseDocumentDisplayName(data.displayName), category: parseCategory(data.category),
    sizeBytes: Number(data.sizeBytes), sha256: data.sha256, createdAt: new Date(Date.parse(data.createdAt)).toISOString(), createdByDisplayName: data.createdByDisplayName.trim(), hasStoredFile: data.hasStoredFile }
}

export function parseDocumentListResult(value: unknown): DocumentListResult {
  const data = pairingRecord(value)
  if (!['ready', 'unconfigured', 'keyMismatch'].includes(String(data.availability))) throw new Error('Invalid document availability')
  if (data.access !== 'readOnly' && data.access !== 'readWrite') throw new Error('Invalid document access')
  if (typeof data.canUpload !== 'boolean' || typeof data.canDelete !== 'boolean') throw new Error('Invalid document capabilities')
  if (!Array.isArray(data.documents) || data.documents.length > documentPageSize) throw new Error('Invalid document list')
  const recovery = data.recovery === null ? null : pairingRecord(data.recovery)
  return { availability: data.availability as DocumentAvailability, clientId: parseHostId(data.clientId), access: data.access, canUpload: data.canUpload, canDelete: data.canDelete,
    documents: data.documents.map(parseClientDocument), nextCursor: parseCursor(data.nextCursor),
    recovery: recovery ? { pendingOperationCount: parseCount(recovery.pendingOperationCount), unreferencedFileCount: recovery.unreferencedFileCount === null ? null : parseCount(recovery.unreferencedFileCount) } : null }
}

export function parseDocumentHostResult(value: unknown): DocumentHostResult {
  const data = pairingRecord(value)
  if (data.status === 'listed') { exactKeys(data, ['status', 'list']); return { status: 'listed', list: parseDocumentListResult(data.list) } }
  if (data.status === 'uploaded') { exactKeys(data, ['status', 'document']); return { status: 'uploaded', document: parseClientDocument(data.document) } }
  if (data.status === 'downloaded') { exactKeys(data, ['status', 'document', 'content']); return { status: 'downloaded', document: parseClientDocument(data.document), content: parseDocumentContent(data.content) } }
  if (data.status === 'deleted') { exactKeys(data, ['status']); return { status: 'deleted' } }
  if (data.status === 'portalCertificate') {
    exactKeys(data, ['status', 'outcome', 'document'])
    return { status: 'portalCertificate', outcome: parsePortalPdfOutcome(data.outcome), document: data.document === null ? null : parseClientDocument(data.document) }
  }
  throw new Error('Invalid document result')
}

/**
 * Resultado para la vista: nunca contiene la ruta elegida ni la clave del expediente. El PDF sólo viaja en
 * `viewed`, validado por `parsePdfView` (firma `%PDF-`, tamaño y campos exactos) y siempre de tipo `stored`.
 */
export function parseDocumentViewResult(value: unknown): DocumentViewResult {
  const data = pairingRecord(value)
  if (data.status === 'listed') { exactKeys(data, ['status', 'list']); return { status: 'listed', list: parseDocumentListResult(data.list) } }
  if (data.status === 'viewed') {
    exactKeys(data, ['status', 'view'])
    const view = parsePdfView(data.view)
    if (view.kind !== 'stored') throw new Error('Invalid document result')
    return { status: 'viewed', view }
  }
  if (data.status === 'uploaded') { exactKeys(data, ['status', 'document']); return { status: 'uploaded', document: parseClientDocument(data.document) } }
  if (data.status === 'saved' || data.status === 'deleted' || data.status === 'cancelled') { exactKeys(data, ['status']); return { status: data.status } }
  throw new Error('Invalid document result')
}
