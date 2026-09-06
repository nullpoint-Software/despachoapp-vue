const test = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  vm = require('node:vm'),
  ts = require('typescript')
const compiled = ts.transpileModule(fs.readFileSync('src/utils/bankReconciliationPdf.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText
const ctx = { exports: {}, require }
vm.runInNewContext(compiled, ctx)
test('genera un reporte paginado con todas las filas, criterios y nombres de archivo seguros', () => {
  const statuses = ['matched', 'review', 'bank_only', 'report_only']
  const rows = Array.from({ length: 32 }, (_, i) => ({
    status: statuses[i % 4],
    reason: 'Revisión de referencia e importe. Movimiento de prueba ' + i,
    bank:
      i % 4 === 3
        ? null
        : {
            date: '2026-07-02',
            type: 'credit',
            amount: 1250,
            description:
              'Transferencia de Servicios Administrativos del Centro y Asociados, S.A. de C.V.',
            reference: 'REF-' + i,
            trackingKey: 'RASTREO-1234567890'
          },
    reportItems:
      i % 4 === 2
        ? []
        : Array.from({ length: i === 1 ? 3 : 1 }, (_, j) => ({
            date: '2026-07-02',
            amount: 1250,
            counterpart: 'Servicios Administrativos del Centro y Asociados',
            counterpartRfc: 'AAA010101AAA',
            uuid: '12345678-1234-1234-1234-123456789012',
            folio: String(i) + '-' + j,
            reportName: 'Ingresos julio 2026',
            source: 'CFDI PUE'
          }))
  }))
  const result = {
    meta: {
      client: { id: 1, name: 'Empresa de prueba para conciliación', rfc: 'AAA/010101AAA' },
      period: { year: 2026, month: 7 },
      bank: { label: 'BBVA México' },
      format: 'CSV',
      reports: [{ nombre: 'Ingresos julio 2026' }],
      statementMovements: 24,
      reportMovements: 26,
      excludedOutsidePeriod: 2,
      skipped: { unpaidPpd: 3, nonCashDocument: 1, nonBankPayment: 2 }
    },
    summary: {
      bankCredits: 30000,
      bankDebits: 0,
      reportCredits: 32500,
      reportDebits: 0,
      creditDifference: -2500,
      debitDifference: 0,
      exactMatches: 8,
      reviewCount: 8,
      bankOnlyCount: 8,
      reportOnlyCount: 8,
      discrepancies: 24,
      coverage: 50
    },
    options: { amountTolerance: 1, dateWindow: 3 },
    rows
  }
  const { doc, filename } = ctx.exports.buildBankReconciliationPdf(
    result,
    new Date('2026-09-06T12:00:00Z')
  )
  assert.equal(filename, 'Conciliacion_AAA_010101AAA_2026_07.pdf')
  assert.ok(doc.getNumberOfPages() > 2)
  const pdf = doc.output()
  assert.ok(pdf.startsWith('%PDF-'))
  assert.ok(
    doc.lastAutoTable.body.some((row) => row.raw.join(' ').includes('Movimiento de prueba 31'))
  )
  assert.ok(pdf.includes('RASTREO-1234567890'))
  if (process.env.PDF_PREVIEW_PATH)
    fs.writeFileSync(process.env.PDF_PREVIEW_PATH, Buffer.from(doc.output('arraybuffer')))
})
