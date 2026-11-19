import type { ExpectedMovement, ReconciliationStatus, StatementMovement } from '../contracts/bankReconciliation'
import { toMicros } from './cfdiDecimal'

/**
 * Concilia movimientos del banco con los esperados por CFDI y pagos (6.5), con el puntaje del sistema
 * original y estas correcciones:
 * - **Ambigüedad:** sólo cuentan los competidores todavía libres (el original contaba también los ya
 *   asignados y mandaba a revisión pares limpios).
 * - **Cobertura:** sólo `matched` (el original contaba también "revisar").
 *
 * Puntaje (máximo 100):
 * - importe: 68 si es exacto, bajando hasta 55 en el límite de la tolerancia;
 * - fecha: 24 el mismo día, 20 dentro de la ventana, 8 hasta 10 días;
 * - referencia: +18 si la descripción o referencia contiene el folio, el RFC de la contraparte o los
 *   primeros o últimos 8 caracteres del UUID; +10 por una palabra del nombre de la contraparte (≥ 5 letras).
 *
 * Reglas:
 * - **Candidatos:** mismo tipo (abono/cargo) e importe dentro de la tolerancia. Más allá de
 *   max(10, 3 × ventana) días sólo cuentan si la referencia coincide.
 * - **Asignación:** uno a uno, del mejor puntaje al peor.
 * - **Coincide** si no es ambiguo, el importe difiere ≤ 1 centavo, la fecha cae en la ventana y el
 *   puntaje es ≥ 88; si no, **revisar**.
 * - **Pagos agrupados:** un movimiento libre se compara con sumas de 2 o 3 esperados libres del mismo
 *   tipo dentro de la ventana; si coincide queda en **revisar** (84).
 * - **Lo que sobra** queda como **sólo banco** o **sólo CFDI**.
 */
export interface ReconciliationMatch { status: ReconciliationStatus; score: number; reason: string; bankIndexes: number[]; expectedIndexes: number[] }

const oneCent = 10_000n
const dayMilliseconds = 86_400_000
const maximumGroupCandidates = 40

function cents(value: string): bigint { return toMicros(value) ?? 0n }
function absolute(value: bigint): bigint { return value < 0n ? -value : value }
function daysBetween(first: string, second: string): number { return Math.abs(Date.parse(first + 'T00:00:00Z') - Date.parse(second + 'T00:00:00Z')) / dayMilliseconds }

/** Puntos por referencia: folio, RFC o fragmentos del UUID (+18) y una palabra del nombre (+10). */
export function referencePoints(bank: StatementMovement, expected: ExpectedMovement): number {
  const haystack = (bank.description + ' ' + bank.reference).toLocaleLowerCase('es-MX')
  const strong = [expected.folio, expected.counterpartRfc, expected.uuid.slice(0, 8), expected.uuid.slice(-8)].map(value => value.toLocaleLowerCase('es-MX').trim()).filter(value => value.length >= 4)
  let points = strong.some(value => haystack.includes(value)) ? 18 : 0
  const nameTokens = expected.counterpartName.toLocaleLowerCase('es-MX').split(/[^a-záéíóúñü0-9]+/).filter(token => token.length >= 5)
  if (nameTokens.some(token => haystack.includes(token))) points += 10
  return points
}

