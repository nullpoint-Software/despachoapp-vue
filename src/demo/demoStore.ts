import type { OfficeBranding } from '../../shared/contracts/branding'
import type { DemoProfileId } from './demoProfiles'
import { createDemoSeed } from './demoSeed'

export interface DemoUser { userId: string; username: string; displayName: string; profileId: DemoProfileId; password: string }
export interface DemoSession { userId: string; expiresAt: Date }

/** Estado de la demo: sólo memoria, se reinicia al recargar la página. */
export interface DemoStore { users: DemoUser[]; branding: OfficeBranding; session: DemoSession | null }

/** Siembra un store nuevo y cerrado en cada llamada; nunca comparte objetos entre llamadas. */
export function createDemoStore(): DemoStore {
  return { ...createDemoSeed(), session: null }
}
