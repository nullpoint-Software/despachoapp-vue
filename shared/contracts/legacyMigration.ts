import type { LegacyClient, LegacyEvent, LegacyGlobalSnapshot, LegacyNormalizationIssue, LegacyPayment, LegacyTask, LegacyUser } from '../legacyMigration/legacySnapshot'
import { parseHostId } from './discovery'
import type { LegacyImportedNote } from './localNotes'
import { pairingRecord, pairingText } from './pairing'
import { maximumTaskAssignees } from './tasks'
import { parsePhotoDataUrl } from './userPhotos'

/**
 * Migración desde el sistema heredado (etapa 8.1): analizar un volcado SQL, resolver conflictos y ejecutar.
 * - Renderer → Main: elegir el archivo, analizar (Main lo lee y reduce a un snapshot GLOBAL + uno LOCAL), ejecutar,
 *   reintentar el paso local (CIEC, notas) y consultar eventos.
 * - Main → Host (canal privado): sólo viaja el snapshot GLOBAL; el Host nunca recibe contraseñas, FIEL ni CIEC, por eso
 *   cada entidad se valida con claves exactas (un campo extra como `ciec` se rechaza).
 * - `execute` es la única acción que pide la contraseña de la sesión y exige escribir la palabra de confirmación.
 */
export const legacyMigrationChannel = 'legacyMigration:run'
export const legacyMigrationConfirmationWord = 'MIGRAR'
export const legacyAnalysisLifetimeMilliseconds = 30 * 60 * 1000
export const maximumLegacyDumpBytes = 256 * 1024 * 1024

/**
 * Fixed whitelist of Host failures the UI must tell apart (spec "Errores"). Only these exact messages cross the private
 * channel, as a code; any other error stays anonymous so raw messages never leave the Host.
 */
export const legacyFailureMessages = {
  analysisStale: 'Analysis stale', analysisExpired: 'Analysis expired', backupUnavailable: 'Backup unavailable', backupFailed: 'Backup failed',
  decisionsIncomplete: 'Decisions incomplete', invalidDecision: 'Invalid decision',
} as const
export type LegacyFailureCode = keyof typeof legacyFailureMessages
/** Host side: the code of an error whose message is exactly a whitelisted one, otherwise null. */
export function readLegacyFailureCode(error: unknown): LegacyFailureCode | null {
  if (!(error instanceof Error)) return null
  return (Object.keys(legacyFailureMessages) as LegacyFailureCode[]).find(code => legacyFailureMessages[code] === error.message) ?? null
}
/** Main side: validates a code received over the channel (anything else is not a legacy failure). */
export function parseLegacyFailureCode(value: unknown): LegacyFailureCode | null {
  return typeof value === 'string' && Object.hasOwn(legacyFailureMessages, value) ? value as LegacyFailureCode : null
}

export type LegacyConflictKind = 'userExists' | 'invalidUsername' | 'clientExists' | 'duplicateRfc' | 'changedSinceImport' | 'expenseClient'
export type LegacyIssueKind = 'invalidAmount' | 'orphanPayment' | 'unknownTaskState' | 'inProgressWithoutAssignee' | 'missingAttendant' | 'deletedAtSource' | 'invalidPhoto' | 'invalidCiec' | 'zeroPayment' | 'invalidDate' | 'invalidJson' | 'truncatedText' | 'invalidRfc' | 'cleanedText' | 'tooManyAssignees'
export type LegacyDecision =
  | { key: string; choice: 'link'; targetId: string }
  | { key: string; choice: 'create'; username?: string }
  | { key: string; choice: 'reject' }
  | { key: string; choice: 'keepCurrent' | 'applyChange' }
  | { key: string; choice: 'officeMovement' | 'regularClient' }
  | { key: string; choice: 'taskState'; state: 'available' | 'inProgress' | 'completed' }
  | { key: string; choice: 'primary'; legacyClientId: string }
export interface LegacyRoleChoice { administratorRoleId: string; employeeRoleId: string | null }
/**
 * `dependentKeys` (Ruling 19): keys of the payments that depend on this client and would be written (new non-zero ones and
 * changed ones). Only client conflicts that offer `reject` fill it; when the client is rejected each new dependent needs
 * its own `officeMovement`/`reject` decision and a changed one cannot use `applyChange`. Empty for every other conflict.
 */
