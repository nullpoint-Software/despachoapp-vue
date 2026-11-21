/** Candidatos no autenticados: guardar una dirección nunca concede confianza ni pairing. */
export interface HostCandidate { candidateId: string; hostId: string; name: string; address: string; port: number }
export interface SelectedHost { hostId: string | null; name: string; address: string; port: number; source: 'mdns' | 'manual' }
export interface DiscoveryStatus { state: 'idle' | 'searching' | 'complete' | 'unavailable'; candidates: HostCandidate[]; selectedHost: SelectedHost | null }
export const discoveryChannels = { status: 'network:getDiscoveryStatus', search: 'network:findHosts', select: 'network:selectHost', manual: 'network:setManualHost' } as const
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid discovery data')
  return value as Record<string, unknown>
}
function text(value: unknown, maximum: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum || [...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) throw new Error('Invalid discovery text')
  return value
}
export function parseHostId(value: unknown): string {
  const hostId = text(value, 36)
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(hostId)) throw new Error('Invalid Host identity')
  return hostId.toLowerCase()
}
/** Direcciones DNS o IPv4, sin esquema, credenciales, rutas ni opciones de conexión. */
export function parseManualHost(value: unknown): { address: string; port: number } {
  const data = record(value)
  if (Object.keys(data).some(key => key !== 'address' && key !== 'port')) throw new Error('Invalid endpoint fields')
  const address = text(data.address, 253).trim().toLowerCase()
  if (!address.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))) throw new Error('Invalid Host address')
  if (/^[0-9.]+$/.test(address) && (address.split('.').length !== 4 || address.split('.').some(part => Number(part) > 255))) throw new Error('Invalid IPv4')
  if (!Number.isInteger(data.port) || Number(data.port) < 1 || Number(data.port) > 65535) throw new Error('Invalid Host port')
  return { address, port: Number(data.port) }
}
export function parseSelectedHost(value: unknown): SelectedHost {
  const data = record(value)
  if (data.source !== 'mdns' && data.source !== 'manual') throw new Error('Invalid selection source')
  return { ...parseManualHost({ address: data.address, port: data.port }), name: text(data.name, 100), source: data.source,
    hostId: data.hostId === null && data.source === 'manual' ? null : parseHostId(data.hostId) }
}
export function parseCandidateId(value: unknown): string | null { return value === null ? null : text(value, 340) }
export function parseHostCandidate(value: unknown): HostCandidate {
  const data = record(value)
  return { ...parseManualHost({ address: data.address, port: data.port }), candidateId: text(data.candidateId, 340), hostId: parseHostId(data.hostId), name: text(data.name, 100) }
}
export function parseDiscoveryStatus(value: unknown): DiscoveryStatus {
  const data = record(value)
  if (!['idle', 'searching', 'complete', 'unavailable'].includes(String(data.state)) || !Array.isArray(data.candidates) || data.candidates.length > 50) throw new Error('Invalid discovery status')
  return { state: data.state as DiscoveryStatus['state'], candidates: data.candidates.map(parseHostCandidate), selectedHost: data.selectedHost === null ? null : parseSelectedHost(data.selectedHost) }
}
