import { pairingRecord, pairingText } from './pairing'
import { parseHostId } from './discovery'
import { parseDocumentDisplayName } from './documents'
import { rfcPattern } from './localXml'

/**
 * Consulta pública de la constancia de situación fiscal (CSF), pedido del usuario "opción para consultar CSF"
 * (2026-10-11). Decisiones:
 * - Sólo el validador público del SAT (el del código QR de la constancia) con idCIF y RFC: sin contraseña,
 *   sin e.firma y sin captcha. No se descarga una constancia nueva.
 * - El idCIF sale de la última constancia del expediente (categoría `taxStatusCertificate`) o se escribe a mano.
 * - El Host consulta y guarda el último resultado útil por cliente (GLOBAL, tabla `clientTaxStatus`, 089).
 * - La consulta tarda lo que tarde el SAT (hasta 20 s), más que los plazos del RPC (10 s local, 5 s remoto):
 *   por eso `query` sólo la inicia y la vista vuelve a pedir `read` hasta que el intento termina, como los lotes
 *   de opiniones. El intento en curso vive en memoria del Host (EPHEMERAL); el resultado útil, en MySQL.
 *
 * Cambios del 2026-10-11 (decisiones del usuario, migraciones 090-093, [[changes/CSF-QR-SCANNER]]):
 * - Permiso propio `taxStatus.query` en lugar de `opinions.query`.
 * - Se guarda el idCIF del último resultado útil (`TaxStatusRecord.idCif`) para no volver a escribirlo; no es secreto,
 *   pero no se registra en logs. Las filas anteriores a la 093 lo tienen en `null`.
 * - Origen `qr`: el idCIF se leyó del código QR de la constancia (cámara, imagen o PDF) en la vista. Para el Host es
 *   un idCIF proporcionado igual que el manual: lo valida (11 dígitos) y lo consulta con el RFC del perfil.
 * - El perfil comparado incluye el CP fiscal (`fiscalPostalCode`, 092).
 *
 * Autocompletar la ficha (pedido del usuario, 2026-10-13, [[changes/CSF-FORM-AUTOFILL]]): "lo del idCIF de la CSF sólo sirve
 * para comparar datos ... sería mejor en editar o crear cliente como autocompletado". Se agregan:
 * - `lookup`: consulta SIN cliente (todavía no existe al dar de alta) con RFC + idCIF que entrega la persona. No guarda
 *   nada en MySQL; el resultado vive en memoria del Host con un `attemptId` aleatorio del usuario de la sesión.
 * - `readLookup`: sondeo de ese intento; sólo lo lee el mismo usuario.
 *
 * Los parsers son estrictos (`exactKeys`): cualquier campo extra o con otro tipo se rechaza en Main y en preload.
 */
export const taxStatusChannel = 'taxStatus:operate'
export const idCifSources = ['document', 'manual', 'qr'] as const
/** Orígenes de un idCIF que la persona entrega en la petición (escrito o leído del QR), frente a `document`. */
export const providedIdCifSources = ['manual', 'qr'] as const
export type ProvidedIdCifSource = typeof providedIdCifSources[number]
export type IdCifSource = typeof idCifSources[number]
/**
 * Resultado de un intento:
 * - `found`: el SAT devolvió datos y se guardaron.
 * - `notFound`: el SAT respondió el formulario vacío (el idCIF no corresponde al RFC o no existe).
 * - `missingRfc`: el perfil del cliente no tiene RFC.
 * - `certificateMissing`: no hay constancia en el expediente; `certificateUnreadable`: no se pudo leer el PDF;
 *   `idCifNotFound`: el PDF no trae un idCIF legible; `certificateRfcMismatch`: la constancia es de otro RFC.
 * - `documentsUnavailable`: el almacén cifrado del expediente no está listo en el Host.
 * - `satUnavailable`: red, tiempo agotado o estado HTTP distinto de 200; `satUnreadable`: respuesta inesperada.
 * - `accessRevoked`: el permiso o la asignación cambiaron durante la consulta; no se guardó nada.
 */
export const taxStatusOutcomes = ['found', 'notFound', 'missingRfc', 'certificateMissing', 'certificateUnreadable', 'idCifNotFound', 'certificateRfcMismatch',
  'documentsUnavailable', 'satUnavailable', 'satUnreadable', 'accessRevoked'] as const
export type TaxStatusOutcome = typeof taxStatusOutcomes[number]
export const taxStatusPersonTypes = ['company', 'individual', 'unknown'] as const
export type TaxStatusPersonType = typeof taxStatusPersonTypes[number]
/** Límites del contenido que el SAT puede devolver; protegen la tabla y la vista de páginas anómalas. */
export const maximumTaxStatusTextLength = 500
export const maximumTaxStatusRegimes = 30
export const maximumTaxStatusOtherFields = 100

