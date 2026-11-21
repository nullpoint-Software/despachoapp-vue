import { pairingRecord } from './pairing'
import { findTaxRegime, isTaxRegimeCode } from '../fiscal/taxRegimes'

/**
 * Perfil GLOBAL del cliente (rediseño de Clientes, ADR-032).
 * - Sin domicilio: el despacho no lo usa y la migración 085 lo retiró (decisión del usuario).
 * - `fiscalPostalCode` (2026-10-11, migración 092): CP fiscal de 5 dígitos, o '' si no se ha capturado. Es lo único
 *   del domicilio que vuelve: lo pide el CFDI 4.0 y la consulta de la CSF lo compara con el del SAT.
 * - `contactName` ya no se captura en la ficha, pero se conserva lo existente: el formulario lo devuelve igual.
 * - La CIEC NO es parte del perfil: se guarda cifrada sólo en el equipo que la captura (ClientCiecRepository).
 * - `additionalTaxRegimes` (2026-10-18, migración 120): un contribuyente puede tener varios regímenes. `taxRegime` es el
 *   principal (el que usan los filtros y las programaciones) y aquí van los demás códigos, sin repetir el principal.
 */
export interface ClientProfile { rfc: string; taxRegime: string; additionalTaxRegimes: string[]; contactName: string; emailAddress: string; phoneNumber: string; fiscalPostalCode: string }
export const emptyClientProfile = (): ClientProfile => ({ rfc: '', taxRegime: '', additionalTaxRegimes: [], contactName: '', emailAddress: '', phoneNumber: '', fiscalPostalCode: '' })
/** Máximo de regímenes adicionales (la columna admite hasta 25 códigos; 10 cubre cualquier constancia real). */
export const maximumAdditionalTaxRegimes = 10
/** Todos los regímenes del perfil, el principal primero, sin vacíos ni repetidos. */
export function listProfileTaxRegimes(profile: Pick<ClientProfile, 'taxRegime' | 'additionalTaxRegimes'>): string[] {
  return [...new Set([profile.taxRegime, ...profile.additionalTaxRegimes].filter(Boolean))]
}
/** CP fiscal mexicano: exactamente 5 dígitos (no se valida contra el catálogo c_CodigoPostal). */
export function isFiscalPostalCode(value: string): boolean { return /^[0-9]{5}$/.test(value) }
function text(value: unknown, maximum: number): string {
  if (typeof value !== 'string' || value.length > maximum || [...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) throw new Error('Invalid profile text')
  return value.trim()
}
/**
 * Estructura y formato básico, también para fichas antiguas: un régimen escrito a mano antes del catálogo o un
 * teléfono con otro formato se siguen pudiendo leer. Las reglas de captura están en `validateClientProfileForSave`.
 */
export function parseClientProfile(value: unknown): ClientProfile {
  const data = pairingRecord(value)
  // Un equipo con una versión anterior a la 092 no envía `fiscalPostalCode` (ni, antes de la 120, `additionalTaxRegimes`):
  // se leen vacíos para no rechazar su ficha. Cualquier otro campo de más o de menos se sigue rechazando.
  const optionalKeys = ['fiscalPostalCode', 'additionalTaxRegimes']
  const expectedKeys = Object.keys(emptyClientProfile()).filter(key => !optionalKeys.includes(key) || key in data)
  if (Object.keys(data).sort().join() !== expectedKeys.sort().join()) throw new Error('Invalid profile fields')
  const rfc = text(data.rfc, 13).toUpperCase()
  if (rfc && !/^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/.test(rfc)) throw new Error('Invalid RFC format')
  const emailAddress = text(data.emailAddress, 254)
  if (emailAddress && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress)) throw new Error('Invalid email')
  const fiscalPostalCode = 'fiscalPostalCode' in data ? text(data.fiscalPostalCode, 5) : ''
  if (fiscalPostalCode && !isFiscalPostalCode(fiscalPostalCode)) throw new Error('Invalid postal code')
  const additionalTaxRegimes: unknown = 'additionalTaxRegimes' in data ? data.additionalTaxRegimes : []
  if (!Array.isArray(additionalTaxRegimes) || additionalTaxRegimes.length > maximumAdditionalTaxRegimes || additionalTaxRegimes.some(code => typeof code !== 'string' || !/^[0-9]{3}$/.test(code))) throw new Error('Invalid additional tax regimes')
  return { rfc, emailAddress, taxRegime: text(data.taxRegime, 100), additionalTaxRegimes: [...additionalTaxRegimes] as string[], contactName: text(data.contactName, 100), phoneNumber: text(data.phoneNumber, 40), fiscalPostalCode }
}

