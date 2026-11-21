import { ref } from 'vue'
import { clearUserPhotos } from '../../shared/users/userPhotoStore'
import { noWorkspaceAccess, type WorkspaceAccess } from '../../../shared/contracts/workspace'
import type { HostState } from '../../../shared/contracts/host'

/**
 * Fases de arranque, como en el sistema original:
 * 1. `setup`: el equipo aún no está listo (función sin elegir, reinicio pendiente, Host sin
 *    administrador o Cliente sin vincular). Sólo se hace una vez; después se modifica en Configuración.
 * 2. `login`: pantalla de inicio de sesión. Nada del despacho, ni notas ni XML, se abre sin sesión.
 * 3. `workspace`: menú del despacho con las secciones que el Host permite a la sesión.
 */
export type ApplicationPhase = 'loading' | 'setup' | 'login' | 'workspace'
export interface SessionUser { userId: string; displayName: string }

export const phase = ref<ApplicationPhase>('loading')
export const sessionUser = ref<SessionUser | null>(null)
export const sessionExpiresAt = ref<string | null>(null)
export const workspaceAccess = ref<WorkspaceAccess>({ ...noWorkspaceAccess })
/** Lo que la animación de arranque dice mientras el Host se prepara (pulido 2026-10-03). */
export const startupMessage = ref('')
/** El Host no terminó de prepararse a tiempo: el inicio de sesión lo avisa y ofrece revisar la conexión. */
export const isHostPendingAtLogin = ref(false)
export const deviceMode = ref<'host' | 'client' | null>(null)
/** Con la configuración dañada, la pantalla de instalación muestra la recuperación. */
export const isInstallationReadable = ref(true)

/** El equipo está listo cuando su función está activa y su conexión con el despacho preparada. */
export async function isDeviceReady(): Promise<boolean> {
  let information
  try { information = await window.contapp.getInstallationInformation(); isInstallationReadable.value = true }
  catch { isInstallationReadable.value = false; deviceMode.value = null; return false }
  deviceMode.value = information.activeMode
  if (!information.mode || information.requiresRestart || !information.activeMode) return false
  try {
    if (information.activeMode === 'host') return (await window.contapp.getHostStatus()).state === 'pairingRequired'
    return (await window.contapp.managePairing('status')).state === 'paired'
  } catch { return false }
}

const hostStartupMessages: Partial<Record<HostState, string>> = {
  starting: 'Iniciando el servicio del despacho…', stopped: 'Iniciando el servicio del despacho…',
  databaseUnavailable: 'Encendiendo el servidor de datos…', migrationRequired: 'Preparando la base de datos…', notHost: 'Iniciando…'
}
/** Estados en los que el Host todavía se está preparando solo (Docker, MySQL, migraciones automáticas). */
const transientHostStates: readonly HostState[] = ['starting', 'stopped', 'databaseUnavailable', 'migrationRequired', 'notHost']
const managedWaitMilliseconds = 180000, ownDatabaseWaitMilliseconds = 20000

/**
 * Arranque (pulido 2026-10-03): la animación cubre que se abra Docker, se encienda MySQL y se apliquen las
 * migraciones; después se pasa al inicio de sesión, desde donde se puede revisar la conexión.
 * - Sin función elegida, con reinicio pendiente o con un paso que necesita a la persona (crear administrador,
 *   conexión segura, migración con MySQL propio, migración fallida): pantalla de instalación, como antes.
 * - Host preparándose: se espera hasta 3 min con el MySQL administrado (Docker puede tardar en abrir) o 20 s con
 *   MySQL propio. Si no termina, se pasa al inicio de sesión con un aviso y "Revisar conexión del equipo".
 * - Cliente: igual que antes (vinculado → inicio de sesión).
 */