export interface LegacyConflict { key: string; kind: LegacyConflictKind; sourceTable: string; legacyId: string; legacyLabel: string; currentLabel: string | null; candidates: { targetId: string; label: string }[]; allowedChoices: LegacyDecision['choice'][]; dependentKeys: string[] }
export interface LegacyIssue { key: string; kind: LegacyIssueKind; sourceTable: string; legacyId: string; legacyLabel: string; allowedChoices: LegacyDecision['choice'][]; isInformational: boolean }
export interface LegacyEntityCounts { create: number; link: number; skip: number; reject: number; update: number }
/** `noKnownTables`: the dump has no CREATE/INSERT of any legacy table (spec "Errores": "sin tablas reconocibles"). */
export type LegacyBlocker = { kind: 'noKnownTables' } | { kind: 'schemaMismatch'; table: string } | { kind: 'passwordCheckFailed'; failedCount: number } | { kind: 'parseError'; lineNumber: number; table: string | null; message: string }
export interface LegacyMigrationPreview { analysisId: string; expiresAt: string; signature: string; counts: Record<'users' | 'clients' | 'tasks' | 'movements' | 'events' | 'notes' | 'ciec', LegacyEntityCounts>; conflicts: LegacyConflict[]; issues: LegacyIssue[]; blockers: LegacyBlocker[]; ignoredTables: string[]; discardedFieldCounts: Record<string, number>; roles: { roleId: string; displayName: string }[] }
/**
 * `createdAmounts`: per legacy payment table, the sum of the income and expense movements created in the run, as
 * two-decimal text (summed in integer cents), so the office can reconcile against the old system (spec "Cierre de 8.1").
 */
export interface LegacyCreatedAmounts { income: string; expense: string }
export interface LegacyRunSummary { runId: string; backupId: string; created: Record<string, number>; linked: Record<string, number>; updated: Record<string, number>; voided: number; createdAmounts: Record<'pagoconcepto' | 'pagomensual', LegacyCreatedAmounts>; pendingPasswordUserIds: string[]; clientIdByLegacyClientId: Record<string, string> }
export interface LegacyEventRecord { legacyEventId: string; userDisplayName: string | null; type: string; aggregateId: string | null; targetId: string | null; payload: unknown; oldPayload: unknown; occurredAt: string }
export interface LegacyEventFilter { fromDate: string | null; toDate: string | null; legacyUserId: string | null; type: string | null; offset: number }
export interface LegacyLocalOutcome { savedCiecCount: number; keptExistingCiecCount: number; failedCiecCount: number }

/** Main → Host (canal privado). */
export type LegacyMigrationHostRequest =
  | { action: 'analyze'; snapshot: LegacyGlobalSnapshot }
  | { action: 'execute'; analysisId: string; signature: string; decisions: LegacyDecision[]; roles: LegacyRoleChoice; confirmation: string }
  | { action: 'readRunMapping'; sourceSha256: string }
  | { action: 'listEvents'; filter: LegacyEventFilter }
export type LegacyMigrationHostResult =
  | { status: 'analyzed'; preview: LegacyMigrationPreview }
  | { status: 'executed'; summary: LegacyRunSummary }
  | { status: 'runMapping'; clientIdByLegacyClientId: Record<string, string> }
  | { status: 'events'; events: LegacyEventRecord[]; hasMore: boolean }
/** Renderer → Main. */
export type LegacyMigrationRequest =
  | { action: 'chooseDump' }
  | { action: 'analyze'; dumpPath: string; legacyWord: string }
  | { action: 'execute'; analysisId: string; signature: string; decisions: LegacyDecision[]; roles: LegacyRoleChoice; confirmation: string }
  | { action: 'retryLocal'; dumpPath: string }
  | { action: 'listEvents'; filter: LegacyEventFilter }
  /** CSV del reporte armado en el Renderer (sin secretos); Main sólo pide dónde guardarlo y lo escribe (las descargas del Renderer están bloqueadas). */
  | { action: 'saveReport'; csv: string }
/** Las notas vuelven al Renderer porque la fusión de notas (`mergeImportedNotes`) vive allí. */
export type LegacyMigrationResult =
  | { status: 'dump'; dumpPath: string | null }
  | { status: 'analyzed'; preview: LegacyMigrationPreview; localCounts: { ciec: number; notes: number } }
  | { status: 'executed'; summary: LegacyRunSummary; local: LegacyLocalOutcome; notes: LegacyImportedNote[] }
  | { status: 'localRetried'; local: LegacyLocalOutcome; notes: LegacyImportedNote[] }
  | { status: 'events'; events: LegacyEventRecord[]; hasMore: boolean }
  | { status: 'reportSaved'; isSaved: boolean }

