import { describe, expect, it } from 'vitest'
import {
  parseLegacyMigrationHostRequest, parseLegacyMigrationHostResult, parseLegacyMigrationRequest, parseLegacyMigrationResult, requiresLegacyReauthentication,
} from '../../shared/contracts/legacyMigration'

const id = '11111111-1111-4111-8111-111111111111'
const hash = 'a'.repeat(64)
const roles = { administratorRoleId: id, employeeRoleId: null }
const filter = { fromDate: null, toDate: null, legacyUserId: null, type: null, offset: 0 }
const entityCounts = { create: 1, link: 0, skip: 0, reject: 0, update: 0 }
const preview = {
  analysisId: id, expiresAt: '2026-10-31T12:00:00.000Z', signature: 'sig',
  counts: { users: entityCounts, clients: entityCounts, tasks: entityCounts, movements: entityCounts, events: entityCounts, notes: entityCounts, ciec: entityCounts },
  conflicts: [{ key: 'user:1', kind: 'userExists', sourceTable: 'usuarios', legacyId: '1', legacyLabel: 'Ana', currentLabel: 'Ana G', candidates: [{ targetId: id, label: 'Ana G' }], allowedChoices: ['link', 'create', 'reject'], dependentKeys: [] }],
  issues: [{ key: 'event:9', kind: 'invalidJson', sourceTable: 'events', legacyId: '9', legacyLabel: 'Evento 9', allowedChoices: [], isInformational: true }],
  blockers: [{ kind: 'parseError', lineNumber: 3, table: null, message: 'bad' }], ignoredTables: ['x'], discardedFieldCounts: { 'usuarios.password': 2 }, roles: [{ roleId: id, displayName: 'Admin' }],
}
const summary = { runId: id, backupId: id, created: { users: 1 }, linked: {}, updated: {}, voided: 0, createdAmounts: { pagoconcepto: { income: '110.35', expense: '0.00' }, pagomensual: { income: '0.00', expense: '0.00' } }, pendingPasswordUserIds: [id], clientIdByLegacyClientId: { '5': id } }
const eventRecord = { legacyEventId: '1', userDisplayName: null, type: 'login', aggregateId: null, targetId: null, payload: { a: 1 }, oldPayload: null, occurredAt: '2026-10-31T12:00:00.000Z' }
const snapshot = () => ({
  sourceSha256: hash,
  users: [{ legacyUserId: '1', isActive: true, displayName: 'Ana', username: 'ana', legacyRole: 'Empleado', registeredAt: '2025-01-01T00:00:00.000Z', photoDataUrl: null, rowHash: hash }],
  clients: [{ legacyClientId: '5', displayName: 'ACME', rfc: null, emailAddress: '', phoneNumber: '', rowHash: hash }],
  tasks: [{ legacyTaskId: '2', title: 't', description: '', legacyState: 'x', createdAt: '2025-01-01T00:00:00.000Z', dueDate: null, dueInstant: null, assigneeLegacyUserIds: ['1'], rowHash: hash }],
  payments: [{ sourceTable: 'pagoconcepto', legacyPaymentId: '3', legacyClientId: '5', legacyUserId: null, concept: 'c', incomeAmount: '1.00', expenseAmount: '0.00', movementDate: '2025-01-01', movementTime: '10:00', rowHash: hash }],
  events: [{ legacyEventId: '1', legacyUserId: null, type: 'login', aggregateId: null, payload: { a: 1 }, oldPayload: null, occurredAt: '2025-01-01T00:00:00.000Z', rowHash: hash }],
  normalizationIssues: [{ kind: 'invalidDate', sourceTable: 'tareas', legacyId: '2' }], discardedFieldCounts: { 'usuarios.password': 1 }, ignoredTables: [],
})
const execute = { action: 'execute', analysisId: id, signature: 'sig', decisions: [{ key: 'k', choice: 'reject' }], roles, confirmation: 'MIGRAR' }

