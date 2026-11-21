import { createHash } from 'node:crypto'
import { getOfficeInstant, officeOffsetMilliseconds } from '../contracts/movements'
import { parseCiec } from '../contracts/clientCredentials'
import { parsePhotoDataUrl } from '../contracts/userPhotos'
import { legacyTextLimits } from '../contracts/legacyMigration'
import { maximumTaskAssignees } from '../contracts/tasks'
import type { LegacyImportedNote } from '../contracts/localNotes'
import type { LegacyDump, LegacyRow, LegacyTableName } from './legacyDumpParser'
import { scrubLegacyPayload } from './legacyEventScrubber'

/**
 * Normalized view of a legacy dump. The GLOBAL part is what the Planner compares with the Host; the LOCAL part (CIEC, notes)
 * only ever travels to the device that runs the import. Secrets (passwords, FIEL, CIEC) never appear in the global part.
 */
export interface LegacyUser { legacyUserId: string; isActive: boolean; displayName: string; username: string; legacyRole: 'Administrador' | 'Empleado'; registeredAt: string; photoDataUrl: string | null; rowHash: string }
export interface LegacyClient { legacyClientId: string; displayName: string; rfc: string | null; emailAddress: string; phoneNumber: string; rowHash: string }
export interface LegacyTask { legacyTaskId: string; title: string; description: string; legacyState: string; createdAt: string; dueDate: string | null; dueInstant: string | null; assigneeLegacyUserIds: string[]; rowHash: string }
export interface LegacyPayment { sourceTable: 'pagoconcepto' | 'pagomensual'; legacyPaymentId: string; legacyClientId: string | null; legacyUserId: string | null; concept: string; incomeAmount: string; expenseAmount: string; movementDate: string; movementTime: string; rowHash: string }
export interface LegacyEvent { legacyEventId: string; legacyUserId: string | null; type: string; aggregateId: string | null; payload: unknown; oldPayload: unknown; occurredAt: string; rowHash: string }
export type LegacyNormalizationIssue = { kind: 'invalidCiec' | 'invalidPhoto' | 'invalidAmount' | 'invalidDate' | 'invalidJson' | 'truncatedText' | 'invalidRfc' | 'cleanedText' | 'tooManyAssignees'; sourceTable: LegacyTableName; legacyId: string }
export interface LegacyGlobalSnapshot { sourceSha256: string; users: LegacyUser[]; clients: LegacyClient[]; tasks: LegacyTask[]; payments: LegacyPayment[]; events: LegacyEvent[]; normalizationIssues: LegacyNormalizationIssue[]; discardedFieldCounts: Record<string, number>; ignoredTables: string[] }
export interface LegacyLocalSnapshot { ciecByLegacyClientId: Record<string, string>; notes: LegacyImportedNote[] }

const maximumConceptLength = 200
/** Same format `parseClientProfile` reads back: an RFC outside it would make the client's profile unreadable in Fiscenix. */
const rfcPattern = /^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/
/** Same check `parseClientProfile` applies when Fiscenix reads the client back. */
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// eslint-disable-next-line no-control-regex -- detecting the control characters the read parsers reject is the point.
const controlCharacterPattern = /[\u0000-\u001F\u007F]/
// eslint-disable-next-line no-control-regex -- same characters, replaced.
const controlCharacters = /[\u0000-\u001F\u007F]/g
/** Task descriptions keep line breaks and tabs (`parseTaskDescription`); every other control character goes. */
// eslint-disable-next-line no-control-regex -- same characters, minus line break and tab.
const descriptionControlCharacters = /[\u0000-\u0008\u000B-\u001F\u007F]/g
const amountPattern =/^\d{1,10}(\.\d{1,2})?$/
const spanishMonths = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const dateTimePattern = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/

/** JSON with keys sorted at every depth, so the row hash does not depend on property order. */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']'
  if (value !== null && typeof value === 'object') {
    return '{' + Object.entries(value).filter(([, child]) => child !== undefined).sort(([first], [second]) => (first < second ? -1 : 1)).map(([key, child]) => JSON.stringify(key) + ':' + canonicalJson(child)).join(',') + '}'
  }
  return JSON.stringify(value)
}
/** Adds `rowHash`: SHA-256 hex of the canonical JSON of the normalized row (used to detect source changes later). */
function hashRow<T extends object>(row: T): T & { rowHash: string } {
  return { ...row, rowHash: createHash('sha256').update(canonicalJson(row)).digest('hex') }
}

/** Movement validation only accepts business dates in 2000-2099 (`parseBusinessDate`); anything else is an invalid date here. */
function isSupportedYear(isoText: string): boolean {
  const year = Number(isoText.slice(0, 4))
  return year >= 2000 && year <= 2099
}