/** Sólo ejecutar pide la contraseña de la sesión. */
export function requiresLegacyReauthentication(request: LegacyMigrationRequest): boolean { return request.action === 'execute' }

const maximumUsers = 100
const maximumRows = 20000
const maximumEvents = 200000
const maximumDecisions = 200000
/** legacyEvents.legacyEventId / legacyUserId are VARCHAR(32); legacy ids are integers, so this only stops a corrupt dump before the backup. */
const maximumLegacyIdLength = 32
const maximumAggregateIdLength = 64
export const maximumLegacyLabelLength = 500
/**
 * Text limits = the Fiscenix columns the executor writes (Ruling 20): clients.displayName 100, clientProfiles.rfc 13 /
 * emailAddress 254 / phoneNumber 40, users.displayName 100, tasks.title 160 / description 2000. `buildLegacySnapshot`
 * truncates to these and reports `truncatedText`, so a value that would fail the INSERT after the backup never arrives.
 */
export const legacyTextLimits = { clientDisplayName: 100, rfc: 13, emailAddress: 254, phoneNumber: 40, userDisplayName: 100, taskTitle: 160, taskDescription: 2000 } as const
const maximumReportLength = 5_000_000

const decisionChoices = ['link', 'create', 'reject', 'keepCurrent', 'applyChange', 'officeMovement', 'regularClient', 'taskState', 'primary'] as const
const taskStates = ['available', 'inProgress', 'completed'] as const
const conflictKinds: readonly string[] = ['userExists', 'invalidUsername', 'clientExists', 'duplicateRfc', 'changedSinceImport', 'expenseClient']
const issueKinds: readonly string[] = ['invalidAmount', 'orphanPayment', 'unknownTaskState', 'inProgressWithoutAssignee', 'missingAttendant', 'deletedAtSource', 'invalidPhoto', 'invalidCiec', 'zeroPayment', 'invalidDate', 'invalidJson', 'truncatedText', 'invalidRfc', 'cleanedText', 'tooManyAssignees']
const normalizationIssueKinds: readonly string[] = ['invalidCiec', 'invalidPhoto', 'invalidAmount', 'invalidDate', 'invalidJson', 'truncatedText', 'invalidRfc', 'cleanedText', 'tooManyAssignees']
const countKeys = ['users', 'clients', 'tasks', 'movements', 'events', 'notes', 'ciec'] as const

function fail(): never { throw new Error('Invalid legacy migration data') }
function exactKeys(data: Record<string, unknown>, keys: readonly string[]): void { if (Object.keys(data).sort().join() !== [...keys].sort().join()) fail() }
/** Texto que puede estar vacío (descripciones, correos); sin recortar porque el hash de la fila depende del valor exacto. */
function plainText(value: unknown, maximum: number): string { if (typeof value !== 'string' || value.length > maximum) fail(); return value }
/**
 * Text Fiscenix later reads with `pairingText` (names, titles, concepts): it must already be in that exact form, because a
 * row that fails it would break the list page that shows it. `buildLegacySnapshot` cleans it before it gets here.
 */
function readableLine(value: unknown, maximum: number): string {
  try { if (pairingText(value, maximum) === value) return value } catch { /* rejected below */ }
  return fail()
}
/** No control characters except line break and tab (`parseTaskDescription`), and no carriage return left. */
function readableText(value: unknown, maximum: number, isMultiline: boolean): string {
  const text = plainText(value, maximum)
  if ([...text].some(character => { const code = character.charCodeAt(0); return (code < 32 && !(isMultiline && (code === 10 || code === 9))) || code === 127 })) fail()
  return text
}
function readableEmail(value: unknown): string {
  const text = readableText(value, legacyTextLimits.emailAddress, false)
  if (text && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) fail()
  return text
}
function nullableText(value: unknown, maximum: number): string | null { return value === null ? null : plainText(value, maximum) }
function legacyId(value: unknown): string { const text = plainText(value, maximumLegacyIdLength); if (!text) fail(); return text }
function nullableLegacyId(value: unknown): string | null { return value === null ? null : legacyId(value) }
function boolean(value: unknown): boolean { if (typeof value !== 'boolean') fail(); return value }
function count(value: unknown): number { if (!Number.isSafeInteger(value) || Number(value) < 0) fail(); return Number(value) }
function timestamp(value: unknown): string { const text = plainText(value, 40); if (!Number.isFinite(Date.parse(text))) fail(); return text }
function nullableTimestamp(value: unknown): string | null { return value === null ? null : timestamp(value) }
function list(value: unknown, maximum: number): unknown[] { if (!Array.isArray(value) || value.length > maximum) fail(); return value as unknown[] }
function countRecord(value: unknown): Record<string, number> {
  const data = pairingRecord(value)
  if (Object.keys(data).length > 200) fail()
  return Object.fromEntries(Object.entries(data).map(([key, entry]) => [plainText(key, 100), count(entry)]))
}
function textList(value: unknown, maximum: number): string[] { return list(value, maximum).map(entry => plainText(entry, 100)) }
function choiceList(value: unknown): LegacyDecision['choice'][] {
  return list(value, decisionChoices.length).map(entry => { if (!decisionChoices.includes(entry as LegacyDecision['choice'])) fail(); return entry as LegacyDecision['choice'] })
}