/** Domicilio fiscal tal como lo imprime el SAT ("Datos de Ubicación"). */
export interface TaxStatusAddress {
  state: string | null; municipality: string | null; neighborhood: string | null; roadType: string | null; roadName: string | null
  exteriorNumber: string | null; interiorNumber: string | null; postalCode: string | null; emailAddress: string | null; localOffice: string | null
}
/** Un régimen de "Características fiscales": nombre y "Fecha de alta" tal como los imprime el SAT. */
export interface TaxStatusRegime { name: string; registeredOn: string | null }
/** Par etiqueta/valor que el parser no reconoció; se conserva para no perder información si el SAT cambia la página. */
export interface TaxStatusField { label: string; value: string }
/**
 * Datos que devolvió el validador. Las fechas se guardan como texto tal cual (el formato del SAT no está
 * verificado con una respuesta real); `null` significa que la etiqueta no apareció o venía vacía.
 */
export interface TaxStatusDetails {
  personType: TaxStatusPersonType
  rfc: string | null; curp: string | null
  legalName: string | null; capitalRegime: string | null; incorporationDate: string | null
  firstName: string | null; paternalSurname: string | null; maternalSurname: string | null; birthDate: string | null
  operationsStartDate: string | null; taxpayerStatus: string | null; statusChangedDate: string | null
  address: TaxStatusAddress
  regimes: TaxStatusRegime[]
  otherFields: TaxStatusField[]
}
/**
 * Último resultado útil guardado en el Host (`queriedRfc` es el RFC del perfil con el que se consultó). `idCif` es el
 * que se usó (093); `null` en resultados guardados antes de esa migración.
 */
export interface TaxStatusRecord { details: TaxStatusDetails; queriedRfc: string; idCifSource: IdCifSource; idCif: string | null; queriedAt: string; queriedByDisplayName: string }
/** Último intento de este cliente desde que arrancó el Host (EPHEMERAL). */
export interface TaxStatusAttempt { state: 'running' | 'completed'; outcome: TaxStatusOutcome | null; idCifSource: IdCifSource; requestedAt: string; finishedAt: string | null }
/** Datos del perfil con los que se compara la consulta (el perfil no guarda domicilio desde la migración 085). */
export interface TaxStatusProfile { displayName: string; rfc: string; taxRegime: string; fiscalPostalCode: string }
/** Última constancia disponible del expediente; sólo si el usuario puede leer documentos. */
export interface TaxStatusCertificate { documentId: string; displayName: string; createdAt: string }
export interface TaxStatusOverview {
  clientId: string; profile: TaxStatusProfile
  /** Puede iniciar consultas: `taxStatus.query` y asignación de lectura y escritura. */
  canQuery: boolean
  /** Puede usar la constancia del expediente: `documents.read`. Sin él sólo queda el idCIF manual. */
  canUseCertificate: boolean
  certificate: TaxStatusCertificate | null
  latest: TaxStatusRecord | null
  attempt: TaxStatusAttempt | null
}

/**
 * `query`: `manualIdCif` es el idCIF que entrega la persona (`null` = tomarlo de la constancia del expediente).
 * `manualIdCifSource` dice cómo lo obtuvo: escrito (`manual`, por omisión si falta, como en equipos con una versión
 * anterior) o leído del código QR (`qr`). Sólo se admite junto con un idCIF.
 */
export type TaxStatusRequest = { action: 'read'; clientId: string } | { action: 'query'; clientId: string; manualIdCif: string | null; manualIdCifSource?: ProvidedIdCifSource }
  | { action: 'lookup'; rfc: string; idCif: string } | { action: 'readLookup'; attemptId: string }
/** Resultados posibles de una consulta sin cliente: no lee el expediente ni guarda, así que no hay más casos. */
export const taxStatusLookupOutcomes = ['found', 'notFound', 'satUnavailable', 'satUnreadable'] as const
export type TaxStatusLookupOutcome = typeof taxStatusLookupOutcomes[number]
/**
 * Consulta sin cliente (EPHEMERAL, memoria del Host). `details` sólo viene con `found`; `rfc` es el RFC consultado,
 * el que la ficha recibe al autocompletar un alta.
 */
export interface TaxStatusLookup { attemptId: string; rfc: string; state: 'running' | 'completed'; outcome: TaxStatusLookupOutcome | null; details: TaxStatusDetails | null }
export type TaxStatusResult = { status: 'overview'; overview: TaxStatusOverview } | { status: 'lookup'; lookup: TaxStatusLookup }

