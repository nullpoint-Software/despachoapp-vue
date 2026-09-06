const { test } = require('node:test')
const assert = require('node:assert/strict')
const vm = require('node:vm')
const fs = require('node:fs')
const ts = require('typescript')
function setup(fetch = async () => ({ ok: true, json: async () => ({ printers: ['Local'] }) })) {
  const storage = new Map([['userid', '1']])
  const context = {
    exports: {},
    fetch,
    AbortSignal,
    localStorage: {
      get length() {
        return storage.size
      },
      key: (index) => [...storage.keys()][index] || null,
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value)
    }
  }
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync('src/utils/printerSettings.ts', 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
    }).outputText,
    context
  )
  return { api: context.exports, storage }
}
test('printer settings are shared when changing application accounts', () => {
  const { api, storage } = setup()
  api.savePrinterPreferences({ token: 'secret', printer: 'Recepción', paperWidth: 58 })
  assert.equal(api.getPrinterPreferences().printer, 'Recepción')
  storage.set('userid', '2')
  assert.equal(api.getPrinterPreferences().printer, 'Recepción')
  storage.delete('userid')
  assert.equal(api.getPrinterPreferences().paperWidth, 58)
})
test('malformed local preferences recover to an unconfigured printer', () => {
  const { api, storage } = setup()
  storage.set('agnes.printer.v1', '{broken')
  assert.equal(api.getPrinterPreferences().printer, '')
})
test('requests go only to loopback and carry the pairing token', async () => {
  let request
  const { api } = setup(async (url, options) => {
    request = { url, options }
    return { ok: true, json: async () => ({ printers: ['Local'] }) }
  })
  await api.listLocalPrinters(' key ')
  assert.equal(request.url, 'http://127.0.0.1:18457/printers')
  assert.equal(request.options.headers.Authorization, 'Bearer key')
  assert.equal(request.options.headers['X-Agnes-User'], undefined)
})
test('a lost print response warns about uncertain delivery and does not retry', async () => {
  let attempts = 0
  const { api } = setup(async () => {
    attempts++
    throw new Error('timeout')
  })
  await assert.rejects(api.printerRequest('/print', 'key', {}), /cola de impresión/)
  assert.equal(attempts, 1)
})

test('tray preferences override the browser cache without changing the pairing key', async () => {
  const { api } = setup(async () => ({
    ok: true,
    json: async () => ({
      preferences: { displayName: 'Agnes User', printer: 'Caja', paperWidth: 80 }
    })
  }))
  const actual = await api.effectivePrinterPreferences({
    token: 'same-key',
    printer: 'Old',
    paperWidth: 58
  })
  assert.equal(actual.printer, 'Caja')
  assert.equal(actual.paperWidth, 80)
  assert.equal(actual.token, 'same-key')
  assert.equal(api.getPrinterPreferences().displayName, undefined)
})

test('existing browser preference migrates once without re-pairing', async () => {
  const calls = []
  const { api } = setup(async (url, options) => {
    calls.push({ url, options })
    return { ok: true, json: async () => ({ preferences: null }) }
  })
  await api.effectivePrinterPreferences({ token: 'existing-key', printer: 'Caja', paperWidth: 58 })
  assert.equal(calls.length, 2)
  assert.equal(calls[1].options.method, 'POST')
  assert.equal(calls[1].options.headers.Authorization, 'Bearer existing-key')
  assert.equal(JSON.parse(calls[1].options.body).printer, 'Caja')
})

test('first connection can list printers before any printer has been selected', async () => {
  const { api } = setup(async () => ({ ok: true, json: async () => ({ preferences: null }) }))
  const actual = await api.effectivePrinterPreferences(
    { token: 'key', printer: '', paperWidth: 80 },
    true
  )
  assert.equal(actual.printer, '')
})

test('legacy preferences migrate without consulting an account identifier', () => {
  const { api, storage } = setup()
  storage.delete('userid')
  storage.set(
    'despacho.printer.v1.old',
    JSON.stringify({
      token: 'same-key',
      printer: 'Shared',
      paperWidth: 80,
      displayName: 'Old name'
    })
  )
  const value = api.getPrinterPreferences()
  assert.equal(value.printer, 'Shared')
  assert.equal(value.token, 'same-key')
  assert.equal(storage.get('agnes.printer.v1').includes('Old name'), false)
})
test('conflicting legacy printers retain the common pairing but require selecting a shared printer', () => {
  const { api, storage } = setup()
  storage.set(
    'despacho.printer.v1.a',
    JSON.stringify({ token: 'same-key', printer: 'A', paperWidth: 80 })
  )
  storage.set(
    'despacho.printer.v1.b',
    JSON.stringify({ token: 'same-key', printer: 'B', paperWidth: 58 })
  )
  const value = api.getPrinterPreferences()
  assert.equal(value.token, 'same-key')
  assert.equal(value.printer, '')
})
