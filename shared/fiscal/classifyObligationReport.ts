import type { ObligationReportRow, ReportStatusFilter } from '../contracts/taxObligations'
import { dueDateOf, statusOf, type ObligationStatus } from './taxObligationSchedule'

/**
 * Renglones del reporte del periodo con su fecha límite y estado (2026-10-18). Lo usan la vista del reporte y el PDF
 * de Main para que ambos cuenten y filtren igual. `today` es el día de la oficina (`getOfficeToday`).
 * Orden: vencidas primero, luego pendientes y al final cumplidas; dentro, por cliente y obligación.
 * Los periodos anteriores al inicio de la obligación (`notApplicable`) no se listan.
 */
export interface ClassifiedObligationRow extends ObligationReportRow { dueDate: string; status: Exclude<ObligationStatus, 'notApplicable'> }
export interface ObligationReportCounts { total: number; fulfilled: number; pending: number; overdue: number }
const statusOrder = { overdue: 0, pending: 1, fulfilled: 2 } as const

export function classifyObligationReport(rows: ObligationReportRow[], fiscalYear: number, today: string): ClassifiedObligationRow[] {
  const classified: ClassifiedObligationRow[] = []
  for (const row of rows) {
    const status = statusOf(row.obligation, fiscalYear, row.periodNumber, row.fulfillment !== null, today)
    if (status !== 'notApplicable') classified.push({ ...row, dueDate: dueDateOf(row.obligation, fiscalYear, row.periodNumber), status })
  }
  return classified.sort((first, second) => statusOrder[first.status] - statusOrder[second.status] || first.clientDisplayName.localeCompare(second.clientDisplayName, 'es-MX')
    || first.obligation.description.localeCompare(second.obligation.description, 'es-MX'))
}
export function countObligationReport(rows: ClassifiedObligationRow[]): ObligationReportCounts {
  return { total: rows.length, fulfilled: rows.filter(row => row.status === 'fulfilled').length, pending: rows.filter(row => row.status === 'pending').length, overdue: rows.filter(row => row.status === 'overdue').length }
}
export function filterObligationReport(rows: ClassifiedObligationRow[], filter: ReportStatusFilter): ClassifiedObligationRow[] {
  return filter === 'all' ? rows : rows.filter(row => row.status === filter)
}
export const obligationStatusLabels: Record<ClassifiedObligationRow['status'], string> = { fulfilled: 'Cumplida', pending: 'Pendiente', overdue: 'Vencida' }
