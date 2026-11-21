import type { ExpectedMovement, ReconciliationStatus } from '../../../shared/contracts/bankReconciliation'

/** Textos de la conciliación bancaria (6.5); los valores válidos los define el contrato compartido. */
export const reconciliationStatusLabels: Record<ReconciliationStatus, string> = { matched: 'Coincide', requiresReview: 'Revisar', bankOnly: 'Sólo banco', fiscalOnly: 'Sólo CFDI' }
export const reconciliationStatusTones: Record<ReconciliationStatus, 'success' | 'warning' | 'info' | 'error'> = { matched: 'success', requiresReview: 'warning', bankOnly: 'error', fiscalOnly: 'info' }
export const movementTypeLabels = { credit: 'Abono', debit: 'Cargo' } as const
export const expectedSourceLabels: Record<ExpectedMovement['source'], string> = { pue: 'PUE', creditNote: 'Nota de crédito', payment: 'Complemento de pago' }
export const formatLabels = { pdf: 'PDF', csv: 'CSV/TXT', xml: 'XML' } as const
/** `2026-09-15` → `15/09/2026`, como el resto de las tablas. */
export function formatMovementDate(value: string): string { return value.slice(8, 10) + '/' + value.slice(5, 7) + '/' + value.slice(0, 4) }
