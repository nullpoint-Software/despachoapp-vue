import { parseEmailAddress } from '../../../shared/contracts/mail'

/**
 * Correos usados recientemente (2026-10-20, pedido del usuario: "recuerda los autocompletados de correo"). Comodidad
 * LOCAL de este equipo y de esta persona, no dato de negocio: los contactos de cada cliente siguen en el Host
 * (`MailContactsPanel`). El redactor los ofrece como sugerencias en "Correos de destino".
 *
 * - Clave por `userId`: otra persona en el mismo equipo no ve los de otra.
 * - Sólo se guardan direcciones de correos que sí salieron; las más recientes primero, hasta `maximumRecentCount`.
 * - Al leer se vuelve a validar cada dirección; si el almacenamiento falta, está bloqueado o trae algo inválido, no hay
 *   sugerencias y el redactor funciona igual.
 */
const storagePrefix = 'contapp.mail.recentRecipients.'
const maximumRecentCount = 50

export function readRecentRecipients(userId: string): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(storagePrefix + userId) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap(item => { try { return [parseEmailAddress(item)] } catch { return [] } }).slice(0, maximumRecentCount)
  } catch { return [] }
}

export function rememberRecipients(userId: string, addresses: readonly string[]): void {
  try {
    const merged = [...new Set([...addresses, ...readRecentRecipients(userId)])].slice(0, maximumRecentCount)
    window.localStorage.setItem(storagePrefix + userId, JSON.stringify(merged))
  } catch { /* Sin almacenamiento: no se recuerda, el envío ya salió. */ }
}
