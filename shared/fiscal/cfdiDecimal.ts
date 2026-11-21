/**
 * Aritmética exacta para importes de CFDI: enteros en millonésimas (6 decimales, el máximo que usan
 * los atributos del SAT), sin coma flotante. Todas las sumas y comparaciones del análisis pasan por aquí.
 */
const scale = 1_000_000n
const decimalPattern = /^(-)?(\d{1,18})(?:\.(\d{1,6}))?$/

/** Texto decimal del XML → millonésimas; `null` si falta o no es un número válido. */
export function toMicros(value: string | null | undefined): bigint | null {
  if (value === null || value === undefined) return null
  const match = decimalPattern.exec(value.trim())
  if (!match) return null
  const micros = BigInt(match[2]!) * scale + BigInt((match[3] ?? '').padEnd(6, '0'))
  return match[1] ? -micros : micros
}

/** Millonésimas → texto con 2 decimales, redondeando a la mitad hacia arriba (en valor absoluto). */
export function formatMicrosAsCents(micros: bigint): string {
  const isNegative = micros < 0n
  const absolute = isNegative ? -micros : micros
  const cents = (absolute + 5_000n) / 10_000n
  return (isNegative && cents > 0n ? '-' : '') + (cents / 100n).toString() + '.' + (cents % 100n).toString().padStart(2, '0')
}

/** Redondea a centavos, para comparar sumas de importes con más decimales contra un total declarado. */
export function roundMicrosToCents(micros: bigint): bigint {
  const isNegative = micros < 0n
  const absolute = isNegative ? -micros : micros
  const rounded = ((absolute + 5_000n) / 10_000n) * 10_000n
  return isNegative ? -rounded : rounded
}

export function sumMicros(values: Array<bigint | null>): bigint { return values.reduce<bigint>((total, value) => total + (value ?? 0n), 0n) }

/** Diferencia absoluta dentro de la tolerancia (en millonésimas). */
export function isWithin(first: bigint, second: bigint, toleranceMicros: bigint): boolean {
  const difference = first - second
  return (difference < 0n ? -difference : difference) <= toleranceMicros
}

/** Un centavo, la tolerancia de redondeo entre importes declarados y calculados. */
export const oneCentMicros = 10_000n
