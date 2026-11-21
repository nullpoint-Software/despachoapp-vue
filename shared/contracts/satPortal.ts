import { parseCiec } from './clientCredentials'
import { parseHostId } from './discovery'
import { rfcPattern } from './localXml'
import { pairingRecord } from './pairing'
import { parsePdfView, type PdfView } from './pdfViewer'

/**
 * Portal del SAT con RFC y CIEC (2026-10-11, pedido del usuario: "además de la opción de sacarlo con RFC y CIEC, lo
 * mismo para las opiniones"). Desde el 2026-10-14 ([[../../docs/decisions/ADR-040-SAT-PORTAL-BROWSER-ENGINE]]) Main
 * maneja sin ventana el Edge o Chrome del equipo (`playwright-core`, como la ContaApp anterior): abre el login del SAT,
 * manda a la vista la **imagen** del captcha, la persona escribe su texto en Fiscenix y Main llena RFC, CIEC (la guardada
 * en ESTE equipo, ADR-032) y ese texto, entra y obtiene el PDF:
 * - `taxStatusCertificate`: la constancia de situación fiscal (CSF) va al expediente del cliente; de ahí sale el idCIF.
 * - **Sin ficha** (2026-10-17, pedido del usuario: "personas que tampoco son clientes, debemos poder obtener las csf y
 *   verificar si realmente existe ese rfc"): `startThirdParty` con el RFC que escribió la persona y
 *   - `taxStatusCertificate` + la CIEC de ESA persona, escrita en el momento: Main la usa en el login y la olvida; el
 *     PDF queda en memoria de Main (no va al Host) y `viewPdf` lo abre en el visor, desde donde se guarda;
 *   - `rfcValidation`: la «Validación de RFC» pública del SAT (sin CIEC, con captcha) dice si el RFC está registrado.
 *   El Host sólo autoriza (`authorizeThirdParty`, permiso `taxStatus.query`); no recibe RFC, CIEC ni PDF.
 * La opinión 32-D con CIEC se retiró el 2026-10-17 (decisión del usuario: la consulta pública ya funciona); el Host
 * conserva la columna `origin` y las opiniones `portal` ya guardadas.
 *
 * Contratos:
 * - **Vista ↔ Main** (`satPortal:operate`): iniciar, leer el avance, cancelar, `submitCaptcha` (el texto que escribió la
 *   persona) y `refreshCaptcha` («Otra imagen»). Con cliente la vista nunca envía RFC ni CIEC; sin ficha envía las de
 *   la persona consultada una sola vez en `startThirdParty`. Recibe sólo la imagen del captcha y el resultado.
 * - **Main ↔ Host** (acción de sesión `satPortal`): `authorize` comprueba permisos y asignación, deja la auditoría
 *   `ciec.portal.*` y devuelve el RFC del perfil. El PDF viaja después por el canal del expediente (ver documents.ts).
 */
export const satPortalChannel = 'satPortal:operate'
export const satPortalServices = ['taxStatusCertificate', 'rfcValidation'] as const
export type SatPortalService = typeof satPortalServices[number]
/** Límite del PDF capturado en Main (la CSF pesa decenas de KB); el Host vuelve a validar con el suyo. */
export const maximumPortalPdfBytes = 10 * 1024 * 1024
/** Tiempo total de una ejecución: navegador, captcha, generación y descarga. */
export const satPortalTimeoutMilliseconds = 10 * 60 * 1000
/** Acción de `clientAudit` de la CSF con la CIEC del cliente (VARCHAR(32)); nunca contiene la CIEC. */
export const satPortalCertificateAuditAction = 'ciec.portal.csf'

/**
 * Estados de una ejecución (EPHEMERAL, memoria de Main):
 * `authorizing` (Host) → `preparing` (abre el navegador y el login) → `waitingForCaptcha` (`captchaImage` a la vista) →
 * `signingIn` (Main envió el acceso; si el SAT lo rechaza vuelve a `waitingForCaptcha` con una imagen nueva) →
 * `working` (sesión iniciada, obteniendo el PDF) → `saving` (enviando al Host) → `saved`. Terminales: `saved`,
 * `cancelled` y `failed` (la vista ofrece «Reintentar», que inicia otra ejecución). Sin ficha termina en `ready`: el PDF
 * listo en Main (`hasPdf`) o la respuesta del SAT sobre el RFC (`rfcStatus`).
 */
