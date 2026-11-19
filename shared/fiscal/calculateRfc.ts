/**
 * Calculadora de RFC (pedido del usuario, 2026-10-17: "verificar si realmente existe ese RFC con una calculadora de RFC
 * para encontrar más rápido"). Propone el RFC de una persona física o moral con el algoritmo público del SAT; después la
 * persona lo comprueba con la «Validación de RFC» del SAT ([[../../docs/modules/SAT-PORTAL#RFC sin ficha]]).
 *
 * Reglas (las mismas que las calculadoras conocidas, p. ej. rfc-facil):
 * - **Física (13):** primera letra y primera vocal interna del apellido paterno, inicial del materno e inicial del
 *   nombre (se salta MARÍA / JOSÉ si hay otro nombre). Casos: sin paterno, sin materno o paterno de 1–2 letras. Se quitan
 *   acentos y partículas (DE, LA, DEL, Y…). Si las 4 letras forman una palabra altisonante, la última se cambia por X.
 * - **Moral (12):** iniciales de las tres primeras palabras de la razón social (con dos palabras: inicial + dos letras;
 *   con una: tres letras), sin el tipo de sociedad (S.A. DE C.V., S.C.…) ni palabras vacías (DE, LA, Y, COMPAÑÍA…).
 * - **Fecha:** AAMMDD de nacimiento o de constitución.
 * - **Homoclave:** del nombre completo, cada carácter a dos dígitos, suma de pares × dígito, módulo 1000 → dos
 *   caracteres en base 34. **Es probable, no segura:** el SAT cambia la homoclave a los homónimos; por eso se valida.
 * - **Dígito verificador:** módulo 11 sobre los 12 caracteres (la moral se rellena con un espacio al inicio).
 * Función pura; no consulta al SAT ni guarda nada.
 */
export type RfcPerson =
  { kind: 'natural'; name: string; firstLastName: string; secondLastName: string; birthDate: string } |
  { kind: 'juristic'; legalName: string; creationDate: string }

const naturalParticles = new Set(['DE', 'LA', 'LAS', 'MC', 'VON', 'DEL', 'LOS', 'Y', 'MAC', 'VAN', 'MI', 'DA', 'DI', 'DAS', 'DER', 'DD', 'DES', 'DU', 'VONDER'])
const skippedFirstNames = new Set(['MARIA', 'MA', 'JOSE', 'J'])
const forbiddenWords = new Set(['BUEI', 'BUEY', 'CACA', 'CACO', 'CAGA', 'CAGO', 'CAKA', 'CAKO', 'COGE', 'COGI', 'COJA', 'COJE', 'COJI', 'COJO', 'COLA', 'CULO', 'FALO', 'FETO', 'GETA', 'GUEI', 'GUEY', 'JETA', 'JOTO', 'KACA', 'KACO', 'KAGA', 'KAGO', 'KAKA', 'KAKO', 'KOGE', 'KOGI', 'KOJA', 'KOJE', 'KOJI', 'KOJO', 'KOLA', 'KULO', 'LILO', 'LOCA', 'LOCO', 'LOKA', 'LOKO', 'MAME', 'MAMO', 'MEAR', 'MEAS', 'MEON', 'MIAR', 'MION', 'MOCO', 'MOKO', 'MULA', 'MULO', 'NACA', 'NACO', 'PEDA', 'PEDO', 'PENE', 'PIPI', 'PITO', 'POPO', 'PUTA', 'PUTO', 'QULO', 'RATA', 'ROBA', 'ROBE', 'ROBO', 'RUIN', 'SENO', 'TETA', 'VACA', 'VAGA', 'VAGO', 'VAKA', 'VUEI', 'VUEY', 'WUEI', 'WUEY'])
/** Tipos de sociedad que se quitan del final de la razón social (ya sin puntos ni comas). */
const companyTypes = ['S EN NC', 'S EN C POR A', 'S EN C', 'S DE RL DE CV', 'S DE RL', 'SAPI DE CV', 'SAB DE CV', 'SA DE CV', 'SA', 'SC', 'SCL', 'SCS', 'SNC', 'AC', 'A EN P', 'SCP', 'SAS', 'SOFOM ENR', 'SOFOM ER', 'SOFOM', 'MI', 'IAP', 'ABP']
const juristicIgnoredWords = new Set(['EL', 'LA', 'DE', 'LOS', 'LAS', 'Y', 'DEL', 'MI', 'POR', 'CON', 'AL', 'SUS', 'E', 'PARA', 'EN', 'MC', 'VON', 'MAC', 'VAN', 'COMPANIA', 'COMPAÑIA', 'CIA', 'SOCIEDAD', 'SOC', 'COMPANY', 'CO', 'COOPERATIVA', 'COOP', 'THE', 'OF', 'AND', 'A', 'U'])
const homoclaveDigits = '123456789ABCDEFGHIJKLMNPQRSTUVWXYZ'
const verificationValues = '0123456789ABCDEFGHIJKLMN&OPQRSTUVWXYZ Ñ'

