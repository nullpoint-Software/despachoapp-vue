import type { ClientProfile } from '../contracts/clientProfile'
import { isFiscalPostalCode, isRegimeForRfc } from '../contracts/clientProfile'
import type { TaxStatusDetails, TaxStatusProfile, TaxStatusRecord } from '../contracts/taxStatus'
import { describeTaxStatusName, findTaxRegimeCodeByName, normalizeTaxpayerName } from './compareTaxStatusWithProfile'
import { describeTaxRegime } from './taxRegimes'

/**
 * Qué cambiaría en la ficha del cliente si se aplican los datos de la CSF. Funciones puras.
 *
 * Historia: nació como "Actualizar ficha con estos datos" del cajón de la CSF (2026-10-11). Desde el 2026-10-13 la
 * consulta vive en la ficha como autocompletado ([[changes/CSF-FORM-AUTOFILL]]): `planTaxStatusAutofill` llena el
 * borrador del formulario (alta o edición) y la persona guarda con el paso "Revisar" normal de Clientes
 * (`clients.create` / `clients.update`, revisión y auditoría en el Host).
 *
 * Reglas:
 * - **Nunca cambia el RFC.** Si el resultado se consultó con otro RFC que el actual del perfil, el plan queda
 *   `isStale` y no propone nada: hay que volver a consultar.
 * - **Nombre:** el del SAT (razón social, o nombre y apellidos) si difiere del de Fiscenix sin contar acentos,
 *   puntuación ni el régimen de capital (la misma regla de la comparación). Se recorta a 100 caracteres, el máximo
 *   de la ficha.
 * - **Régimen:** los nombres del SAT se convierten a código con `findTaxRegimeCodeByName` y se quedan sólo los que
 *   aplican al tipo de persona del RFC. Si el régimen de la ficha ya está entre ellos, no cambia. Si hay uno, se
 *   propone; si hay varios, la persona elige (`regimeOptions`, `selectedRegimeCode`) y sin elección no se propone.
 *   Con el principal resuelto, los demás regímenes del SAT se proponen como adicionales (2026-10-18).
 * - **CP fiscal:** el del domicilio fiscal del SAT, si tiene 5 dígitos y difiere del de la ficha.
 */
export type ProfileUpdateField = 'displayName' | 'taxRegime' | 'additionalTaxRegimes' | 'fiscalPostalCode'
export interface ProfileUpdateChange { field: ProfileUpdateField; label: string; currentValue: string; proposedValue: string; currentText: string; proposedText: string }
export interface TaxStatusProfileUpdatePlan {
  /** El resultado se consultó con otro RFC: no se propone nada. */
  isStale: boolean
  changes: ProfileUpdateChange[]
  /** Códigos de régimen del SAT que aplican al RFC; con dos o más, la persona elige uno. */
  regimeOptions: string[]
  /** Hay varios regímenes posibles, el de la ficha no está entre ellos y aún no se eligió. */
  needsRegimeChoice: boolean
}

/** Longitud máxima del nombre o razón social en la ficha (`displayName`). */
const maximumDisplayNameLength = 100

