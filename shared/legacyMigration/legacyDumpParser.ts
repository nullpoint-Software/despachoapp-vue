/**
 * Parser for full mysqldump/phpMyAdmin SQL dumps of the legacy "kanbanpagos" app (stage 8.1).
 * Flow: splitStatements() cuts the text at ';' outside quotes/comments -> CREATE TABLE statements give column order
 * and types -> INSERT [IGNORE] / REPLACE statements are read with a strict literal reader (strings, NULL, plain numbers
 * only). A schema qualifier (`kanbanpagos`.`clientes`) is dropped; an INSERT/REPLACE whose table cannot be read is an error.
 * Nothing is executed and nothing is evaluated: any non-literal value aborts the parse with LegacyDumpError.
 * Numbers stay as text so decimals never lose precision before the importer converts them.
 */

export const legacyTableNames = ['usuarios', 'clientes', 'notas', 'tareas', 'tareas_de_empleados', 'pagoconcepto', 'pagomensual', 'events'] as const
export type LegacyTableName = (typeof legacyTableNames)[number]
export type LegacyValue = string | null
export type LegacyRow = Record<string, LegacyValue>
export type LegacyColumnType = 'timestamp' | 'datetime' | 'other'

export interface LegacyDump {
  tables: Record<LegacyTableName, LegacyRow[]>
  columnTypes: Record<LegacyTableName, Record<string, LegacyColumnType>>
  ignoredTables: string[]
  schemaMismatches: { table: LegacyTableName; expectedColumns: string[]; foundColumns: string[] }[]
}

export class LegacyDumpError extends Error {
  constructor(message: string, readonly lineNumber: number, readonly tableName: string | null) {
    super(`${message} (línea ${lineNumber}${tableName ? `, tabla ${tableName}` : ''})`)
    this.name = 'LegacyDumpError'
  }
}

/** Columns of each known table in 01-init.sql; a CREATE TABLE with a different column set is reported as a mismatch. */
export const expectedLegacyColumns: Record<LegacyTableName, readonly string[]> = {
  usuarios: ['id_usuario', 'activo', 'nombre', 'email', 'telefono', 'imagen', 'puesto', 'fecha_registro', 'username', 'password'],
  clientes: ['id_cliente', 'nombre', 'rfc', 'fiel', 'ciecf', 'email', 'telefono'],
  notas: ['id', 'titulo', 'descripcion', 'pinned', 'color'],
  tareas: ['id_tarea', 'titulo', 'descripcion', 'estado', 'fecha_creacion', 'fecha_vencimiento'],
  tareas_de_empleados: ['id_tarea_asig', 'id_usuario_asig'],
  pagoconcepto: ['id', 'cliente', 'asunto', 'atendio', 'cobramos', 'pagamos', 'fecha'],
  pagomensual: ['id', 'cliente', 'asunto', 'atendio', 'fechapago', 'honorarios', 'mes_ano'],
  events: ['id', 'userid', 'type', 'aggregate_id', 'payload', 'oldpayload', 'timestamp'],
}

interface Statement { text: string; startLine: number }

/**
 * Table name after CREATE TABLE / INSERT: an optional schema qualifier (`kanbanpagos`. or kanbanpagos.) is dropped;
 * group 1 is a quoted name, group 2 a bare one.
 */
const tableNameSource = '(?:(?:`[^`]+`|\\w+)\\.)?(?:`([^`]+)`|(\\w+))'
const createTablePattern = new RegExp('^CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?' + tableNameSource, 'i')
/** `INSERT INTO`, `INSERT IGNORE INTO` and `REPLACE INTO` (phpMyAdmin/mysqldump options) all carry rows. */
const insertPattern = new RegExp('^(?:INSERT(?:\\s+IGNORE)?|REPLACE)\\s+INTO\\s+' + tableNameSource, 'i')
const tableNameOf = (match: RegExpExecArray): string => match[1] ?? match[2] ?? ''

function countNewlines(text: string): number {
  let count = 0
  for (let index = text.indexOf('\n'); index !== -1; index = text.indexOf('\n', index + 1)) count += 1
  return count
}

/** Returns the index just after the closing quote of the string starting at `start`, or -1 when unterminated. */
function findStringEnd(text: string, start: number): number {
  const quote = text[start]
  let index = start + 1
  while (index < text.length) {
    const character = text[index]
    if (character === '\\') index += 2
    else if (character === quote) {
      if (text[index + 1] === quote) index += 2 // doubled quote = literal quote
      else return index + 1
    } else index += 1
  }
  return -1
}

