import { pairingRecord, pairingText } from './pairing'
import { parseHostId } from './discovery'
import { parseCreateAdministrator } from './administrator'
import { isValidNewPassword } from './passwordPolicy'

/** Catálogo compartido para representar controles; la decisión siempre se toma en Host. */
export const administratorRecoveryPermissions = ['devices.manage', 'users.manage', 'roles.manage', 'office.manage'] as const
export const permissionKeys = [...administratorRecoveryPermissions, 'clients.read', 'clients.create', 'clients.update', 'clients.assign', 'documents.read', 'documents.upload', 'documents.delete', 'movements.read', 'movements.create', 'movements.update', 'movements.void', 'tasks.read', 'tasks.create', 'tasks.update', 'tasks.assign', 'tasks.complete', 'notes.use', 'xml.use', 'reports.read', 'reports.manage', 'sat.download', 'opinions.read', 'opinions.query', 'taxStatus.query', 'bank.reconcile', 'schedules.manage', 'officeMovements.read', 'officeMovements.create', 'officeMovements.update', 'officeMovements.void', 'backups.manage', 'backups.restore', 'mail.send', 'migration.run'] as const
export type PermissionKey = typeof permissionKeys[number]
export type PermissionOverride = { permissionKey: PermissionKey; effect: 'allow' | 'deny' }
export interface AccessUser { userId: string; username: string; displayName: string; isActive: boolean; roleIds: string[]; overrides: PermissionOverride[] }
export interface AccessRole { roleId: string; displayName: string; permissions: PermissionKey[] }
export interface AccessSnapshot { revision: number; users: AccessUser[]; roles: AccessRole[] }
export type AccessRequest = { action: 'list' } | { action: 'createUser'; revision: number; username: string; displayName: string; password: string } |
  { action: 'updateUser'; revision: number; userId: string; displayName: string; isActive: boolean; password: string; roleIds: string[]; overrides: PermissionOverride[] } |
  { action: 'saveRole'; revision: number; roleId: string | null; displayName: string; permissions: PermissionKey[] } |
  { action: 'deleteRole'; revision: number; roleId: string }
export const accessChannel = 'security:access'
function parseRevision(value: unknown): number { if (!Number.isSafeInteger(value) || Number(value) < 0) throw new Error('Invalid revision'); return Number(value) }
function parseList<T>(value: unknown, maximum: number, parse: (item: unknown) => T): T[] {
  if (!Array.isArray(value) || value.length > maximum) throw new Error('Invalid list')
  return value.map(parse)
}
function parsePermission(value: unknown): PermissionKey { if (!permissionKeys.includes(value as PermissionKey)) throw new Error('Invalid permission'); return value as PermissionKey }
function parsePermissions(value: unknown): PermissionKey[] { const values = parseList(value, permissionKeys.length, parsePermission); if (new Set(values).size !== values.length) throw new Error('Duplicate permission'); return values }
function parseRoleIds(value: unknown): string[] { const values = parseList(value, 32, parseHostId); if (new Set(values).size !== values.length) throw new Error('Duplicate role'); return values }
function parseOverrides(value: unknown): PermissionOverride[] {
  const values = parseList(value, permissionKeys.length, item => { const data = pairingRecord(item); if (data.effect !== 'allow' && data.effect !== 'deny') throw new Error('Invalid effect'); return { permissionKey: parsePermission(data.permissionKey), effect: data.effect } as PermissionOverride })
  if (new Set(values.map(item => item.permissionKey)).size !== values.length) throw new Error('Duplicate override')
  return values
}
/** Rechaza campos inesperados y acota cada colección antes de IPC/HTTP o SQL. */
export function parseAccessRequest(value: unknown): AccessRequest {
  const data = pairingRecord(value)
  const keys: Record<string, string[]> = { list: ['action'], createUser: ['action','revision','username','displayName','password'], updateUser: ['action','revision','userId','displayName','isActive','password','roleIds','overrides'], saveRole: ['action','revision','roleId','displayName','permissions'], deleteRole: ['action','revision','roleId'] }
  const expected = typeof data.action === 'string' ? keys[data.action] : undefined
  if (!expected || Object.keys(data).sort().join() !== [...expected].sort().join()) throw new Error('Invalid access request')
  if (data.action === 'list') return { action: 'list' }
  const revision = parseRevision(data.revision)
  if (data.action === 'createUser') return { action: 'createUser', revision, ...parseCreateAdministrator({ username: data.username, displayName: data.displayName, password: data.password }) }
  if (data.action === 'deleteRole') return { action: 'deleteRole', revision, roleId: parseHostId(data.roleId) }
  const displayName = pairingText(data.displayName)
  if (data.action === 'saveRole') return { action: 'saveRole', revision, roleId: data.roleId === null ? null : parseHostId(data.roleId), displayName, permissions: parsePermissions(data.permissions) }
  if (typeof data.isActive !== 'boolean' || typeof data.password !== 'string' || (data.password !== '' && !isValidNewPassword(data.password))) throw new Error('Invalid user')
  return { action: 'updateUser', revision, userId: parseHostId(data.userId), displayName, isActive: data.isActive, password: data.password, roleIds: parseRoleIds(data.roleIds), overrides: parseOverrides(data.overrides) }
}
/** Reconstruye sólo datos públicos: ningún hash ni secreto puede atravesar Preload. */
export function parseAccessSnapshot(value: unknown): AccessSnapshot {
  const data = pairingRecord(value)
  return { revision: parseRevision(data.revision), roles: parseList(data.roles, 32, item => { const role = pairingRecord(item); return { roleId: parseHostId(role.roleId), displayName: pairingText(role.displayName), permissions: parsePermissions(role.permissions) } }),
    users: parseList(data.users, 100, item => { const user = pairingRecord(item); if (typeof user.isActive !== 'boolean') throw new Error('Invalid user'); const username = pairingText(user.username); return { userId: parseHostId(user.userId), username, displayName: pairingText(user.displayName), isActive: user.isActive, roleIds: parseRoleIds(user.roleIds), overrides: parseOverrides(user.overrides) } }) }
}