interface LocalMoment { date: string; time: string; instant: Date }
/**
 * Reads a dump date. TIMESTAMP columns are stored in UTC (the dump sets time_zone +00:00) and become office local time;
 * DATETIME columns already are office wall time. The type comes from the dump's own CREATE TABLE. Invalid or zero dates give null.
 */
function readMoment(dump: LegacyDump, table: LegacyTableName, column: string, value: string | null): LocalMoment | null {
  const match = dateTimePattern.exec(value ?? '')
  if (!match) return null
  const date = match[1] as string, time = match[2] as string
  if (dump.columnTypes[table][column] === 'timestamp') {
    const instant = new Date(date + 'T' + time + 'Z')
    if (Number.isNaN(instant.getTime())) return null
    const wall = new Date(instant.getTime() + officeOffsetMilliseconds(instant.getTime())).toISOString()
    return isSupportedYear(wall) ? { date: wall.slice(0, 10), time: wall.slice(11, 19), instant } : null
  }
  const day = new Date(date + 'T' + time + 'Z')
  // Rejects impossible calendar values such as 2025-02-31 or 0000-00-00 that JavaScript would roll over.
  if (Number.isNaN(day.getTime()) || day.toISOString().slice(0, 19).replace('T', ' ') !== date + ' ' + time) return null
  return isSupportedYear(date) ? { date, time, instant: getOfficeInstant(date, time) } : null
}

/** Two-decimal text amount, or null when negative, non numeric or beyond DECIMAL(10,2). A NULL column counts as zero. */
function normalizeAmount(value: string | null): string | null {
  const text = (value ?? '0').trim()
  if (!amountPattern.test(text)) return null
  const [whole = '0', cents = ''] = text.split('.')
  return whole.replace(/^0+(?=\d)/, '') + '.' + cents.padEnd(2, '0')
}
function parseJsonColumn(value: string | null): { isValid: boolean; parsed: unknown } {
  if (value === null) return { isValid: true, parsed: null }
  try { return { isValid: true, parsed: JSON.parse(value) } } catch { return { isValid: false, parsed: null } }
}

/**
 * Normalizes every known table. Rows with an unreadable date, amount or JSON are excluded and reported as issues (the
 * Planner turns them into visible decisions); optional bad data (photo, CIEC, due date) only drops that field.
 */
