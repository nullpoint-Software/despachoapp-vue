import { pairingRecord } from './pairing'

/**
 * Diagnóstico del equipo (7.4): lo arma Main sólo con datos LOCAL y estados, nunca con contraseñas, tokens,
 * claves, rutas de datos ni contenido de negocio. Se muestra en Configuración → Este equipo y se puede exportar
 * a un archivo para soporte.
 */
export const diagnosticsChannel = 'diagnostics:operate'
export type DiagnosticsAction = 'read' | 'export'
export type DiagnosticState = 'ok' | 'warning' | 'error'
export interface DiagnosticCheck { name: string; state: DiagnosticState; detail: string }
export interface DiagnosticsReport {
  generatedAt: string
  application: { version: string; platform: string; architecture: string; electronVersion: string; isInstalled: boolean; isRunningInBackground: boolean }
  device: { mode: 'host' | 'client' | null; computerName: string }
  host: { state: string; listeningPort: number | null; certificateExpiresAt: string | null; authorityExpiresAt: string | null } | null
  client: { selectedAddress: string | null; selectedPort: number | null; trustedHostId: string | null; fingerprint: string | null } | null
  network: { addresses: string[] }
  storage: { freeBytes: number | null; totalBytes: number | null }
  recentEvents: Array<{ date: string; level: string; event: string }>
  checks: DiagnosticCheck[]
}
export type DiagnosticsResult = { status: 'report'; report: DiagnosticsReport } | { status: 'exported' } | { status: 'cancelled' }

export function parseDiagnosticsAction(value: unknown): DiagnosticsAction {
  if (value !== 'read' && value !== 'export') throw new Error('Invalid diagnostics action')
  return value
}
const text = (value: unknown, maximum: number) => { if (typeof value !== 'string' || value.length > maximum) throw new Error('Invalid diagnostics'); return value }
const optionalText = (value: unknown, maximum: number) => value === null ? null : text(value, maximum)
const optionalNumber = (value: unknown) => { if (value === null) return null; if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error('Invalid diagnostics'); return value }
const flag = (value: unknown) => { if (typeof value !== 'boolean') throw new Error('Invalid diagnostics'); return value }
function list<T>(value: unknown, maximum: number, parse: (item: unknown) => T): T[] {
  if (!Array.isArray(value) || value.length > maximum) throw new Error('Invalid diagnostics')
  return value.map(parse)
}

export function parseDiagnosticsReport(value: unknown): DiagnosticsReport {
  const data = pairingRecord(value)
  const application = pairingRecord(data.application), device = pairingRecord(data.device), network = pairingRecord(data.network), storage = pairingRecord(data.storage)
  if (device.mode !== null && device.mode !== 'host' && device.mode !== 'client') throw new Error('Invalid diagnostics')
  let host: DiagnosticsReport['host'] = null, client: DiagnosticsReport['client'] = null
  if (data.host !== null) {
    const entry = pairingRecord(data.host)
    host = { state: text(entry.state, 40), listeningPort: optionalNumber(entry.listeningPort), certificateExpiresAt: optionalText(entry.certificateExpiresAt, 40), authorityExpiresAt: optionalText(entry.authorityExpiresAt, 40) }
  }
  if (data.client !== null) {
    const entry = pairingRecord(data.client)
    client = { selectedAddress: optionalText(entry.selectedAddress, 100), selectedPort: optionalNumber(entry.selectedPort), trustedHostId: optionalText(entry.trustedHostId, 36), fingerprint: optionalText(entry.fingerprint, 100) }
  }
  return {
    generatedAt: text(data.generatedAt, 40),
    application: { version: text(application.version, 40), platform: text(application.platform, 40), architecture: text(application.architecture, 40), electronVersion: text(application.electronVersion, 40),
      isInstalled: flag(application.isInstalled), isRunningInBackground: flag(application.isRunningInBackground) },
    device: { mode: device.mode, computerName: text(device.computerName, 100) },
    host, client,
    network: { addresses: list(network.addresses, 32, item => text(item, 64)) },
    storage: { freeBytes: optionalNumber(storage.freeBytes), totalBytes: optionalNumber(storage.totalBytes) },
    recentEvents: list(data.recentEvents, 200, item => { const entry = pairingRecord(item); return { date: text(entry.date, 40), level: text(entry.level, 10), event: text(entry.event, 60) } }),
    checks: list(data.checks, 30, item => {
      const entry = pairingRecord(item)
      if (entry.state !== 'ok' && entry.state !== 'warning' && entry.state !== 'error') throw new Error('Invalid diagnostics')
      return { name: text(entry.name, 80), state: entry.state, detail: text(entry.detail, 300) }
    })
  }
}
export function parseDiagnosticsResult(value: unknown): DiagnosticsResult {
  const data = pairingRecord(value)
  if (data.status === 'report') return { status: 'report', report: parseDiagnosticsReport(data.report) }
  if (data.status === 'exported' || data.status === 'cancelled') return { status: data.status }
  throw new Error('Invalid diagnostics result')
}
