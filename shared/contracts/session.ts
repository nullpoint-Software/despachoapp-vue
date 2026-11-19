import { pairingRecord, pairingText } from './pairing'
import { parseHostId } from './discovery'
import { isValidNewPassword } from './passwordPolicy'
export interface LoginRequest { username: string; password: string }
/** `sensitiveConfirmedUntil` (ADR-038) sólo aparece con la gracia de confirmación vigente según el reloj del Host. */
export interface SessionStatus { state: 'signedOut' | 'authenticated'; user: { userId: string; displayName: string } | null; expiresAt: string | null; sensitiveConfirmedUntil?: string }
export const sessionChannel = 'security:session'
export function parseLoginRequest(value: unknown): LoginRequest {
  const data = pairingRecord(value)
  if (Object.keys(data).sort().join(',') !== 'password,username' || typeof data.username !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9.-]{2,63}$/.test(data.username) || typeof data.password !== 'string' || !data.password.length || data.password.length > 128) throw new Error('Invalid login')
  return { username: data.username.toLowerCase(), password: data.password }
}
/** El DTO público excluye token, hash, roles internos y credenciales de dispositivo. */
export function parseSessionStatus(value: unknown): SessionStatus {
  const data = pairingRecord(value)
  if (data.state === 'signedOut' && data.user === null && data.expiresAt === null) return { state: 'signedOut', user: null, expiresAt: null }
  if (data.state !== 'authenticated' || typeof data.expiresAt !== 'string' || data.expiresAt.length > 40 || !Number.isFinite(Date.parse(data.expiresAt))) throw new Error('Invalid session status')
  const user = pairingRecord(data.user)
  const grace = data.sensitiveConfirmedUntil
  if (grace !== undefined && (typeof grace !== 'string' || grace.length > 40 || !Number.isFinite(Date.parse(grace)))) throw new Error('Invalid session status')
  return { state: 'authenticated', user: { userId: parseHostId(user.userId), displayName: pairingText(user.displayName) }, expiresAt: data.expiresAt, ...(grace === undefined ? {} : { sensitiveConfirmedUntil: grace }) }
}
export const signedOut: SessionStatus = { state: 'signedOut', user: null, expiresAt: null }

/**
 * Cambiar la propia contraseña (2026-10-17, pedido del usuario: "opción para cambiar la contraseña" en Configuración).
 * La persona da la actual y la nueva; el Host verifica la actual con el mismo contador de intentos de las operaciones
 * sensibles (5 fallos en 15 min bloquean), guarda la nueva y revoca sus OTRAS sesiones. La nueva sigue
 * `isValidNewPassword` y debe ser distinta de la actual. Ninguna de las dos se registra en logs.
 */
export interface PasswordChangeRequest { currentPassword: string; newPassword: string }
export function parsePasswordChangeRequest(value: unknown): PasswordChangeRequest {
  const data = pairingRecord(value)
  if (Object.keys(data).sort().join(',') !== 'currentPassword,newPassword' || typeof data.currentPassword !== 'string' || !data.currentPassword.length || data.currentPassword.length > 128 ||
    !isValidNewPassword(data.newPassword) || data.newPassword === data.currentPassword) throw new Error('Invalid password change')
  return { currentPassword: data.currentPassword, newPassword: data.newPassword }
}