/** Cada decisión lleva las claves exactas de su opción; una opción desconocida se rechaza. */
function parseDecision(value: unknown): LegacyDecision {
  const data = pairingRecord(value)
  const key = plainText(data.key, 200)
  if (!key) fail()
  switch (data.choice) {
    case 'link': exactKeys(data, ['key', 'choice', 'targetId']); return { key, choice: 'link', targetId: parseHostId(data.targetId) }
    case 'create':
      if ('username' in data) { exactKeys(data, ['key', 'choice', 'username']); return { key, choice: 'create', username: plainText(data.username, 100) } }
      exactKeys(data, ['key', 'choice']); return { key, choice: 'create' }
    case 'reject': exactKeys(data, ['key', 'choice']); return { key, choice: 'reject' }
    case 'keepCurrent': case 'applyChange': case 'officeMovement': case 'regularClient': exactKeys(data, ['key', 'choice']); return { key, choice: data.choice }
    case 'taskState':
      exactKeys(data, ['key', 'choice', 'state'])
      if (!taskStates.includes(data.state as typeof taskStates[number])) fail()
      return { key, choice: 'taskState', state: data.state as typeof taskStates[number] }
    case 'primary': exactKeys(data, ['key', 'choice', 'legacyClientId']); return { key, choice: 'primary', legacyClientId: legacyId(data.legacyClientId) }
    default: return fail()
  }
}
function parseDecisions(value: unknown): LegacyDecision[] { return list(value, maximumDecisions).map(parseDecision) }
function parseRoles(value: unknown): LegacyRoleChoice {
  const data = pairingRecord(value); exactKeys(data, ['administratorRoleId', 'employeeRoleId'])
  return { administratorRoleId: parseHostId(data.administratorRoleId), employeeRoleId: data.employeeRoleId === null ? null : parseHostId(data.employeeRoleId) }
}
/** Escribir la palabra es obligatorio: no basta un clic. */
function parseConfirmation(value: unknown): string { if (value !== legacyMigrationConfirmationWord) throw new Error('Legacy migration confirmation required'); return legacyMigrationConfirmationWord }
function parseEventFilter(value: unknown): LegacyEventFilter {
  const data = pairingRecord(value); exactKeys(data, ['fromDate', 'toDate', 'legacyUserId', 'type', 'offset'])
  return { fromDate: nullableText(data.fromDate, 10), toDate: nullableText(data.toDate, 10), legacyUserId: nullableLegacyId(data.legacyUserId), type: nullableText(data.type, 100), offset: count(data.offset) }
}

