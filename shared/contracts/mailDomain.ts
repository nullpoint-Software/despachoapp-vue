import { pairingRecord } from './pairing'

/**
 * Asistente de dominio del correo (2026-10-20, [[MAIL]]): revisa en el DNS público si el dominio del remitente tiene
 * SPF, DKIM y DMARC, que deciden si los correos llegan a la bandeja de entrada o a spam.
 *
 * Canal `mail:domain` (Renderer → Main). Main toma el dominio de la cuenta vinculada en ESTE equipo, nunca de la vista:
 * - `check`: consulta el DNS y devuelve el informe con los registros sugeridos.
 * - `copyRecord`: Main vuelve a armar el registro sugerido (SPF o DMARC) y lo copia al portapapeles.
 * - `openDkimConsole`: abre en el navegador la consola del proveedor donde se genera la llave DKIM (Google o
 *   Microsoft). La llave la genera y la usa el proveedor; Fiscenix no guarda llaves privadas.
 * Todo es información pública del DNS: no hay datos LOCAL ni GLOBAL que guardar.
 */
export const mailDomainChannel = 'mail:domain'

export type MailDomainRecordKind = 'spf' | 'dmarc'
export type MailDomainRequest = { action: 'check' } | { action: 'copyRecord'; record: MailDomainRecordKind } | { action: 'openDkimConsole' }

export interface MailDomainReport {
  domain: string
  /** Dominio público del proveedor (gmail.com, outlook.com…): ya está autenticado y su DNS no se puede cambiar. */
  isProviderDomain: boolean
  /** `record` es el registro publicado (o `null`); `suggestedRecord` el que conviene publicar. */
  spf: { record: string | null; isProviderIncluded: boolean; suggestedRecord: string }
  /** Selectores revisados y si alguno tiene llave publicada. `consoleUrl` sólo para Google y Microsoft. */
  dkim: { selectors: string[]; isFound: boolean; consoleUrl: string | null }
  dmarc: { record: string | null; policy: string | null; suggestedRecord: string }
}

export type MailDomainResult = { status: 'report'; report: MailDomainReport } | { status: 'copied'; record: MailDomainRecordKind } | { status: 'opened' }

export function parseMailDomainRequest(value: unknown): MailDomainRequest {
  const data = pairingRecord(value)
  const keys = Object.keys(data).sort().join(',')
  if ((data.action === 'check' || data.action === 'openDkimConsole') && keys === 'action') return { action: data.action }
  if (data.action === 'copyRecord' && keys === 'action,record' && (data.record === 'spf' || data.record === 'dmarc')) return { action: 'copyRecord', record: data.record }
  throw new Error('Invalid mail domain request')
}

function parseText(value: unknown, maximumLength: number): string {
  if (typeof value !== 'string' || value.length > maximumLength) throw new Error('Invalid mail domain report')
  return value
}
function parseNullableText(value: unknown, maximumLength: number): string | null { return value === null ? null : parseText(value, maximumLength) }
function parseFlag(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new Error('Invalid mail domain report')
  return value
}

/** Valida el informe que llega de Main antes de que la vista lo use (el DNS es texto ajeno). */
export function parseMailDomainResult(value: unknown): MailDomainResult {
  const data = pairingRecord(value)
  if (data.status === 'opened') return { status: 'opened' }
  if (data.status === 'copied' && (data.record === 'spf' || data.record === 'dmarc')) return { status: 'copied', record: data.record }
  if (data.status !== 'report') throw new Error('Invalid mail domain result')
  const report = pairingRecord(data.report), spf = pairingRecord(report.spf), dkim = pairingRecord(report.dkim), dmarc = pairingRecord(report.dmarc)
  if (!Array.isArray(dkim.selectors) || dkim.selectors.length > 10) throw new Error('Invalid mail domain report')
  return { status: 'report', report: {
    domain: parseText(report.domain, 253), isProviderDomain: parseFlag(report.isProviderDomain),
    spf: { record: parseNullableText(spf.record, 4000), isProviderIncluded: parseFlag(spf.isProviderIncluded), suggestedRecord: parseText(spf.suggestedRecord, 4000) },
    dkim: { selectors: dkim.selectors.map(selector => parseText(selector, 63)), isFound: parseFlag(dkim.isFound), consoleUrl: parseNullableText(dkim.consoleUrl, 200) },
    dmarc: { record: parseNullableText(dmarc.record, 4000), policy: parseNullableText(dmarc.policy, 20), suggestedRecord: parseText(dmarc.suggestedRecord, 4000) }
  } }
}
