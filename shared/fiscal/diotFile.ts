import type { DiotRow } from '../contracts/fiscalReports'

/**
 * Archivo de carga masiva de la DIOT a partir de las líneas que calcula el Host (`buildDiot`).
 * El instructivo del SAT pide UTF-8 y `|` como separador. No dice nada de BOM ni de fin de línea:
 * se escribe sin BOM y con CRLF (el formato de Windows). Pendiente de confirmarlo con una carga real
 * en la plataforma del SAT (ver validation/FISCAL-REPORTS).
 */
export function renderDiotFile(rows: DiotRow[]): string {
  return rows.map(row => row.fields.join('|')).join('\r\n') + (rows.length ? '\r\n' : '')
}