describe('legacy migration contract', () => {
  it('parses a valid request for every renderer action', () => {
    const requests = [{ action: 'chooseDump' }, { action: 'analyze', dumpPath: 'C:\\a.sql', legacyWord: 'word' }, execute, { action: 'retryLocal', dumpPath: 'C:\\a.sql' }, { action: 'listEvents', filter }, { action: 'saveReport', csv: 'a;b' }]
    for (const request of requests) expect(parseLegacyMigrationRequest(request)).toEqual(request)
  })
  it('rejects invalid renderer requests', () => {
    for (const request of [{ action: 'nope' }, { action: 'analyze', dumpPath: 'a.sql', legacyWord: '' }, { action: 'retryLocal', runId: id }, { action: 'analyze', dumpPath: 'a.sql', legacyWord: 'x'.repeat(65) }, { action: 'analyze', dumpPath: 'a.sql', legacyWord: ' word' }, { action: 'listEvents', filter: { ...filter, offset: -1 } }, { action: 'saveReport', csv: 'x'.repeat(5_000_001) }, null]) expect(() => parseLegacyMigrationRequest(request)).toThrow()
  })
  it('rejects extra keys', () => {
    expect(() => parseLegacyMigrationRequest({ action: 'chooseDump', extra: 1 })).toThrow()
    expect(() => parseLegacyMigrationRequest({ ...execute, extra: 1 })).toThrow()
    expect(() => parseLegacyMigrationHostRequest({ action: 'readRunMapping', sourceSha256: 'a'.repeat(64), extra: 1 })).toThrow()
  })
  it('rejects confirmation other than MIGRAR', () => {
    expect(() => parseLegacyMigrationRequest({ ...execute, confirmation: 'migrar' })).toThrow()
    expect(() => parseLegacyMigrationHostRequest({ ...execute, confirmation: '' })).toThrow()
  })
  it('requires reauthentication only for execute', () => {
    expect(requiresLegacyReauthentication(parseLegacyMigrationRequest(execute))).toBe(true)
    for (const request of [{ action: 'chooseDump' }, { action: 'retryLocal', dumpPath: 'C:\\a.sql' }, { action: 'listEvents', filter }] as const) expect(requiresLegacyReauthentication(request)).toBe(false)
  })
  it('accepts every decision choice and rejects unknown ones', () => {
    const decisions = [
      { key: 'a', choice: 'link', targetId: id }, { key: 'b', choice: 'create' }, { key: 'c', choice: 'create', username: 'ana2' }, { key: 'd', choice: 'reject' }, { key: 'e', choice: 'keepCurrent' },
      { key: 'f', choice: 'applyChange' }, { key: 'g', choice: 'officeMovement' }, { key: 'h', choice: 'regularClient' }, { key: 'i', choice: 'taskState', state: 'completed' }, { key: 'j', choice: 'primary', legacyClientId: '5' },
    ]
    expect(parseLegacyMigrationRequest({ ...execute, decisions }).action).toBe('execute')
    for (const bad of [{ key: 'a', choice: 'explode' }, { key: 'a', choice: 'taskState', state: 'bogus' }, { key: 'a', choice: 'reject', extra: 1 }, { key: 'a', choice: 'link' }]) {
      expect(() => parseLegacyMigrationRequest({ ...execute, decisions: [bad] })).toThrow()
    }
  })
  it('parses valid host requests', () => {
    const requests = [{ action: 'analyze', snapshot: snapshot() }, execute, { action: 'readRunMapping', sourceSha256: 'a'.repeat(64) }, { action: 'listEvents', filter }]
    for (const request of requests) expect(parseLegacyMigrationHostRequest(request)).toEqual(request)
  })
  it('rejects invalid host requests', () => {
    expect(() => parseLegacyMigrationHostRequest({ action: 'readRunMapping', sourceSha256: 'x' })).toThrow()
    expect(() => parseLegacyMigrationHostRequest({ action: 'other' })).toThrow()
  })
  it('rejects a snapshot containing a ciec field or a password', () => {
    const withCiec = snapshot(); (withCiec.clients[0] as Record<string, unknown>).ciec = '12345678'
    expect(() => parseLegacyMigrationHostRequest({ action: 'analyze', snapshot: withCiec })).toThrow()
    const withPassword = snapshot(); (withPassword.users[0] as Record<string, unknown>).password = 'x'
    expect(() => parseLegacyMigrationHostRequest({ action: 'analyze', snapshot: withPassword })).toThrow()
    expect(() => parseLegacyMigrationHostRequest({ action: 'analyze', snapshot: { ...snapshot(), ciecByLegacyClientId: {} } })).toThrow()
  })
  it('parses valid host results and rejects invalid ones', () => {
    const results = [{ status: 'analyzed', preview }, { status: 'executed', summary }, { status: 'runMapping', clientIdByLegacyClientId: { '5': id } }, { status: 'events', events: [eventRecord], hasMore: false }]
    for (const result of results) expect(parseLegacyMigrationHostResult(result)).toEqual(result)
    expect(() => parseLegacyMigrationHostResult({ status: 'executed', summary: { ...summary, voided: -1 } })).toThrow()
    expect(() => parseLegacyMigrationHostResult({ status: 'executed', summary: { ...summary, createdAmounts: { ...summary.createdAmounts, pagomensual: { income: '1.5', expense: '0.00' } } } })).toThrow()
    expect(() => parseLegacyMigrationHostResult({ status: 'nope' })).toThrow()
  })
  it('rejects a payload in an analyzed host result', () => {
    expect(() => parseLegacyMigrationHostResult({ status: 'analyzed', preview, payload: {} })).toThrow()
    expect(() => parseLegacyMigrationHostResult({ status: 'analyzed', preview: { ...preview, payload: {} } })).toThrow()
  })
  it('accepts a locally blocked preview only in the renderer result and only with blockers', () => {
    const zero = { create: 0, link: 0, skip: 0, reject: 0, update: 0 }
    const blocked = { analysisId: '', expiresAt: '', signature: '', counts: { users: zero, clients: zero, tasks: zero, movements: zero, events: zero, notes: zero, ciec: zero }, conflicts: [], issues: [], blockers: [{ kind: 'schemaMismatch', table: 'usuarios' }], ignoredTables: [], discardedFieldCounts: {}, roles: [] }
    const result = { status: 'analyzed', preview: blocked, localCounts: { ciec: 0, notes: 0 } }
    expect(parseLegacyMigrationResult(result)).toEqual(result)
    expect(() => parseLegacyMigrationResult({ ...result, preview: { ...blocked, blockers: [] } })).toThrow()
    expect(() => parseLegacyMigrationResult({ ...result, preview: { ...blocked, conflicts: preview.conflicts } })).toThrow()
    expect(() => parseLegacyMigrationHostResult({ status: 'analyzed', preview: blocked })).toThrow()
  })
  it('snapshot limits match the Fiscenix columns the executor writes', () => {
    const accepts = (change: (data: ReturnType<typeof snapshot>) => void) => { const data = snapshot(); change(data); return () => parseLegacyMigrationHostRequest({ action: 'analyze', snapshot: data }) }
    const cases: [string, number, (data: ReturnType<typeof snapshot>, text: string) => void][] = [
      ['client displayName', 100, (data, text) => { data.clients[0]!.displayName = text }],
      ['client rfc', 13, (data, text) => { (data.clients[0] as Record<string, unknown>).rfc = text }],
      ['client emailAddress', 254, (data, text) => { data.clients[0]!.emailAddress = text.slice(6) + '@a.com' }],
      ['client phoneNumber', 40, (data, text) => { data.clients[0]!.phoneNumber = text }],
      ['user displayName', 100, (data, text) => { data.users[0]!.displayName = text }],
      ['task title', 160, (data, text) => { data.tasks[0]!.title = text }],
      ['task description', 2000, (data, text) => { data.tasks[0]!.description = text }],
      ['event legacy id', 32, (data, text) => { data.events[0]!.legacyEventId = text }],
    ]
    for (const [, limit, change] of cases) {
      expect(accepts(data => change(data, 'x'.repeat(limit)))).not.toThrow()
      expect(accepts(data => change(data, 'x'.repeat(limit + 1)))).toThrow()
    }
    const truncated = snapshot(); truncated.normalizationIssues.push({ kind: 'truncatedText', sourceTable: 'tareas', legacyId: '2' }, { kind: 'invalidRfc', sourceTable: 'clientes', legacyId: '5' },
      { kind: 'cleanedText', sourceTable: 'clientes', legacyId: '5' }, { kind: 'tooManyAssignees', sourceTable: 'tareas', legacyId: '2' })
    expect(() => parseLegacyMigrationHostRequest({ action: 'analyze', snapshot: truncated })).not.toThrow()
  })
  it('snapshot text must already be what the Fiscenix read paths accept', () => {
    const accepts = (change: (data: ReturnType<typeof snapshot>) => void) => { const data = snapshot(); change(data); return () => parseLegacyMigrationHostRequest({ action: 'analyze', snapshot: data }) }
    expect(accepts(data => { data.tasks[0]!.description = 'uno\ndos\ttres' })).not.toThrow()
    for (const change of [
      (data: ReturnType<typeof snapshot>) => { data.clients[0]!.displayName = '' },
      (data: ReturnType<typeof snapshot>) => { data.clients[0]!.displayName = ' Cliente' },
      (data: ReturnType<typeof snapshot>) => { data.users[0]!.displayName = 'Ana\tLópez' },
      (data: ReturnType<typeof snapshot>) => { data.tasks[0]!.title = '' },
      (data: ReturnType<typeof snapshot>) => { data.tasks[0]!.description = 'uno\r\ndos' },
      (data: ReturnType<typeof snapshot>) => { data.clients[0]!.emailAddress = 'sin arroba' },
      (data: ReturnType<typeof snapshot>) => { data.clients[0]!.phoneNumber = '55\n12' },
      (data: ReturnType<typeof snapshot>) => { data.payments[0]!.concept = '' },
      (data: ReturnType<typeof snapshot>) => { data.tasks[0]!.assigneeLegacyUserIds = Array.from({ length: 11 }, (_, index) => String(index + 1)) },
    ]) expect(accepts(change)).toThrow()
  })
  it('carries dependent keys and the no-known-tables blocker', () => {
    const withDependents = { ...preview, conflicts: [{ ...preview.conflicts[0], kind: 'clientExists', allowedChoices: ['link', 'reject'], dependentKeys: ['pagoconcepto:1'] }] }
    expect(parseLegacyMigrationHostResult({ status: 'analyzed', preview: withDependents })).toEqual({ status: 'analyzed', preview: withDependents })
    expect(() => parseLegacyMigrationHostResult({ status: 'analyzed', preview: { ...preview, conflicts: [{ ...preview.conflicts[0], dependentKeys: undefined }] } })).toThrow()
    const blocked = { ...preview, analysisId: '', expiresAt: '', signature: '', conflicts: [], issues: [], blockers: [{ kind: 'noKnownTables' }] }
    expect(parseLegacyMigrationResult({ status: 'analyzed', preview: blocked, localCounts: { ciec: 0, notes: 0 } })).toMatchObject({ preview: { blockers: [{ kind: 'noKnownTables' }] } })
  })
  it('rejects a snapshot user photo that is not an image data url', () => {
    const bad = snapshot(); (bad.users[0] as Record<string, unknown>).photoDataUrl = 'data:text/html;base64,AAAA'
    expect(() => parseLegacyMigrationHostRequest({ action: 'analyze', snapshot: bad })).toThrow()
  })
  it('parses valid renderer results and rejects invalid ones', () => {
    const local = { savedCiecCount: 1, keptExistingCiecCount: 0, failedCiecCount: 0 }
    const notes = [{ noteId: 'legacy-1', title: 't', markdown: '', folder: 'General', isPinned: false, isArchived: false }]
    const results = [{ status: 'dump', dumpPath: null }, { status: 'dump', dumpPath: 'C:\\a.sql' }, { status: 'analyzed', preview, localCounts: { ciec: 1, notes: 2 } }, { status: 'executed', summary, local, notes }, { status: 'localRetried', local, notes }, { status: 'events', events: [eventRecord], hasMore: true }, { status: 'reportSaved', isSaved: false }]
    for (const result of results) expect(parseLegacyMigrationResult(result)).toEqual(result)
    expect(() => parseLegacyMigrationResult({ status: 'executed', summary, local, notes: [{ ...notes[0], extra: 1 }] })).toThrow()
    expect(() => parseLegacyMigrationResult({ status: 'localRetried', local: { ...local, failedCiecCount: 'x' }, notes })).toThrow()
    expect(() => parseLegacyMigrationResult({ status: 'dump' })).toThrow()
  })
})
