import { findTaxRegime, taxRegimes } from '../../../shared/fiscal/taxRegimes'
import type { SearchSelectOption } from '../../shared/components/searchSelectOption'

/**
 * Textos de la ficha y la lista de Clientes (ADR-032). Sólo presentación: las reglas de captura están en
 * `shared/contracts/clientProfile.ts`.
 */

/**
 * Opciones del selector con búsqueda de régimen fiscal (2026-10-04): "601 · General de Ley Personas Morales".
 * `personType` deja sólo los de persona moral o física; los regímenes sin vigencia sólo aparecen si es `keepCode`
 * (la ficha ya lo tiene) o si se piden todos para filtrar (`includeRetired`).
 */
export function taxRegimeOptions(options: { personType?: 'moral' | 'física' | null; keepCode?: string; includeRetired?: boolean } = {}): SearchSelectOption[] {
  return taxRegimes
    .filter(regime => (options.includeRetired || !regime.isRetired || regime.code === options.keepCode) &&
      (!options.personType || (options.personType === 'moral' ? regime.isForCompanies : regime.isForIndividuals)))
    .map(regime => ({ value: regime.code, label: regime.code + ' · ' + regime.description, keywords: regime.isForCompanies && regime.isForIndividuals ? 'moral física' : regime.isForCompanies ? 'moral' : 'física' }))
}

/** "5512345678" → "55 1234 5678". Otros valores (fichas antiguas) se muestran tal cual. */
export function formatPhoneNumber(value: string): string {
  return /^[0-9]{10}$/.test(value) ? value.slice(0, 2) + ' ' + value.slice(2, 6) + ' ' + value.slice(6) : value
}

/** Tipo de persona según la longitud del RFC; vacío si no hay RFC o no tiene 12 o 13 caracteres. */
export function describePersonType(rfc: string): string {
  return rfc.length === 12 ? 'Persona moral' : rfc.length === 13 ? 'Persona física' : ''
}

/** Régimen para mostrar: código y nombre del catálogo, o el texto capturado antes del catálogo. */
export function describeRegime(value: string): { code: string; name: string } | null {
  if (!value) return null
  const regime = findTaxRegime(value)
  return regime ? { code: regime.code, name: regime.description } : { code: '', name: value }
}
