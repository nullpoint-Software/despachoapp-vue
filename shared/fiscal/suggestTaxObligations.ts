import type { ObligationPeriodicity } from './taxObligationSchedule'

/**
 * Obligaciones sugeridas por régimen fiscal (2026-10-18, decisión del usuario: "sugerir por régimen"), para cuando no
 * se tiene la constancia a la mano. Las descripciones siguen el texto que imprime el SAT en la CSF para que, al leer la
 * constancia después, no se dupliquen. Es una sugerencia: en el alta por pasos se quitan o agregan antes de guardar.
 *
 * Reglas usadas (vencimientos generales del SAT):
 * - IVA y pagos provisionales de ISR: día 17 del mes siguiente (RIF: bimestral, día 17 del mes siguiente al bimestre).
 * - DIOT: último día del mes siguiente (personas físicas en RESICO no la presentan).
 * - Contabilidad electrónica (balanza): morales día 3 y físicas día 5 del segundo mes siguiente.
 * - Anual: morales 31 de marzo; físicas 30 de abril; fines no lucrativos 15 de febrero.
 * Varios regímenes se suman sin repetir descripciones; '616' (sin obligaciones) no agrega nada.
 */
export interface SuggestedObligation { description: string; periodicity: ObligationPeriodicity; dueMonthsAfter: number; dueDay: number }

const monthly = (description: string, dueDay = 17, dueMonthsAfter = 1): SuggestedObligation => ({ description, periodicity: 'monthly', dueMonthsAfter, dueDay })
const vat = monthly('Pago definitivo mensual de IVA.')
const diot = monthly('Declaración de proveedores de IVA (DIOT).', 31)
const companyAccounting = monthly('Envío de contabilidad electrónica (balanza de comprobación).', 3, 2)
const individualAccounting = monthly('Envío de contabilidad electrónica (balanza de comprobación).', 5, 2)
const companyAnnual: SuggestedObligation = { description: 'Declaración anual de ISR del ejercicio. Personas morales.', periodicity: 'annual', dueMonthsAfter: 3, dueDay: 31 }
const individualAnnual: SuggestedObligation = { description: 'Declaración anual de ISR. Personas físicas.', periodicity: 'annual', dueMonthsAfter: 4, dueDay: 30 }
const generalCompany = [monthly('Pago provisional mensual de ISR personas morales régimen general.'), vat, diot, companyAccounting, companyAnnual]

/** Sugerencias por código c_RegimenFiscal; el tipo de persona separa RESICO de morales y físicas. */
function suggestForRegime(code: string, isCompany: boolean): SuggestedObligation[] {
  switch (code) {
    case '601': case '620': case '622': case '623': case '624': case '628': return generalCompany
    case '603': return [{ description: 'Declaración anual informativa de personas morales con fines no lucrativos.', periodicity: 'annual', dueMonthsAfter: 2, dueDay: 15 }]
    case '606': return [monthly('Pago provisional mensual de ISR por arrendamiento.'), vat, diot, individualAnnual]
    case '612': return [monthly('Pago provisional mensual de ISR por actividades empresariales y profesionales.'), vat, diot, individualAccounting, individualAnnual]
    case '621': return [{ description: 'Pago definitivo bimestral de ISR. Régimen de Incorporación Fiscal.', periodicity: 'bimonthly', dueMonthsAfter: 1, dueDay: 17 },
      { description: 'Pago definitivo bimestral de IVA. Régimen de Incorporación Fiscal.', periodicity: 'bimonthly', dueMonthsAfter: 1, dueDay: 17 }]
    case '625': return [monthly('Pago provisional mensual de ISR por plataformas tecnológicas.'), vat, individualAnnual]
    case '626': return isCompany
      ? [monthly('Pago provisional mensual de ISR. Régimen Simplificado de Confianza. Personas morales.'), vat, diot, companyAccounting, companyAnnual]
      : [monthly('Pago provisional mensual de ISR. Régimen Simplificado de Confianza.'), vat, individualAnnual]
    case '616': return []
    default: return isCompany ? [] : [individualAnnual]
  }
}

export function suggestTaxObligations(regimeCodes: string[], isCompany: boolean): SuggestedObligation[] {
  const suggestions = new Map<string, SuggestedObligation>()
  for (const code of regimeCodes) for (const item of suggestForRegime(code, isCompany)) if (!suggestions.has(item.description)) suggestions.set(item.description, item)
  return [...suggestions.values()]
}

/** Regímenes con sugerencias propias por tipo de persona; los demás sólo agregan la anual de personas físicas. */
const companyRegimeCodes = ['601', '603', '626'], individualRegimeCodes = ['606', '612', '621', '625', '626']

/**
 * Catálogo completo de obligaciones que Fiscenix conoce (2026-10-19, pedido del usuario: "para el autocompletado de las
 * obligaciones, poder usar de las que están en el programa"): lo usa la descripción del alta para autocompletar con su
 * periodicidad y vencimiento. Primero las del tipo de persona (la contabilidad electrónica vence distinto en morales
 * y físicas) y después las del otro tipo que falten, sin repetir descripciones.
 */
export function listKnownTaxObligations(isCompany: boolean): SuggestedObligation[] {
  const known = new Map<string, SuggestedObligation>()
  const companies = suggestTaxObligations(companyRegimeCodes, true), individuals = suggestTaxObligations(individualRegimeCodes, false)
  for (const item of isCompany ? [...companies, ...individuals] : [...individuals, ...companies]) if (!known.has(item.description)) known.set(item.description, item)
  return [...known.values()]
}
