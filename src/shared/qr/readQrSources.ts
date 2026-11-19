import { loadPdfDocument } from '../pdf/pdfDocument'
import { decodeQrPixels, maximumQrDecodeDimension } from './decodeQrPixels'

/**
 * Fuentes de imagen para leer un código QR en la vista (2026-10-11, [[changes/CSF-QR-SCANNER]]): un cuadro de la
 * cámara, una imagen elegida (foto o captura) o una página de un PDF dibujada con pdf.js. Todas terminan en
 * `decodeQrPixels` sobre un `<canvas>` temporal que sólo existe en memoria de esta ventana.
 *
 * Nada de esto sale de la vista: los píxeles no viajan a Main ni al Host, y el texto leído se devuelve al llamador
 * sin registrarlo. Quien llama valida el contenido (p. ej. `parseTaxStatusQrText`).
 */

/** Lienzo de trabajo con lectura frecuente de píxeles (evita la copia de GPU a CPU en cada `getImageData`). */
function createWorkCanvas(width: number, height: number): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width)); canvas.height = Math.max(1, Math.round(height))
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Canvas unavailable')
  return { canvas, context }
}

/**
 * Dibuja `source` a cada escala indicada (relativa a la que cabe en `maximumQrDecodeDimension`) y devuelve el
 * primer texto leído. Probar varias escalas ayuda con fotos muy grandes (el QR queda más definido al reducir) o
 * capturas pequeñas (al ampliar, cada módulo del QR ocupa más píxeles).
 */
export function decodeQrFromDrawable(source: CanvasImageSource, sourceWidth: number, sourceHeight: number, relativeScales: readonly number[] = [1, 0.5, 1.5]): string | null {
  if (sourceWidth <= 0 || sourceHeight <= 0) return null
  const fittingScale = Math.min(1, maximumQrDecodeDimension / Math.max(sourceWidth, sourceHeight))
  for (const relativeScale of relativeScales) {
    const scale = Math.min(fittingScale * relativeScale, maximumQrDecodeDimension / Math.max(sourceWidth, sourceHeight))
    const width = Math.round(sourceWidth * scale), height = Math.round(sourceHeight * scale)
    if (width < 21 || height < 21) continue
    const { context } = createWorkCanvas(width, height)
    // Fondo blanco: una imagen PNG con transparencia se leería como negro.
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, width, height)
    context.drawImage(source, 0, 0, width, height)
    const text = decodeQrPixels(context.getImageData(0, 0, width, height))
    if (text) return text
  }
  return null
}

/** Imagen elegida por la persona (PNG o JPG). Lanza si el archivo no es una imagen que el navegador pueda abrir. */
export async function decodeQrFromImageFile(file: Blob): Promise<string | null> {
  const bitmap = await createImageBitmap(file)
  try { return decodeQrFromDrawable(bitmap, bitmap.width, bitmap.height) }
  finally { bitmap.close() }
}

/** Escalas de render de una página PDF: 2× (144 ppp) basta para el QR de la constancia; 3× es el respaldo. */
const pdfRenderScales = [2, 3] as const
/** Lado máximo de una página dibujada para leer el QR (una carta a 3× mide ~1840 × 2380 px). */
const maximumPdfRenderDimension = 2600

/**
 * Busca un QR en las primeras `maximumPageCount` páginas de un PDF. Cada página se dibuja con pdf.js en un lienzo
 * temporal y se lee completa; el documento y su worker se destruyen al terminar, haya o no resultado.
 */
export async function decodeQrFromPdfContent(content: Uint8Array, maximumPageCount = 1): Promise<string | null> {
  const task = loadPdfDocument(content)
  try {
    const pdfDocument = await task.promise
    const pageCount = Math.min(pdfDocument.numPages, maximumPageCount)
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
      const page = await pdfDocument.getPage(pageNumber)
      try {
        for (const requestedScale of pdfRenderScales) {
          const base = page.getViewport({ scale: 1 })
          const scale = Math.min(requestedScale, maximumPdfRenderDimension / Math.max(base.width, base.height))
          const viewport = page.getViewport({ scale })
          const { canvas, context } = createWorkCanvas(viewport.width, viewport.height)
          context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height)
          await page.render({ canvas, viewport }).promise
          const text = decodeQrPixels(context.getImageData(0, 0, canvas.width, canvas.height))
          if (text) return text
        }
      } finally { page.cleanup() }
    }
    return null
  } finally { await task.destroy() }
}

/** Archivo PDF elegido por la persona: se lee en memoria y se busca el QR en sus dos primeras páginas. */
export async function decodeQrFromPdfFile(file: Blob): Promise<string | null> {
  return decodeQrFromPdfContent(new Uint8Array(await file.arrayBuffer()), 2)
}
