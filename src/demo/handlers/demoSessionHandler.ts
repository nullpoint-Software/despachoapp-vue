import { signedOut, type SessionStatus } from '../../../shared/contracts/session'
import { noWorkspaceAccess } from '../../../shared/contracts/workspace'
import type { DesktopApi } from '../../../shared/contracts/desktop'
import { demoProfiles } from '../demoProfiles'
import type { DemoStore } from '../demoStore'

/**
 * Sesión simulada de la demo. Es EFÍMERA: vive sólo en memoria (`store.session`) y se pierde al recargar.
 * La contraseña de la demo es pública a propósito, para que la reconfirmación de ADR-038 aún se pueda ejercitar.
 * Todo método compara la expiración contra `now()` y limpia la sesión vencida antes de responder.
 */
export const demoSessionDurationMilliseconds = 8 * 60 * 60 * 1000

export function createDemoSessionHandler(store: DemoStore, now: () => Date): Pick<DesktopApi, 'authenticateUser' | 'manageSession' | 'readWorkspaceAccess' | 'changeOwnPassword'> {
  /** Devuelve el usuario con sesión vigente o null; una sesión vencida se borra. */
  function readActiveUser() {
    if (store.session && store.session.expiresAt.getTime() < now().getTime()) store.session = null
    return store.session ? store.users.find(user => user.userId === store.session!.userId) ?? null : null
  }
  function describeStatus(): SessionStatus {
    const user = readActiveUser()
    if (!user || !store.session) return { ...signedOut }
    return { state: 'authenticated', user: { userId: user.userId, displayName: user.displayName }, expiresAt: store.session.expiresAt.toISOString() }
  }
  return {
    async authenticateUser(request) {
      const username = request.username.trim().toLowerCase()
      const user = store.users.find(candidate => candidate.username === username)
      if (!user || user.password !== request.password) throw new Error('Invalid credentials')
      store.session = { userId: user.userId, expiresAt: new Date(now().getTime() + demoSessionDurationMilliseconds) }
      return describeStatus()
    },
    async manageSession(action) {
      if (action === 'logout' || action === 'logoutAll') store.session = null
      return describeStatus()
    },
    async readWorkspaceAccess() {
      const user = readActiveUser()
      const profile = demoProfiles.find(candidate => candidate.profileId === user?.profileId)
      return profile ? { ...profile.access } : { ...noWorkspaceAccess }
    },
    async changeOwnPassword() {
      throw new Error('La contraseña de la demo no se puede cambiar.')
    }
  }
}
