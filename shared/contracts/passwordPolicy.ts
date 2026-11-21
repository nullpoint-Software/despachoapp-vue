export const minimumPasswordLength = 8
export const maximumPasswordLength = 128
/** Longitud mínima de producto; la fortaleza también depende de evitar claves previsibles o reutilizadas. */
export function isValidNewPassword(value: unknown): value is string {
  return typeof value === 'string' && value.length >= minimumPasswordLength && value.length <= maximumPasswordLength
}
