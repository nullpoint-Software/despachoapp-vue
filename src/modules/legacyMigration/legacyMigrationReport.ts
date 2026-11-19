import type { LegacyDecision, LegacyLocalOutcome, LegacyMigrationPreview, LegacyRunSummary } from '../../../shared/contracts/legacyMigration'
import { decisionItems } from './legacyMigrationDecisions'

/**
 * "Descargar reporte" de la migración: CSV (separador `;`, como Excel en español) armado en el Renderer sólo con el
 * resumen del Host, la vista previa y las decisiones. Nunca lleva contraseñas, CIEC, palabra clave ni payloads de eventos:
 * esos datos no existen en el Renderer más allá de los conteos. Main sólo lo escribe donde elija la persona.
 */
export interface LegacyReportInput { summary: LegacyRunSummary; preview: LegacyMigrationPreview; decisions: Map<string, LegacyDecision>; local: LegacyLocalOutcome | null }

/** Comillas cuando hace falta y un apóstrofo delante de `= + - @`, tabulador o retorno para que una hoja de cálculo no lo ejecute como fórmula. */
function formatCell(value: string | number): string {
  const text = String(value)
  const safe = /^[=+\-@\t\r]/.test(text) ? "'" + text : text
  return /[;"\r\n]/.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe
}

export function buildLegacyReportCsv({ summary, preview, decisions, local }: LegacyReportInput): string {
  const rows: (string | number)[][] = [['Sección', 'Tabla o tipo', 'Concepto', 'Valor']]
  rows.push(['Corrida', '', 'Respaldo previo', summary.backupId], ['Corrida', '', 'Corrida', summary.runId])
  for (const [label, record] of [['Creados', summary.created], ['Vinculados', summary.linked], ['Actualizados', summary.updated]] as const) {
    for (const [entity, total] of Object.entries(record)) rows.push(['Resultado', entity, label, total])
  }
  rows.push(['Resultado', 'movimientos', 'Anulados (corregidos en origen)', summary.voided], ['Resultado', 'usuarios', 'Pendientes de contraseña', summary.pendingPasswordUserIds.length])
  // Importes creados por tabla heredada, para cuadrar contra la app anterior (texto con dos decimales, sin redondeos).
  for (const [table, totals] of Object.entries(summary.createdAmounts)) rows.push(['Importes creados', table, 'Cobros', totals.income], ['Importes creados', table, 'Gastos', totals.expense])
  if (local) rows.push(['Paso local', 'ciec', 'Guardadas', local.savedCiecCount], ['Paso local', 'ciec', 'Ya guardadas (se conservaron)', local.keptExistingCiecCount], ['Paso local', 'ciec', 'Con error', local.failedCiecCount])
  for (const [entity, counts] of Object.entries(preview.counts)) {
    for (const [action, total] of Object.entries(counts)) rows.push(['Vista previa', entity, action, total])
  }
  for (const conflict of preview.conflicts) rows.push(['Conflicto', conflict.sourceTable + ' · ' + conflict.kind, conflict.legacyLabel, decisions.get(conflict.key)?.choice ?? ''])
  for (const dependent of decisionItems(preview, decisions).dependents) rows.push(['Pago de cliente rechazado', dependent.sourceTable, dependent.legacyLabel, decisions.get(dependent.key)?.choice ?? ''])
  for (const issue of preview.issues) rows.push(['Incidencia', issue.sourceTable + ' · ' + issue.kind, issue.legacyLabel, issue.isInformational ? 'informativa' : decisions.get(issue.key)?.choice ?? ''])
  return rows.map(row => row.map(formatCell).join(';')).join('\r\n') + '\r\n'
}
