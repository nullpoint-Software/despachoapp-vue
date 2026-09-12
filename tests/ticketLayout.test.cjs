const { test } = require('node:test')
const assert = require('node:assert/strict')
const ts = require('typescript')
const fs = require('node:fs')
const vm = require('node:vm')
const context = { exports: {} }
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync('src/utils/ticketLayout.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText,
  context
)
for (const paper of [58, 80]) {
  test(`ticket ${paper} mm preserves labels and values within the printable columns`, () => {
    const layout = context.exports.ticketTextLayout(paper)
    const label = 'Fecha del servicio'
    const value = 'Consultoría fiscal para José y compañía con revisión de documentos'
    const lines = layout.row(label, value).split('\n')
    const left = paper === 58 ? 10 : 14
    assert.ok(lines.every((line) => Array.from(line).length <= layout.width))
    assert.ok(
      lines.every(
        (line) =>
          Array.from(line)
            .slice(left, left + 3)
            .join('') === ' | '
      )
    )
    assert.equal(
      lines
        .map((line) => Array.from(line).slice(0, left).join('').trim())
        .filter(Boolean)
        .join(' '),
      label
    )
    assert.equal(
      lines
        .map((line) =>
          Array.from(line)
            .slice(left + 3)
            .join('')
            .trim()
        )
        .filter(Boolean)
        .join(' '),
      value
    )
    const id = 'ABC123'.repeat(20)
    assert.equal(
      layout
        .row('Referencia', id)
        .split('\n')
        .map((line) =>
          Array.from(line)
            .slice(left + 3)
            .join('')
        )
        .join(''),
      id
    )
  })
}

for (const paper of [58, 80]) {
  test(`ticket ${paper} mm aligns amounts at the same right edge`, () => {
    const layout = context.exports.ticketTextLayout(paper)
    for (const amount of ['$0.00', '$1,250.50', '$125,000.00']) {
      const line = layout.row('Cobrado', amount, 'right')
      assert.equal(Array.from(line).length, layout.width)
      assert.ok(line.endsWith(amount))
    }
  })
}