function parseSnapshotUser(value: unknown): LegacyUser {
  const data = pairingRecord(value); exactKeys(data, ['legacyUserId', 'isActive', 'displayName', 'username', 'legacyRole', 'registeredAt', 'photoDataUrl', 'rowHash'])
  if (data.legacyRole !== 'Administrador' && data.legacyRole !== 'Empleado') fail()
  // El Host es frontera de confianza: la foto se vuelve a validar (imagen jpeg/png/webp y tamaño máximo).
  return { legacyUserId: legacyId(data.legacyUserId), isActive: boolean(data.isActive), displayName: readableLine(data.displayName, legacyTextLimits.userDisplayName), username: plainText(data.username, 200), legacyRole: data.legacyRole, registeredAt: timestamp(data.registeredAt), photoDataUrl: data.photoDataUrl === null ? null : parsePhotoDataUrl(data.photoDataUrl), rowHash: plainText(data.rowHash, 64) }
}
function parseSnapshotClient(value: unknown): LegacyClient {
  const data = pairingRecord(value); exactKeys(data, ['legacyClientId', 'displayName', 'rfc', 'emailAddress', 'phoneNumber', 'rowHash'])
  return { legacyClientId: legacyId(data.legacyClientId), displayName: readableLine(data.displayName, legacyTextLimits.clientDisplayName), rfc: nullableText(data.rfc, legacyTextLimits.rfc), emailAddress: readableEmail(data.emailAddress), phoneNumber: readableText(data.phoneNumber, legacyTextLimits.phoneNumber, false), rowHash: plainText(data.rowHash, 64) }
}
function parseSnapshotTask(value: unknown): LegacyTask {
  const data = pairingRecord(value); exactKeys(data, ['legacyTaskId', 'title', 'description', 'legacyState', 'createdAt', 'dueDate', 'dueInstant', 'assigneeLegacyUserIds', 'rowHash'])
  return { legacyTaskId: legacyId(data.legacyTaskId), title: readableLine(data.title, legacyTextLimits.taskTitle), description: readableText(data.description, legacyTextLimits.taskDescription, true), legacyState: plainText(data.legacyState, 100), createdAt: timestamp(data.createdAt), dueDate: nullableText(data.dueDate, 10), dueInstant: nullableTimestamp(data.dueInstant), assigneeLegacyUserIds: list(data.assigneeLegacyUserIds, maximumTaskAssignees).map(legacyId), rowHash: plainText(data.rowHash, 64) }
}
function parseSnapshotPayment(value: unknown): LegacyPayment {
  const data = pairingRecord(value); exactKeys(data, ['sourceTable', 'legacyPaymentId', 'legacyClientId', 'legacyUserId', 'concept', 'incomeAmount', 'expenseAmount', 'movementDate', 'movementTime', 'rowHash'])
  if (data.sourceTable !== 'pagoconcepto' && data.sourceTable !== 'pagomensual') fail()
  return { sourceTable: data.sourceTable, legacyPaymentId: legacyId(data.legacyPaymentId), legacyClientId: nullableLegacyId(data.legacyClientId), legacyUserId: nullableLegacyId(data.legacyUserId), concept: readableLine(data.concept, 200), incomeAmount: plainText(data.incomeAmount, 20), expenseAmount: plainText(data.expenseAmount, 20), movementDate: plainText(data.movementDate, 10), movementTime: plainText(data.movementTime, 5), rowHash: plainText(data.rowHash, 64) }
}
/** `payload`/`oldPayload` son JSON ya depurado por `scrubLegacyPayload`; se aceptan tal cual. */
function parseSnapshotEvent(value: unknown): LegacyEvent {
  const data = pairingRecord(value); exactKeys(data, ['legacyEventId', 'legacyUserId', 'type', 'aggregateId', 'payload', 'oldPayload', 'occurredAt', 'rowHash'])
  return { legacyEventId: legacyId(data.legacyEventId), legacyUserId: nullableLegacyId(data.legacyUserId), type: plainText(data.type, 100), aggregateId: nullableText(data.aggregateId, maximumAggregateIdLength), payload: data.payload, oldPayload: data.oldPayload, occurredAt: timestamp(data.occurredAt), rowHash: plainText(data.rowHash, 64) }
}
function parseNormalizationIssue(value: unknown): LegacyNormalizationIssue {
  const data = pairingRecord(value); exactKeys(data, ['kind', 'sourceTable', 'legacyId'])
  if (!normalizationIssueKinds.includes(data.kind as string)) fail()
  return { kind: data.kind as LegacyNormalizationIssue['kind'], sourceTable: plainText(data.sourceTable, 100) as LegacyNormalizationIssue['sourceTable'], legacyId: legacyId(data.legacyId) }
}
function parseSnapshot(value: unknown): LegacyGlobalSnapshot {
  const data = pairingRecord(value); exactKeys(data, ['sourceSha256', 'users', 'clients', 'tasks', 'payments', 'events', 'normalizationIssues', 'discardedFieldCounts', 'ignoredTables'])
  const sourceSha256 = plainText(data.sourceSha256, 64)
  if (!/^[a-f0-9]{64}$/.test(sourceSha256)) fail()
  return {
    sourceSha256, users: list(data.users, maximumUsers).map(parseSnapshotUser), clients: list(data.clients, maximumRows).map(parseSnapshotClient), tasks: list(data.tasks, maximumRows).map(parseSnapshotTask),
    payments: list(data.payments, maximumRows).map(parseSnapshotPayment), events: list(data.events, maximumEvents).map(parseSnapshotEvent), normalizationIssues: list(data.normalizationIssues, maximumEvents).map(parseNormalizationIssue),
    discardedFieldCounts: countRecord(data.discardedFieldCounts), ignoredTables: textList(data.ignoredTables, 200),
  }
}

