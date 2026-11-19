import type { TaxStatusDetails, TaxStatusOutcome } from '../../../shared/contracts/taxStatus'
import type { TaxStatusQrMatch } from '../../../shared/fiscal/parseTaxStatusQrText'

/**
 * Textos y tonos de la consulta de la constancia en el autocompletado de la ficha (TaxStatusAutofillDialog, 2026-10-13;
 * antes, el cajón de la CSF). Viven fuera de la plantilla para que la vista no decida reglas y para probarlos sin
 * montar el componente. Los tonos acompañan siempre a un texto.
 */
export type NoticeTone = 'info' | 'success' | 'warning' | 'error'
export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'error'

/** Mensaje de cada resultado de intento: qué pasó y qué hacer. */
export function describeTaxStatusOutcome(outcome: TaxStatusOutcome): { title: string; text: string; tone: NoticeTone } {
  switch (outcome) {
    case 'found': return { title: 'Constancia consultada', text: 'El SAT devolvió los datos vigentes. Revísalos y usa los que quieras en la ficha.', tone: 'success' }
    case 'notFound': return { title: 'El SAT no devolvió datos', text: 'El idCIF no corresponde al RFC (o ya no existe). Revisa el RFC y el idCIF, o usa una constancia reciente.', tone: 'warning' }
    case 'missingRfc': return { title: 'El cliente no tiene RFC', text: 'Escribe el RFC para poder consultar.', tone: 'warning' }
    case 'certificateMissing': return { title: 'No hay constancia en Documentos', text: 'Sube la constancia en Documentos, elige su PDF aquí o escribe el idCIF a mano.', tone: 'warning' }
    case 'certificateUnreadable': return { title: 'No se pudo leer la constancia', text: 'El PDF no se pudo abrir o está dañado. Sube otra constancia o escribe el idCIF a mano.', tone: 'warning' }
    case 'idCifNotFound': return { title: 'La constancia no trae un idCIF legible', text: 'Puede ser un PDF escaneado o de otro formato. Elige el PDF aquí para leer su código QR, escanéalo con «Escanear QR» o escribe los 11 dígitos a mano.', tone: 'warning' }
    case 'certificateRfcMismatch': return { title: 'La constancia es de otro RFC', text: 'El RFC impreso en la constancia no es el del perfil. Revisa el RFC del cliente o sube su constancia.', tone: 'warning' }
    case 'documentsUnavailable': return { title: 'El expediente no está disponible', text: 'El Host no puede leer los documentos ahora (clave sin configurar u ocupado). Intenta en un momento o escribe el idCIF a mano.', tone: 'warning' }
    case 'satUnavailable': return { title: 'No fue posible consultar al SAT', text: 'Falla de red o el SAT no respondió a tiempo. Intenta más tarde; la ficha no cambió.', tone: 'error' }
    case 'satUnreadable': return { title: 'El SAT respondió algo que no se pudo leer', text: 'Puede estar en mantenimiento o haber cambiado su página. Intenta más tarde; la ficha no cambió.', tone: 'error' }
    case 'accessRevoked': return { title: 'No se guardó el resultado', text: 'Tu permiso o tu asignación cambiaron durante la consulta.', tone: 'error' }
  }
}

/** Sello de "Situación del contribuyente": activo en verde, suspendido en ámbar, cancelado o baja en rojo. */
export function describeTaxpayerStatusTone(status: string | null): BadgeTone {
  if (!status) return 'neutral'
  const normalized = status.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase()
  if (/CANCELAD|BAJA|NO LOCALIZADO|FALLECI/.test(normalized)) return 'error'
  if (/SUSPENDID/.test(normalized)) return 'warning'
  if (/ACTIVO|REACTIVAD/.test(normalized)) return 'success'
  return 'info'
}

/** Renglones de "Domicilio fiscal"; los vacíos se omiten. */
export function listAddressFacts(details: TaxStatusDetails): { label: string; value: string }[] {
  const address = details.address
  const facts: [string, string | null][] = [['Código postal', address.postalCode], ['Entidad federativa', address.state], ['Municipio o alcaldía', address.municipality],
    ['Colonia', address.neighborhood], ['Vialidad', [address.roadType, address.roadName].filter(Boolean).join(' ') || null], ['Número exterior', address.exteriorNumber],
    ['Número interior', address.interiorNumber], ['Correo electrónico', address.emailAddress], ['Administración local', address.localOffice]]
  return facts.filter((fact): fact is [string, string] => Boolean(fact[1])).map(([label, value]) => ({ label, value }))
}

/**
 * Por qué un código QR no sirve para el idCIF del cliente (lector QR, 2026-10-11). `clientRfc` es el del perfil;
 * con `otherRfc` se muestran los dos para que la persona vea que es la constancia de otro contribuyente.
 */
export function describeTaxStatusQrRejection(match: Extract<TaxStatusQrMatch, { status: 'rejected' }>, clientRfc: string): string {
  switch (match.reason) {
    case 'otherRfc': return 'El código es de la constancia del RFC ' + (match.qrRfc ?? '') + ', no del cliente (' + clientRfc + '). No se usó su idCIF.'
    case 'empty': case 'notUrl': case 'notSatValidator': return 'Ese código QR no es el del validador del SAT. Usa el QR impreso en la constancia de situación fiscal.'
    case 'notTaxStatusCertificate': return 'Es un código del SAT, pero no de una constancia de situación fiscal (puede ser de una opinión de cumplimiento o de un CFDI).'
    case 'missingData': case 'invalidIdCif': case 'invalidRfc': return 'El código QR no trae un idCIF de 11 dígitos y un RFC válidos. Prueba con otra foto o escribe el idCIF a mano.'
  }
}
