import { readIpcErrorMessage } from '../../shared/ipcErrorMessage'

/**
 * Traduce las fallas conocidas de la migración (spec "Errores") a lo que la vista muestra y ofrece. Main reenvía sin
 * cambios los mensajes de la lista blanca del Host ('Analysis stale', 'Backup failed', ...) y los suyos ('Dump not
 * chosen', ...); cualquier otro error se trata como genérico: el Host deshace toda la transacción, así que "No se hizo
 * ningún cambio" es cierto. La contraseña incorrecta nunca llega aquí: la maneja `withSensitiveConfirmation`.
 * - `reanalyze`: ofrecer "Volver a analizar" (conservando decisiones aplicables).
 * - `backupSettings`: ofrecer el enlace a la configuración de respaldos.
 * - `conflicts`: volver al paso de conflictos.
 */
export type LegacyFailureAction = 'reanalyze' | 'backupSettings' | 'conflicts' | null
export interface LegacyFailureView { title: string; message: string; action: LegacyFailureAction }

const unchanged = 'No se hizo ningún cambio.'
const failureViews: Record<string, LegacyFailureView> = {
  'Analysis stale': { title: 'El análisis ya no es vigente', message: 'Los datos del despacho cambiaron desde el análisis (o Fiscenix se reinició). ' + unchanged + ' Vuelve a analizar; las decisiones que sigan aplicando se conservan.', action: 'reanalyze' },
  'Analysis expired': { title: 'El análisis caducó', message: 'Pasaron más de 30 minutos desde el análisis. ' + unchanged + ' Vuelve a analizar; las decisiones que sigan aplicando se conservan.', action: 'reanalyze' },
  'Backup unavailable': { title: 'No hay respaldos configurados', message: 'La migración siempre hace antes un respaldo verificado. ' + unchanged + ' Configura los respaldos y vuelve a intentarlo.', action: 'backupSettings' },
  'Backup failed': { title: 'El respaldo previo falló', message: 'No se pudo completar el respaldo verificado previo. ' + unchanged + ' Revisa la carpeta de respaldos y vuelve a intentarlo.', action: 'backupSettings' },
  'Decisions incomplete': { title: 'Faltan decisiones', message: 'Hay conflictos o incidencias sin resolver. ' + unchanged, action: 'conflicts' },
  'Invalid decision': { title: 'Una decisión no es válida', message: 'Revisa los conflictos: un usuario nuevo repetido, un vínculo que ya no aplica o un RFC repetido cuyos clientes no eligen el mismo principal. ' + unchanged, action: 'conflicts' },
  'Dump not chosen': { title: 'Elige el archivo otra vez', message: 'Fiscenix sólo lee el archivo elegido en esta sesión. Vuelve a elegirlo.', action: null },
  'Dump too large': { title: 'Archivo demasiado grande', message: 'La exportación supera los 256 MB. Exporta de nuevo sólo la base de la app anterior.', action: null },
  'No run for this dump': { title: 'No hay una migración de este archivo', message: 'Este archivo no se ha migrado (o cambió desde entonces). Elige el mismo archivo con el que se migró.', action: null },
}

export function describeLegacyFailure(error: unknown, fallbackTitle = 'No se completó la migración'): LegacyFailureView {
  return failureViews[readIpcErrorMessage(error, '')] ?? { title: fallbackTitle, message: unchanged + ' Revisa la conexión con el Host y vuelve a intentarlo.', action: null }
}
