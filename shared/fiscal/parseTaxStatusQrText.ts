import { rfcPattern } from '../contracts/localXml'

/**
 * Lectura del texto del código QR de una constancia de situación fiscal (CSF), pedido del usuario "escaner qr para el
 * idCIF" (2026-10-11, [[changes/CSF-QR-SCANNER]]).
 *
 * El QR de la CSF codifica la dirección del validador público del SAT:
 * `https://siat.sat.gob.mx/app/qr/faces/pages/mobile/validadorqr.jsf?D1=10&D2=1&D3=<idCIF>_<RFC>`.
 * De `D3` salen el idCIF (11 dígitos) y el RFC. Reglas:
 * 1. El texto debe ser una URL `http` o `https` (algunos lectores cambian el esquema) del host `siat.sat.gob.mx`
 *    (el host se compara sin mayúsculas, como lo normaliza `URL`) y la ruta del validador (sin mayúsculas).
 * 2. `D1=10` identifica la constancia; otro valor es otro documento del SAT y se rechaza.
 * 3. `D3` puede venir codificado (`%5F`, `%26` para un RFC con "&"): `URLSearchParams` lo decodifica.
 * 4. El RFC se valida con el patrón compartido del SAT (`rfcPattern`) y se devuelve en mayúsculas.
 *
 * Es una función pura: no consulta al SAT ni decide si el RFC es del cliente (eso lo comprueba la vista y, al
 * consultar, el Host con el RFC del perfil). Nunca registra el texto leído.
 */
export type TaxStatusQrRejection = 'empty' | 'notUrl' | 'notSatValidator' | 'notTaxStatusCertificate' | 'missingData' | 'invalidIdCif' | 'invalidRfc'
export type TaxStatusQrReading = { status: 'valid'; idCif: string; rfc: string } | { status: 'invalid'; reason: TaxStatusQrRejection }

const validatorHost = 'siat.sat.gob.mx'
const validatorPath = '/app/qr/faces/pages/mobile/validadorqr.jsf'
/** Tope del texto que se intenta leer: un QR de la CSF tiene ~100 caracteres. */
const maximumQrTextLength = 2048

export function parseTaxStatusQrText(text: string): TaxStatusQrReading {
  const trimmed = text.trim()
  if (!trimmed) return { status: 'invalid', reason: 'empty' }
  if (trimmed.length > maximumQrTextLength) return { status: 'invalid', reason: 'notUrl' }
  let url: URL
  try { url = new URL(trimmed) } catch { return { status: 'invalid', reason: 'notUrl' } }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return { status: 'invalid', reason: 'notUrl' }
  if (url.hostname.toLowerCase() !== validatorHost || url.pathname.toLowerCase() !== validatorPath) return { status: 'invalid', reason: 'notSatValidator' }
  // Los nombres de parámetro se aceptan sin distinguir mayúsculas (d1/D1), por si un lector los altera.
  const parameters = new Map<string, string>()
  for (const [name, value] of url.searchParams) if (!parameters.has(name.toUpperCase())) parameters.set(name.toUpperCase(), value)
  if (parameters.get('D1') !== '10') return { status: 'invalid', reason: 'notTaxStatusCertificate' }
  const data = parameters.get('D3')?.trim()
  if (!data) return { status: 'invalid', reason: 'missingData' }
  // idCIF y RFC van separados por el primer "_"; el RFC no contiene "_".
  const separatorIndex = data.indexOf('_')
  if (separatorIndex < 0) return { status: 'invalid', reason: 'missingData' }
  const idCif = data.slice(0, separatorIndex), rfc = data.slice(separatorIndex + 1).toUpperCase()
  if (!/^[0-9]{11}$/.test(idCif)) return { status: 'invalid', reason: 'invalidIdCif' }
  if (!rfcPattern.test(rfc)) return { status: 'invalid', reason: 'invalidRfc' }
  return { status: 'valid', idCif, rfc }
}

/**
 * Valida el texto del QR y que su RFC sea el del cliente (`clientRfc`, el del perfil). Si el QR es de otro RFC no
 * devuelve el idCIF: la vista no llena el campo y explica la diferencia con `qrRfc`.
 */
export type TaxStatusQrMatch = { status: 'matched'; idCif: string } | { status: 'rejected'; reason: TaxStatusQrRejection | 'otherRfc'; qrRfc: string | null }

export function matchTaxStatusQrToRfc(text: string, clientRfc: string): TaxStatusQrMatch {
  const reading = parseTaxStatusQrText(text)
  if (reading.status === 'invalid') return { status: 'rejected', reason: reading.reason, qrRfc: null }
  if (reading.rfc !== clientRfc.trim().toUpperCase()) return { status: 'rejected', reason: 'otherRfc', qrRfc: reading.rfc }
  return { status: 'matched', idCif: reading.idCif }
}
