export type ManagedDatabaseState = 'idle' | 'starting' | 'ready' | 'unavailable' | 'failed'
export interface ManagedDatabaseStatus { state: ManagedDatabaseState; message: string }
export const managedDatabaseChannels = { status: 'host:getManagedDatabase', start: 'host:startManagedDatabase' } as const
export function parseManagedDatabaseStatus(value: unknown): ManagedDatabaseStatus {
  if (!value || typeof value !== 'object') throw new Error('Invalid managed database status')
  const data = value as Record<string, unknown>
  if (!['idle', 'starting', 'ready', 'unavailable', 'failed'].includes(String(data.state)) || typeof data.message !== 'string' || data.message.length > 600) throw new Error('Invalid managed database status')
  return { state: data.state as ManagedDatabaseState, message: data.message }
}
