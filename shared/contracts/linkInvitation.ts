import { parseHostId } from './discovery'
import { pairingRecord, pairingText, parsePairingSecret } from './pairing'
export const linkInvitationChannel = 'devices:linkFile'
export interface LinkInvitation { invitationId: string; secret: string; expiresAt: string; maximumDeviceCount?: number }
export interface LinkInvitationOptions { maximumDeviceCount: number }
/** La omisión conserva archivos y llamadas anteriores: una PC. El límite nunca procede del canje. */
export function parseMaximumDeviceCount(value: unknown = 1): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 10) throw new Error('Invalid invitation capacity')
  return value
}
export function parseLinkInvitationOptions(value: unknown): LinkInvitationOptions {
  if (value === undefined) return { maximumDeviceCount: 1 }
  const data = pairingRecord(value)
  if (Object.keys(data).join(',') !== 'maximumDeviceCount') throw new Error('Invalid invitation options')
  return { maximumDeviceCount: parseMaximumDeviceCount(data.maximumDeviceCount) }
}
export interface RedeemInvitation extends LinkInvitation { deviceId: string; computerName: string; credential: string }
export function parseLinkInvitation(value: unknown): LinkInvitation {
  const data = pairingRecord(value)
  if (typeof data.expiresAt !== 'string' || !Number.isFinite(Date.parse(data.expiresAt))) throw new Error('Invalid invitation expiry')
  return { invitationId: parseHostId(data.invitationId), secret: parsePairingSecret(data.secret), expiresAt: data.expiresAt, maximumDeviceCount: parseMaximumDeviceCount(data.maximumDeviceCount) }
}
/** La credencial se genera y guarda en Main antes de canjear: reintentar no autoriza otro equipo. */
export function parseRedeemInvitation(value: unknown): RedeemInvitation {
  const data = pairingRecord(value)
  return { ...parseLinkInvitation(data), deviceId: parseHostId(data.deviceId), computerName: pairingText(data.computerName), credential: parsePairingSecret(data.credential) }
}
