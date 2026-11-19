export type HostState = 'notHost' | 'starting' | 'configurationRequired' | 'databaseUnavailable' | 'migrationRequired' | 'migrationFailed' | 'setupRequired' | 'securityRequired' | 'pairingRequired' | 'stopped'
export interface HostStatus { state: HostState }
export interface DatabaseConfiguration { port: number; database: string; user: string; password: string }
export interface MigrationCredentials { user: string; password: string }
export const hostChannels = { status: 'host:getStatus', configure: 'host:configureDatabase', migrate: 'host:prepareDatabase' } as const

/** Esquemas acotados sin rutas/host arbitrarios: MySQL sólo en loopback del Host. */
export function parseDatabaseConfiguration(value: unknown): DatabaseConfiguration {
  if (typeof value !== 'object' || value === null || Object.keys(value).sort().join(',') !== 'database,password,port,user') throw new Error('Invalid database configuration')
  const data = value as Record<string, unknown>
  if (!Number.isInteger(data.port) || Number(data.port) < 1 || Number(data.port) > 65535 ||
      typeof data.database !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(data.database)) throw new Error('Invalid database configuration')
  const credentials = parseMigrationCredentials({ user: data.user, password: data.password })
  return { port: Number(data.port), database: data.database, ...credentials }
}
export function parseMigrationCredentials(value: unknown): MigrationCredentials {
  if (typeof value !== 'object' || value === null || Object.keys(value).sort().join(',') !== 'password,user') throw new Error('Invalid database credentials')
  const data = value as Record<string, unknown>
  if (typeof data.user !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_]{0,31}$/.test(data.user) ||
      typeof data.password !== 'string' || !data.password.length || data.password.length > 512) throw new Error('Invalid database credentials')
  return { user: data.user, password: data.password }
}
export function parseHostStatus(value: unknown): HostStatus {
  const states: HostState[] = ['notHost', 'starting', 'configurationRequired', 'databaseUnavailable', 'migrationRequired', 'migrationFailed', 'setupRequired', 'securityRequired', 'pairingRequired', 'stopped']
  if (typeof value !== 'object' || value === null || !('state' in value) || !states.includes(value.state as HostState)) throw new Error('Invalid Host status')
  return { state: value.state as HostState }
}
