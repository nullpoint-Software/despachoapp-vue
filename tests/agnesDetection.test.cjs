const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const context = { exports: {}, AbortSignal }
const source = fs
  .readFileSync('src/utils/agnesDetection.ts', 'utf8')
  .replace('import.meta.env.BASE_URL', "'/'")
vm.runInNewContext(
  ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText,
  context
)
const { detectAgnes, AGNES_DOWNLOAD_URL } = context.exports

test('download points to the Agnes ZIP bundled with DespachoApp', () => {
  assert.equal(AGNES_DOWNLOAD_URL, '/printing/AgnesPrinterPlugin-1.2.zip')
  assert.ok(fs.statSync('public' + AGNES_DOWNLOAD_URL).size > 0)
})
test('unreachable or browser-blocked agent offers the unavailable state', async () => {
  assert.equal(
    await detectAgnes('', async () => {
      throw new Error('network')
    }),
    'unavailable'
  )
})
test('wrong or absent pairing key is distinguished from agent absence', async () => {
  assert.equal(await detectAgnes('', async () => ({ status: 401, ok: false })), 'pairing')
})
test('compatible agent is detected without changing preferences or printing', async () => {
  let request
  const result = await detectAgnes(' key ', async (url, options) => {
    request = { url, options }
    return {
      status: 200,
      ok: true,
      json: async () => ({ name: 'Agnes Printer Plugin', apiVersion: 1, version: '1.2' })
    }
  })
  assert.equal(result, 'ready')
  assert.equal(request.url, 'http://127.0.0.1:18457/v1/info')
  assert.equal(request.options.headers.Authorization, 'Bearer key')
  assert.equal(request.options.body, undefined)
})
test('an incompatible service offers the current download', async () => {
  assert.equal(await detectAgnes('key', async () => ({ status: 404, ok: false })), 'incompatible')
  assert.equal(
    await detectAgnes('key', async () => ({
      status: 200,
      ok: true,
      json: async () => ({ name: 'another service' })
    })),
    'incompatible'
  )
})
