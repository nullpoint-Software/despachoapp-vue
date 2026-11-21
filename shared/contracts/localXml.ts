/**
 * XML físicos LOCAL del dispositivo ([[02-DATA-OWNERSHIP#XML]]). Sólo se aceptan CFDI 3.3/4.0
 * timbrados; la identidad es el UUID del timbre. Nada de esto se envía al Host: ligar un XML a un
 * contribuyente y publicar datos derivados corresponde a 6.1. Ningún contrato transporta rutas.
 */
/** `analyze` (6.1): datos fiscales estructurados del XML, calculados en Main; no salen del equipo. */
export const localXmlChannels = { list: 'xml:list', import: 'xml:import', read: 'xml:read', analyze: 'xml:analyze', saveCopy: 'xml:saveCopy', trash: 'xml:trash', restore: 'xml:restore', importFiles: 'xml:importFiles' } as const
export const maximumXmlFiles = 5000
export const maximumXmlBytes = 10 * 1024 * 1024
export const maximumImportBytes = 250 * 1024 * 1024
export const trashRetentionDays = 30
/** Archivos por importación (diálogo o arrastre); cada ZIP cuenta como uno. */
export const maximumImportFileCount = 200
/** Resultados por archivo que viajan al Renderer; los contadores siguen contando todo. */
export const maximumImportFileListSize = 500
/**
 * Arrastre (2026-10-12): cada archivo soltado viaja en memoria (vista, copia IPC y Main), así que el tope es menor que el
 * del diálogo; un ZIP más grande se importa con «Elegir archivos», que Main lee del disco.
 */
export const maximumDroppedFileBytes = 50 * 1024 * 1024
export const maximumDroppedBytes = 100 * 1024 * 1024
export const maximumXmlListSize = 500
export const cfdiVoucherTypes = ['I', 'E', 'T', 'N', 'P'] as const
export type CfdiVoucherType = typeof cfdiVoucherTypes[number]