export async function prepareDeviceAtStartup(now: () => number = () => Date.now()): Promise<void> {
  const startedAt = now()
  for (;;) {
    let information
    try { information = await window.contapp.getInstallationInformation(); isInstallationReadable.value = true }
    catch { isInstallationReadable.value = false; deviceMode.value = null; phase.value = 'setup'; return }
    deviceMode.value = information.activeMode
    if (!information.mode || information.requiresRestart || !information.activeMode) { phase.value = 'setup'; return }
    if (information.activeMode === 'client') { await evaluatePhase(); return }
    let state: HostState = 'starting'
    try { state = (await window.contapp.getHostStatus()).state } catch { /* El proceso Host todavía arranca. */ }
    if (state === 'pairingRequired') { isHostPendingAtLogin.value = false; await evaluatePhase(); return }
    if (!transientHostStates.includes(state)) { phase.value = 'setup'; return }
    let isManagedPreparing = false
    try { isManagedPreparing = ['starting', 'ready'].includes((await window.contapp.getManagedDatabaseStatus()).state) } catch { /* Sin estado del MySQL administrado: se trata como MySQL propio. */ }
    // Con MySQL propio, una migración pendiente necesita su cuenta: se pide en la instalación.
    if (state === 'migrationRequired' && !isManagedPreparing) { phase.value = 'setup'; return }
    if (now() - startedAt > (isManagedPreparing ? managedWaitMilliseconds : ownDatabaseWaitMilliseconds)) {
      isHostPendingAtLogin.value = true; phase.value = 'login'; return
    }
    startupMessage.value = hostStartupMessages[state] ?? 'Iniciando…'
    await new Promise(resolve => setTimeout(resolve, 1500))
  }
}

/** Capacidades según el Host; sin respuesta se ocultan todas las secciones. */
export async function refreshWorkspaceAccess(): Promise<void> {
  try { workspaceAccess.value = await window.contapp.readWorkspaceAccess() } catch { workspaceAccess.value = { ...noWorkspaceAccess } }
}

/** Al cerrar sesión también se vacían las fotos de perfil en memoria (EPHEMERAL). */
function clearSession(): void { clearUserPhotos(); sessionUser.value = null; sessionExpiresAt.value = null; workspaceAccess.value = { ...noWorkspaceAccess } }

/** Decide la fase inicial o tras un cambio de configuración. */
export async function evaluatePhase(): Promise<void> {
  if (!(await isDeviceReady())) { clearSession(); phase.value = 'setup'; return }
  try {
    const status = await window.contapp.manageSession('status')
    if (status.state === 'authenticated' && status.user) {
      sessionUser.value = status.user; sessionExpiresAt.value = status.expiresAt
      await refreshWorkspaceAccess(); phase.value = 'workspace'; return
    }
  } catch { /* Sin respuesta del Host se pide iniciar sesión otra vez. */ }
  clearSession(); phase.value = 'login'
}

/** La contraseña sólo viaja a Main; el token nunca llega a la vista. */
export async function signIn(username: string, password: string): Promise<void> {
  const status = await window.contapp.authenticateUser({ username, password })
  if (status.state !== 'authenticated' || !status.user) throw new Error('Login failed')
  sessionUser.value = status.user; sessionExpiresAt.value = status.expiresAt
  await refreshWorkspaceAccess()
  phase.value = 'workspace'
}

/**
 * Consulta de fondo: no prolonga la sesión. Devuelve `false` si la sesión terminó en el Host;
 * entonces se vuelve a la pantalla de inicio de sesión.
 */
export async function verifySession(): Promise<boolean> {
  try {
    const status = await window.contapp.manageSession('status')
    if (status.state === 'authenticated' && status.user) { sessionUser.value = status.user; sessionExpiresAt.value = status.expiresAt; return true }
  } catch { return true } // Una caída momentánea no cierra la vista; cada operación sigue exigiendo sesión.
  clearSession(); phase.value = 'login'
  return false
}

/** Cierra en el Host; aunque falle la confirmación, este equipo olvida el token. */
export async function signOut(shouldCloseAll = false): Promise<void> {
  try { await window.contapp.manageSession(shouldCloseAll ? 'logoutAll' : 'logout') }
  finally { clearSession(); phase.value = 'login' }
}
