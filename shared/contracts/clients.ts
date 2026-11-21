import { parseClientProfile, type ClientProfile } from './clientProfile'
import { pairingRecord, pairingText } from './pairing'
import { parseHostId } from './discovery'
export type ClientAccess = 'readOnly' | 'readWrite'
export type CredentialPurpose = 'save' | 'delete' | 'copy'
export interface ClientIdentity { clientId: string; displayName: string; isActive: boolean; revision: number }
export interface AssignedClient extends ClientIdentity { access: ClientAccess }
export interface ClientAssignment { userId: string; access: ClientAccess }
export type ClientRequest = { action: 'list'; afterClientId: string | null } |
  { action: 'create'; displayName: string; profile?: ClientProfile } |
  { action: 'update'; clientId: string; revision: number; displayName: string; isActive: boolean; profile?: ClientProfile } |
  { action: 'get'; clientId: string } | { action: 'directory'; afterClientId: string | null } |
  { action: 'inspectAssignments'; clientId: string } |
  // Autoriza a Main a guardar, borrar o copiar la CIEC de este equipo: permiso de editar y asignación de escritura;
  // copiar además pide la contraseña del usuario. Queda en la auditoría del cliente.
  { action: 'confirmCredentialAccess'; clientId: string; purpose: CredentialPurpose } |
  { action: 'assign'; clientId: string; revision: number; userId: string; access: ClientAccess | null }