export function reconcileBankMovements(bank: StatementMovement[], expected: ExpectedMovement[], tolerance: string, dateWindowDays: number): ReconciliationMatch[] {
  const toleranceMicros = cents(tolerance)
  const farLimit = Math.max(10, dateWindowDays * 3)
  type Candidate = { bankIndex: number; expectedIndex: number; score: number; amountDifference: bigint; dayDifference: number }
  const candidates: Candidate[] = []
  bank.forEach((movement, bankIndex) => expected.forEach((item, expectedIndex) => {
    if (movement.type !== item.type) return
    const amountDifference = absolute(cents(movement.amount) - cents(item.amount))
    if (amountDifference > toleranceMicros) return
    const dayDifference = daysBetween(movement.date, item.date)
    const reference = referencePoints(movement, item)
    if (dayDifference > farLimit && reference < 18) return
    const amountPoints = amountDifference === 0n ? 68 : Math.max(55, Math.round(68 - 13 * Number(amountDifference) / Math.max(1, Number(toleranceMicros))))
    const datePoints = dayDifference === 0 ? 24 : dayDifference <= dateWindowDays ? 20 : dayDifference <= 10 ? 8 : 0
    candidates.push({ bankIndex, expectedIndex, score: Math.min(100, amountPoints + datePoints + reference), amountDifference, dayDifference })
  }))
  candidates.sort((first, second) => second.score - first.score || Number(first.amountDifference - second.amountDifference) || first.dayDifference - second.dayDifference)

  const usedBank = new Set<number>(), usedExpected = new Set<number>()
  const matches: ReconciliationMatch[] = []
  for (const candidate of candidates) {
    if (usedBank.has(candidate.bankIndex) || usedExpected.has(candidate.expectedIndex)) continue
    // Ambiguo: otro candidato libre, con igual o mejor puntaje, comparte el movimiento o el CFDI.
    const isAmbiguous = candidates.some(other => other !== candidate && other.score >= candidate.score && !usedBank.has(other.bankIndex) && !usedExpected.has(other.expectedIndex)
      && (other.bankIndex === candidate.bankIndex) !== (other.expectedIndex === candidate.expectedIndex))
    usedBank.add(candidate.bankIndex); usedExpected.add(candidate.expectedIndex)
    const isClean = !isAmbiguous && candidate.amountDifference <= oneCent && candidate.dayDifference <= dateWindowDays && candidate.score >= 88
    const reason = isClean ? 'Importe y fecha coinciden.' : isAmbiguous ? 'Hay más de un movimiento o CFDI con el mismo importe; confirma cuál corresponde.'
      : candidate.amountDifference > oneCent ? 'El importe difiere dentro de la tolerancia.' : candidate.dayDifference > dateWindowDays ? 'La fecha está fuera de la ventana; coincide por importe y referencia.' : 'Coincidencia débil; confírmala.'
    matches.push({ status: isClean ? 'matched' : 'requiresReview', score: candidate.score, reason, bankIndexes: [candidate.bankIndex], expectedIndexes: [candidate.expectedIndex] })
  }

  // Pagos agrupados: un movimiento libre igual a la suma de 2 o 3 esperados libres.
  bank.forEach((movement, bankIndex) => {
    if (usedBank.has(bankIndex)) return
    const pool = expected.map((item, index) => ({ item, index })).filter(({ item, index }) => !usedExpected.has(index) && item.type === movement.type && daysBetween(movement.date, item.date) <= dateWindowDays).slice(0, maximumGroupCandidates)
    const target = cents(movement.amount)
    let group: number[] | null = null
    for (let first = 0; first < pool.length && !group; first++) for (let second = first + 1; second < pool.length && !group; second++) {
      const pair = cents(pool[first]!.item.amount) + cents(pool[second]!.item.amount)
      if (absolute(pair - target) <= toleranceMicros) { group = [pool[first]!.index, pool[second]!.index]; break }
      for (let third = second + 1; third < pool.length; third++) {
        if (absolute(pair + cents(pool[third]!.item.amount) - target) <= toleranceMicros) { group = [pool[first]!.index, pool[second]!.index, pool[third]!.index]; break }
      }
    }
    if (!group) return
    usedBank.add(bankIndex); group.forEach(index => usedExpected.add(index))
    matches.push({ status: 'requiresReview', score: 84, reason: 'El movimiento coincide con la suma de ' + group.length + ' CFDI. Confirma que sea un pago agrupado.', bankIndexes: [bankIndex], expectedIndexes: group })
  })

  bank.forEach((movement, index) => { if (!usedBank.has(index)) matches.push({ status: 'bankOnly', score: 0, reason: (movement.type === 'credit' ? 'Abono' : 'Cargo') + ' sin CFDI ni complemento compatible.', bankIndexes: [index], expectedIndexes: [] }) })
  expected.forEach((item, index) => { if (!usedExpected.has(index)) matches.push({ status: 'fiscalOnly', score: 0, reason: (item.source === 'payment' ? 'Complemento de pago' : 'CFDI') + ' sin movimiento bancario compatible.', bankIndexes: [], expectedIndexes: [index] }) })
  return matches
}
