import type { DocumentCategory } from '../../../shared/contracts/documents'

/** Etiquetas de presentación del expediente; la clasificación válida la decide el contrato compartido. */
export const documentCategoryLabels: Record<DocumentCategory, string> = {
  taxStatusCertificate: 'Constancia de situación fiscal',
  complianceOpinion: 'Opinión de cumplimiento',
  contract: 'Contrato',
  identification: 'Identificación',
  taxDocument: 'Documento fiscal',
  other: 'Otro documento'
}

/** Tamaño legible en unidades binarias; el límite de carga es 20 MiB. */
export function formatDocumentSize(sizeBytes: number): string {
  if (sizeBytes < 1024) return sizeBytes + ' B'
  if (sizeBytes < 1024 * 1024) return (sizeBytes / 1024).toLocaleString('es-MX', { maximumFractionDigits: 1 }) + ' KB'
  return (sizeBytes / (1024 * 1024)).toLocaleString('es-MX', { maximumFractionDigits: 1 }) + ' MB'
}

export function formatDocumentDate(isoDate: string): string {
  return new Date(isoDate).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
}
