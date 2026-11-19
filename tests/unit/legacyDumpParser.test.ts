import { describe, expect, it } from 'vitest'
import { LegacyDumpError, parseLegacyDump } from '../../shared/legacyMigration/legacyDumpParser'
import { buildLegacyDump, encryptLegacyPassword } from '../support/legacyDump'

/** Parser del volcado SQL de kanbanpagos (etapa 8.1): literales, escapes, orden de columnas y errores. */
const threeClients = [
  { id_cliente: 1, nombre: 'Uno', rfc: 'AAA010101AAA' },
  { id_cliente: 2, nombre: 'Dos', rfc: 'XAXX010101000' },
  { id_cliente: 3, nombre: 'Tres', rfc: 'BBB010101BBB' },
]

describe('parseLegacyDump', () => {
  it('parses multi-row inserts with column list', () => {
    const dump = parseLegacyDump(buildLegacyDump({ clientes: threeClients }))
    expect(dump.tables.clientes.length).toBe(3)
    expect(dump.tables.clientes[1]?.rfc).toBe('XAXX010101000')
  })

  it('parses inserts without column list using CREATE TABLE order', () => {
    const dump = parseLegacyDump(buildLegacyDump({ clientes: threeClients }, { omitColumnList: true }))
    expect(dump.tables.clientes.length).toBe(3)
    expect(dump.tables.clientes[1]?.rfc).toBe('XAXX010101000')
    expect(dump.tables.clientes[2]?.nombre).toBe('Tres')
  })

  it('decodes mysql escapes', () => {
    const dump = parseLegacyDump(buildLegacyDump({
      extraStatements: ["INSERT INTO `notas` (`id`, `titulo`, `descripcion`, `pinned`, `color`) VALUES (1, 'O\\'Brien \\n', 'It''s', NULL, 12.50);"],
    }))
    expect(dump.tables.notas[0]).toEqual({ id: '1', titulo: "O'Brien \n", descripcion: "It's", pinned: null, color: '12.50' })
  })

  it('keeps utf8 accents', () => {
    const dump = parseLegacyDump(buildLegacyDump({ clientes: [{ nombre: 'Ñandú Pérez' }] }))
    expect(dump.tables.clientes[0]?.nombre).toBe('Ñandú Pérez')
  })

  it('keeps separators inside strings', () => {
    const dump = parseLegacyDump(buildLegacyDump({ pagoconcepto: [{ asunto: 'a;b),(c' }] }))
    expect(dump.tables.pagoconcepto).toHaveLength(1)
    expect(dump.tables.pagoconcepto[0]?.asunto).toBe('a;b),(c')
  })

  it('parses a 2 MB row', () => {
    const image = 'x'.repeat(2 * 1024 * 1024)
    const text = buildLegacyDump({ usuarios: [{ imagen: image }] })
    const startedAt = Date.now()
    const dump = parseLegacyDump(text)
    expect(Date.now() - startedAt).toBeLessThan(2000)
    expect(dump.tables.usuarios[0]?.imagen).toHaveLength(image.length)
  })

  it('reads column types from CREATE TABLE', () => {
    const dump = parseLegacyDump(buildLegacyDump())
    expect(dump.columnTypes.pagomensual.fechapago).toBe('timestamp')
    expect(dump.columnTypes.pagoconcepto.fecha).toBe('datetime')
    expect(dump.columnTypes.pagoconcepto.cobramos).toBe('other')
  })

  it('ignores views and unknown tables', () => {
    const dump = parseLegacyDump(buildLegacyDump({ extraStatements: ['CREATE TABLE `otra_tabla` (`id` int);', 'INSERT INTO `otra_tabla` VALUES (1);'] }))
    expect(dump.ignoredTables).toContain('gananciasporano')
    expect(dump.ignoredTables).toContain('otra_tabla')
  })

  it('treats a missing known table as empty', () => {
    expect(parseLegacyDump(buildLegacyDump()).tables.events).toEqual([])
    expect(parseLegacyDump('SET time_zone = "+00:00";').tables.clientes).toEqual([])
  })

  it('reports schema mismatches', () => {
    const dump = parseLegacyDump(buildLegacyDump({ clientes: [{ foo: 'extra' }] }))
    expect(dump.schemaMismatches).toHaveLength(1)
    expect(dump.schemaMismatches[0]?.table).toBe('clientes')
    expect(dump.schemaMismatches[0]?.foundColumns).toContain('foo')
    expect(parseLegacyDump(buildLegacyDump({ clientes: threeClients })).schemaMismatches).toEqual([])
  })

  it('rejects non-literal values', () => {
    const text = buildLegacyDump({ extraStatements: ["INSERT INTO `clientes` (`id_cliente`) VALUES\n(NOW());"] })
    const failure = (() => { try { parseLegacyDump(text) } catch (error) { return error } })()
    expect(failure).toBeInstanceOf(LegacyDumpError)
    expect((failure as LegacyDumpError).tableName).toBe('clientes')
    expect((failure as LegacyDumpError).lineNumber).toBe(text.split('\n').findIndex((line) => line.startsWith('(NOW')) + 1)
  })

  it('reads INSERT IGNORE, REPLACE and schema-qualified table names', () => {
    const columns = '(`id_cliente`, `nombre`, `rfc`, `fiel`, `ciecf`, `email`, `telefono`)'
    const dump = parseLegacyDump([
      'CREATE TABLE IF NOT EXISTS `kanbanpagos`.`clientes` (`id_cliente` int, `nombre` varchar(100), `rfc` varchar(13), `fiel` text, `ciecf` text, `email` text, `telefono` text);',
      `INSERT IGNORE INTO \`kanbanpagos\`.\`clientes\` ${columns} VALUES (1, 'Uno', '', NULL, NULL, '', '');`,
      `REPLACE INTO \`clientes\` ${columns} VALUES (2, 'Dos', '', NULL, NULL, '', '');`,
      `insert ignore into kanbanpagos.clientes VALUES (3, 'Tres', '', NULL, NULL, '', '');`,
    ].join('\n'))
    expect(dump.tables.clientes.map(row => row.nombre)).toEqual(['Uno', 'Dos', 'Tres'])
    expect(dump.ignoredTables).toEqual([])
    expect(dump.schemaMismatches).toEqual([])
  })

  it('turns an insert it cannot attribute to a table into a parse error', () => {
    const failure = (() => { try { parseLegacyDump("SET NAMES utf8mb4;\nINSERT DELAYED INTO `clientes` VALUES (1);") } catch (error) { return error } })()
    expect(failure).toBeInstanceOf(LegacyDumpError)
    expect((failure as LegacyDumpError).lineNumber).toBe(2)
  })

  it('rejects unterminated strings', () => {
    expect(() => parseLegacyDump("INSERT INTO `notas` (`id`) VALUES ('abc);")).toThrow(LegacyDumpError)
  })
})

describe('encryptLegacyPassword', () => {
  it('produces hex whose length is a multiple of 32', () => {
    expect(encryptLegacyPassword('secreto', 'hanekawa')).toMatch(/^([0-9a-f]{32})+$/)
  })
})
