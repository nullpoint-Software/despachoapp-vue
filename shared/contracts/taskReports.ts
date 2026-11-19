import { pairingRecord } from './pairing'
import { parseBusinessDate } from './movements'
import type { PdfAction } from './fiscalWorkspace'

/**
 * Reporte PDF de tareas terminadas (2026-10-04, pedido del usuario): las tareas completadas en un día de la oficina,
 * con encabezado del despacho (nombre y logo) y diseño brutalista. `tasks:completedPdf` (Renderer → Main): Main pide al
 * Host las tareas visibles para la sesión (`tasks.read`), se queda con las completadas ese día y arma el PDF.
 * El Host acepta días de hasta 366 atrás (`maximumCompletedWindowDays`).
 */
export const taskReportChannel = 'tasks:completedPdf'
export interface CompletedTasksPdfRequest { day: string; action: PdfAction }

export function parseCompletedTasksPdfRequest(value: unknown): CompletedTasksPdfRequest {
  const data = pairingRecord(value)
  if (Object.keys(data).sort().join() !== 'action,day') throw new Error('Invalid task report request')
  if (data.action !== 'preview' && data.action !== 'save') throw new Error('Invalid PDF action')
  return { day: parseBusinessDate(data.day), action: data.action }
}
