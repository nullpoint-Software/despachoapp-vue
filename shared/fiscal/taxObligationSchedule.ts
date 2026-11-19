/**
 * Calendario de obligaciones fiscales (2026-10-18, [[modules/TAX-OBLIGATIONS]]). Funciones puras que comparten el
 * Host (reporte del periodo), Main (PDF) y la vista (cuadrícula del cliente).
 *
 * Modelo: cada obligación tiene una periodicidad y una regla de vencimiento "día `dueDay` del `dueMonthsAfter`-ésimo
 * mes después del último mes del periodo". Así se expresan las reglas que imprime la constancia del SAT:
 * - "día 17 del mes inmediato posterior" → 1 mes, día 17;
 * - "último día del mes inmediato posterior" → 1 mes, día 31 (se ajusta al último día del mes);
 * - "30 de abril del ejercicio siguiente" (anual, el periodo termina en diciembre) → 4 meses, día 30.
 *
 * Periodos por ejercicio: mensual 1-12, bimestral 1-6, trimestral 1-4 y anual 1. En el reporte por mes se listan las
 * obligaciones cuyo periodo TERMINA en ese mes (la declaración de ese periodo).
 *
 * shortcut: el SAT recorre al siguiente día hábil un vencimiento en sábado, domingo o día inhábil; aquí no se recorre
 * (una obligación se ve vencida un día antes en esos casos). Si hace falta exactitud, agregar el calendario de días inhábiles.
 */
export const obligationPeriodicities = ['monthly', 'bimonthly', 'quarterly', 'annual'] as const
export type ObligationPeriodicity = typeof obligationPeriodicities[number]
export type ObligationStatus = 'fulfilled' | 'pending' | 'overdue' | 'notApplicable'
export interface ObligationRule { periodicity: ObligationPeriodicity; dueMonthsAfter: number; dueDay: number; startsOn: string | null }

const monthsPerPeriod: Record<ObligationPeriodicity, number> = { monthly: 1, bimonthly: 2, quarterly: 3, annual: 12 }
export const periodicityLabels: Record<ObligationPeriodicity, string> = { monthly: 'Mensual', bimonthly: 'Bimestral', quarterly: 'Trimestral', annual: 'Anual' }
const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** Cuántos periodos tiene un ejercicio. */
export function countPeriods(periodicity: ObligationPeriodicity): number { return 12 / monthsPerPeriod[periodicity] }
/** Último mes (1-12) del periodo. */
export function periodEndMonth(periodicity: ObligationPeriodicity, periodNumber: number): number { return periodNumber * monthsPerPeriod[periodicity] }
/** Periodo que termina en `month`, o `null` si en ese mes no termina ninguno (p. ej. bimestral en marzo). */
export function periodEndingIn(periodicity: ObligationPeriodicity, month: number): number | null {
  const size = monthsPerPeriod[periodicity]
  return month % size === 0 ? month / size : null
}
const pad = (value: number) => String(value).padStart(2, '0')
const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate()

/** Fecha límite `AAAA-MM-DD` del periodo; un día mayor que el mes se ajusta a su último día. */
export function dueDateOf(rule: ObligationRule, fiscalYear: number, periodNumber: number): string {
  const monthIndex = periodEndMonth(rule.periodicity, periodNumber) - 1 + rule.dueMonthsAfter
  const year = fiscalYear + Math.floor(monthIndex / 12), month = monthIndex % 12 + 1
  return year + '-' + pad(month) + '-' + pad(Math.min(rule.dueDay, daysInMonth(year, month)))
}
/** El periodo cuenta si termina en o después del inicio de la obligación (fecha "Inicio" de la constancia). */
export function isPeriodApplicable(rule: ObligationRule, fiscalYear: number, periodNumber: number): boolean {
  if (!rule.startsOn) return true
  const endMonth = periodEndMonth(rule.periodicity, periodNumber)
  return fiscalYear + '-' + pad(endMonth) + '-' + pad(daysInMonth(fiscalYear, endMonth)) >= rule.startsOn
}
/** Estado de un periodo: cumplida si se marcó; vencida si `today` (AAAA-MM-DD de la oficina) pasó la fecha límite. */
export function statusOf(rule: ObligationRule, fiscalYear: number, periodNumber: number, isFulfilled: boolean, today: string): ObligationStatus {
  if (isFulfilled) return 'fulfilled'
  if (!isPeriodApplicable(rule, fiscalYear, periodNumber)) return 'notApplicable'
  return today > dueDateOf(rule, fiscalYear, periodNumber) ? 'overdue' : 'pending'
}
/** "Marzo 2026", "Bimestre 2 (mar-abr) 2026", "Trimestre 1 2026", "Ejercicio 2026". */
export function describePeriod(periodicity: ObligationPeriodicity, periodNumber: number, fiscalYear: number): string {
  const end = periodEndMonth(periodicity, periodNumber)
  if (periodicity === 'monthly') return monthNames[end - 1]!.replace(/^./, letter => letter.toUpperCase()) + ' ' + fiscalYear
  if (periodicity === 'bimonthly') return 'Bimestre ' + periodNumber + ' (' + monthNames[end - 2]!.slice(0, 3) + '-' + monthNames[end - 1]!.slice(0, 3) + ') ' + fiscalYear
  if (periodicity === 'quarterly') return 'Trimestre ' + periodNumber + ' ' + fiscalYear
  return 'Ejercicio ' + fiscalYear
}
/** Regla en palabras: "Día 17 del mes siguiente", "Último día del mes siguiente", "30 de abril del año siguiente". */
export function describeDueRule(rule: Pick<ObligationRule, 'periodicity' | 'dueMonthsAfter' | 'dueDay'>): string {
  if (rule.periodicity === 'annual') return (rule.dueDay >= 31 ? 'Último día de ' : rule.dueDay + ' de ') + monthNames[(rule.dueMonthsAfter - 1) % 12] + ' del año siguiente'
  const day = rule.dueDay >= 31 ? 'Último día' : 'Día ' + rule.dueDay
  const months = rule.dueMonthsAfter === 1 ? 'del mes siguiente' : 'del ' + rule.dueMonthsAfter + '.º mes siguiente'
  return day + ' ' + months + ' al periodo'
}