/** Resumen mínimo del CFDI para organizar y detectar duplicados; el análisis fiscal completo es 6.1. */
export interface LocalXmlRecord {
  uuid: string
  version: '3.3' | '4.0'
  voucherType: CfdiVoucherType
  issuerRfc: string
  issuerName: string
  receiverRfc: string
  receiverName: string
  issuedAt: string
  total: string
  currency: string
  sizeBytes: number
  sha256: string
  importedAt: string
  trashedAt: string | null
}
export interface LocalXmlFilter { view: 'active' | 'trash'; rfc: string | null; period: string | null; search: string }
export interface LocalXmlList { records: LocalXmlRecord[]; totalCount: number; isTruncated: boolean; rfcs: string[]; periods: string[] }
export type XmlRejectionReason = 'notXml' | 'notCfdi' | 'unsupportedVersion' | 'missingStamp' | 'tooLarge' | 'unsafeContent' | 'invalidZip'
export interface XmlRejection { name: string; reason: XmlRejectionReason }
/** Resultado de un XML (o de un ZIP rechazado completo); dentro de un ZIP el nombre es `paquete.zip/entrada.xml`. */
export type XmlImportFileResult = { name: string; outcome: 'imported' | 'duplicate' | 'conflict' } | { name: string; outcome: 'rejected'; reason: XmlRejectionReason }
/** `files` llega hasta `maximumImportFileListSize`; si es más corto que la suma de contadores, la lista se recortó. */
export interface XmlImportSummary { imported: number; duplicates: number; conflicts: number; rejected: number; rejections: XmlRejection[]; files: XmlImportFileResult[] }
/** Archivo arrastrado: el Renderer lo lee y manda sólo nombre y bytes, nunca su ruta. */
export interface XmlImportContent { name: string; content: Uint8Array }
export type XmlImportResult = { status: 'cancelled' } | { status: 'imported'; summary: XmlImportSummary }

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
/** RFC de persona moral (12) o física (13); acepta Ñ y & como el SAT. */
export const rfcPattern = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid XML data')
  return value as Record<string, unknown>
}
function exactKeys(data: Record<string, unknown>, keys: readonly string[]): void {
  if (Object.keys(data).sort().join() !== [...keys].sort().join()) throw new Error('Invalid XML data')
}
function text(value: unknown, maximum: number, isEmptyAllowed = false): string {
  if (typeof value !== 'string' || value.length > maximum || (!isEmptyAllowed && !value.trim()) || [...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) throw new Error('Invalid XML text')
  return value
}
export function parseXmlUuid(value: unknown): string {
  if (typeof value !== 'string' || !uuidPattern.test(value)) throw new Error('Invalid CFDI UUID')
  return value
}
export function parseXmlUuids(value: unknown): string[] {
  if (!Array.isArray(value) || !value.length || value.length > maximumXmlListSize) throw new Error('Invalid CFDI selection')
  const uuids = value.map(parseXmlUuid)
  if (new Set(uuids).size !== uuids.length) throw new Error('Invalid CFDI selection')
  return uuids
}
export function parseXmlFilter(value: unknown): LocalXmlFilter {
  const data = record(value)
  exactKeys(data, ['view', 'rfc', 'period', 'search'])
  if (data.view !== 'active' && data.view !== 'trash') throw new Error('Invalid XML view')
  if (data.rfc !== null && (typeof data.rfc !== 'string' || !rfcPattern.test(data.rfc))) throw new Error('Invalid RFC')
  if (data.period !== null && (typeof data.period !== 'string' || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(data.period))) throw new Error('Invalid period')
  return { view: data.view, rfc: data.rfc, period: data.period, search: text(data.search, 100, true).trim() }
}
function parseRecord(value: unknown): LocalXmlRecord {
  const data = record(value)
  exactKeys(data, ['uuid', 'version', 'voucherType', 'issuerRfc', 'issuerName', 'receiverRfc', 'receiverName', 'issuedAt', 'total', 'currency', 'sizeBytes', 'sha256', 'importedAt', 'trashedAt'])
  if (data.version !== '3.3' && data.version !== '4.0') throw new Error('Invalid CFDI version')
  if (!cfdiVoucherTypes.includes(data.voucherType as CfdiVoucherType)) throw new Error('Invalid voucher type')
  for (const key of ['issuerRfc', 'receiverRfc'] as const) if (typeof data[key] !== 'string' || !rfcPattern.test(data[key] as string)) throw new Error('Invalid RFC')
  if (typeof data.issuedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(data.issuedAt)) throw new Error('Invalid issue date')
  if (typeof data.total !== 'string' || !/^\d{1,18}(\.\d{1,6})?$/.test(data.total)) throw new Error('Invalid total')
  if (!Number.isSafeInteger(data.sizeBytes) || Number(data.sizeBytes) < 1 || Number(data.sizeBytes) > maximumXmlBytes) throw new Error('Invalid size')
  if (typeof data.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(data.sha256)) throw new Error('Invalid hash')
  for (const key of ['importedAt', 'trashedAt'] as const) if (!(key === 'trashedAt' && data[key] === null) && (typeof data[key] !== 'string' || !Number.isFinite(Date.parse(data[key] as string)))) throw new Error('Invalid timestamp')
  return { uuid: parseXmlUuid(data.uuid), version: data.version, voucherType: data.voucherType as CfdiVoucherType, issuerRfc: data.issuerRfc as string, issuerName: text(data.issuerName, 300, true),
    receiverRfc: data.receiverRfc as string, receiverName: text(data.receiverName, 300, true), issuedAt: data.issuedAt, total: data.total, currency: text(data.currency, 10),
    sizeBytes: Number(data.sizeBytes), sha256: data.sha256, importedAt: data.importedAt as string, trashedAt: data.trashedAt as string | null }
}
export function parseLocalXmlList(value: unknown): LocalXmlList {
  const data = record(value)
  exactKeys(data, ['records', 'totalCount', 'isTruncated', 'rfcs', 'periods'])
  if (!Array.isArray(data.records) || data.records.length > maximumXmlListSize || !Number.isSafeInteger(data.totalCount) || typeof data.isTruncated !== 'boolean') throw new Error('Invalid XML list')
  if (!Array.isArray(data.rfcs) || data.rfcs.length > 1000 || !data.rfcs.every(item => typeof item === 'string' && rfcPattern.test(item))) throw new Error('Invalid XML list')
  if (!Array.isArray(data.periods) || data.periods.length > 1200 || !data.periods.every(item => typeof item === 'string' && /^\d{4}-\d{2}$/.test(item))) throw new Error('Invalid XML list')
  return { records: data.records.map(parseRecord), totalCount: Number(data.totalCount), isTruncated: data.isTruncated, rfcs: data.rfcs as string[], periods: data.periods as string[] }
}
const rejectionReasons: readonly XmlRejectionReason[] = ['notXml', 'notCfdi', 'unsupportedVersion', 'missingStamp', 'tooLarge', 'unsafeContent', 'invalidZip']
export function parseXmlImportResult(value: unknown): XmlImportResult {
  const data = record(value)
  if (data.status === 'cancelled') { exactKeys(data, ['status']); return { status: 'cancelled' } }
  exactKeys(data, ['status', 'summary'])
  if (data.status !== 'imported') throw new Error('Invalid XML import')
  const summary = record(data.summary)
  exactKeys(summary, ['imported', 'duplicates', 'conflicts', 'rejected', 'rejections', 'files'])
  for (const key of ['imported', 'duplicates', 'conflicts', 'rejected'] as const) if (!Number.isSafeInteger(summary[key]) || Number(summary[key]) < 0) throw new Error('Invalid XML import')
  if (!Array.isArray(summary.rejections) || summary.rejections.length > 50) throw new Error('Invalid XML import')
  const rejections = summary.rejections.map(item => {
    const rejection = record(item)
    exactKeys(rejection, ['name', 'reason'])
    if (!rejectionReasons.includes(rejection.reason as XmlRejectionReason)) throw new Error('Invalid XML import')
    return { name: text(rejection.name, 260), reason: rejection.reason as XmlRejectionReason }
  })
  if (!Array.isArray(summary.files) || summary.files.length > maximumImportFileListSize) throw new Error('Invalid XML import')
  const files = summary.files.map((item): XmlImportFileResult => {
    const file = record(item)
    const name = text(file.name, 260)
    if (file.outcome === 'rejected') {
      exactKeys(file, ['name', 'outcome', 'reason'])
      if (!rejectionReasons.includes(file.reason as XmlRejectionReason)) throw new Error('Invalid XML import')
      return { name, outcome: 'rejected', reason: file.reason as XmlRejectionReason }
    }
    exactKeys(file, ['name', 'outcome'])
    if (file.outcome !== 'imported' && file.outcome !== 'duplicate' && file.outcome !== 'conflict') throw new Error('Invalid XML import')
    return { name, outcome: file.outcome }
  })
  return { status: 'imported', summary: { imported: Number(summary.imported), duplicates: Number(summary.duplicates), conflicts: Number(summary.conflicts), rejected: Number(summary.rejected), rejections, files } }
}
/**
 * Archivos arrastrados al modal de importación: 1 a 200 con nombre legible y bytes, cada uno hasta 50 MB y en total
 * hasta 100 MB.
 * Se valida en Preload y otra vez en Main; el importador aplica después el mismo presupuesto que al diálogo.
 */
export function parseXmlImportContents(value: unknown): XmlImportContent[] {
  if (!Array.isArray(value) || !value.length || value.length > maximumImportFileCount) throw new Error('Invalid XML import files')
  let totalBytes = 0
  return value.map(item => {
    const file = record(item)
    exactKeys(file, ['name', 'content'])
    if (!(file.content instanceof Uint8Array)) throw new Error('Invalid XML import files')
    totalBytes += file.content.byteLength
    if (file.content.byteLength > maximumDroppedFileBytes || totalBytes > maximumDroppedBytes) throw new Error('Invalid XML import files')
    // Sólo el nombre base: un separador indicaría una ruta, que este contrato nunca transporta.
    if (/[\\/]/.test(text(file.name, 260))) throw new Error('Invalid XML import files')
    return { name: file.name as string, content: file.content }
  })
}
export function parseXmlText(value: unknown): string {
  if (typeof value !== 'string' || value.length > maximumXmlBytes) throw new Error('Invalid XML content')
  return value
}
export function parseCopyResult(value: unknown): 'saved' | 'cancelled' {
  if (value !== 'saved' && value !== 'cancelled') throw new Error('Invalid copy result')
  return value
}
export function parseChangedCount(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > maximumXmlListSize) throw new Error('Invalid change count')
  return Number(value)
}