/** Cuts the dump at ';' outside quotes, dropping comments but keeping their newlines so line numbers stay exact. */
function splitStatements(text: string): Statement[] {
  const statements: Statement[] = []
  let pieces: string[] = []
  let runStart = 0
  let line = 1
  let startLine: number | null = null
  const finish = (end: number) => {
    pieces.push(text.slice(runStart, end))
    const statementText = pieces.join('').trim()
    if (statementText && startLine !== null) statements.push({ text: statementText, startLine })
    pieces = []
    startLine = null
  }
  let index = 0
  while (index < text.length) {
    const character = text[index] ?? ''
    const isLineComment = character === '#' || (character === '-' && text[index + 1] === '-' && /\s/.test(text[index + 2] ?? ' '))
    if (isLineComment || (character === '/' && text[index + 1] === '*')) {
      let commentEnd: number
      if (isLineComment) {
        commentEnd = text.indexOf('\n', index)
        if (commentEnd === -1) commentEnd = text.length
      } else {
        commentEnd = text.indexOf('*/', index + 2)
        commentEnd = commentEnd === -1 ? text.length : commentEnd + 2
      }
      pieces.push(text.slice(runStart, index))
      const newlineCount = countNewlines(text.slice(index, commentEnd))
      pieces.push('\n'.repeat(newlineCount))
      line += newlineCount
      index = commentEnd
      runStart = index
    } else if (character === "'" || character === '"' || character === '`') {
      if (startLine === null) startLine = line
      const end = findStringEnd(text, index)
      if (end === -1) {
        const partialText = (pieces.join('') + text.slice(runStart, index)).trimStart()
        const partialName = insertPattern.exec(partialText) ?? createTablePattern.exec(partialText)
        throw new LegacyDumpError('Cadena sin cerrar', line, partialName ? tableNameOf(partialName) : null)
      }
      line += countNewlines(text.slice(index, end))
      index = end
    } else if (character === ';') {
      finish(index)
      index += 1
      runStart = index
    } else {
      if (character === '\n') line += 1
      else if (startLine === null && !/\s/.test(character)) startLine = line
      index += 1
    }
  }
  finish(text.length)
  return statements
}

/** Splits at top-level commas (outside parentheses and quotes); used for the CREATE TABLE body. */
function splitTopLevel(body: string): string[] {
  const items: string[] = []
  let depth = 0
  let itemStart = 0
  let index = 0
  while (index < body.length) {
    const character = body[index] ?? ''
    if (character === "'" || character === '"' || character === '`') {
      const end = findStringEnd(body, index)
      index = end === -1 ? body.length : end
      continue
    }
    if (character === '(') depth += 1
    else if (character === ')') depth -= 1
    else if (character === ',' && depth === 0) {
      items.push(body.slice(itemStart, index))
      itemStart = index + 1
    }
    index += 1
  }
  items.push(body.slice(itemStart))
  return items.map((item) => item.trim()).filter(Boolean)
}

