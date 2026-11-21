import { parseHostId } from './discovery'
import { pairingRecord } from './pairing'

/**
 * CIEC del cliente en ESTE equipo (rediseño de Clientes, ADR-032, decisión del usuario):
 * - se guarda cifrada con la protección del sistema operativo, como la e.firma, y nunca viaja al Host;
 * - la vista sólo la envía al capturarla; leer devuelve si existe y cuándo se guardó, nunca su valor;
 * - "copiar" la pone en el portapapeles desde Main tras confirmar la contraseña del usuario en el Host, y la
 *   borra del portapapeles a los 30 s si nadie lo cambió.
 */
export const clientCredentialsChannel = 'clients:credentials'
export type ClientCredentialRequest =
  { action: 'read'; clientId: string } |
  { action: 'save'; clientId: string; ciec: string } |
  { action: 'delete'; clientId: string } |
  { action: 'copy'; clientId: string }
export interface ClientCredentialStatus { isCiecSaved: boolean; savedAt: string | null }

/** La CIEC del SAT tiene 8 caracteres; se aceptan de 8 a 32 sin espacios ni caracteres de control. */
export function parseCiec(value: unknown): string {
  if (typeof value !== 'string' || !/^[\x21-\x7EÑñ]{8,32}$/.test(value)) throw new Error('Invalid CIEC')
  return value
}

export function parseClientCredentialRequest(value: unknown): ClientCredentialRequest {
  const data = pairingRecord(value)
  const keys = data.action === 'save' ? 'action,ciec,clientId' : 'action,clientId'
  if (Object.keys(data).sort().join() !== keys) throw new Error('Invalid credential request')
  const clientId = parseHostId(data.clientId)
  if (data.action === 'save') return { action: 'save', clientId, ciec: parseCiec(data.ciec) }
  if (data.action === 'read' || data.action === 'delete' || data.action === 'copy') return { action: data.action, clientId }
  throw new Error('Invalid credential request')
}

/** Copiar exige la contraseña del usuario; las demás acciones no la aceptan. */
export function requiresCredentialReauthentication(request: ClientCredentialRequest): boolean { return request.action === 'copy' }

export function parseClientCredentialStatus(value: unknown): ClientCredentialStatus {
  const data = pairingRecord(value)
  if (Object.keys(data).sort().join() !== 'isCiecSaved,savedAt' || typeof data.isCiecSaved !== 'boolean') throw new Error('Invalid credential status')
  if (data.savedAt !== null && (typeof data.savedAt !== 'string' || Number.isNaN(Date.parse(data.savedAt)))) throw new Error('Invalid credential status')
  return { isCiecSaved: data.isCiecSaved, savedAt: data.savedAt }
}
