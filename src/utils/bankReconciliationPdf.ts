import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

export interface BankReconciliationPdfData {
  meta: {
    client: { id: number; name: string; rfc: string }
    period: { year: number; month: number }
    bank: { label: string }
    format: string
    reports: Array<{ nombre: string }>
    statementMovements: number
    reportMovements: number
    excludedOutsidePeriod?: number
    skipped: { unpaidPpd: number; nonCashDocument: number; nonBankPayment: number }
  }
  summary: {
    bankCredits: number
    bankDebits: number
    reportCredits: number
    reportDebits: number
    creditDifference: number
    debitDifference: number
    exactMatches: number
    reviewCount: number
    bankOnlyCount: number
    reportOnlyCount: number
    discrepancies: number
    coverage: number
  }
  options?: { amountTolerance: number; dateWindow: number }
  rows: Array<{
    status: 'matched' | 'review' | 'bank_only' | 'report_only'
    reason: string
    bank: null | {
      date: string
      type: string
      amount: number
      description: string
      reference: string
      trackingKey: string
    }
    reportItems: Array<{
      date: string
      amount: number
      counterpart: string
      counterpartRfc: string
      uuid: string
      folio: string
      reportName: string
      source: string
    }>
  }>
}

export function buildBankReconciliationPdf(
  result: BankReconciliationPdfData,
  generatedAt = new Date()
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const { meta, summary } = result
  const period = String(meta.period.month).padStart(2, '0') + '/' + meta.period.year
  const money = (value: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value)
  const date = (value: string) => {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
    return match ? match[3] + '/' + match[2] + '/' + match[1] : value || 'Sin fecha'
  }
  const label = {
    matched: 'Coincide',
    review: 'Revisar',
    bank_only: 'Sólo banco',
    report_only: 'Sólo reporte'
  }
  const margin = { top: 28, bottom: 18, left: 14, right: 14 }
  const styles = { fontSize: 9, cellPadding: 3, overflow: 'linebreak' as const, textColor: 30 }
  const headStyles = {
    fillColor: [30, 38, 40] as [number, number, number],
    textColor: 255,
    fontStyle: 'bold' as const
  }
  const finalY = () =>
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 28
  doc.setProperties({
    title: 'Conciliación bancaria - ' + period,
    subject: meta.client.name,
    author: 'Despacho App'
  })
  autoTable(doc, {
    startY: 28,
    margin,
    styles,
    headStyles,
    theme: 'grid',
    head: [['CLIENTE', 'PERIODO Y BANCO', 'ALCANCE']],
    body: [
      [
        meta.client.name + '\nRFC: ' + (meta.client.rfc || 'No registrado'),
        period + '\n' + meta.bank.label + ' · Archivo ' + meta.format,
        meta.statementMovements +
          ' movimientos bancarios\n' +
          meta.reportMovements +
          ' movimientos de reportes'
      ]
    ],
    columnStyles: { 0: { cellWidth: 100 }, 1: { cellWidth: 80 }, 2: { cellWidth: 89 } }
  })
  autoTable(doc, {
    startY: finalY() + 6,
    margin,
    styles,
    headStyles,
    theme: 'grid',
    head: [['RESULTADO', 'CANTIDAD', 'RESULTADO', 'CANTIDAD']],
    body: [
      [
        'Coincidencias',
        String(summary.exactMatches),
        'Requieren revisión',
        String(summary.reviewCount)
      ],
      [
        'Sólo banco',
        String(summary.bankOnlyCount),
        'Sólo reporte',
        String(summary.reportOnlyCount)
      ],
      [
        'Discrepancias',
        String(summary.discrepancies),
        'Cobertura de relaciones propuestas',
        summary.coverage + '%'
      ]
    ]
  })
  autoTable(doc, {
    startY: finalY() + 6,
    margin,
    styles,
    headStyles,
    theme: 'grid',
    head: [['IMPORTES EN MXN', 'BANCO', 'REPORTES', 'DIFERENCIA (BANCO - REPORTES)']],
    body: [
      [
        'Abonos / ingresos',
        money(summary.bankCredits),
        money(summary.reportCredits),
        money(summary.creditDifference)
      ],
      [
        'Cargos / egresos',
        money(summary.bankDebits),
        money(summary.reportDebits),
        money(summary.debitDifference)
      ]
    ]
  })
  const observations = [
    'La cobertura incluye relaciones pendientes de revisión. Este reporte documenta la comparación; no confirma pagos ni modifica los CFDI.',
    'Reportes utilizados: ' +
      (meta.reports.map((report) => report.nombre).join(' / ') || 'Sin reportes'),
    'Exclusiones: ' +
      (meta.excludedOutsidePeriod || 0) +
      ' movimientos bancarios de otros periodos; ' +
      meta.skipped.unpaidPpd +
      ' CFDI PPD sin pago en el periodo; ' +
      meta.skipped.nonBankPayment +
      ' CFDI o pagos en efectivo; ' +
      meta.skipped.nonCashDocument +
      ' documentos sin movimiento de efectivo.'
  ]
  if (result.options)
    observations.push(
      'Criterios: tolerancia de importe ' +
        money(result.options.amountTolerance) +
        '; ventana de fechas ' +
        result.options.dateWindow +
        ' días.'
    )
  autoTable(doc, {
    startY: finalY() + 6,
    margin,
    styles: { ...styles, fontSize: 8 },
    theme: 'plain',
    body: observations.map((text) => [text])
  })

  doc.addPage()
  autoTable(doc, {
    startY: 28,
    margin,
    styles: { ...styles, fontSize: 8 },
    headStyles,
    theme: 'grid',
    rowPageBreak: 'avoid',
    head: [['ESTADO', 'MOVIMIENTO BANCARIO', 'CFDI / PAGOS RELACIONADOS', 'EXPLICACIÓN']],
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 73 },
      2: { cellWidth: 100 },
      3: { cellWidth: 72 }
    },
    body: result.rows.length
      ? result.rows.map((row) => [
          label[row.status],
          row.bank
            ? [
                date(row.bank.date) +
                  ' · ' +
                  (row.bank.type === 'credit' ? 'Abono' : 'Cargo') +
                  ' · ' +
                  money(row.bank.amount),
                row.bank.description,
                'Referencia: ' + (row.bank.reference || 'Sin referencia'),
                ...(row.bank.trackingKey ? ['Rastreo: ' + row.bank.trackingKey] : [])
              ].join('\n')
            : 'Sin movimiento bancario',
          row.reportItems.length
            ? row.reportItems
                .map((item) =>
                  [
                    date(item.date) + ' · ' + money(item.amount),
                    item.counterpart,
                    'RFC: ' + (item.counterpartRfc || 'No registrado'),
                    'UUID: ' + (item.uuid || 'No registrado'),
                    ...(item.folio ? ['Folio: ' + item.folio] : []),
                    item.source,
                    'Reporte: ' + item.reportName
                  ].join('\n')
                )
                .join('\n\n')
            : 'Sin CFDI relacionado',
          row.reason
        ])
      : [['Sin movimientos', '', '', 'No hay movimientos para mostrar.']]
  })
  const pageCount = doc.getNumberOfPages()
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(30, 38, 40)
    doc.text('CONCILIACIÓN BANCARIA', 14, 14)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text(period + ' · ' + (page === 1 ? 'Resumen' : 'Detalle y continuación'), 14, 20)
    doc.setDrawColor(180)
    doc.line(14, 23, 283, 23)
    doc.setFontSize(7)
    doc.text('Despacho App · Generado: ' + generatedAt.toLocaleString('es-MX'), 14, 201)
    doc.text('Página ' + page + ' de ' + pageCount, 283, 201, { align: 'right' })
  }
  const identifier = (meta.client.rfc || String(meta.client.id)).replace(/[^a-zA-Z0-9_-]/g, '_')
  return {
    doc,
    filename:
      'Conciliacion_' +
      identifier +
      '_' +
      meta.period.year +
      '_' +
      String(meta.period.month).padStart(2, '0') +
      '.pdf'
  }
}
