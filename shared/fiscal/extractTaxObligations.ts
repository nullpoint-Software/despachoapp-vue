import type { ObligationPeriodicity } from './taxObligationSchedule'

/**
 * Obligaciones impresas en la constancia de situación fiscal (CSF), a partir del texto que extrae pdf.js
 * (2026-10-18, pedido del usuario: "el catálogo es el del SAT"). La consulta pública del SAT con el idCIF sólo trae
 * regímenes; la tabla de obligaciones sólo viene en el PDF de la constancia:
 *
 *   Obligaciones:
 *   Descripción de la Obligación | Descripción Vencimiento | Fecha Inicio | Fecha Fin
 *   Pago definitivo mensual de IVA. | A más tardar el día 17 del mes inmediato posterior al periodo que corresponda. | 01/01/2022 |
 *
 * pdf.js devuelve las celdas como texto corrido, así que:
 * 1. Se toma el texto entre "Obligaciones:" y el aviso de datos personales o la cadena original, sin encabezados de
 *    tabla ni pies de página repetidos.
 * 2. Cada renglón es "descripción + vencimiento + fecha de inicio [+ fecha de fin]": el vencimiento empieza con
 *    "A más tardar", "Conjuntamente", "Dentro de"…; la fecha de inicio cierra el renglón.
 * 3. De la descripción y el vencimiento se deduce la periodicidad y la regla (`dueMonthsAfter`, `dueDay`); lo que no
 *    se pueda deducir queda en `null` para que la persona lo elija antes de guardar.
 * Pura: no registra nada. El texto de la constancia no se guarda.
 */
export interface CertificateObligation {
  description: string; dueText: string; startsOn: string; endsOn: string | null
  periodicity: ObligationPeriodicity | null; dueMonthsAfter: number | null; dueDay: number | null
}
const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const maximumDescriptionLength = 300
const dueStartPattern = '(?:A m[aá]s tardar|Conjuntamente|Dentro de|Durante|Cuando|A partir de)'
const datePattern = '(\\d{2})/(\\d{2})/(\\d{4})'

function toIsoDate(day: string, month: string, year: string): string { return year + '-' + month + '-' + day }

/** Sección de obligaciones sin encabezados ni pies de página; '' si la constancia no la trae. */
function readObligationSection(text: string): string {
  const normalized = text.replace(/\s+/g, ' ')
  const start = normalized.search(/Obligaciones\s?:/i)
  if (start < 0) return ''
  const rest = normalized.slice(start).replace(/^Obligaciones\s?:/i, '')
  const end = rest.search(/Sus datos personales|Cadena Original|Sello Digital/i)
  return (end < 0 ? rest : rest.slice(0, end))
    .replace(/Descripci[oó]n de la Obligaci[oó]n\s+Descripci[oó]n Vencimiento\s+Fecha Inicio\s+Fecha Fin/gi, ' ')
    .replace(/P[aá]gina \[?\d+\]? de \[?\d+\]?/gi, ' ')
    .replace(/\s+/g, ' ').trim()
}

/** Periodicidad por las palabras del SAT; `null` si no es clara. */
export function inferPeriodicity(description: string, dueText: string): ObligationPeriodicity | null {
  const text = (description + ' ' + dueText).toLowerCase()
  if (/bimestral/.test(text)) return 'bimonthly'
  if (/trimestral/.test(text)) return 'quarterly'
  if (/\banual\b|ejercicio siguiente|año siguiente/.test(text)) return 'annual'
  if (/mensual|mes inmediato posterior|mes siguiente|segundo mes posterior/.test(text)) return 'monthly'
  return null
}

/**
 * Regla de vencimiento del texto del SAT. `isCompany` decide "junto con la anual" (morales: 31 de marzo; físicas:
 * 30 de abril). `null` si el texto no sigue un patrón conocido.
 */
export function inferDueRule(dueText: string, periodicity: ObligationPeriodicity | null, isCompany: boolean): { dueMonthsAfter: number; dueDay: number } | null {
  const text = dueText.toLowerCase()
  const monthPattern = months.join('|')
  if (/[uú]ltimo d[ií]a del mes (inmediato posterior|siguiente)/.test(text)) return { dueMonthsAfter: 1, dueDay: 31 }
  const nextMonth = /d[ií]a (\d{1,2}) del mes (inmediato posterior|siguiente)/.exec(text)
  if (nextMonth) return { dueMonthsAfter: 1, dueDay: Number(nextMonth[1]) }
  const secondMonth = /d[ií]a (\d{1,2}) del segundo mes (posterior|siguiente)/.exec(text)
  if (secondMonth) return { dueMonthsAfter: 2, dueDay: Number(secondMonth[1]) }
  // Fechas del año siguiente sólo tienen sentido en obligaciones anuales (el periodo termina en diciembre).
  if (periodicity === 'annual' || periodicity === null) {
    const lastDayOf = new RegExp('[uú]ltimo d[ií]a de (' + monthPattern + ') del (ejercicio|año) siguiente').exec(text)
    if (lastDayOf) return { dueMonthsAfter: months.indexOf(lastDayOf[1]!) + 1, dueDay: 31 }
    const dayOf = new RegExp('(\\d{1,2}) de (' + monthPattern + ') del (ejercicio|año) siguiente').exec(text)
    if (dayOf) return { dueMonthsAfter: months.indexOf(dayOf[2]!) + 1, dueDay: Number(dayOf[1]) }
    if (/conjuntamente con la declaraci[oó]n anual/.test(text)) return isCompany ? { dueMonthsAfter: 3, dueDay: 31 } : { dueMonthsAfter: 4, dueDay: 30 }
  }
  return null
}

export function extractTaxObligations(text: string, isCompany: boolean): CertificateObligation[] {
  const section = readObligationSection(text)
  if (!section) return []
  const rowPattern = new RegExp('(.+?)\\s+(' + dueStartPattern + '.*?)\\s+' + datePattern + '(?:\\s+' + datePattern + ')?(?=\\s|$)', 'giu')
  const obligations: CertificateObligation[] = []
  for (const match of section.matchAll(rowPattern)) {
    const description = match[1]!.trim().slice(0, maximumDescriptionLength), dueText = match[2]!.trim()
    if (!description) continue
    const periodicity = inferPeriodicity(description, dueText)
    const rule = inferDueRule(dueText, periodicity, isCompany)
    obligations.push({ description, dueText, startsOn: toIsoDate(match[3]!, match[4]!, match[5]!), endsOn: match[6] ? toIsoDate(match[6], match[7]!, match[8]!) : null,
      periodicity, dueMonthsAfter: rule?.dueMonthsAfter ?? null, dueDay: rule?.dueDay ?? null })
  }
  return obligations
}