export const satPortalRunStates = ['authorizing', 'preparing', 'waitingForCaptcha', 'signingIn', 'working', 'saving', 'saved', 'ready', 'cancelled', 'failed'] as const
export type SatPortalRunState = typeof satPortalRunStates[number]
export const activeSatPortalRunStates: readonly SatPortalRunState[] = ['authorizing', 'preparing', 'waitingForCaptcha', 'signingIn', 'working', 'saving']
/** Respuesta de la «Validación de RFC» del SAT. */
export const satRfcStatuses = ['registered', 'notRegistered'] as const
export type SatRfcStatus = typeof satRfcStatuses[number]
export interface SatPortalRun {
  runId: string
  /** Cliente de la ejecución; `null` sin ficha. */
  clientId: string | null
  service: SatPortalService
  state: SatPortalRunState
  /** Explicación en español para la persona; nunca incluye RFC, CIEC ni respuestas del SAT. */
  message: string
  startedAt: string
  finishedAt: string | null
  /** Documento del expediente creado o reutilizado (la CSF). */
  documentId: string | null
  /** Imagen del captcha (`data:image/png;base64,…`) sólo en `waitingForCaptcha`; `null` en los demás estados. */
  captchaImage: string | null
  /** Sin ficha: la CSF está en memoria de Main y `viewPdf` la abre. */
  hasPdf: boolean
  /** Sin ficha, `rfcValidation`: lo que respondió el SAT. */
  rfcStatus: SatRfcStatus | null
}

/**
 * Captcha ([[../../docs/modules/SAT-PORTAL#Captcha]]): Main manda la imagen tal como la muestra el SAT y la persona
 * escribe su texto en Fiscenix. Fiscenix nunca lo lee (sin OCR), no lo manda a servicios externos ni lo intenta por su
 * cuenta. El texto se normaliza como la versión anterior: sin espacios a los lados y en mayúsculas.
 * Excepción (2026-10-17): el captcha de la «Validación de RFC» distingue mayúsculas y minúsculas ("considerando
 * números, letras mayúsculas y minúsculas"), así que `satPortal:operate` conserva lo escrito (`parseCaptchaText`) y
 * Main lo pasa a mayúsculas sólo para los logins (`SatPortalCoordinator.submitCaptcha`).
 */
export const maximumCaptchaTextLength = 16
export const maximumCaptchaImageLength = 400000
const captchaImagePattern = /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/
/** Texto del captcha sin espacios a los lados, tal como se escribió. */
export function parseCaptchaText(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Invalid captcha text')
  const text = value.trim()
  if (!text || text.length > maximumCaptchaTextLength || [...text].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) throw new Error('Invalid captcha text')
  return text
}
export function normalizeCaptchaText(value: unknown): string {
  return parseCaptchaText(value).toLocaleUpperCase('es-MX')
}
export function parseCaptchaImage(value: unknown): string | null {
  if (value === null) return null
  if (typeof value !== 'string' || value.length > maximumCaptchaImageLength || !captchaImagePattern.test(value)) throw new Error('Invalid captcha image')
  return value
}

export type SatPortalViewRequest =
  { action: 'read' } |
  { action: 'start'; clientId: string; service: 'taxStatusCertificate' } |
  { action: 'startThirdParty'; service: 'taxStatusCertificate'; rfc: string; ciec: string } |
  { action: 'startThirdParty'; service: 'rfcValidation'; rfc: string } |
  { action: 'viewPdf' } |
  { action: 'cancel' } |
  { action: 'submitCaptcha'; captchaText: string } |
  { action: 'refreshCaptcha' }
/** `pdfView` sólo en la respuesta de `viewPdf`. */
export interface SatPortalViewResult { run: SatPortalRun | null; pdfView?: PdfView }

/**
 * Petición de Main al Host. Con cliente, el RFC lo pone el Host desde el perfil, nunca la vista. Sin ficha
 * (`authorizeThirdParty`) el Host sólo comprueba el permiso: no recibe el RFC.
 */
export type SatPortalHostRequest = { action: 'authorize'; clientId: string; service: 'taxStatusCertificate' } | { action: 'authorizeThirdParty'; service: SatPortalService }
export type SatPortalHostResult = { status: 'authorized'; rfc: string } | { status: 'missingRfc' } | { status: 'thirdPartyAuthorized' }

/** RFC escrito por la persona: sin espacios a los lados, en mayúsculas y con la forma del SAT. */
export function parsePortalRfc(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Invalid RFC')
  const rfc = value.trim().toLocaleUpperCase('es-MX')
  if (!rfcPattern.test(rfc)) throw new Error('Invalid RFC')
  return rfc
}
function parseCertificateService(value: unknown): 'taxStatusCertificate' {
  if (value !== 'taxStatusCertificate') throw new Error('Invalid SAT portal service')
  return value
}

