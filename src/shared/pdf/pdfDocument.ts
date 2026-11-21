import { GlobalWorkerOptions, getDocument, type PDFDocumentLoadingTask } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

/**
 * Carga de PDF con pdf.js (Mozilla, Apache-2.0) en la ventana de Fiscenix (2026-10-06).
 * - El worker de pdf.js va empaquetado con la app y se sirve desde `contapp://`; por eso la CSP permite
 *   `worker-src 'self'` (y nada más externo).
 * - Sin XFA y sin descargas (pdf.js 6 ya no evalúa código del documento): el PDF llega como bytes
 *   desde Main y las fuentes estándar no se piden a la red (pdf.js usa las del sistema si faltan).
 */
GlobalWorkerOptions.workerSrc = workerUrl

/** Tarea de carga: `promise` da el documento y `destroy()` lo libera junto con su worker. */
export function loadPdfDocument(content: Uint8Array): PDFDocumentLoadingTask {
  // pdf.js transfiere el buffer al worker: se le da una copia para que el visor conserve la suya.
  return getDocument({ data: content.slice(), enableXfa: false, disableAutoFetch: true, disableStream: true, useSystemFonts: true, verbosity: 0 })
}
