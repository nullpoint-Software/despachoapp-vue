import { pairingRecord } from './pairing'

/**
 * Capacidades del espacio de trabajo que el Host calcula para la sesión vigente.
 * Sirven para mostrar u ocultar secciones y, en Main, para autorizar las herramientas LOCAL
 * (notas y XML). Cada operación GLOBAL vuelve a exigir su permiso en el Host.
 */
export const workspaceCapabilityKeys = ['canUseNotes', 'canUseXml', 'canReadClients', 'canReadMovements', 'canReadTasks', 'canReadReports', 'canManageReports', 'canDownloadSat', 'canReadOpinions', 'canQueryOpinions', 'canReconcileBank', 'canViewTeam', 'canManageAccess', 'canManageDevices', 'canManageOffice', 'canManageBackups', 'canSendMail', 'canRunLegacyMigration'] as const
export type WorkspaceCapability = typeof workspaceCapabilityKeys[number]
export type WorkspaceAccess = Record<WorkspaceCapability, boolean>
export const workspaceChannel = 'security:workspace'
export const noWorkspaceAccess: WorkspaceAccess = { canUseNotes: false, canUseXml: false, canReadClients: false, canReadMovements: false, canReadTasks: false, canReadReports: false, canManageReports: false, canDownloadSat: false, canReadOpinions: false, canQueryOpinions: false, canReconcileBank: false, canViewTeam: false, canManageAccess: false, canManageDevices: false, canManageOffice: false, canManageBackups: false, canSendMail: false, canRunLegacyMigration: false }

/** Exactamente las capacidades booleanas del catálogo; cualquier otra clave o tipo se rechaza. */
export function parseWorkspaceAccess(value: unknown): WorkspaceAccess {
  const data = pairingRecord(value)
  if (Object.keys(data).sort().join(',') !== [...workspaceCapabilityKeys].sort().join(',')) throw new Error('Invalid workspace access')
  const access = { ...noWorkspaceAccess }
  for (const key of workspaceCapabilityKeys) {
    if (typeof data[key] !== 'boolean') throw new Error('Invalid workspace access')
    access[key] = data[key]
  }
  return access
}
