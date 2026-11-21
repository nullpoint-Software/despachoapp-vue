import { isValidNewPassword } from './passwordPolicy'
export interface CreateAdministratorRequest { displayName: string; username: string; password: string }
export const administratorChannel = 'host:createAdministrator'
/** Credenciales efímeras: no se recortan ni normalizan contraseñas, ni se devuelven en errores. */
export function parseCreateAdministrator(value: unknown): CreateAdministratorRequest {
  if (!value || typeof value !== 'object' || Object.keys(value).sort().join(',') !== 'displayName,password,username') throw new Error('Invalid administrator request')
  const data = value as Record<string, unknown>
  if (typeof data.displayName !== 'string' || !data.displayName.trim() || data.displayName.length > 100 ||
    [...data.displayName].some(character => character.charCodeAt(0) < 32) ||
    typeof data.username !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9.-]{2,63}$/.test(data.username) ||
    !isValidNewPassword(data.password)) throw new Error('Invalid administrator request')
  return { displayName: data.displayName.trim(), username: data.username.toLowerCase(), password: data.password }
}