export interface AssignmentUser { userId: string; displayName: string; username: string; isActive: boolean }
/** Columnas de la tabla de Clientes: sólo contribuyentes asignados al usuario. `additionalTaxRegimes` (migración 120) alimenta el "+N" y el filtro por régimen. */
export interface ClientSummary { clientId: string; rfc: string; taxRegime: string; additionalTaxRegimes: string[]; contactName: string; phoneNumber: string; emailAddress: string }
export interface ClientResult { profile?: ClientProfile | null; summaries?: ClientSummary[]; directory?: ClientIdentity[]; users?: AssignmentUser[]; clients: AssignedClient[]; nextClientId: string | null; assignmentTarget: ClientIdentity | null; assignments: ClientAssignment[] }
export const clientsChannel = 'clients:operate'
export function parseClientRevision(value: unknown): number { if (!Number.isSafeInteger(value) || Number(value) < 0) throw new Error('Invalid client revision'); return Number(value) }
function parseAccess(value: unknown): ClientAccess { if (value !== 'readOnly' && value !== 'readWrite') throw new Error('Invalid client access'); return value }
/** Contrato explícito de perfil y asignación; nunca acepta credenciales fiscales ni identidad del actor. */
export function parseClientRequest(value: unknown): ClientRequest {
  const data = pairingRecord(value)
  const keys: Record<string, string[]> = { list: ['action','afterClientId'], directory: ['action','afterClientId'], get: ['action','clientId'], create: ['action','displayName'], update: ['action','clientId','revision','displayName','isActive'], inspectAssignments: ['action','clientId'], confirmCredentialAccess: ['action','clientId','purpose'], assign: ['action','clientId','revision','userId','access'] }
  const expected = typeof data.action === 'string' && Object.hasOwn(keys, data.action) ? keys[data.action] : undefined
  if (!expected || Object.keys(data).sort().join() !== [...expected, ...(('profile' in data && (data.action === 'create' || data.action === 'update')) ? ['profile'] : [])].sort().join()) throw new Error('Invalid client request')
  if (data.action === 'list' || data.action === 'directory') return { action: data.action, afterClientId: data.afterClientId === null ? null : parseHostId(data.afterClientId) }
  if (data.action === 'create') return { action: 'create', displayName: pairingText(data.displayName), ...('profile' in data ? { profile: parseClientProfile(data.profile) } : {}) }
  const clientId = parseHostId(data.clientId)
  if (data.action === 'get') return { action: 'get', clientId }
  if (data.action === 'inspectAssignments') return { action: 'inspectAssignments', clientId }
  if (data.action === 'confirmCredentialAccess') {
    if (data.purpose !== 'save' && data.purpose !== 'delete' && data.purpose !== 'copy') throw new Error('Invalid credential purpose')
    return { action: 'confirmCredentialAccess', clientId, purpose: data.purpose }
  }
  const revision = parseClientRevision(data.revision)
  if (data.action === 'assign') return { action: 'assign', clientId, revision, userId: parseHostId(data.userId), access: data.access === null ? null : parseAccess(data.access) }
  if (typeof data.isActive !== 'boolean') throw new Error('Invalid client state')
  return { action: 'update', clientId, revision, displayName: pairingText(data.displayName), isActive: data.isActive, ...('profile' in data ? { profile: parseClientProfile(data.profile) } : {}) }
}
function parseIdentity(value: unknown): ClientIdentity {
  const data = pairingRecord(value)
  if (typeof data.isActive !== 'boolean') throw new Error('Invalid client state')
  return { clientId: parseHostId(data.clientId), displayName: pairingText(data.displayName), isActive: data.isActive, revision: parseClientRevision(data.revision) }
}
/** Resumen validado con las mismas reglas del perfil. */
function parseSummary(value: unknown): ClientSummary {
  const data = pairingRecord(value)
  // Un Host anterior a la 120 no envía regímenes adicionales: se leen como lista vacía.
  const profile = parseClientProfile({ rfc: data.rfc, taxRegime: data.taxRegime, contactName: data.contactName, emailAddress: data.emailAddress, phoneNumber: data.phoneNumber, ...('additionalTaxRegimes' in data ? { additionalTaxRegimes: data.additionalTaxRegimes } : {}) })
  return { clientId: parseHostId(data.clientId), rfc: profile.rfc, taxRegime: profile.taxRegime, additionalTaxRegimes: profile.additionalTaxRegimes, contactName: profile.contactName, phoneNumber: profile.phoneNumber, emailAddress: profile.emailAddress }
}
/** Reconstruye DTO público acotado; una respuesta nunca expone columnas SQL arbitrarias. */
export function parseClientResult(value: unknown): ClientResult {
  const data = pairingRecord(value)
  if (!Array.isArray(data.clients) || data.clients.length > 50 || !Array.isArray(data.assignments) || data.assignments.length > 100) throw new Error('Invalid clients result')
  if (data.directory !== undefined && (!Array.isArray(data.directory) || data.directory.length > 50)) throw new Error('Invalid directory')
  if (data.users !== undefined && (!Array.isArray(data.users) || data.users.length > 100)) throw new Error('Invalid assignment users')
  if (data.summaries !== undefined && (!Array.isArray(data.summaries) || data.summaries.length > 50)) throw new Error('Invalid client summaries')
  return { profile: data.profile == null ? null : parseClientProfile(data.profile), summaries: (data.summaries as unknown[] | undefined)?.map(parseSummary) ?? [], directory: (data.directory as unknown[] | undefined)?.map(parseIdentity) ?? [], users: (data.users as unknown[] | undefined)?.map(item => { const user = pairingRecord(item); if (typeof user.isActive !== 'boolean') throw new Error('Invalid user'); return { userId: parseHostId(user.userId), displayName: pairingText(user.displayName), username: pairingText(user.username), isActive: user.isActive } }) ?? [], clients: data.clients.map(item => ({ ...parseIdentity(item), access: parseAccess(pairingRecord(item).access) })), nextClientId: data.nextClientId === null ? null : parseHostId(data.nextClientId), assignmentTarget: data.assignmentTarget === null ? null : parseIdentity(data.assignmentTarget), assignments: data.assignments.map(item => { const row = pairingRecord(item); return { userId: parseHostId(row.userId), access: parseAccess(row.access) } }) }
}
