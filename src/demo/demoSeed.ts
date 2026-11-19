import type { OfficeBranding } from '../../shared/contracts/branding'
import { demoPassword, demoProfiles, type DemoProfileId } from './demoProfiles'
import type { DemoStore, DemoUser } from './demoStore'

/** Ids fijos para que pruebas y seeds posteriores puedan referenciar a cada persona. */
const demoUserIds: Record<DemoProfileId, string> = {
  administrator: '00000000-0000-4000-8000-000000000001',
  accountant: '00000000-0000-4000-8000-000000000002',
  assistant: '00000000-0000-4000-8000-000000000003'
}

/** Datos iniciales: un usuario por perfil (mismo orden que `demoProfiles`) y la marca del despacho demo. */
export function createDemoSeed(): Pick<DemoStore, 'users' | 'branding'> {
  const users: DemoUser[] = demoProfiles.map(profile => ({
    userId: demoUserIds[profile.profileId], username: profile.username, displayName: profile.displayName, profileId: profile.profileId, password: demoPassword
  }))
  const branding: OfficeBranding = { officeName: 'Despacho Demo', logoDataUrl: null }
  return { users, branding }
}
