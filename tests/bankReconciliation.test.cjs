const test = require('node:test')
const assert = require('node:assert/strict')
const vm = require('node:vm')
const fs = require('node:fs')
const ts = require('typescript')
function setup(request, savePdf = async () => {}) {
  const props = {
    clientId: 1,
    year: 2026,
    month: 7,
    reports: [{ tipo: 'mensual', ejercicio: 2026, mes: 7 }]
  }
  const source = ts.transpileModule(
    fs.readFileSync('src/components/adminApp/BankReconciliation/BankReconciliation.ts', 'utf8') +
      '\nexport {runComparison,resetComparison,selectFile,result,statementFile,loading,draft,downloadPdf,pdfError};',
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
  ).outputText
  const context = {
    exports: {},
    defineProps: () => props,
    withDefaults: (p) => p,
    require(name) {
      if (name === 'vue')
        return {
          computed: (f) => ({
            get value() {
              return f()
            }
          }),
          ref: (value) => ({ value }),
          reactive: (v) => v,
          watch: () => {},
          nextTick: async () => {}
        }
      if (name === 'file-saver') return { saveAs: () => {} }
      if (name.includes('bankReconciliationPdf'))
        return {
          buildBankReconciliationPdf: (result) => ({
            doc: { save: () => savePdf(result) },
            filename: 'reporte.pdf'
          })
        }
      if (name.includes('/client')) return { fs: { reconcileBankStatement: request } }
      if (name.includes('tutorialStorage')) return { hasCompletedTutorial: () => true }
      throw Error(name)
    }
  }
  vm.runInNewContext(source, context)
  return context.exports
}
test('una respuesta anterior no reemplaza la conciliación del nuevo contexto', async () => {
  let resolveOld
  const old = new Promise((resolve) => {
    resolveOld = resolve
  })
  let calls = 0
  const api = setup(() => (++calls === 1 ? old : Promise.resolve({ rows: [], marker: 'new' })))
  api.selectFile({ name: 'julio.csv', size: 20 })
  const pending = api.runComparison()
  api.resetComparison()
  api.selectFile({ name: 'nuevo.csv', size: 20 })
  await api.runComparison()
  resolveOld({ rows: [], marker: 'old' })
  await pending
  assert.equal(api.result.value.marker, 'new')
  assert.equal(api.loading.value, false)
})
test('archivo inválido elimina la selección anterior y no se envía al servidor', async () => {
  let calls = 0
  const api = setup(async () => {
    calls++
    return { rows: [] }
  })
  api.selectFile({ name: 'valido.csv', size: 20 })
  api.selectFile({ name: 'invalido.exe', size: 20 })
  await api.runComparison()
  assert.equal(api.statementFile.value, null)
  assert.equal(calls, 0)
})
test('elimina la contraseña cuando falla el procesamiento', async () => {
  const api = setup(async () => {
    throw Error('failure')
  })
  api.selectFile({ name: 'protegido.pdf', size: 20 })
  api.draft.password = 'temporary'
  await api.runComparison()
  assert.equal(api.draft.password, '')
  assert.equal(api.loading.value, false)
})

test('descarga PDF al finalizar aunque no existan discrepancias y permite repetir', async () => {
  const comparison = { rows: [], summary: { discrepancies: 0 } }
  const downloads = []
  const api = setup(
    async () => comparison,
    async (result) => downloads.push(result)
  )
  api.selectFile({ name: 'banco.csv', size: 20 })
  await api.runComparison()
  assert.equal(downloads.length, 1)
  assert.equal(downloads[0], comparison)
  await api.downloadPdf()
  assert.equal(downloads.length, 2)
})
test('un error de PDF conserva la conciliación y permite volver a descargar', async () => {
  let fail = true
  const comparison = { rows: [], summary: { discrepancies: 0 } }
  const api = setup(
    async () => comparison,
    async () => {
      if (fail) throw Error('download')
    }
  )
  api.selectFile({ name: 'banco.csv', size: 20 })
  await api.runComparison()
  assert.equal(api.result.value, comparison)
  assert.match(api.pdfError.value, /PDF/)
  fail = false
  await api.downloadPdf()
  assert.equal(api.pdfError.value, '')
})
