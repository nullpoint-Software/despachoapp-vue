import { parseHostId } from './discovery'
export const pairingChannels = { client: 'devices:pairing', administrator: 'devices:administer' } as const
export type PairingState = 'idle' | 'pending' | 'approved' | 'paired' | 'denied' | 'expired' | 'revoked'
export interface PairingStatus { state: PairingState; code: string | null; expiresAt: string | null; message: string }
export interface DeviceEntry { deviceId: string; alias: string; computerName: string; observedAddress: string; isRevoked: boolean; isBlocked?: boolean; lastSeenAt: string | null }
export interface PairingEntry { requestId: string; deviceId: string; computerName: string; observedAddress: string; expiresAt: string; state: 'pending' | 'approved' }
export interface DeviceAdministration { requests: PairingEntry[]; devices: DeviceEntry[] }
export interface DeviceAdministrationRequest { action: 'list' | 'approve' | 'deny' | 'revoke' | 'block' | 'unblock' | 'closeSessions'; username: string; password: string; targetId?: string; code?: string; alias?: string }
export function pairingRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid pairing data')
  return value as Record<string, unknown>
}
export function pairingText(value: unknown, maximum = 100): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum || [...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) throw new Error('Invalid pairing text')
  return value.trim()
}
export function parsePairingSecret(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) throw new Error('Invalid pairing proof')
  return value
}
export function parsePairingStatus(value: unknown): PairingStatus {
  const data = pairingRecord(value)
  if (!['idle', 'pending', 'approved', 'paired', 'denied', 'expired', 'revoked'].includes(String(data.state))) throw new Error('Invalid pairing state')
  if (data.code !== null && (typeof data.code !== 'string' || !/^[0-9]{8}$/.test(data.code))) throw new Error('Invalid pairing code')
  if (data.expiresAt !== null && (typeof data.expiresAt !== 'string' || data.expiresAt.length > 40 || !Number.isFinite(Date.parse(data.expiresAt)))) throw new Error('Invalid pairing expiry')
  return { state: data.state as PairingState, code: data.code as string | null, expiresAt: data.expiresAt as string | null, message: pairingText(data.message, 500) }
}
/** Credenciales por operación, sin sesión ni autorización implícita por usar la ventana del Host. */
export function parseDeviceAdministrationRequest(value: unknown): DeviceAdministrationRequest {
  const data = pairingRecord(value)
  if (!['list', 'approve', 'deny', 'revoke', 'block', 'unblock', 'closeSessions'].includes(String(data.action)) || typeof data.action !== 'string' || Object.keys(data).some(key => !['action','username','password','targetId','code','alias'].includes(key))) throw new Error('Invalid device administration')
  if (typeof data.username !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9.-]{2,63}$/.test(data.username) || typeof data.password !== 'string' || !data.password.length || data.password.length > 128) throw new Error('Invalid administrator credentials')
  const result: DeviceAdministrationRequest = { action: data.action as DeviceAdministrationRequest['action'], username: data.username.toLowerCase(), password: data.password }
  if (data.action !== 'list') result.targetId = parseHostId(data.targetId)
  if (data.action === 'approve') {
    if (typeof data.code !== 'string' || !/^[0-9]{8}$/.test(data.code)) throw new Error('Invalid comparison code')
    result.code = data.code; result.alias = pairingText(data.alias)
  }
  return result
}
export function parseDeviceAdministration(value: unknown): DeviceAdministration {
  const data = pairingRecord(value)
  if (!Array.isArray(data.requests) || data.requests.length > 30 || !Array.isArray(data.devices) || data.devices.length > 200) throw new Error('Invalid device list')
  return {
    requests: data.requests.map(value => { const row = pairingRecord(value); if (!['pending','approved'].includes(String(row.state))) throw new Error('Invalid pairing state'); return { requestId: parseHostId(row.requestId), deviceId: parseHostId(row.deviceId), computerName: pairingText(row.computerName), observedAddress: pairingText(row.observedAddress, 45), expiresAt: pairingText(row.expiresAt, 40), state: row.state as 'pending' | 'approved' } }),
    devices: data.devices.map(value => { const row = pairingRecord(value); if (typeof row.isRevoked !== 'boolean' || (row.isBlocked !== undefined && typeof row.isBlocked !== 'boolean')) throw new Error('Invalid device status'); return { deviceId: parseHostId(row.deviceId), alias: pairingText(row.alias), computerName: pairingText(row.computerName), observedAddress: pairingText(row.observedAddress, 45), isRevoked: row.isRevoked, ...(row.isBlocked === undefined ? {} : { isBlocked: row.isBlocked }), lastSeenAt: row.lastSeenAt === null ? null : pairingText(row.lastSeenAt, 40) } })
  }
}
