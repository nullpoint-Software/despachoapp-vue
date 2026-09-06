const { test } = require('node:test')
const assert = require('node:assert/strict')
const vm = require('node:vm')
const fs = require('node:fs')
const ts = require('typescript')
const source = ts.transpileModule(fs.readFileSync('src/utils/paymentSubjectSuggestions.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText
function setup(storage = new Map(), denied = false) {
  const context = { exports: {}, localStorage: {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => { if (denied) throw new Error('Quota'); storage.set(key, value) }
  } }
  vm.runInNewContext(source, context)
  return context.exports
}
test('added and edited suggestions survive reopening in the same browser', () => {
  const storage = new Map()
  const api = setup(storage)
  const values = api.loadSubjectSuggestions()
  values[0] = 'Honorarios anuales'
  values.push('  Nuevo   trámite  ')
  api.saveSubjectSuggestions(values)
  const reloaded = setup(storage).loadSubjectSuggestions()
  assert.equal(reloaded[0], 'Honorarios anuales')
  assert.equal(reloaded.at(-1), 'Nuevo trámite')
})
test('invalid suggestions do not overwrite saved values', () => {
  const api = setup()
  api.saveSubjectSuggestions(['Original'])
  for (const values of [[''], ['SAT', ' sat '], ['a'.repeat(201)]]) {
    assert.throws(() => api.saveSubjectSuggestions(values))
    assert.equal(api.loadSubjectSuggestions()[0], 'Original')
  }
})
test('corrupt saved data recovers defaults', () => {
  for (const raw of ['{', '{}', '[3]', '[""]']) {
    const api = setup(new Map([['despacho.payment-subjects.v1', raw]]))
    assert.equal(api.loadSubjectSuggestions().length, 10)
  }
})
test('storage failures are reported instead of claiming success', () => {
  assert.throws(() => setup(new Map(), true).saveSubjectSuggestions(['SAT']), /No se pudieron guardar/)
})