function parseEntityCounts(value: unknown): LegacyEntityCounts {
  const data = pairingRecord(value); exactKeys(data, ['create', 'link', 'skip', 'reject', 'update'])
  return { create: count(data.create), link: count(data.link), skip: count(data.skip), reject: count(data.reject), update: count(data.update) }
}
function parseConflict(value: unknown): LegacyConflict {
  const data = pairingRecord(value); exactKeys(data, ['key', 'kind', 'sourceTable', 'legacyId', 'legacyLabel', 'currentLabel', 'candidates', 'allowedChoices', 'dependentKeys'])
  if (!conflictKinds.includes(data.kind as string)) fail()
  return {
    key: plainText(data.key, 200), kind: data.kind as LegacyConflictKind, sourceTable: plainText(data.sourceTable, 100), legacyId: legacyId(data.legacyId), legacyLabel: plainText(data.legacyLabel, maximumLegacyLabelLength), currentLabel: nullableText(data.currentLabel, maximumLegacyLabelLength),
    candidates: list(data.candidates, 100).map(entry => { const candidate = pairingRecord(entry); exactKeys(candidate, ['targetId', 'label']); return { targetId: parseHostId(candidate.targetId), label: plainText(candidate.label, maximumLegacyLabelLength) } }),
    allowedChoices: choiceList(data.allowedChoices), dependentKeys: list(data.dependentKeys, maximumRows).map(entry => plainText(entry, 200)),
  }
}
function parseIssue(value: unknown): LegacyIssue {
  const data = pairingRecord(value); exactKeys(data, ['key', 'kind', 'sourceTable', 'legacyId', 'legacyLabel', 'allowedChoices', 'isInformational'])
  if (!issueKinds.includes(data.kind as string)) fail()
  return { key: plainText(data.key, 200), kind: data.kind as LegacyIssueKind, sourceTable: plainText(data.sourceTable, 100), legacyId: legacyId(data.legacyId), legacyLabel: plainText(data.legacyLabel, maximumLegacyLabelLength), allowedChoices: choiceList(data.allowedChoices), isInformational: boolean(data.isInformational) }
}
function parseBlocker(value: unknown): LegacyBlocker {
  const data = pairingRecord(value)
  if (data.kind === 'noKnownTables') { exactKeys(data, ['kind']); return { kind: 'noKnownTables' } }
  if (data.kind === 'schemaMismatch') { exactKeys(data, ['kind', 'table']); return { kind: 'schemaMismatch', table: plainText(data.table, 100) } }
  if (data.kind === 'passwordCheckFailed') { exactKeys(data, ['kind', 'failedCount']); return { kind: 'passwordCheckFailed', failedCount: count(data.failedCount) } }
  if (data.kind === 'parseError') { exactKeys(data, ['kind', 'lineNumber', 'table', 'message']); return { kind: 'parseError', lineNumber: count(data.lineNumber), table: nullableText(data.table, 100), message: plainText(data.message, 500) } }
  return fail()
}
/**
 * `allowLocalBlocked`: Main devuelve al Renderer, sin consultar al Host, una vista previa bloqueada (error de lectura, esquema o
 * palabra incorrecta) con id, firma y vencimiento vacíos. Sólo se acepta así si hay bloqueos y no hay conflictos ni incidencias;
 * la respuesta del Host siempre exige id, firma y fecha válidos.
 */
