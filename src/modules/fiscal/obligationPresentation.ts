import type { ObligationSource } from '../../../shared/contracts/taxObligations'
import type { ObligationPeriodicity, ObligationStatus } from '../../../shared/fiscal/taxObligationSchedule'

/** Textos de las vistas de obligaciones fiscales (2026-10-18). Sólo presentación; las reglas viven en `shared/fiscal`. */
const shortMonths = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
/** Rótulo corto de la celda del periodo: "Mar", "B2", "T1" o "Anual". */
export function shortPeriodLabel(periodicity: ObligationPeriodicity, periodNumber: number): string {
  if (periodicity === 'monthly') return shortMonths[periodNumber - 1]!
  if (periodicity === 'bimonthly') return 'B' + periodNumber
  if (periodicity === 'quarterly') return 'T' + periodNumber
  return 'Anual'
}
/** "17 nov 2026" para una fecha de negocio `AAAA-MM-DD`. */
export const formatBusinessDay = (day: string) => new Date(day + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
export const formatInstant = (instant: string) => new Date(instant).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
export const obligationStatusTexts: Record<ObligationStatus, string> = { fulfilled: 'Cumplida', pending: 'Pendiente', overdue: 'Vencida', notApplicable: 'No aplica' }
export const obligationStatusTones: Record<ObligationStatus, 'success' | 'warning' | 'error' | 'neutral'> = { fulfilled: 'success', pending: 'warning', overdue: 'error', notApplicable: 'neutral' }
export const obligationSourceTexts: Record<ObligationSource, string> = { certificate: 'De la constancia', regime: 'Por régimen', manual: 'Manual' }