function exactKeys(data: Record<string, unknown>, keys: readonly string[]): void {
  if (Object.keys(data).sort().join() !== [...keys].sort().join()) throw new Error('Invalid tax status data')
}
function oneOf<T extends string>(value: unknown, values: readonly T[]): T { if (!values.includes(value as T)) throw new Error('Invalid tax status data'); return value as T }
function text(value: unknown, maximum: number): string {
  if (typeof value !== 'string' || value.length > maximum || [...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) throw new Error('Invalid tax status text')
  return value
}
function optionalText(value: unknown, maximum = maximumTaxStatusTextLength): string | null { return value === null ? null : text(value, maximum) }
function instant(value: unknown): string { if (typeof value !== 'string' || value.length > 40 || !Number.isFinite(Date.parse(value))) throw new Error('Invalid timestamp'); return value }
/** CP fiscal del perfil: 5 dígitos o '' (sin capturar). */
function postalCode(value: unknown): string { if (typeof value !== 'string' || (value !== '' && !/^[0-9]{5}$/.test(value))) throw new Error('Invalid postal code'); return value }
function flag(value: unknown): boolean { if (typeof value !== 'boolean') throw new Error('Invalid tax status flag'); return value }

/**
 * idCIF capturado a mano: exactamente 11 dígitos, como lo imprime la constancia. Se aceptan espacios
 * alrededor (pegado desde el PDF) pero no dentro; lanza si no cumple.
 */
export function parseIdCif(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Invalid idCIF')
  const idCif = value.trim()
  if (!/^[0-9]{11}$/.test(idCif)) throw new Error('Invalid idCIF')
  return idCif
}
/** Variante sin excepción para la validación en vivo de la vista. */
export function isValidIdCif(value: string): boolean { return /^[0-9]{11}$/.test(value.trim()) }
/** RFC de una consulta sin cliente: formato del SAT, en mayúsculas y sin espacios alrededor; lanza si no cumple. */
function parseLookupRfc(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Invalid RFC')
  const rfc = value.trim().toUpperCase()
  if (!rfcPattern.test(rfc)) throw new Error('Invalid RFC')
  return rfc
}

export function parseTaxStatusRequest(value: unknown): TaxStatusRequest {
  const data = pairingRecord(value)
  if (data.action === 'read') { exactKeys(data, ['action', 'clientId']); return { action: 'read', clientId: parseHostId(data.clientId) } }
  if (data.action === 'query') {
    const hasSource = 'manualIdCifSource' in data
    exactKeys(data, ['action', 'clientId', 'manualIdCif', ...(hasSource ? ['manualIdCifSource'] : [])])
    const manualIdCif = data.manualIdCif === null ? null : parseIdCif(data.manualIdCif)
    if (hasSource && manualIdCif === null) throw new Error('Invalid tax status request')
    return { action: 'query', clientId: parseHostId(data.clientId), manualIdCif, ...(hasSource ? { manualIdCifSource: oneOf(data.manualIdCifSource, providedIdCifSources) } : {}) }
  }
  if (data.action === 'lookup') { exactKeys(data, ['action', 'rfc', 'idCif']); return { action: 'lookup', rfc: parseLookupRfc(data.rfc), idCif: parseIdCif(data.idCif) } }
  if (data.action === 'readLookup') { exactKeys(data, ['action', 'attemptId']); return { action: 'readLookup', attemptId: parseHostId(data.attemptId) } }
  throw new Error('Invalid tax status request')
}

const addressKeys = ['state', 'municipality', 'neighborhood', 'roadType', 'roadName', 'exteriorNumber', 'interiorNumber', 'postalCode', 'emailAddress', 'localOffice'] as const
const scalarDetailKeys = ['rfc', 'curp', 'legalName', 'capitalRegime', 'incorporationDate', 'firstName', 'paternalSurname', 'maternalSurname', 'birthDate',
  'operationsStartDate', 'taxpayerStatus', 'statusChangedDate'] as const

/**
 * Valida los datos del SAT en tres puntos: antes de guardarlos en MySQL, al leerlos de la columna JSON y al
 * recibirlos en Main y preload. Así una fila alterada o una página anómala no llega a la vista.
 */
export function parseTaxStatusDetails(value: unknown): TaxStatusDetails {
  const data = pairingRecord(value)
  exactKeys(data, ['personType', ...scalarDetailKeys, 'address', 'regimes', 'otherFields'])
  const addressData = pairingRecord(data.address)
  exactKeys(addressData, addressKeys)
  if (!Array.isArray(data.regimes) || data.regimes.length > maximumTaxStatusRegimes) throw new Error('Invalid tax regimes')
  if (!Array.isArray(data.otherFields) || data.otherFields.length > maximumTaxStatusOtherFields) throw new Error('Invalid tax status fields')
  const address = Object.fromEntries(addressKeys.map(key => [key, optionalText(addressData[key])])) as unknown as TaxStatusAddress
  const scalars = Object.fromEntries(scalarDetailKeys.map(key => [key, optionalText(data[key])])) as Record<typeof scalarDetailKeys[number], string | null>
  return {
    personType: oneOf(data.personType, taxStatusPersonTypes), ...scalars, address,
    regimes: data.regimes.map(item => {
      const regime = pairingRecord(item); exactKeys(regime, ['name', 'registeredOn'])
      return { name: text(regime.name, maximumTaxStatusTextLength), registeredOn: optionalText(regime.registeredOn) }
    }),
    otherFields: data.otherFields.map(item => {
      const field = pairingRecord(item); exactKeys(field, ['label', 'value'])
      return { label: text(field.label, maximumTaxStatusTextLength), value: text(field.value, maximumTaxStatusTextLength) }
    })
  }
}

function parseRecord(value: unknown): TaxStatusRecord | null {
  if (value === null) return null
  const data = pairingRecord(value)
  exactKeys(data, ['details', 'queriedRfc', 'idCifSource', 'idCif', 'queriedAt', 'queriedByDisplayName'])
  return { details: parseTaxStatusDetails(data.details), queriedRfc: text(data.queriedRfc, 13), idCifSource: oneOf(data.idCifSource, idCifSources),
    idCif: data.idCif === null ? null : parseIdCif(data.idCif), queriedAt: instant(data.queriedAt),
    queriedByDisplayName: pairingText(data.queriedByDisplayName, 200) }
}
function parseAttempt(value: unknown): TaxStatusAttempt | null {
  if (value === null) return null
  const data = pairingRecord(value)
  exactKeys(data, ['state', 'outcome', 'idCifSource', 'requestedAt', 'finishedAt'])
  const state = oneOf(data.state, ['running', 'completed'] as const)
  const outcome = data.outcome === null ? null : oneOf(data.outcome, taxStatusOutcomes)
  // Un intento terminado siempre tiene resultado y hora de fin; uno en curso, ninguno de los dos.
  if ((state === 'completed') !== (outcome !== null) || (state === 'completed') !== (data.finishedAt !== null)) throw new Error('Invalid tax status attempt')
  return { state, outcome, idCifSource: oneOf(data.idCifSource, idCifSources), requestedAt: instant(data.requestedAt), finishedAt: data.finishedAt === null ? null : instant(data.finishedAt) }
}

/** Intento sin cliente: los datos sólo acompañan a `found`, y un intento en curso no tiene resultado. */
function parseLookup(value: unknown): TaxStatusLookup {
  const data = pairingRecord(value)
  exactKeys(data, ['attemptId', 'rfc', 'state', 'outcome', 'details'])
  const state = oneOf(data.state, ['running', 'completed'] as const)
  const outcome = data.outcome === null ? null : oneOf(data.outcome, taxStatusLookupOutcomes)
  const details = data.details === null ? null : parseTaxStatusDetails(data.details)
  if ((state === 'completed') !== (outcome !== null) || (outcome === 'found') !== (details !== null)) throw new Error('Invalid tax status lookup')
  return { attemptId: parseHostId(data.attemptId), rfc: parseLookupRfc(data.rfc), state, outcome, details }
}

export function parseTaxStatusResult(value: unknown): TaxStatusResult {
  const data = pairingRecord(value)
  if (data.status === 'lookup') { exactKeys(data, ['status', 'lookup']); return { status: 'lookup', lookup: parseLookup(data.lookup) } }
  exactKeys(data, ['status', 'overview'])
  if (data.status !== 'overview') throw new Error('Invalid tax status result')
  const overview = pairingRecord(data.overview)
  exactKeys(overview, ['clientId', 'profile', 'canQuery', 'canUseCertificate', 'certificate', 'latest', 'attempt'])
  const profile = pairingRecord(overview.profile)
  exactKeys(profile, ['displayName', 'rfc', 'taxRegime', 'fiscalPostalCode'])
  let certificate: TaxStatusCertificate | null = null
  if (overview.certificate !== null) {
    const entry = pairingRecord(overview.certificate)
    exactKeys(entry, ['documentId', 'displayName', 'createdAt'])
    certificate = { documentId: parseHostId(entry.documentId), displayName: parseDocumentDisplayName(entry.displayName), createdAt: instant(entry.createdAt) }
  }
  return { status: 'overview', overview: {
    clientId: parseHostId(overview.clientId),
    profile: { displayName: pairingText(profile.displayName, 100), rfc: text(profile.rfc, 13), taxRegime: text(profile.taxRegime, 100), fiscalPostalCode: postalCode(profile.fiscalPostalCode) },
    canQuery: flag(overview.canQuery), canUseCertificate: flag(overview.canUseCertificate), certificate,
    latest: parseRecord(overview.latest), attempt: parseAttempt(overview.attempt)
  } }
}