function parseCreateTable(statementText: string): { columns: string[]; types: Record<string, LegacyColumnType> } {
  const body = statementText.slice(statementText.indexOf('(') + 1, statementText.lastIndexOf(')'))
  const columns: string[] = []
  const types: Record<string, LegacyColumnType> = {}
  for (const item of splitTopLevel(body)) {
    const match = /^`([^`]+)`\s+(\w+)/.exec(item) // keys and constraints do not start with a quoted name
    if (!match) continue
    const [, columnName = '', rawTypeName = ''] = match
    columns.push(columnName)
    const typeName = rawTypeName.toLowerCase()
    types[columnName] = typeName === 'timestamp' || typeName === 'datetime' ? typeName : 'other'
  }
  return { columns, types }
}

const simpleEscapes: Record<string, string> = { '0': '\0', n: '\n', r: '\r', t: '\t', b: '\b', Z: '\x1a' }

/** Cursor over one INSERT statement that reads literals only; `fail` turns the cursor offset into a line number. */
class LiteralReader {
  position = 0
  constructor(readonly text: string, private readonly startLine: number, private readonly tableName: string) {}

  fail(message: string): never {
    throw new LegacyDumpError(message, this.startLine + countNewlines(this.text.slice(0, this.position)), this.tableName)
  }

  skipWhitespace() {
    while (this.position < this.text.length && /\s/.test(this.text[this.position] ?? '')) this.position += 1
  }

  peek(): string {
    this.skipWhitespace()
    return this.text[this.position] ?? ''
  }

  expect(character: string) {
    if (this.peek() !== character) this.fail(`Se esperaba "${character}"`)
    this.position += 1
  }

  /** Consumes a comma when present; lets the callers loop over comma-separated lists. */
  consumeComma(): boolean {
    if (this.peek() !== ',') return false
    this.position += 1
    return true
  }

  readIdentifier(): string {
    this.expect('`')
    const end = this.text.indexOf('`', this.position)
    if (end === -1) this.fail('Identificador sin cerrar')
    const name = this.text.slice(this.position, end)
    this.position = end + 1
    return name
  }

  readString(): string {
    const quote = this.text[this.position]
    const escapePattern = quote === "'" ? /['\\]/g : /["\\]/g
    const chunks: string[] = []
    let index = this.position + 1
    for (;;) {
      escapePattern.lastIndex = index
      const match = escapePattern.exec(this.text)
      if (!match) {
        this.position = index
        this.fail('Cadena sin cerrar')
      }
      chunks.push(this.text.slice(index, match.index))
      if (match[0] === quote) {
        if (this.text[match.index + 1] === quote) {
          chunks.push(quote)
          index = match.index + 2
          continue
        }
        this.position = match.index + 1
        return chunks.join('')
      }
      const escaped = this.text[match.index + 1] ?? ''
      chunks.push(simpleEscapes[escaped] ?? escaped) // \x -> x also covers \\ \' \"
      index = match.index + 2
    }
  }

  readValue(): LegacyValue {
    const character = this.peek()
    if (character === "'" || character === '"') return this.readString()
    const numberPattern = /-?\d+(\.\d+)?(?![\w.(])/y
    numberPattern.lastIndex = this.position
    const numeric = numberPattern.exec(this.text)
    if (numeric) {
      this.position += numeric[0].length
      return numeric[0]
    }
    if (/^NULL(?![\w(])/i.test(this.text.slice(this.position, this.position + 5))) {
      this.position += 4
      return null
    }
    return this.fail('Valor que no es un literal')
  }
}

function parseInsert(statement: Statement, tableName: string, defaultColumns: readonly string[] | undefined): LegacyRow[] {
  const reader = new LiteralReader(statement.text, statement.startLine, tableName)
  reader.position = insertPattern.exec(statement.text)![0].length
  let listedOrDefaultColumns = defaultColumns
  if (reader.peek() === '(') {
    reader.position += 1
    const listedColumns: string[] = []
    do listedColumns.push(reader.readIdentifier())
    while (reader.consumeComma())
    reader.expect(')')
    listedOrDefaultColumns = listedColumns
  }
  if (!listedOrDefaultColumns) return reader.fail('INSERT sin lista de columnas y sin CREATE TABLE previo')
  const columns = listedOrDefaultColumns
  const valuesKeyword = /VALUES/iy
  reader.skipWhitespace()
  valuesKeyword.lastIndex = reader.position
  if (!valuesKeyword.test(statement.text)) reader.fail('Se esperaba VALUES')
  reader.position = valuesKeyword.lastIndex
  const rows: LegacyRow[] = []
  do {
    reader.expect('(')
    const row: LegacyRow = {}
    for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
      if (columnIndex > 0) reader.expect(',')
      row[columns[columnIndex] ?? ''] = reader.readValue()
    }
    reader.expect(')') // also fails when the tuple has more values than columns
    rows.push(row)
  } while (reader.consumeComma())
  if (reader.peek() !== '') reader.fail('Texto inesperado tras los valores')
  return rows
}

export function parseLegacyDump(text: string): LegacyDump {
  const knownNames: readonly string[] = legacyTableNames
  const dump: LegacyDump = {
    tables: Object.fromEntries(legacyTableNames.map((name) => [name, []])) as unknown as LegacyDump['tables'],
    columnTypes: Object.fromEntries(legacyTableNames.map((name) => [name, {}])) as unknown as LegacyDump['columnTypes'],
    ignoredTables: [],
    schemaMismatches: [],
  }
  const createdColumns = new Map<string, string[]>()
  const ignoredTables = new Set<string>()
  for (const statement of splitStatements(text)) {
    const createMatch = createTablePattern.exec(statement.text)
    const insertMatch = createMatch ? null : insertPattern.exec(statement.text)
    const match = createMatch ?? insertMatch
    if (!match) {
      // Rows we cannot attribute to a table (INSERT DELAYED, INSERT ... SELECT without INTO...) must never be lost silently.
      if (/^(?:INSERT|REPLACE)\b/i.test(statement.text)) throw new LegacyDumpError('INSERT que no se puede leer', statement.startLine, null)
      continue // SET, ALTER, DROP, views, transactions...
    }
    const tableName = tableNameOf(match)
    if (!knownNames.includes(tableName)) {
      ignoredTables.add(tableName)
      continue
    }
    const knownName = tableName as LegacyTableName
    if (createMatch) {
      const { columns, types } = parseCreateTable(statement.text)
      createdColumns.set(knownName, columns)
      dump.columnTypes[knownName] = types
      const expected = expectedLegacyColumns[knownName]
      if (columns.length !== expected.length || expected.some((column) => !columns.includes(column))) {
        dump.schemaMismatches.push({ table: knownName, expectedColumns: [...expected], foundColumns: columns })
      }
    } else {
      dump.tables[knownName].push(...parseInsert(statement, knownName, createdColumns.get(knownName)))
    }
  }
  dump.ignoredTables = [...ignoredTables]
  return dump
}
