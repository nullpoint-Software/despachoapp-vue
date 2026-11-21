/**
 * idCIF y RFC impresos en una constancia de situación fiscal, a partir del texto que extrae `readPdfText`.
 *
 * La CSF imprime el idCIF como "idCIF: 12345678901" (11 dígitos) cerca del RFC. pdfjs puede devolver el texto
 * con espacios entre fragmentos ("id CIF :", dígitos separados), por eso:
 * 1. primero se busca el idCIF con sus 11 dígitos juntos;
 * 2. si no aparece, se aceptan dígitos separados por un espacio, siempre que sean exactamente 11.
 * El RFC es el primero con formato válido después de la etiqueta "RFC"; sirve para comprobar que la constancia
 * es del mismo cliente antes de consultar al SAT. Si el PDF no trae RFC legible, la comprobación se omite.
 *
 * Vive en `shared` desde el 2026-10-13: el Host la usa con el texto de `readPdfText` y la vista con el texto que pdf.js
 * extrae del PDF que la persona elige al autocompletar la ficha (`readCertificatePdf`). Es pura y no registra nada.
 */
export interface CertificateIdentity { idCif: string | null; rfc: string | null }

export function extractCertificateIdentity(text: string): CertificateIdentity {
  // `\s` incluye el espacio duro (U+00A0) que pdfjs puede devolver.
  const normalized = text.replace(/\s+/g, ' ')
  const compact = /id\s?CIF\s?[:：]?\s?([0-9]{11})(?![0-9])/i.exec(normalized)?.[1]
  const spaced = compact ? undefined : /id\s?CIF\s?[:：]?\s?([0-9](?: ?[0-9]){10})(?! ?[0-9])/i.exec(normalized)?.[1]?.replace(/ /g, '')
  const rfc = /\bRFC\s?[:：]?\s?([A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3})(?![A-Z0-9])/.exec(normalized.toUpperCase())?.[1] ?? null
  return { idCif: compact ?? spaced ?? null, rfc }
}