function parsePreview(value: unknown, allowLocalBlocked = false): LegacyMigrationPreview {
  const data = pairingRecord(value); exactKeys(data, ['analysisId', 'expiresAt', 'signature', 'counts', 'conflicts', 'issues', 'blockers', 'ignoredTables', 'discardedFieldCounts', 'roles'])
  const counts = pairingRecord(data.counts); exactKeys(counts, countKeys)
  const isLocalBlocked = allowLocalBlocked && data.analysisId === '' && data.expiresAt === '' && data.signature === '' && list(data.blockers, 1000).length > 0 && list(data.conflicts, 1).length === 0 && list(data.issues, 1).length === 0
  return {
    analysisId: isLocalBlocked ? '' : parseHostId(data.analysisId), expiresAt: isLocalBlocked ? '' : timestamp(data.expiresAt), signature: isLocalBlocked ? '' : plainText(data.signature, 256),
    counts: Object.fromEntries(countKeys.map(key => [key, parseEntityCounts(counts[key])])) as LegacyMigrationPreview['counts'],
    conflicts: list(data.conflicts, maximumDecisions).map(parseConflict), issues: list(data.issues, maximumDecisions).map(parseIssue), blockers: list(data.blockers, 1000).map(parseBlocker),
    ignoredTables: textList(data.ignoredTables, 200), discardedFieldCounts: countRecord(data.discardedFieldCounts),
    roles: list(data.roles, 200).map(entry => { const role = pairingRecord(entry); exactKeys(role, ['roleId', 'displayName']); return { roleId: parseHostId(role.roleId), displayName: pairingText(role.displayName, 100) } }),
  }
}
function parseIdMap(value: unknown): Record<string, string> {
  const data = pairingRecord(value)
  if (Object.keys(data).length > maximumRows) fail()
  return Object.fromEntries(Object.entries(data).map(([key, entry]) => [legacyId(key), parseHostId(entry)]))
}
function parseSummary(value: unknown): LegacyRunSummary {
  const data = pairingRecord(value); exactKeys(data, ['runId', 'backupId', 'created', 'linked', 'updated', 'voided', 'createdAmounts', 'pendingPasswordUserIds', 'clientIdByLegacyClientId'])
  const amounts = pairingRecord(data.createdAmounts); exactKeys(amounts, ['pagoconcepto', 'pagomensual'])
  const parseAmounts = (entry: unknown): LegacyCreatedAmounts => {
    const totals = pairingRecord(entry); exactKeys(totals, ['income', 'expense'])
    const amount = (total: unknown): string => { const text = plainText(total, 20); if (!/^\d{1,17}\.\d{2}$/.test(text)) fail(); return text }
    return { income: amount(totals.income), expense: amount(totals.expense) }
  }
  return { runId: parseHostId(data.runId), backupId: parseHostId(data.backupId), created: countRecord(data.created), linked: countRecord(data.linked), updated: countRecord(data.updated), voided: count(data.voided),
    createdAmounts: { pagoconcepto: parseAmounts(amounts.pagoconcepto), pagomensual: parseAmounts(amounts.pagomensual) }, pendingPasswordUserIds: list(data.pendingPasswordUserIds, maximumUsers).map(parseHostId), clientIdByLegacyClientId: parseIdMap(data.clientIdByLegacyClientId) }
}
function parseEventRecords(data: Record<string, unknown>): { events: LegacyEventRecord[]; hasMore: boolean } {
  exactKeys(data, ['status', 'events', 'hasMore'])
  return {
    hasMore: boolean(data.hasMore),
    events: list(data.events, 1000).map(entry => {
      const event = pairingRecord(entry); exactKeys(event, ['legacyEventId', 'userDisplayName', 'type', 'aggregateId', 'targetId', 'payload', 'oldPayload', 'occurredAt'])
      return { legacyEventId: legacyId(event.legacyEventId), userDisplayName: nullableText(event.userDisplayName, 200), type: plainText(event.type, 100), aggregateId: nullableText(event.aggregateId, maximumAggregateIdLength), targetId: nullableText(event.targetId, maximumAggregateIdLength), payload: event.payload, oldPayload: event.oldPayload, occurredAt: timestamp(event.occurredAt) }
    }),
  }
}
function parseLocalOutcome(value: unknown): LegacyLocalOutcome {
  const data = pairingRecord(value); exactKeys(data, ['savedCiecCount', 'keptExistingCiecCount', 'failedCiecCount'])
  return { savedCiecCount: count(data.savedCiecCount), keptExistingCiecCount: count(data.keptExistingCiecCount), failedCiecCount: count(data.failedCiecCount) }
}
function parseNotes(value: unknown): LegacyImportedNote[] {
  return list(value, 1000).map(entry => {
    const note = pairingRecord(entry); exactKeys(note, ['noteId', 'title', 'markdown', 'folder', 'isPinned', 'isArchived'])
    return { noteId: plainText(note.noteId, 100), title: plainText(note.title, 200), markdown: plainText(note.markdown, 1000000), folder: plainText(note.folder, 120), isPinned: boolean(note.isPinned), isArchived: boolean(note.isArchived) }
  })
}

