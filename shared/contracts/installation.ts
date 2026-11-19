/** Contratos locales: no incluyen rutas, material protegido ni credenciales. */
export type InstallationMode = 'host' | 'client'
export interface InstallationInformation {
  deviceId: string
  computerName: string
  mode: InstallationMode | null
  activeMode: InstallationMode | null
  requiresRestart: boolean
}
export interface ConfigureInstallationRequest { mode: InstallationMode }
export const installationChannels = {
  get: 'installation:getInformation',
  configure: 'installation:configure',
  restore: 'installation:restorePrevious',
  restart: 'application:restart'
} as const

/** Validación compartida pura: Preload no depende de módulos Node ni de un validador externo. */
export function parseInstallationRequest(value: unknown): ConfigureInstallationRequest {
  if (typeof value !== 'object' || value === null || Object.keys(value).length !== 1 ||
      !('mode' in value) || (value.mode !== 'host' && value.mode !== 'client')) throw new Error('Invalid installation request')
  return { mode: value.mode }
}
export function parseInstallationInformation(value: unknown): InstallationInformation {
  if (typeof value !== 'object' || value === null) throw new Error('Invalid installation information')
  const data = value as Record<string, unknown>
  const isMode = (mode: unknown): mode is InstallationMode | null => mode === null || mode === 'host' || mode === 'client'
  if (typeof data.deviceId !== 'string' || !/^[0-9a-f-]{36}$/i.test(data.deviceId) ||
      typeof data.computerName !== 'string' || data.computerName.length > 255 ||
      !isMode(data.mode) || !isMode(data.activeMode) || typeof data.requiresRestart !== 'boolean') throw new Error('Invalid installation information')
  return { deviceId: data.deviceId, computerName: data.computerName, mode: data.mode, activeMode: data.activeMode, requiresRestart: data.requiresRestart }
}
