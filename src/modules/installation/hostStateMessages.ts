import type { HostState } from '../../../shared/contracts/host'

/** Texto de cada estado del servicio Host (instalación y Configuración › Este equipo). */
export const hostStateMessages: Record<HostState, string> = {
  notHost: 'Este equipo funciona como Cliente.',
  starting: 'Preparando el servicio local…',
  configurationRequired: 'Crea el servidor automático para comenzar. Fiscenix se encarga de la base de datos.',
  databaseUnavailable: 'MySQL no está disponible o el esquema requiere revisión. Revisa el servicio y las credenciales.',
  migrationRequired: 'La conexión funciona. Falta preparar el esquema de Fiscenix.',
  migrationFailed: 'La preparación falló. Revisa permisos e historial antes de reintentar; no se modificará automáticamente un esquema desconocido.',
  setupRequired: 'Base preparada. El servicio permanece local hasta configurar el administrador y la conexión segura.',
  pairingRequired: 'Host listo. Para conectar otros equipos genera una clave USB en Configuración > Este equipo.',
  securityRequired: 'Administrador creado. Falta preparar la conexión segura y el emparejamiento de Clientes.',
  stopped: 'El servicio Host está detenido.'
}

/**
 * Resumen del estado para la tarjeta "Estado del servicio" (2026-10-06): una palabra y el tono de su insignia.
 * En servicio = el Host atiende a los Clientes; los estados de preparación piden configurar; los fallos, revisar.
 */
export function describeHostState(state: HostState): { label: string; tone: 'success' | 'info' | 'warning' | 'error' } {
  if (state === 'pairingRequired') return { label: 'En servicio', tone: 'success' }
  if (state === 'starting' || state === 'notHost') return { label: state === 'starting' ? 'Iniciando' : 'Cliente', tone: 'info' }
  if (state === 'databaseUnavailable' || state === 'migrationFailed' || state === 'stopped') return { label: state === 'stopped' ? 'Detenido' : 'Requiere revisión', tone: 'error' }
  return { label: 'Por configurar', tone: 'warning' }
}