export function parseLegacyMigrationRequest(value: unknown): LegacyMigrationRequest {
  const data = pairingRecord(value)
  if (data.action === 'chooseDump') { exactKeys(data, ['action']); return { action: 'chooseDump' } }
  if (data.action === 'analyze') {
    exactKeys(data, ['action', 'dumpPath', 'legacyWord'])
    if (typeof data.legacyWord !== 'string' || !data.legacyWord.length || data.legacyWord.length > 64 || data.legacyWord !== data.legacyWord.trim()) fail() // same rule as deriveLegacyCipherMaterial
    return { action: 'analyze', dumpPath: pairingText(data.dumpPath, 1024), legacyWord: data.legacyWord }
  }
  if (data.action === 'execute') {
    exactKeys(data, ['action', 'analysisId', 'signature', 'decisions', 'roles', 'confirmation'])
    return { action: 'execute', analysisId: parseHostId(data.analysisId), signature: plainText(data.signature, 256), decisions: parseDecisions(data.decisions), roles: parseRoles(data.roles), confirmation: parseConfirmation(data.confirmation) }
  }
  if (data.action === 'retryLocal') { exactKeys(data, ['action', 'dumpPath']); return { action: 'retryLocal', dumpPath: pairingText(data.dumpPath, 1024) } }
  if (data.action === 'listEvents') { exactKeys(data, ['action', 'filter']); return { action: 'listEvents', filter: parseEventFilter(data.filter) } }
  if (data.action === 'saveReport') { exactKeys(data, ['action', 'csv']); return { action: 'saveReport', csv: plainText(data.csv, maximumReportLength) } }
  return fail()
}
export function parseLegacyMigrationHostRequest(value: unknown): LegacyMigrationHostRequest {
  const data = pairingRecord(value)
  if (data.action === 'analyze') { exactKeys(data, ['action', 'snapshot']); return { action: 'analyze', snapshot: parseSnapshot(data.snapshot) } }
  if (data.action === 'execute') {
    exactKeys(data, ['action', 'analysisId', 'signature', 'decisions', 'roles', 'confirmation'])
    return { action: 'execute', analysisId: parseHostId(data.analysisId), signature: plainText(data.signature, 256), decisions: parseDecisions(data.decisions), roles: parseRoles(data.roles), confirmation: parseConfirmation(data.confirmation) }
  }
  if (data.action === 'readRunMapping') {
    exactKeys(data, ['action', 'sourceSha256'])
    if (typeof data.sourceSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(data.sourceSha256)) fail()
    return { action: 'readRunMapping', sourceSha256: data.sourceSha256 }
  }
  if (data.action === 'listEvents') { exactKeys(data, ['action', 'filter']); return { action: 'listEvents', filter: parseEventFilter(data.filter) } }
  return fail()
}
export function parseLegacyMigrationHostResult(value: unknown): LegacyMigrationHostResult {
  const data = pairingRecord(value)
  // `analyzed` no lleva `payload`: la vista previa nunca incluye contenido de eventos (claves exactas lo garantizan).
  if (data.status === 'analyzed') { exactKeys(data, ['status', 'preview']); return { status: 'analyzed', preview: parsePreview(data.preview) } }
  if (data.status === 'executed') { exactKeys(data, ['status', 'summary']); return { status: 'executed', summary: parseSummary(data.summary) } }
  if (data.status === 'runMapping') { exactKeys(data, ['status', 'clientIdByLegacyClientId']); return { status: 'runMapping', clientIdByLegacyClientId: parseIdMap(data.clientIdByLegacyClientId) } }
  if (data.status === 'events') return { status: 'events', ...parseEventRecords(data) }
  return fail()
}
export function parseLegacyMigrationResult(value: unknown): LegacyMigrationResult {
  const data = pairingRecord(value)
  if (data.status === 'dump') { exactKeys(data, ['status', 'dumpPath']); return { status: 'dump', dumpPath: data.dumpPath === null ? null : pairingText(data.dumpPath, 1024) } }
  if (data.status === 'analyzed') {
    exactKeys(data, ['status', 'preview', 'localCounts'])
    const localCounts = pairingRecord(data.localCounts); exactKeys(localCounts, ['ciec', 'notes'])
    return { status: 'analyzed', preview: parsePreview(data.preview, true), localCounts: { ciec: count(localCounts.ciec), notes: count(localCounts.notes) } }
  }
  if (data.status === 'executed') { exactKeys(data, ['status', 'summary', 'local', 'notes']); return { status: 'executed', summary: parseSummary(data.summary), local: parseLocalOutcome(data.local), notes: parseNotes(data.notes) } }
  if (data.status === 'localRetried') { exactKeys(data, ['status', 'local', 'notes']); return { status: 'localRetried', local: parseLocalOutcome(data.local), notes: parseNotes(data.notes) } }
  if (data.status === 'events') return { status: 'events', ...parseEventRecords(data) }
  if (data.status === 'reportSaved') { exactKeys(data, ['status', 'isSaved']); return { status: 'reportSaved', isSaved: boolean(data.isSaved) } }
  return fail()
}
