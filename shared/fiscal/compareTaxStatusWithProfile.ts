import type { TaxStatusDetails } from '../contracts/taxStatus'
import { taxRegimes } from './taxRegimes'

/**
 * Reglas para relacionar lo que devolvió el SAT (consulta pública de la CSF) con la ficha del cliente: nombres sin
 * acentos, puntuación ni régimen de capital, y nombre del régimen del SAT → código c_RegimenFiscal. Las usa
 * `planTaxStatusProfileUpdate` para autocompletar la ficha.
 *
 * Historia: hasta el 2026-10-13 aquí vivía también la comparación renglón por renglón del cajón de la CSF; se retiró
 * con el cajón (pedido del usuario: la consulta sólo sirve para autocompletar la ficha, [[changes/CSF-FORM-AUTOFILL]]).
 */

/** Texto comparable: sin acentos, en mayúsculas, sin puntos y con espacios simples ("S.A. de C.V." → "SA DE CV"). */
export function normalizeComparableText(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase().replace(/\./g, '').replace(/[^A-Z0-9&]+/g, ' ').trim()
}

/**
 * Régimen de capital al final de una razón social. Desde 2022 la constancia imprime la denominación sin él, pero
 * en Fiscenix el nombre suele llevarlo ("Ejemplo SA de CV"); se ignora para no marcar una diferencia falsa.
 */
const capitalRegimeSuffix = /\s+(SAPI|SAB|SA|S DE RL|SRL|S EN C|S EN NC|SC|AC|SAS|SPR|SPR DE RL|SCL|SCP|S DE SS|IAP|ABP)(\s+DE\s+(CV|RI|IP))?$/
export function normalizeTaxpayerName(value: string, capitalRegime: string | null): string {
  let normalized = normalizeComparableText(value)
  const declaredSuffix = capitalRegime ? normalizeComparableText(capitalRegime) : ''
  if (declaredSuffix && normalized.endsWith(' ' + declaredSuffix)) normalized = normalized.slice(0, -declaredSuffix.length - 1)
  return normalized.replace(capitalRegimeSuffix, '').trim()
}

/** Palabras vacías que el SAT antepone a los regímenes ("Régimen de las ..."); no distinguen un régimen de otro. */
const regimeStopWords = new Set(['REGIMEN', 'DE', 'DEL', 'LA', 'LAS', 'LOS', 'EL', 'Y', 'E', 'A', 'CON', 'POR', 'EN', 'PARA', 'O'])
function regimeWords(value: string): Set<string> {
  return new Set(normalizeComparableText(value).split(' ').filter(word => word && !regimeStopWords.has(word)))
}

/**
 * Código del catálogo c_RegimenFiscal para el nombre que imprime el SAT ("Régimen Simplificado de Confianza" →
 * 626). Compara palabras significativas y elige la descripción más parecida (índice de Jaccard ≥ 0.6); sin una
 * coincidencia clara devuelve `null` para no inventar un régimen.
 */
export function findTaxRegimeCodeByName(name: string): string | null {
  const words = regimeWords(name)
  if (!words.size) return null
  let bestCode: string | null = null, bestScore = 0
  for (const regime of taxRegimes) {
    const candidate = regimeWords(regime.description)
    const sharedCount = [...candidate].filter(word => words.has(word)).length
    const score = sharedCount / new Set([...candidate, ...words]).size
    if (score > bestScore) { bestScore = score; bestCode = regime.code }
  }
  return bestScore >= 0.6 ? bestCode : null
}

/** Nombre completo que registra el SAT: razón social (moral) o nombre y apellidos (física). */
export function describeTaxStatusName(record: { details: TaxStatusDetails }): string {
  const details = record.details
  if (details.legalName) return details.legalName
  return [details.firstName, details.paternalSurname, details.maternalSurname].filter(Boolean).join(' ')
}
