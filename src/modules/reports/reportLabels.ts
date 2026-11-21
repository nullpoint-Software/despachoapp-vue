import type { CreditKind, DiotIssueCode, ImportKind, OperationType, ReportDirection, ReportType, SupplierRegion, ThirdPartyType } from '../../../shared/contracts/fiscalReports'

/** Textos de reportes y DIOT; los valores válidos los define el contrato compartido. */
export const reportTypeLabels: Record<ReportType, string> = { monthly: 'Mensual', annual: 'Anual' }
export const reportDirectionLabels: Record<ReportDirection, string> = { issued: 'Emitidas', received: 'Recibidas' }
export const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
export function formatReportPeriod(report: { reportType: ReportType; fiscalYear: number; fiscalMonth: number }): string {
  return report.reportType === 'annual' ? 'Ejercicio ' + report.fiscalYear : monthNames[report.fiscalMonth - 1] + ' ' + report.fiscalYear
}
/** Nombre sugerido como el original: "Mensual Recibidas septiembre 2026" o "Anual Emitidas 2026". */
export function suggestReportName(reportType: ReportType, direction: ReportDirection, fiscalYear: number, fiscalMonth: number): string {
  return reportTypeLabels[reportType] + ' ' + reportDirectionLabels[direction] + ' ' + (reportType === 'monthly' ? monthNames[fiscalMonth - 1] + ' ' : '') + fiscalYear
}

export const thirdPartyTypeLabels: Record<ThirdPartyType, string> = { '04': '04 · Proveedor nacional', '05': '05 · Proveedor extranjero', '15': '15 · Proveedor global' }
export const operationTypeLabels: Record<OperationType, string> = {
  '02': '02 · Enajenación de bienes', '03': '03 · Servicios profesionales', '06': '06 · Uso o goce temporal de bienes', '07': '07 · Importación de bienes o servicios',
  '08': '08 · Importación por transferencia virtual', '85': '85 · Otros', '87': '87 · Operaciones globales'
}
export const regionLabels: Record<SupplierRegion, string> = { none: 'Sin estímulo de región', north: 'Región fronteriza norte (8 %)', south: 'Región fronteriza sur (8 %)' }
export const importKindLabels: Record<ImportKind, string> = { none: 'No es importación', tangible: 'Importación de bienes tangibles', intangible: 'Importación de intangibles y servicios' }
export const creditKindLabels: Record<CreditKind, string> = {
  exclusive: 'IVA acreditable exclusivo de actividades gravadas', proportional: 'IVA acreditable en proporción', notRequirements: 'No acreditable: no reúne requisitos',
  exemptActivities: 'No acreditable: actividades exentas', notSubject: 'No acreditable: actividades no objeto'
}
export const diotIssueLabels: Record<DiotIssueCode, string> = {
  missingExchangeRate: 'Un CFDI en moneda extranjera no tiene tipo de cambio.',
  vat8WithoutRegion: 'Tiene IVA al 8 % y el proveedor no tiene región fronteriza. Elige norte o sur en sus ajustes.',
  refundExceedsValue: 'Las devoluciones, descuentos o bonificaciones superan al valor de los actos; el SAT no lo acepta.',
  amountTooLarge: 'Un importe supera los 14 dígitos que admite el SAT.',
  missingForeignTaxId: 'Proveedor extranjero sin número de identificación fiscal.',
  missingCountry: 'Proveedor extranjero sin país de residencia.',
  missingJurisdiction: 'Con país ZZZ hay que especificar la jurisdicción fiscal.',
  negativeAmountClamped: 'Un importe quedó negativo por notas de crédito y se escribió 0.'
}
