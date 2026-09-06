export interface CfdiVerification {
  url: string
  issuerSeal: string
  satSeal: string
  certificate: string
  satCertificate: string
}

export function readCfdiVerification(xml: string, expectedUuid: string): CfdiVerification | null {
  if (!xml) return null
  const document = new DOMParser().parseFromString(xml, 'application/xml')
  if (document.getElementsByTagName('parsererror').length) throw new Error('El XML del CFDI no es válido.')
  const root = document.documentElement
  if (root.localName !== 'Comprobante') throw new Error('El XML no corresponde a un CFDI.')
  const stamp = document.getElementsByTagNameNS('http://www.sat.gob.mx/TimbreFiscalDigital', 'TimbreFiscalDigital')[0]
  if (!stamp) return null
  const uuid = stamp.getAttribute('UUID') || ''
  if (uuid.toUpperCase() !== String(expectedUuid).toUpperCase()) throw new Error('El folio del XML no coincide con el comprobante.')
  const issuer = root.getElementsByTagNameNS(root.namespaceURI || '*', 'Emisor')[0]
  const receiver = root.getElementsByTagNameNS(root.namespaceURI || '*', 'Receptor')[0]
  const issuerSeal = root.getAttribute('Sello') || stamp.getAttribute('SelloCFD') || ''
  const total = root.getAttribute('Total') || ''
  const issuerRfc = issuer?.getAttribute('Rfc') || ''
  const receiverRfc = receiver?.getAttribute('Rfc') || ''
  let url = ''
  if (issuerSeal.length >= 8 && issuerRfc && receiverRfc && /^\d{1,18}(\.\d{1,6})?$/.test(total)) {
    // Preserve the decimal string from the XML, including large amounts.
    const [integer, decimals = ''] = total.split('.')
    const fraction = decimals.replace(/0+$/, '')
    const normalizedTotal = integer.replace(/^0+(?=\d)/, '') + (fraction ? `.${fraction}` : '')
    const params = new URLSearchParams({ id: uuid, re: issuerRfc, rr: receiverRfc, tt: normalizedTotal, fe: issuerSeal.slice(-8) })
    url = `https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?${params}`
  }
  return { url, issuerSeal, satSeal: stamp.getAttribute('SelloSAT') || '', certificate: root.getAttribute('NoCertificado') || '', satCertificate: stamp.getAttribute('NoCertificadoSAT') || '' }
}
