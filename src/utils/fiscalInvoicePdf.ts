import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import QRCode from 'qrcode'
import { readCfdiVerification } from './cfdiVerification'

export async function buildInvoicePdf(data: Record<string, any>, logo?: string, options: { xml?: string; paymentFormLabel?: string } = {}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const number = (value: unknown) => Number(value || 0)
  const currency = data.moneda || 'MXN'
  const verification = readCfdiVerification(options.xml || '', data.uuid)
  const qrImage = verification?.url ? await QRCode.toDataURL(verification.url, { errorCorrectionLevel: 'M', margin: 4, width: 512 }) : null
  const methodNames: Record<string, string> = { PUE: 'Pago en una sola exhibición', PPD: 'Pago en parcialidades o diferido' }
  const currencyName = new Intl.DisplayNames('es-MX', { type: 'currency' }).of(currency) || currency
  const money = (value: unknown) => new Intl.NumberFormat('es-MX', {
    style: 'currency', currency, maximumFractionDigits: 2
  }).format(number(value))
  const text = (value: unknown) => String(value || 'No especificado')
  const type = ({ I: 'Ingreso', E: 'Nota de crédito', P: 'Pago', T: 'Traslado', N: 'Nómina' } as Record<string, string>)[data.tipo_comprobante] || text(data.tipo_comprobante)
  const finalY = () => Number((doc as any).lastAutoTable?.finalY || 38)
  const margin = { top: 38, bottom: 22, left: 14, right: 14 }

  autoTable(doc, {
    startY: 38, margin, theme: 'plain',
    head: [['EMISOR', 'RECEPTOR']],
    body: [[`${text(data.emisor_nombre)}\nRFC: ${text(data.emisor_rfc)}`, `${text(data.receptor_nombre)}\nRFC: ${text(data.receptor_rfc)}`]],
    styles: { fontSize: 9, cellPadding: 4, overflow: 'linebreak', textColor: [20, 20, 19] },
    headStyles: { fontSize: 7, fillColor: [20, 20, 19], textColor: [255, 255, 255] },
    columnStyles: { 0: { cellWidth: 91 }, 1: { cellWidth: 91 } },
    rowPageBreak: 'avoid'
  })
  autoTable(doc, {
    startY: finalY() + 4, margin, theme: 'grid',
    body: [
      [{ content: 'FOLIO FISCAL (UUID)', colSpan: 3 }],
      [{ content: text(data.uuid), colSpan: 3 }],
      ['FECHA DE EMISIÓN', 'SERIE / FOLIO', 'MONEDA'],
      [text(data.fecha_emision).replace('T', ' ').replace(/\.\d+Z$/, ''), [data.serie, data.folio].filter(Boolean).join(' / ') || 'No especificado', currency + ' - ' + currencyName],
      ['MÉTODO DE PAGO', 'FORMA DE PAGO', 'TIPO DE CAMBIO'],
      [data.metodo_pago ? data.metodo_pago + ' - ' + (methodNames[data.metodo_pago] || 'Método no identificado') : 'No especificado', options.paymentFormLabel || text(data.forma_pago), data.tipo_cambio || (currency === 'MXN' ? '1' : 'No especificado')]
    ],
    didParseCell: (cell) => {
      if ([0, 2, 4].includes(cell.row.index)) {
        cell.cell.styles.fillColor = [20, 20, 19]
        cell.cell.styles.textColor = [255, 255, 255]
        cell.cell.styles.fontStyle = 'bold'
        cell.cell.styles.fontSize = 7
      }
    },
    styles: { fontSize: 8, cellPadding: 3, lineColor: [210, 210, 207], lineWidth: 0.2, overflow: 'linebreak' },
    columnStyles: { 0: { cellWidth: 60.67 }, 1: { cellWidth: 60.66 }, 2: { cellWidth: 60.67 } },
    rowPageBreak: 'avoid'
  })
  autoTable(doc, {
    startY: finalY() + 7, margin,
    head: [['CONCEPTO', 'CANT.', 'UNIDAD', 'V. UNITARIO', 'DESCUENTO', 'IMPORTE']],
    body: (data.concepts || []).map((concept: Record<string, any>) => [
      `${text(concept.descripcion)}${concept.clave_prod_serv ? `\nClave SAT: ${concept.clave_prod_serv}` : ''}`,
      new Intl.NumberFormat('es-MX', { maximumFractionDigits: 6 }).format(number(concept.cantidad)),
      concept.unidad || concept.clave_unidad || '-', money(concept.valor_unitario), money(concept.descuento), money(concept.importe)
    ]),
    styles: { fontSize: 8, cellPadding: 2.5, overflow: 'linebreak', valign: 'top' },
    headStyles: { fillColor: [20, 20, 19], textColor: [255, 255, 255], fontSize: 7 },
    alternateRowStyles: { fillColor: [244, 242, 236] },
    columnStyles: { 0: { cellWidth: 70 }, 1: { cellWidth: 14, halign: 'right' }, 2: { cellWidth: 20 }, 3: { cellWidth: 26, halign: 'right' }, 4: { cellWidth: 26, halign: 'right' }, 5: { cellWidth: 26, halign: 'right' } },
    rowPageBreak: 'avoid'
  })
  // Keep the verification QR beside the totals, on the same page.
  let totalsY = finalY() + 6
  if (totalsY + 62 > 275) {
    doc.addPage()
    totalsY = 38
  }
  const totalsPage = doc.getNumberOfPages()
  // Display the amounts stored in the XML; do not recalculate its total.
  autoTable(doc, {
    startY: totalsY, margin: { ...margin, left: 104 }, tableWidth: 92,
    theme: 'plain', pageBreak: 'avoid',
    body: [
      ['Subtotal', money(data.subtotal)],
      ['Descuento', money(data.descuento)],
      ['Impuestos trasladados', money(data.total_impuestos_trasladados)],
      ['Impuestos retenidos', money(data.total_impuestos_retenidos)]
    ],
    foot: [[`TOTAL ${currency}`, money(data.total)]],
    showFoot: 'lastPage',
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 0: { cellWidth: 52 }, 1: { cellWidth: 40, halign: 'right' } },
    footStyles: { fillColor: [20, 20, 19], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 11 }
  })
  const totalsEnd = finalY()
  doc.setPage(totalsPage)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(20, 20, 19)
  doc.text('VERIFICACIÓN DEL SAT', 59, totalsY + 4, { align: 'center' })
  if (qrImage) {
    doc.addImage(qrImage, 'PNG', 38, totalsY + 7, 42, 42)
    doc.link(38, totalsY + 7, 42, 42, { url: verification!.url })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.text('Escanea para verificar este CFDI', 59, totalsY + 54, { align: 'center' })
  } else {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text(doc.splitTextToSize('QR no disponible: faltan datos del timbre en el XML original.', 78), 59, totalsY + 13, { align: 'center' })
  }
  doc.setPage(doc.getNumberOfPages())
  const seals = [
    ['SELLO DIGITAL DEL CFDI | CERTIFICADO: ' + (verification?.certificate || 'No disponible'), verification?.issuerSeal || 'No disponible en el XML original'],
    ['SELLO DIGITAL DEL SAT | CERTIFICADO: ' + (verification?.satCertificate || 'No disponible'), verification?.satSeal || 'No disponible en el XML original']
  ]
  let sealY = Math.max(totalsEnd, totalsY + 58) + 6
  for (const [title, seal] of seals) {
    autoTable(doc, {
      startY: sealY, margin, theme: 'plain', head: [[title]], body: [[seal]],
      styles: { font: 'courier', fontSize: 6.5, cellPadding: 3, overflow: 'linebreak' },
      headStyles: { font: 'helvetica', fontSize: 7, fillColor: [20, 20, 19], textColor: [255, 255, 255] },
      pageBreak: 'avoid'
    })
    sealY = finalY() + 4
  }
  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page)
    if (logo) {
      const properties = doc.getImageProperties(logo)
      const scale = Math.min(44 / properties.width, 16 / properties.height)
      doc.addImage(logo, 'PNG', 14, 10, properties.width * scale, properties.height * scale)
    }
    doc.setTextColor(20, 20, 19)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(15)
    doc.text('Representación del CFDI', 196, 16, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(type, 196, 23, { align: 'right' })
    doc.setDrawColor(20, 20, 19)
    doc.line(14, 31, 196, 31)
    doc.setDrawColor(210, 210, 207)
    doc.line(14, 279, 196, 279)
    doc.setFontSize(7)
    doc.text('Representación de los datos del XML importado', 14, 284)
    doc.text(`${page} / ${pages}`, 196, 284, { align: 'right' })
    doc.setFontSize(6.5)
    doc.text(`UUID: ${text(data.uuid)}`, 14, 289)
  }
  return doc
}