export function planTaxStatusProfileUpdate(input: { record: Pick<TaxStatusRecord, 'details' | 'queriedRfc'>; profile: TaxStatusProfile; selectedRegimeCode: string | null; additionalTaxRegimes?: string[] }): TaxStatusProfileUpdatePlan {
  const { record, profile } = input
  if (!profile.rfc || record.queriedRfc !== profile.rfc) return { isStale: true, changes: [], regimeOptions: [], needsRegimeChoice: false }
  const details = record.details
  const changes: ProfileUpdateChange[] = []

  const satName = describeTaxStatusName(record).trim().slice(0, maximumDisplayNameLength)
  if (satName && normalizeTaxpayerName(profile.displayName, details.capitalRegime) !== normalizeTaxpayerName(satName, details.capitalRegime)) {
    changes.push({ field: 'displayName', label: 'Nombre o razón social', currentValue: profile.displayName, proposedValue: satName, currentText: profile.displayName, proposedText: satName })
  }

  // Códigos únicos, en el orden del SAT, que corresponden al tipo de persona del RFC (12 = moral, 13 = física).
  const regimeOptions = [...new Set(details.regimes.map(regime => findTaxRegimeCodeByName(regime.name)).filter((code): code is string => code !== null))]
    .filter(code => isRegimeForRfc(code, profile.rfc))
  const isCurrentRegimeListed = Boolean(profile.taxRegime) && regimeOptions.includes(profile.taxRegime)
  let proposedRegime: string | null = null, needsRegimeChoice = false
  if (!isCurrentRegimeListed && regimeOptions.length === 1) proposedRegime = regimeOptions[0]!
  else if (!isCurrentRegimeListed && regimeOptions.length > 1) {
    if (input.selectedRegimeCode && regimeOptions.includes(input.selectedRegimeCode)) proposedRegime = input.selectedRegimeCode
    else needsRegimeChoice = true
  }
  if (proposedRegime && proposedRegime !== profile.taxRegime) {
    changes.push({ field: 'taxRegime', label: 'Régimen fiscal', currentValue: profile.taxRegime, proposedValue: proposedRegime,
      currentText: profile.taxRegime ? describeTaxRegime(profile.taxRegime) : '', proposedText: describeTaxRegime(proposedRegime) })
  }
  // Regímenes adicionales (2026-10-18): con el principal resuelto, los demás del SAT pasan a adicionales.
  const mainRegime = proposedRegime ?? (isCurrentRegimeListed ? profile.taxRegime : null)
  const currentAdditional = input.additionalTaxRegimes ?? []
  if (mainRegime && regimeOptions.length > 1) {
    const proposedAdditional = regimeOptions.filter(code => code !== mainRegime)
    if ([...proposedAdditional].sort().join() !== [...currentAdditional].sort().join()) {
      changes.push({ field: 'additionalTaxRegimes', label: 'Regímenes adicionales', currentValue: currentAdditional.join(','), proposedValue: proposedAdditional.join(','),
        currentText: currentAdditional.map(describeTaxRegime).join(' / '), proposedText: proposedAdditional.map(describeTaxRegime).join(' / ') })
    }
  }

  const satPostalCode = details.address.postalCode?.trim() ?? ''
  if (isFiscalPostalCode(satPostalCode) && satPostalCode !== profile.fiscalPostalCode) {
    changes.push({ field: 'fiscalPostalCode', label: 'CP fiscal', currentValue: profile.fiscalPostalCode, proposedValue: satPostalCode, currentText: profile.fiscalPostalCode, proposedText: satPostalCode })
  }
  return { isStale: false, changes, regimeOptions, needsRegimeChoice }
}

/**
 * Aplica los cambios del plan a la ficha completa vigente (leída del Host con su revisión). Conserva RFC, contacto,
 * correo y teléfono tal como están; devuelve el nombre y el perfil que se envían en la actualización normal.
 */
export function applyTaxStatusProfileUpdate(current: { displayName: string; profile: ClientProfile }, changes: ProfileUpdateChange[]): { displayName: string; profile: ClientProfile } {
  let displayName = current.displayName
  const profile = { ...current.profile }
  for (const change of changes) {
    if (change.field === 'displayName') displayName = change.proposedValue
    else if (change.field === 'taxRegime') profile.taxRegime = change.proposedValue
    else if (change.field === 'additionalTaxRegimes') profile.additionalTaxRegimes = change.proposedValue.split(',').filter(Boolean)
    else profile.fiscalPostalCode = change.proposedValue
  }
  return { displayName, profile }
}

/**
 * Autocompletar la ficha con la CSF (2026-10-13): plan y borrador resultante a partir de los datos del SAT.
 *
 * - `savedRfc` es el RFC guardado de un cliente existente ('' al dar de alta o si la ficha no tenía RFC). **Nunca se
 *   cambia:** si existe y no es el consultado, el plan queda `isStale` y el borrador no cambia; si existe, el RFC del
 *   borrador se deja como esté. Sin RFC guardado, el borrador toma el RFC consultado.
 * - Nombre, régimen (con elección si hay varios) y CP fiscal siguen las reglas de `planTaxStatusProfileUpdate`,
 *   comparando contra el borrador actual con el RFC consultado (de él depende si el régimen es de persona moral o física).
 * - Contacto, correo y teléfono no se tocan: la CSF no los trae para la ficha.
 */
export function planTaxStatusAutofill(input: { details: TaxStatusDetails; queriedRfc: string; savedRfc: string; displayName: string; profile: ClientProfile; selectedRegimeCode: string | null }): { plan: TaxStatusProfileUpdatePlan; next: { displayName: string; profile: ClientProfile } } {
  const current = { displayName: input.displayName, profile: input.profile }
  if (input.savedRfc && input.savedRfc !== input.queriedRfc) return { plan: { isStale: true, changes: [], regimeOptions: [], needsRegimeChoice: false }, next: current }
  const plan = planTaxStatusProfileUpdate({ record: { details: input.details, queriedRfc: input.queriedRfc },
    profile: { displayName: input.displayName, rfc: input.queriedRfc, taxRegime: input.profile.taxRegime, fiscalPostalCode: input.profile.fiscalPostalCode }, selectedRegimeCode: input.selectedRegimeCode, additionalTaxRegimes: input.profile.additionalTaxRegimes })
  const next = applyTaxStatusProfileUpdate(current, plan.changes)
  return { plan, next: { displayName: next.displayName, profile: { ...next.profile, rfc: input.savedRfc ? input.profile.rfc : input.queriedRfc } } }
}
