/**
 * Visor de PDF dentro de Fiscenix (2026-10-06, pedido del usuario: un visor como vue-pdf-viewer; se eligió uno propio con
 * pdf.js porque vue-pdf-viewer es de licencia comercial con marca de agua).
 *
 * Flujo:
 * 1. Main genera el PDF (Fiscal, CFDI, tareas) y lo guarda en memoria con un `viewId` aleatorio (`PdfViewStore`).
 * 2. La vista recibe `{ viewId, title, fileName, content }` y lo dibuja con pdf.js (`PdfViewer.vue`).
 * 3. **Guardar** e **Imprimir** sólo envían el `viewId`: Main escribe o imprime el documento que él mismo generó. La vista
 *    nunca le manda bytes para escribir en disco.
 * 4. Al cerrar el visor se pide `release` para liberar la memoria. Main además conserva sólo los últimos documentos.
 *
 * Documentos del expediente (2026-10-11, [[changes/CLIENT-DOCUMENTS-PDF-VIEWER]]): además de los PDF generados por
 * Main, el visor abre PDFs guardados del expediente del cliente. `kind` le dice a la vista cómo se imprime:
 * - `generated`: Main imprime el HTML del que salió el PDF (sin trabajo en la vista).
 * - `stored`: el PDF no tiene HTML; la vista dibuja las hojas con pdf.js en un contenedor sólo de impresión y
 *   después pide `pdf:print`, y Main abre el diálogo de impresión de la ventana principal.
 * - `captured` (2026-10-17): la CSF que el motor del SAT obtuvo para alguien sin ficha. Main conserva los bytes (no
 *   están en el Host) y Guardar los escribe donde elija la persona; se imprime como `stored`.
 */
export const pdfViewerChannels = { save: 'pdf:save', print: 'pdf:print', release: 'pdf:release' } as const
/** Tope del PDF que se manda a la vista (los reportes y CFDI pesan mucho menos). */
export const maximumViewedPdfBytes = 25 * 1024 * 1024
export const pdfViewKinds = ['generated', 'stored', 'captured'] as const
export type PdfViewKind = typeof pdfViewKinds[number]
export interface PdfView { viewId: string; kind: PdfViewKind; title: string; fileName: string; content: Uint8Array }
/** Resultado de pedir un PDF: abrirlo en el visor, o guardarlo directo (con su diálogo). */
export type PdfResult = { status: 'viewed'; view: PdfView } | { status: 'saved' } | { status: 'cancelled' }
export type PdfSaveResult = 'saved' | 'cancelled'

const viewIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
function text(value: unknown, maximum: number): string {
  if (typeof value !== 'string' || !value.length || value.length > maximum || [...value].some(character => character.charCodeAt(0) < 32)) throw new Error('Invalid PDF text')
  return value
}
/** Firma `%PDF-` al inicio: la comparten el contrato del visor y Main antes de abrir un documento del expediente. */
export function hasPdfSignature(content: Uint8Array): boolean {
  return content.byteLength >= 5 && String.fromCharCode(...content.subarray(0, 5)) === '%PDF-'
}
export function parsePdfViewId(value: unknown): string {
  if (typeof value !== 'string' || !viewIdPattern.test(value)) throw new Error('Invalid PDF view')
  return value
}
export function parsePdfView(value: unknown): PdfView {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid PDF view')
  const data = value as Record<string, unknown>
  if (Object.keys(data).sort().join() !== 'content,fileName,kind,title,viewId') throw new Error('Invalid PDF view')
  if (!pdfViewKinds.includes(data.kind as PdfViewKind)) throw new Error('Invalid PDF view')
  if (!(data.content instanceof Uint8Array) || data.content.byteLength < 5 || data.content.byteLength > maximumViewedPdfBytes) throw new Error('Invalid PDF content')
  // Firma de PDF: el visor sólo recibe PDF, nunca otro tipo de archivo.
  if (!hasPdfSignature(data.content)) throw new Error('Invalid PDF content')
  return { viewId: parsePdfViewId(data.viewId), kind: data.kind as PdfViewKind, title: text(data.title, 300), fileName: text(data.fileName, 260), content: data.content }
}
export function parsePdfResult(value: unknown): PdfResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid PDF result')
  const data = value as Record<string, unknown>
  if (data.status === 'viewed' && Object.keys(data).sort().join() === 'status,view') return { status: 'viewed', view: parsePdfView(data.view) }
  if ((data.status === 'saved' || data.status === 'cancelled') && Object.keys(data).join() === 'status') return { status: data.status }
  throw new Error('Invalid PDF result')
}
export function parsePdfSaveResult(value: unknown): PdfSaveResult {
  if (value !== 'saved' && value !== 'cancelled') throw new Error('Invalid PDF result')
  return value
}
