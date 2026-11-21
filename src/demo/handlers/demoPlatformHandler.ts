import type { DesktopApi } from '../../../shared/contracts/desktop'

/**
 * Plataforma simulada: valores fijos con los que `prepareDeviceAtStartup` toma la ruta de Cliente vinculado
 * (modo y modo activo `client`, sin reinicio pendiente, vinculación `paired`) y pasa directo al inicio de sesión.
 * Salir y reiniciar recargan la página, lo que también borra los datos del visitante (comportamiento buscado).
 */
export function createDemoPlatformHandler(reloadPage: () => void): Pick<DesktopApi, 'getInstallationInformation' | 'managePairing' | 'getHostStatus' | 'getManagedDatabaseStatus' | 'getApplicationInformation' | 'manageHostEvents' | 'quitApplication' | 'restartApplication'> {
  return {
    async getInstallationInformation() {
      return { deviceId: '00000000-0000-4000-8000-000000000001', computerName: 'Navegador', mode: 'client', activeMode: 'client', requiresRestart: false }
    },
    async managePairing() { return { state: 'paired', code: null, expiresAt: null, message: 'Equipo vinculado a la demo.' } },
    async getHostStatus() { return { state: 'pairingRequired' } },
    async getManagedDatabaseStatus() { return { state: 'idle', message: 'La demo no usa base de datos.' } },
    async getApplicationInformation() { return { version: '0.1.0', platform: 'web' } },
    async manageHostEvents() { return { state: 'connected', attempt: 0 } },
    async quitApplication() { reloadPage() },
    async restartApplication() { reloadPage() }
  }
}
