/**
 * Catálogo c_RegimenFiscal del SAT, incluido en la aplicación (ADR-032): la ficha del cliente lo necesita siempre,
 * aunque el equipo no haya descargado catálogos. Origen: bambucode/catalogos_sat_JSON (c_RegimenFiscal.json,
 * actualización del 2023-03-27). Se copió una vez; actualizarlo es editar esta lista.
 * - `isForIndividuals` / `isForCompanies`: si aplica a personas físicas (RFC de 13) o morales (RFC de 12).
 * - `isRetired`: el SAT le puso fin de vigencia; se muestra para fichas antiguas pero no se ofrece al capturar.
 */
export interface TaxRegime { code: string; description: string; isForIndividuals: boolean; isForCompanies: boolean; isRetired: boolean }

export const taxRegimes: readonly TaxRegime[] = [
  { code: '601', description: 'General de Ley Personas Morales', isForIndividuals: false, isForCompanies: true, isRetired: false },
  { code: '603', description: 'Personas Morales con Fines no Lucrativos', isForIndividuals: false, isForCompanies: true, isRetired: false },
  { code: '605', description: 'Sueldos y Salarios e Ingresos Asimilados a Salarios', isForIndividuals: true, isForCompanies: false, isRetired: false },
  { code: '606', description: 'Arrendamiento', isForIndividuals: true, isForCompanies: false, isRetired: false },
  { code: '607', description: 'Régimen de Enajenación o Adquisición de Bienes', isForIndividuals: true, isForCompanies: false, isRetired: false },
  { code: '608', description: 'Demás ingresos', isForIndividuals: true, isForCompanies: false, isRetired: false },
  { code: '609', description: 'Consolidación', isForIndividuals: false, isForCompanies: true, isRetired: true },
  { code: '610', description: 'Residentes en el Extranjero sin Establecimiento Permanente en México', isForIndividuals: true, isForCompanies: true, isRetired: false },
  { code: '611', description: 'Ingresos por Dividendos (socios y accionistas)', isForIndividuals: true, isForCompanies: false, isRetired: false },
  { code: '612', description: 'Personas Físicas con Actividades Empresariales y Profesionales', isForIndividuals: true, isForCompanies: false, isRetired: false },
  { code: '614', description: 'Ingresos por intereses', isForIndividuals: true, isForCompanies: false, isRetired: false },
  { code: '615', description: 'Régimen de los ingresos por obtención de premios', isForIndividuals: true, isForCompanies: false, isRetired: false },
  { code: '616', description: 'Sin obligaciones fiscales', isForIndividuals: true, isForCompanies: false, isRetired: false },
  { code: '620', description: 'Sociedades Cooperativas de Producción que optan por diferir sus ingresos', isForIndividuals: false, isForCompanies: true, isRetired: false },
  { code: '621', description: 'Incorporación Fiscal', isForIndividuals: true, isForCompanies: false, isRetired: false },
  { code: '622', description: 'Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras', isForIndividuals: false, isForCompanies: true, isRetired: false },
  { code: '623', description: 'Opcional para Grupos de Sociedades', isForIndividuals: false, isForCompanies: true, isRetired: false },
  { code: '624', description: 'Coordinados', isForIndividuals: false, isForCompanies: true, isRetired: false },
  { code: '625', description: 'Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas', isForIndividuals: true, isForCompanies: false, isRetired: false },
  { code: '626', description: 'Régimen Simplificado de Confianza', isForIndividuals: true, isForCompanies: true, isRetired: false },
  { code: '628', description: 'Hidrocarburos', isForIndividuals: false, isForCompanies: true, isRetired: false },
  { code: '629', description: 'De los Regímenes Fiscales Preferentes y de las Empresas Multinacionales', isForIndividuals: true, isForCompanies: false, isRetired: false },
  { code: '630', description: 'Enajenación de acciones en bolsa de valores', isForIndividuals: true, isForCompanies: false, isRetired: false }
]

/** Régimen por código; `undefined` si el código no está en el catálogo. */
export function findTaxRegime(code: string): TaxRegime | undefined {
  return taxRegimes.find(regime => regime.code === code)
}

/** Un régimen fiscal capturado debe ser un código de tres dígitos del catálogo. */
export function isTaxRegimeCode(value: string): boolean {
  return /^[0-9]{3}$/.test(value) && findTaxRegime(value) !== undefined
}

/** Texto para mostrar: '626 · Régimen Simplificado de Confianza', o el valor tal cual si no es un código. */
export function describeTaxRegime(value: string): string {
  const regime = findTaxRegime(value)
  return regime ? regime.code + ' · ' + regime.description : value
}
