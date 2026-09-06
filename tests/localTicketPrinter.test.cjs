const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
function setup(
  settings = { token: 'key', printer: 'Local', paperWidth: 58 },
  request = async () => ({ status: 'queued' })
) {
  const calls = []
  const context = {
    exports: {},
    crypto: { randomUUID: () => 'job-id' },
    require: (name) => {
      if (name === './printerSettings')
        return {
          getPrinterPreferences: () => settings,
          effectivePrinterPreferences: async () => settings,
          printerRequest: async (...args) => {
            calls.push(args)
            return request(...args)
          }
        }
      if (name === './ticketRaster') return { rasterTicket: async (_, width) => ['png-' + width] }
      return () => {}
    }
  }
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync('src/utils/localTicketPrinter.ts', 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true
      }
    }).outputText,
    context
  )
  return { api: context.exports, calls }
}
const ticket = { title: 'Pago', text: 'José', logo: '/logo.png', barcode: '123' }
test('sends directly to the saved printer and paper size without browser print APIs', async () => {
  const { api, calls } = setup()
  await api.printLocalTicket(ticket)
  assert.equal(calls[0][0], '/print')
  assert.equal(calls[0][2].printer, 'Local')
  assert.equal(calls[0][2].paperWidth, 58)
  assert.equal(calls[0][2].pages[0], 'png-58')
})
test('unconfigured printing directs the user to Settings without sending', async () => {
  const { api, calls } = setup({ token: '', printer: '', paperWidth: 80 })
  await assert.rejects(api.printLocalTicket(ticket), /Configuración/)
  assert.equal(calls.length, 0)
})
test('overlapping clicks do not enqueue duplicate tickets', async () => {
  let finish
  const { api, calls } = setup(
    undefined,
    () =>
      new Promise((resolve) => {
        finish = resolve
      })
  )
  const first = api.printLocalTicket(ticket)
  await Promise.resolve()
  await assert.rejects(api.printLocalTicket(ticket), /Espera/)
  finish({ status: 'queued' })
  await first
  assert.equal(calls.length, 1)
})
test('unknown agent response is not reported as success', async () => {
  const { api } = setup(undefined, async () => ({ status: 'unknown' }))
  await assert.rejects(api.printLocalTicket(ticket), /no confirmó/)
})