function exactKeys(data: Record<string, unknown>, keys: readonly string[]): void {
  if (Object.keys(data).sort().join() !== [...keys].sort().join()) throw new Error('Invalid SAT portal data')
}
export function parseSatPortalService(value: unknown): SatPortalService {
  if (!satPortalServices.includes(value as SatPortalService)) throw new Error('Invalid SAT portal service')
  return value as SatPortalService
}
function instant(value: unknown): string {
  if (typeof value !== 'string' || value.length > 40 || !Number.isFinite(Date.parse(value))) throw new Error('Invalid SAT portal date')
  return value
}
function message(value: unknown): string {
  if (typeof value !== 'string' || value.length > 500 || [...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) throw new Error('Invalid SAT portal message')
  return value
}

export function parseSatPortalViewRequest(value: unknown): SatPortalViewRequest {
  const data = pairingRecord(value)
  if (data.action === 'read' || data.action === 'cancel' || data.action === 'refreshCaptcha' || data.action === 'viewPdf') { exactKeys(data, ['action']); return { action: data.action } }
  if (data.action === 'submitCaptcha') { exactKeys(data, ['action', 'captchaText']); return { action: 'submitCaptcha', captchaText: parseCaptchaText(data.captchaText) } }
  if (data.action === 'start') { exactKeys(data, ['action', 'clientId', 'service']); return { action: 'start', clientId: parseHostId(data.clientId), service: parseCertificateService(data.service) } }
  if (data.action === 'startThirdParty' && data.service === 'rfcValidation') { exactKeys(data, ['action', 'service', 'rfc']); return { action: 'startThirdParty', service: 'rfcValidation', rfc: parsePortalRfc(data.rfc) } }
  if (data.action === 'startThirdParty') { exactKeys(data, ['action', 'service', 'rfc', 'ciec']); return { action: 'startThirdParty', service: parseCertificateService(data.service), rfc: parsePortalRfc(data.rfc), ciec: parseCiec(data.ciec) } }
  throw new Error('Invalid SAT portal request')
}

export function parseSatPortalRun(value: unknown): SatPortalRun {
  const data = pairingRecord(value)
  exactKeys(data, ['runId', 'clientId', 'service', 'state', 'message', 'startedAt', 'finishedAt', 'documentId', 'captchaImage', 'hasPdf', 'rfcStatus'])
  if (!satPortalRunStates.includes(data.state as SatPortalRunState)) throw new Error('Invalid SAT portal state')
  if (typeof data.hasPdf !== 'boolean' || (data.rfcStatus !== null && !satRfcStatuses.includes(data.rfcStatus as SatRfcStatus))) throw new Error('Invalid SAT portal run')
  return { runId: parseHostId(data.runId), clientId: data.clientId === null ? null : parseHostId(data.clientId), hasPdf: data.hasPdf, rfcStatus: data.rfcStatus as SatRfcStatus | null, service: parseSatPortalService(data.service), state: data.state as SatPortalRunState, message: message(data.message),
    startedAt: instant(data.startedAt), finishedAt: data.finishedAt === null ? null : instant(data.finishedAt), documentId: data.documentId === null ? null : parseHostId(data.documentId), captchaImage: parseCaptchaImage(data.captchaImage) }
}

export function parseSatPortalViewResult(value: unknown): SatPortalViewResult {
  const data = pairingRecord(value)
  const hasPdfView = 'pdfView' in data
  exactKeys(data, hasPdfView ? ['run', 'pdfView'] : ['run'])
  const run = data.run === null ? null : parseSatPortalRun(data.run)
  return hasPdfView ? { run, pdfView: parsePdfView(data.pdfView) } : { run }
}

export function parseSatPortalHostRequest(value: unknown): SatPortalHostRequest {
  const data = pairingRecord(value)
  if (data.action === 'authorizeThirdParty') { exactKeys(data, ['action', 'service']); return { action: 'authorizeThirdParty', service: parseSatPortalService(data.service) } }
  exactKeys(data, ['action', 'clientId', 'service'])
  if (data.action !== 'authorize') throw new Error('Invalid SAT portal request')
  return { action: 'authorize', clientId: parseHostId(data.clientId), service: parseCertificateService(data.service) }
}

export function parseSatPortalHostResult(value: unknown): SatPortalHostResult {
  const data = pairingRecord(value)
  if (data.status === 'missingRfc' || data.status === 'thirdPartyAuthorized') { exactKeys(data, ['status']); return { status: data.status } }
  exactKeys(data, ['status', 'rfc'])
  if (data.status !== 'authorized' || typeof data.rfc !== 'string' || !rfcPattern.test(data.rfc)) throw new Error('Invalid SAT portal result')
  return { status: 'authorized', rfc: data.rfc }
}
