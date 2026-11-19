import { extractCertificateIdentity } from '../../../shared/fiscal/extractCertificateIdentity'
import { extractTaxObligations, type CertificateObligation } from '../../../shared/fiscal/extractTaxObligations'
import { loadPdfDocument } from '../../shared/pdf/pdfDocument'

/** Tope del PDF elegido: una constancia pesa menos de 1 MB; el expediente admite hasta 20 MB. */
const maximumCertificateBytes = 20 * 1024 * 1024
/** La tabla de obligaciones suele ir en la página 2 o 3; se revisan hasta 6 por si la constancia trae muchos regímenes. */
const maximumCertificatePages = 6

/**
 * Obligaciones de la constancia de situación fiscal (PDF) que la persona elige al dar de alta obligaciones
 * (2026-10-18). Todo ocurre en esta ventana, como `readCertificatePdf` de Clientes: el PDF no viaja a Main ni al Host
 * y no se guarda; sólo las obligaciones leídas pasan al alta por pasos, donde la persona las revisa.
 * Devuelve también el RFC impreso para que quien llama compruebe que la constancia es del cliente.
 * Lanza si el archivo no es un PDF legible o es demasiado grande.
 */
export async function readCertificateObligations(file: Blob, isCompany: boolean): Promise<{ rfc: string | null; obligations: CertificateObligation[] }> {
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
    const text = pages.join(' ')
    return { rfc: extractCertificateIdentity(text).rfc, obligations: extractTaxObligations(text, isCompany) }
  } finally { content.fill(0) }
}
