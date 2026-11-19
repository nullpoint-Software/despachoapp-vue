import { parseHostId } from './discovery'
export const hostTrustChannel = 'security:hostTrust'
/**
 * 7.4: `rotate` (Host) crea una CA nueva con el mismo `hostId`; `renew` (Cliente) importa esa identidad renovada
 * tras confirmar la huella nueva. El certificado del servidor se renueva solo y no necesita acción.
 */
export type HostTrustAction = 'status' | 'prepare' | 'export' | 'import' | 'verify' | 'rotate' | 'renew'
export interface HostTrustIdentity { hostId: string; fingerprint: string; expiresAt: string }
/** Vencimientos del Host: certificado del servidor (renovación automática) y CA (aviso a 6 meses). */
export interface HostCertificateDates { certificateExpiresAt: string; authorityExpiresAt: string; isAuthorityExpiring: boolean }
export interface HostTrustStatus { identity: HostTrustIdentity | null; isListening: boolean; message: string; certificates: HostCertificateDates | null }
const trustActions = ['status', 'prepare', 'export', 'import', 'verify', 'rotate', 'renew']
export function parseHostTrustAction(value: unknown): HostTrustAction {
  if (typeof value !== 'string' || !trustActions.includes(value)) throw new Error('Invalid trust action')
  return value as HostTrustAction
}
/** Sólo información pública: nunca certificados privados, rutas o credenciales en el puente. */
export function parseHostTrustStatus(value: unknown): HostTrustStatus {
  if (!value || typeof value !== 'object') throw new Error('Invalid trust status')
  const data = value as Record<string, unknown>
  if (typeof data.isListening !== 'boolean' || typeof data.message !== 'string' || data.message.length > 600) throw new Error('Invalid trust status')
  let identity: HostTrustIdentity | null = null
  if (data.identity !== null) {
    if (!data.identity || typeof data.identity !== 'object') throw new Error('Invalid trust identity')
    const entry = data.identity as Record<string, unknown>
    if (typeof entry.fingerprint !== 'string' || !/^([A-F0-9]{2}:){31}[A-F0-9]{2}$/.test(entry.fingerprint) || typeof entry.expiresAt !== 'string' || entry.expiresAt.length > 40 || !Number.isFinite(Date.parse(entry.expiresAt))) throw new Error('Invalid trust identity')
    identity = { hostId: parseHostId(entry.hostId), fingerprint: entry.fingerprint, expiresAt: entry.expiresAt }
  }
  let certificates: HostCertificateDates | null = null
  if (data.certificates !== null && data.certificates !== undefined) {
    const entry = data.certificates as Record<string, unknown>
    const isDate = (item: unknown) => typeof item === 'string' && item.length <= 40 && Number.isFinite(Date.parse(item))
    if (!isDate(entry.certificateExpiresAt) || !isDate(entry.authorityExpiresAt) || typeof entry.isAuthorityExpiring !== 'boolean') throw new Error('Invalid certificate dates')
    certificates = { certificateExpiresAt: String(entry.certificateExpiresAt), authorityExpiresAt: String(entry.authorityExpiresAt), isAuthorityExpiring: entry.isAuthorityExpiring }
  }
  return { identity, isListening: data.isListening, message: data.message, certificates }
}