export function buildLegacySnapshot(dump: LegacyDump, sourceSha256: string): { global: LegacyGlobalSnapshot; local: LegacyLocalSnapshot } {
  const issues: LegacyNormalizationIssue[] = []
  const reportIssue = (kind: LegacyNormalizationIssue['kind'], sourceTable: LegacyTableName, legacyId: string): void => { issues.push({ kind, sourceTable, legacyId }) }
  const discardedFieldCounts: Record<string, number> = { 'usuarios.password': 0, 'usuarios.email': 0, 'usuarios.telefono': 0, 'clientes.fiel': 0, 'notas.color': 0 }
  const countDiscarded = (key: string, value: string | null | undefined): void => { if (value) discardedFieldCounts[key] = (discardedFieldCounts[key] ?? 0) + 1 }
  const text = (row: LegacyRow, column: string): string => row[column] ?? ''
  /**
   * Per-row text normalizer. Imported text must pass the parsers Fiscenix uses to read it back (`pairingText`,
   * `parseClientProfile`, `parseTaskDescription`); otherwise one bad row breaks the whole list page that contains it.
   * - Ruling 20: text longer than its Fiscenix column is cut to `legacyTextLimits` → one `truncatedText` per row.
   * - Control characters become spaces (one-line text) or are removed (descriptions); an empty required name or title
   *   gets a placeholder; an email the profile parser would reject is left empty → one `cleanedText` per row.
   * Surrounding spaces are trimmed silently, as the read parsers do too.
   */
  const rowText = (sourceTable: LegacyTableName, legacyId: string) => {
    let isTruncated = false, isCleaned = false
    // UTF-16 length, like the Host parser checks; a cut never leaves half of a surrogate pair.
    const fit = (value: string, maximum: number): string => { if (value.length <= maximum) return value; isTruncated = true; return value.slice(0, maximum).replace(/[\uD800-\uDBFF]$/, '').trim() }
    return {
      line: (value: string, maximum: number, placeholder = ''): string => {
        const cleaned = value.replace(controlCharacters, ' ').trim()
        if (cleaned !== value.trim()) isCleaned = true
        if (!cleaned && placeholder) { isCleaned = true; return placeholder }
        return fit(cleaned, maximum)
      },
      description: (value: string, maximum: number): string => {
        const normalized = value.replace(/\r\n?/g, '\n'), cleaned = normalized.replace(descriptionControlCharacters, '')
        if (cleaned !== normalized) isCleaned = true
        return fit(cleaned, maximum)
      },
      // A cut email could point to someone else, so an over-long or malformed one is dropped instead.
      email: (value: string, maximum: number): string => {
        const trimmed = value.trim()
        if (!trimmed || (trimmed.length <= maximum && !controlCharacterPattern.test(trimmed) && emailPattern.test(trimmed))) return trimmed
        isCleaned = true
        return ''
      },
      report: (): void => {
        if (isTruncated) reportIssue('truncatedText', sourceTable, legacyId)
        if (isCleaned) reportIssue('cleanedText', sourceTable, legacyId)
      },
    }
  }

  const users: LegacyUser[] = []
  for (const row of dump.tables.usuarios) {
    const legacyUserId = text(row, 'id_usuario')
    countDiscarded('usuarios.password', row.password)
    countDiscarded('usuarios.email', row.email)
    countDiscarded('usuarios.telefono', row.telefono)
    const registered = readMoment(dump, 'usuarios', 'fecha_registro', row.fecha_registro ?? null)
    if (!registered) { reportIssue('invalidDate', 'usuarios', legacyUserId); continue }
    let photoDataUrl: string | null = null
    if (row.imagen) {
      try { photoDataUrl = parsePhotoDataUrl(row.imagen) } catch { reportIssue('invalidPhoto', 'usuarios', legacyUserId) }
    }
    const rowTexts = rowText('usuarios', legacyUserId)
    const displayName = rowTexts.line(text(row, 'nombre'), legacyTextLimits.userDisplayName, `Usuario ${legacyUserId}`)
    rowTexts.report()
    users.push(hashRow({ legacyUserId, isActive: row.activo === '1', displayName, username: text(row, 'username'), legacyRole: row.puesto === 'Administrador' ? 'Administrador' as const : 'Empleado' as const, registeredAt: registered.instant.toISOString(), photoDataUrl }))
  }

  const clients: LegacyClient[] = []
  const ciecByLegacyClientId: Record<string, string> = {}
  for (const row of dump.tables.clientes) {
    const legacyClientId = text(row, 'id_cliente')
    countDiscarded('clientes.fiel', row.fiel)
    if (row.ciecf) {
      try { ciecByLegacyClientId[legacyClientId] = parseCiec(row.ciecf) } catch { reportIssue('invalidCiec', 'clientes', legacyClientId) }
    }
    const rfc = text(row, 'rfc').replace(/\s+/g, '').toUpperCase()
    // An RFC is never cut (a shortened one could match another taxpayer): an invalid one is reported and left empty.
    const isRfcValid = rfcPattern.test(rfc)
    if (rfc && !isRfcValid) reportIssue('invalidRfc', 'clientes', legacyClientId)
    const rowTexts = rowText('clientes', legacyClientId)
    clients.push(hashRow({ legacyClientId, displayName: rowTexts.line(text(row, 'nombre'), legacyTextLimits.clientDisplayName, `Cliente ${legacyClientId}`), rfc: isRfcValid ? rfc : null,
      emailAddress: rowTexts.email(text(row, 'email'), legacyTextLimits.emailAddress), phoneNumber: rowTexts.line(text(row, 'telefono'), legacyTextLimits.phoneNumber) }))
    rowTexts.report()
  }

  const assigneesByTaskId = new Map<string, string[]>()
  for (const row of dump.tables.tareas_de_empleados) {
    const taskId = text(row, 'id_tarea_asig')
    assigneesByTaskId.set(taskId, [...(assigneesByTaskId.get(taskId) ?? []), text(row, 'id_usuario_asig')])
  }
  const tasks: LegacyTask[] = []
  for (const row of dump.tables.tareas) {
    const legacyTaskId = text(row, 'id_tarea')
    const created = readMoment(dump, 'tareas', 'fecha_creacion', row.fecha_creacion ?? null)
    if (!created) { reportIssue('invalidDate', 'tareas', legacyTaskId); continue }
    const due = readMoment(dump, 'tareas', 'fecha_vencimiento', row.fecha_vencimiento ?? null)
    // A present but unreadable due date is reported and left empty; the task itself still imports.
    if (row.fecha_vencimiento && !due) reportIssue('invalidDate', 'tareas', legacyTaskId)
    const rowTexts = rowText('tareas', legacyTaskId)
    const title = rowTexts.line(text(row, 'titulo'), legacyTextLimits.taskTitle, `Tarea ${legacyTaskId}`), description = rowTexts.description(text(row, 'descripcion'), legacyTextLimits.taskDescription)
    rowTexts.report()
    // The task list rejects more than `maximumTaskAssignees`: the first ones by legacy id are kept and the cut is reported.
    const assigneeLegacyUserIds = [...new Set(assigneesByTaskId.get(legacyTaskId) ?? [])].sort()
    if (assigneeLegacyUserIds.length > maximumTaskAssignees) reportIssue('tooManyAssignees', 'tareas', legacyTaskId)
    tasks.push(hashRow({ legacyTaskId, title, description, legacyState: text(row, 'estado'), createdAt: created.instant.toISOString(), dueDate: due?.date ?? null, dueInstant: due?.instant.toISOString() ?? null, assigneeLegacyUserIds: assigneeLegacyUserIds.slice(0, maximumTaskAssignees) }))
  }

  const payments: LegacyPayment[] = []
  for (const row of dump.tables.pagoconcepto) {
    const legacyPaymentId = text(row, 'id')
    const moment = readMoment(dump, 'pagoconcepto', 'fecha', row.fecha ?? null)
    const incomeAmount = normalizeAmount(row.cobramos ?? null), expenseAmount = normalizeAmount(row.pagamos ?? null)
    if (!moment) { reportIssue('invalidDate', 'pagoconcepto', legacyPaymentId); continue }
    if (incomeAmount === null || expenseAmount === null) { reportIssue('invalidAmount', 'pagoconcepto', legacyPaymentId); continue }
    const rowTexts = rowText('pagoconcepto', legacyPaymentId)
    const concept = rowTexts.line(text(row, 'asunto'), maximumConceptLength, 'Sin concepto')
    rowTexts.report()
    payments.push(hashRow({ sourceTable: 'pagoconcepto' as const, legacyPaymentId, legacyClientId: row.cliente ?? null, legacyUserId: row.atendio ?? null, concept, incomeAmount, expenseAmount, movementDate: moment.date, movementTime: moment.time.slice(0, 5) }))
  }
  for (const row of dump.tables.pagomensual) {
    const legacyPaymentId = text(row, 'id')
    const moment = readMoment(dump, 'pagomensual', 'fechapago', row.fechapago ?? null)
    const month = readMoment(dump, 'pagomensual', 'mes_ano', row.mes_ano ?? null)
    const incomeAmount = normalizeAmount(row.honorarios ?? null)
    if (!moment || !month) { reportIssue('invalidDate', 'pagomensual', legacyPaymentId); continue }
    if (incomeAmount === null) { reportIssue('invalidAmount', 'pagomensual', legacyPaymentId); continue }
    const label = `Honorarios ${spanishMonths[Number(month.date.slice(5, 7)) - 1]} ${month.date.slice(0, 4)}`
    const rowTexts = rowText('pagomensual', legacyPaymentId)
    const subject = rowTexts.line(text(row, 'asunto'), maximumConceptLength)
    rowTexts.report()
    // The month label takes part of the concept, so cutting the combined text stays silent, as before.
    payments.push(hashRow({ sourceTable: 'pagomensual' as const, legacyPaymentId, legacyClientId: row.cliente ?? null, legacyUserId: row.atendio ?? null, concept: (subject ? `${label} — ${subject}` : label).slice(0, maximumConceptLength).trim(), incomeAmount, expenseAmount: '0.00', movementDate: moment.date, movementTime: moment.time.slice(0, 5) }))
  }

  const events: LegacyEvent[] = []
  for (const row of dump.tables.events) {
    const legacyEventId = text(row, 'id')
    const occurred = readMoment(dump, 'events', 'timestamp', row.timestamp ?? null)
    if (!occurred) { reportIssue('invalidDate', 'events', legacyEventId); continue }
    const payload = parseJsonColumn(row.payload ?? null), oldPayload = parseJsonColumn(row.oldpayload ?? null)
    if (!payload.isValid || !oldPayload.isValid) { reportIssue('invalidJson', 'events', legacyEventId); continue }
    events.push(hashRow({ legacyEventId, legacyUserId: row.userid ?? null, type: text(row, 'type'), aggregateId: row.aggregate_id ?? null, payload: scrubLegacyPayload(payload.parsed), oldPayload: scrubLegacyPayload(oldPayload.parsed), occurredAt: occurred.instant.toISOString() }))
  }

  const notes: LegacyImportedNote[] = dump.tables.notas.map((row) => {
    countDiscarded('notas.color', row.color)
    return { noteId: 'legacy-' + text(row, 'id'), title: text(row, 'titulo'), markdown: text(row, 'descripcion'), folder: 'General', isPinned: row.pinned === '1', isArchived: false }
  })

  return {
    global: { sourceSha256, users, clients, tasks, payments, events, normalizationIssues: issues, discardedFieldCounts, ignoredTables: dump.ignoredTables },
    local: { ciecByLegacyClientId, notes },
  }
}
