import { parseHostId } from './discovery'
import { pairingRecord } from './pairing'
import { parseSatAssignedRequest, parseSatDownloadProgress, type SatDownloadHostRequest, type SatDownloadResult } from './satDownloads'
import { parseSatPlatformStatus } from './satDownloadSchedules'

/**
 * Canal de equipo de la descarga automática del SAT (2026-10-12, ADR-037).
 *
 * El equipo ejecutor de una programación avanza sus solicitudes **automáticas** aunque nadie haya iniciado sesión: se
 * autentica ante el Host como equipo (identidad y credencial del emparejamiento), no como usuario. Por eso el canal es
 * mínimo y cerrado; sólo admite las tres operaciones que el trabajador necesita:
 * - `listAssigned`: se reporta (check-in), avanza sus programaciones y recibe sus solicitudes automáticas vencidas;
 * - `reportProgress`: informa el avance de una solicitud automática que él ejecuta, con la revisión vigente;
 * - `reportProbe`: informa la prueba de conexión del corta-circuitos cuando el Host se la pidió.
 * Nada más: ni historial, ni configuración, ni solicitudes manuales, ni e.firma. Las mismas formas de petición y de
 * respuesta que el canal de sesión, para que el trabajador sea el mismo.
 *
 * Transporte: RPC privado en el equipo Host (`satDownloads:device`) y `POST /sat-device` por TLS fijado en un Cliente.
 */
export type SatWorkerRequest = Extract<SatDownloadHostRequest, { action: 'listAssigned' | 'reportProgress' | 'reportProbe' }>
export type SatWorkerResult = Extract<SatDownloadResult, { status: 'assigned' | 'progressSaved' | 'probeSaved' }>
export const satDeviceActions = ['listAssigned', 'reportProgress', 'reportProbe'] as const

function exactKeys(data: Record<string, unknown>, keys: readonly string[]): void {
  if (Object.keys(data).sort().join() !== [...keys].sort().join()) throw new Error('Invalid SAT device request')
}
function revisionNumber(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) throw new Error('Invalid SAT device request')
  return Number(value)
}

/** Sólo las tres acciones del canal de equipo, con las claves exactas; cualquier otra cosa se rechaza. */
export function parseSatDeviceRequest(value: unknown): SatWorkerRequest {
  const data = pairingRecord(value)
  if (data.action === 'listAssigned') { exactKeys(data, ['action']); return { action: 'listAssigned' } }
  if (data.action === 'reportProbe') {
    exactKeys(data, ['action', 'isAvailable'])
    if (typeof data.isAvailable !== 'boolean') throw new Error('Invalid SAT device request')
    return { action: 'reportProbe', isAvailable: data.isAvailable }
  }
  if (data.action === 'reportProgress') {
    exactKeys(data, ['action', 'requestId', 'revision', 'progress'])
    return { action: 'reportProgress', requestId: parseHostId(data.requestId), revision: revisionNumber(data.revision), progress: parseSatDownloadProgress(data.progress) }
  }
  throw new Error('Invalid SAT device request')
}

/** Respuesta del canal de equipo: sólo `assigned`, `progressSaved` o `probeSaved`. */
export function parseSatDeviceResult(value: unknown): SatWorkerResult {
  const data = pairingRecord(value)
  if (data.status === 'assigned') {
    exactKeys(data, ['status', 'requests', 'platform', 'shouldProbe'])
    if (!Array.isArray(data.requests) || data.requests.length > 100 || typeof data.shouldProbe !== 'boolean') throw new Error('Invalid SAT device result')
    return { status: 'assigned', requests: data.requests.map(parseSatAssignedRequest), platform: parseSatPlatformStatus(data.platform), shouldProbe: data.shouldProbe }
  }
  if (data.status === 'progressSaved') {
    exactKeys(data, ['status', 'revision', 'isCancelled'])
    if (typeof data.isCancelled !== 'boolean') throw new Error('Invalid SAT device result')
    return { status: 'progressSaved', revision: revisionNumber(data.revision), isCancelled: data.isCancelled }
  }
  if (data.status === 'probeSaved') { exactKeys(data, ['status', 'platform']); return { status: 'probeSaved', platform: parseSatPlatformStatus(data.platform) } }
  throw new Error('Invalid SAT device result')
}
