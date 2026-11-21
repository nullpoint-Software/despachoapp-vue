/**
 * Máscara de "Escribir fecha" de `DateField` (pedido del usuario, 2026-10-17: "que se ponga el / automáticamente").
 * Con sólo dígitos y diagonales, deja los dígitos (máximo 8) como dd/mm/aaaa. Al escribir (`isInserting`) agrega la
 * diagonal en cuanto se completan el día o el mes; al borrar no la vuelve a poner, para que la persona pueda borrarla.
 * Con guiones o puntos (formatos que `applyTyped` también acepta) no toca el texto.
 */
export function formatTypedDate(value: string, isInserting: boolean): string {
  if (!/^[\d/]*$/.test(value)) return value
  const digits = value.replace(/\//g, '').slice(0, 8)
  let text = digits.slice(0, 2)
  if (digits.length > 2) text += '/' + digits.slice(2, 4)
  if (digits.length > 4) text += '/' + digits.slice(4)
  if (isInserting && (digits.length === 2 || digits.length === 4)) text += '/'
  return text
}
