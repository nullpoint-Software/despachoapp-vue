import { extractCertificateIdentity } from '../../../shared/fiscal/extractCertificateIdentity'
import { parseTaxStatusQrText } from '../../../shared/fiscal/parseTaxStatusQrText'
import { loadPdfDocument } from '../../shared/pdf/pdfDocument'
import { decodeQrFromPdfContent } from '../../shared/qr/readQrSources'

/** Tope del PDF elegido: una constancia pesa menos de 1 MB; el expediente admite hasta 20 MB. */
const maximumCertificateBytes = 20 * 1024 * 1024
/** La constancia trae el idCIF y el QR en la primera página; se revisan dos por si la primera es una portada. */
const maximumCertificatePages = 2

/**
 * idCIF y RFC de una constancia (PDF) que la persona elige al autocompletar la ficha (2026-10-13,
 * [[changes/CSF-FORM-AUTOFILL]]). Todo ocurre en esta ventana: el PDF no viaja a Main ni al Host y no se guarda.
 *
 * 1. Texto de las primeras páginas con pdf.js y `extractCertificateIdentity` ("idCIF: 12345678901" y "RFC: …").
 * 2. Si el texto no trae el idCIF (PDF escaneado), el código QR de esas páginas con `parseTaxStatusQrText`.
 * Devuelve `null` si ninguno sirve; lanza si el archivo no es un PDF legible o es demasiado grande. Quien llama
 * comprueba que el RFC sea el de la ficha.
 */
export async function readCertificatePdf(file: Blob): Promise<{ idCif: string; rfc: string | null; source: 'text' | 'qr' } | null> {
  if (file.size > maximumCertificateBytes) throw new Error('Certificate too large')
  const content = new Uint8Array(await file.arrayBuffer())
  try {
    const task = loadPdfDocument(content)
    const pages: string[] = []
    try {
      const pdfDocument = await task.promise
      for (let pageNumber = 1; pageNumber <= Math.min(pdfDocument.numPages, maximumCertificatePages); pageNumber++) {
        const page = await pdfDocument.getPage(pageNumber)
        const text = await page.getTextContent()
        pages.push(text.items.map(item => ('str' in item ? item.str : '')).join(' '))
        page.cleanup()
      }
    } finally { await task.destroy() }
    const identity = extractCertificateIdentity(pages.join(' '))
    if (identity.idCif) return { idCif: identity.idCif, rfc: identity.rfc, source: 'text' }
    const qrText = await decodeQrFromPdfContent(content, maximumCertificatePages)
    const reading = qrText ? parseTaxStatusQrText(qrText) : null
    return reading?.status === 'valid' ? { idCif: reading.idCif, rfc: reading.rfc, source: 'qr' } : null
  } finally { content.fill(0) }
}
