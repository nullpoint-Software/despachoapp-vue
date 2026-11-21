export type DockerRuntimeAction = 'status' | 'detect' | 'install' | 'download' | `select:${string}`
export interface DockerRuntimeStatus {
  options: string[]; selected: string; isLocked: boolean; isBusy: boolean; message: string
}
export const dockerRuntimeChannel = 'host:dockerRuntime'
/** IDs son nombres WSL acotados, nunca argumentos de shell ni rutas. */
export function parseRuntimeId(value: unknown): string {
  if (typeof value !== 'string' || !/^(desktop|wsl:[a-zA-Z0-9][a-zA-Z0-9.-]{0,63})$/.test(value)) throw new Error('Invalid runtime')
  return value
}
export function parseDockerRuntimeAction(value: unknown): DockerRuntimeAction {
  if (value === 'status' || value === 'detect' || value === 'install' || value === 'download') return value
  if (typeof value === 'string' && value.startsWith('select:')) return `select:${parseRuntimeId(value.slice(7))}`
  throw new Error('Invalid runtime action')
}
export function parseDockerRuntimeStatus(value: unknown): DockerRuntimeStatus {
  if (!value || typeof value !== 'object') throw new Error('Invalid runtime status')
  const data = value as Record<string, unknown>
  if (!Array.isArray(data.options) || data.options.length > 32 || typeof data.isLocked !== 'boolean' || typeof data.isBusy !== 'boolean' || typeof data.message !== 'string' || data.message.length > 600) throw new Error('Invalid runtime status')
  return { options: data.options.map(parseRuntimeId), selected: data.selected === '' ? '' : parseRuntimeId(data.selected), isLocked: data.isLocked, isBusy: data.isBusy, message: data.message }
}