/**
 * Teléfono a 10 dígitos, como en la ContaApp anterior: se quitan espacios, guiones, puntos y paréntesis, y la
 * lada de país +52. Vacío se permite (dato pendiente). Lanza si no quedan exactamente 10 dígitos.
 */
export function normalizePhoneNumber(value: string): string {
  const digits = value.replace(/[\s\-.()]/g, '').replace(/^\+?52(?=[0-9]{10}$)/, '')
  if (digits && !/^[0-9]{10}$/.test(digits)) throw new Error('Invalid phone number')
  return digits
}

/** RFC de 12 caracteres = persona moral; de 13 = persona física. */
export function isRegimeForRfc(code: string, rfc: string): boolean {
  const regime = findTaxRegime(code)
  if (!regime) return false
  return rfc.length === 12 ? regime.isForCompanies : regime.isForIndividuals
}

/** Error de captura con el campo que lo causó, para que la ficha marque el paso y el campo correctos. */
export class ClientProfileError extends Error {
  constructor(readonly field: 'rfc' | 'taxRegime' | 'emailAddress' | 'phoneNumber' | 'fiscalPostalCode') { super('Invalid client profile: ' + field) }
}

/**
 * Reglas de captura (UI y Host en create/update): régimen del catálogo c_RegimenFiscal o vacío, teléfono de
 * 10 dígitos o vacío y CP fiscal de 5 dígitos o vacío. El régimen debe corresponder al tipo de persona del RFC (12 = moral, 13 = física).
 */
export function validateClientProfileForSave(value: unknown): ClientProfile {
  let profile: ClientProfile
  try { profile = parseClientProfile(value) } catch (error) {
    const data = pairingRecord(value)
    if (typeof data.rfc === 'string' && data.rfc.trim() && !/^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/.test(data.rfc.trim().toUpperCase())) throw new ClientProfileError('rfc')
    if (typeof data.emailAddress === 'string' && data.emailAddress.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.emailAddress.trim())) throw new ClientProfileError('emailAddress')
    if (typeof data.fiscalPostalCode === 'string' && data.fiscalPostalCode.trim() && !isFiscalPostalCode(data.fiscalPostalCode.trim())) throw new ClientProfileError('fiscalPostalCode')
    throw error
  }
  if (profile.taxRegime && !isTaxRegimeCode(profile.taxRegime)) throw new ClientProfileError('taxRegime')
  if (profile.taxRegime && profile.rfc && !isRegimeForRfc(profile.taxRegime, profile.rfc)) throw new ClientProfileError('taxRegime')
  // Adicionales: exigen régimen principal, no se repiten y cada uno es del catálogo y del tipo de persona del RFC.
  const additional = profile.additionalTaxRegimes
  if (additional.length && !profile.taxRegime) throw new ClientProfileError('taxRegime')
  if (new Set([profile.taxRegime, ...additional]).size !== additional.length + 1) throw new ClientProfileError('taxRegime')
  if (additional.some(code => !isTaxRegimeCode(code) || (profile.rfc && !isRegimeForRfc(code, profile.rfc)))) throw new ClientProfileError('taxRegime')
  let phoneNumber: string
  try { phoneNumber = normalizePhoneNumber(profile.phoneNumber) } catch { throw new ClientProfileError('phoneNumber') }
  return { ...profile, phoneNumber }
}