/** Mayúsculas sin acentos (conserva la Ñ), sin signos salvo `&`, espacios simples. */
export function normalizeRfcText(value: string): string {
  return value.toLocaleUpperCase('es-MX').normalize('NFD').replace(/Ñ/g, 'Ñ').replace(/[̀-ͯ]/g, '')
    .replace(/[.'´`]/g, '').replace(/[^A-Z0-9Ñ& ]/g, ' ').replace(/\s+/g, ' ').trim()
}

function withoutParticles(value: string): string {
  return normalizeRfcText(value).split(' ').filter(word => word && !naturalParticles.has(word)).join(' ')
}

/** AAMMDD de una fecha `AAAA-MM-DD`; lanza si no es una fecha real. */
function dateCode(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)
  const date = match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : null
  if (!match || !date || date.toISOString().slice(0, 10) !== isoDate) throw new Error('Invalid RFC date')
  return match[1]!.slice(2) + match[2] + match[3]
}

function naturalLetters(person: Extract<RfcPerson, { kind: 'natural' }>): string {
  const names = withoutParticles(person.name).split(' ').filter(Boolean)
  const name = (names.length > 1 && skippedFirstNames.has(names[0]!) ? names.slice(1) : names).join(' ')
  const first = withoutParticles(person.firstLastName), second = withoutParticles(person.secondLastName)
  if (!name) throw new Error('Missing RFC name')
  if (!first && !second) throw new Error('Missing RFC last name')
  if (!first) return second.slice(0, 2) + name.slice(0, 2)
  if (!second) return first.slice(0, 2) + name.slice(0, 2)
  if (first.length <= 2) return first[0]! + second[0]! + name.slice(0, 2)
  const innerVowel = /[AEIOU]/.exec(first.slice(1))?.[0] ?? 'X'
  return first[0]! + innerVowel + second[0]! + name[0]!
}

function juristicLetters(legalName: string): string {
  let text = normalizeRfcText(legalName)
  // El tipo de sociedad va al final (p. ej. "…, S.A. DE C.V."); se quita el más largo que coincida.
  for (const type of companyTypes) if (text === type || text.endsWith(' ' + type)) { text = text.slice(0, -type.length).trim(); break }
  const words = text.split(' ').filter(word => word && !juristicIgnoredWords.has(word))
  if (!words.length) throw new Error('Missing RFC legal name')
  if (words.length >= 3) return words[0]![0]! + words[1]![0]! + words[2]![0]!
  if (words.length === 2) return words[0]![0]! + words[1]!.slice(0, 2).padEnd(2, 'X')
  return words[0]!.slice(0, 3).padEnd(3, 'X')
}

/** Homoclave (2 caracteres) del nombre completo. */
export function calculateHomoclave(fullName: string): string {
  const characterCode = (character: string): string => {
    if (character === ' ') return '00'
    if (character === '&') return '10'
    if (character === 'Ñ') return '40'
    if (/\d/.test(character)) return '0' + character
    const index = character.charCodeAt(0) - 65
    // A–I → 11–19, J–R → 21–29, S–Z → 32–39 (tabla del SAT).
    return String(index < 9 ? 11 + index : index < 18 ? 12 + index : 14 + index)
  }
  const code = '0' + [...normalizeRfcText(fullName)].map(characterCode).join('')
  let sum = 0
  for (let index = 0; index < code.length - 1; index++) sum += Number(code.slice(index, index + 2)) * Number(code[index + 1])
  const lastThree = sum % 1000
  return homoclaveDigits[Math.floor(lastThree / 34)]! + homoclaveDigits[lastThree % 34]!
}

/** Dígito verificador de los primeros 11 (moral) o 12 (física) caracteres. */
export function calculateVerificationDigit(rfcWithoutDigit: string): string {
  const padded = rfcWithoutDigit.padStart(12, ' ')
  const sum = [...padded].reduce((total, character, index) => total + verificationValues.indexOf(character) * (13 - index), 0)
  const remainder = sum % 11
  return remainder === 0 ? '0' : remainder === 1 ? 'A' : String(11 - remainder)
}

/** RFC completo propuesto (homoclave probable). Lanza si faltan datos o la fecha no es válida. */
export function calculateRfc(person: RfcPerson): string {
  let base: string, fullName: string
  if (person.kind === 'natural') {
    const letters = naturalLetters(person)
    base = (forbiddenWords.has(letters) ? letters.slice(0, 3) + 'X' : letters) + dateCode(person.birthDate)
    fullName = [person.firstLastName, person.secondLastName, person.name].join(' ')
  } else {
    base = juristicLetters(person.legalName) + dateCode(person.creationDate)
    fullName = person.legalName
  }
  const withHomoclave = base + calculateHomoclave(fullName)
  return withHomoclave + calculateVerificationDigit(withHomoclave)
}
