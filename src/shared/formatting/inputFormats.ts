/**
 * Formato al escribir de los datos con forma conocida (2026-10-04, pedido del usuario): RFC, teléfono, dinero y correo.
 * Son funciones puras: los campos (RfcField, PhoneField, MoneyField, EmailField) las aplican en cada tecla y las
 * pruebas unitarias las cubren. Las reglas de validez siguen en los contratos compartidos y el Host las repite.
 */

/** RFC: mayúsculas, sin espacios ni guiones, sólo letras (incluidas Ñ y &) y dígitos, hasta 13 caracteres. */
export function formatRfcInput(value: string): string {
  return value.toUpperCase().replace(/[^A-ZÑ&0-9]/g, '').slice(0, 13)
}

/** Tipo de persona y si el RFC ya tiene la estructura del SAT (12 moral, 13 física). */
export function describeRfcInput(value: string): { personType: 'moral' | 'física' | null; isComplete: boolean } {
  const isComplete = /^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/.test(value)
  return { personType: value.length === 12 ? 'moral' : value.length === 13 ? 'física' : null, isComplete }
}

/** Teléfono mexicano de 10 dígitos agrupado como "55 1234 5678" mientras se escribe; quita la lada +52. */
export function formatPhoneInput(value: string): string {
  let digits = value.replace(/\D/g, '')
  if (digits.length > 10 && digits.startsWith('52')) digits = digits.slice(2)
  digits = digits.slice(0, 10)
  return [digits.slice(0, 2), digits.slice(2, 6), digits.slice(6)].filter(Boolean).join(' ')
}

/** Importe mientras se escribe: dígitos y un punto decimal con hasta dos decimales; las comas de miles se ignoran. */
export function sanitizeMoneyInput(value: string): string {
  const cleaned = value.replace(/[^0-9.]/g, '')
  const [whole = '', ...rest] = cleaned.split('.')
  const decimals = rest.join('').slice(0, 2)
  const integer = whole.replace(/^0+(?=\d)/, '').slice(0, 15)
  return cleaned.includes('.') ? (integer || '0') + '.' + decimals : integer
}

/** Importe para mostrar fuera del foco: "$1,250.50"; vacío si no hay número. */
export function formatMoneyDisplay(value: string): string {
  if (!value || Number.isNaN(Number(value))) return ''
  return '$' + Number(value).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Dominios de correo más usados en México, en el orden en que se sugieren. */
export const commonEmailDomains = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com.mx', 'icloud.com', 'live.com.mx', 'prodigy.net.mx'] as const

/** Correo: sin espacios y en minúsculas. */
export function formatEmailInput(value: string): string { return value.replace(/\s/g, '').toLowerCase() }

/** Sugerencias al escribir "usuario@do…": completa con los dominios comunes que empiezan igual (hasta 5). */
export function suggestEmailAddresses(value: string): string[] {
  const at = value.indexOf('@')
  if (at < 1 || value.indexOf('@', at + 1) >= 0) return []
  const local = value.slice(0, at), typedDomain = value.slice(at + 1)
  return commonEmailDomains.filter(domain => domain.startsWith(typedDomain) && domain !== typedDomain).slice(0, 5).map(domain => local + '@' + domain)
}
