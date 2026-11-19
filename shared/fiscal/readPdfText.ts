/**
 * Texto de un PDF con `pdfjs-dist` (Mozilla, Apache-2.0), la base de `pdf-parse` que usaba el sistema
 * original. Lo usan el Host para las opiniones del SAT (6.4) y Main para los estados de cuenta (6.5).
 * Se carga con `import()` porque es un módulo ES. Sólo extrae texto: sin fuentes del sistema ni
 * formularios XFA (la versión 6 ya no evalúa código del documento).
 *
 * Opciones:
 * - Límites por omisión: 10 páginas y 2 MB (opiniones). Los estados de cuenta piden más.
 * - `password`: contraseña de un PDF protegido; sin ella (o equivocada) se lanza `PdfPasswordError`.
 * - `keepLines`: conserva los renglones (cada movimiento bancario es un renglón).
 */
export class PdfPasswordError extends Error {}
export interface PdfTextOptions { maximumBytes?: number; maximumPages?: number; password?: string | null; keepLines?: boolean }

/**
 * Worker de pdfjs en el mismo proceso (corrección 2026-10-11: "opiniones de cumplimiento no funciona").
 * pdfjs sólo se reconoce como Node si `process.type` falta o es "browser" (Main). El Host corre en un
 * `utilityProcess` (`process.type === 'utility'`): pdfjs lo trata como navegador, exige `workerSrc` y lanzaba
 * "No GlobalWorkerOptions.workerSrc specified", que el Host mostraba como "El SAT respondió algo que no se pudo leer".
 * Con el módulo del worker en `globalThis.pdfjsWorker`, pdfjs usa su "fake worker" en este mismo proceso, sin
 * `workerSrc` ni Web Workers, en Main, en el Host y en las pruebas de Node por igual.
 */
async function provideInProcessWorker(): Promise<void> {
  const workerGlobal = globalThis as typeof globalThis & { pdfjsWorker?: unknown }
  if (!workerGlobal.pdfjsWorker) workerGlobal.pdfjsWorker = await import('pdfjs-dist/legacy/build/pdf.worker.mjs')
}

export async function readPdfText(content: Buffer, options: PdfTextOptions = {}): Promise<string> {
  const maximumPdfBytes = options.maximumBytes ?? 2 * 1024 * 1024, maximumPages = options.maximumPages ?? 10
  if (content.length > maximumPdfBytes || content.subarray(0, 5).toString('latin1') !== '%PDF-') throw new Error('Invalid PDF')
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  await provideInProcessWorker()
  // `verbosity: 0`: sólo errores. Para extraer texto no hacen falta las fuentes estándar y pdfjs avisaría por cada una.
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(content), useSystemFonts: false, disableFontFace: true, enableXfa: false, stopAtErrors: true, verbosity: 0, ...(options.password ? { password: options.password } : {}) })
  try {
    let document
    try { document = await loadingTask.promise }
    catch (error) { if (error instanceof Error && error.name === 'PasswordException') throw new PdfPasswordError('PDF password required', { cause: error }); throw error }
    const pages: string[] = []
    for (let pageNumber = 1; pageNumber <= Math.min(document.numPages, maximumPages); pageNumber++) {
      const page = await document.getPage(pageNumber)
      const text = await page.getTextContent()
      // Con `keepLines`, cada fin de renglón de pdfjs (`hasEOL`) se conserva como salto de línea.
      pages.push(text.items.map(item => ('str' in item ? item.str + (options.keepLines && item.hasEOL ? '\n' : ' ') : '')).join(''))
      page.cleanup()
    }
    const joined = pages.join('\n')
    return options.keepLines ? joined.split('\n').map(line => line.replace(/[ \t]+/g, ' ').trim()).filter(Boolean).join('\n') : joined.replace(/\s+/g, ' ').trim()
  } finally { await loadingTask.destroy() }
}
