import { describe, expect, it } from 'vitest'
import type { LegacyConflict, LegacyDecision, LegacyIssue, LegacyMigrationPreview } from '../../shared/contracts/legacyMigration'
import { applyToAll, carryOverDecisions, decisionItems, defaultPrimaryLegacyClientId, inconsistentRfcGroups, pendingKeys } from '../../src/modules/legacyMigration/legacyMigrationDecisions'
import { buildLegacyReportCsv } from '../../src/modules/legacyMigration/legacyMigrationReport'

const zeroCounts = { create: 0, link: 0, skip: 0, reject: 0, update: 0 }
const counts = Object.fromEntries(['users', 'clients', 'tasks', 'movements', 'events', 'notes', 'ciec'].map(key => [key, zeroCounts])) as LegacyMigrationPreview['counts']
const hostUserId = '11111111-1111-4111-8111-111111111111'

function conflict(key: string, overrides: Partial<LegacyConflict> = {}): LegacyConflict {
  return { key, kind: 'expenseClient', sourceTable: 'clientes', legacyId: key.split(':')[1]!, legacyLabel: key, currentLabel: null, candidates: [], allowedChoices: ['officeMovement', 'regularClient'], dependentKeys: [], ...overrides }
}
function issue(key: string, overrides: Partial<LegacyIssue> = {}): LegacyIssue {
  return { key, kind: 'orphanPayment', sourceTable: 'pagoconcepto', legacyId: key.split(':')[1]!, legacyLabel: key, allowedChoices: ['officeMovement', 'reject'], isInformational: false, ...overrides }
}
function preview(conflicts: LegacyConflict[], issues: LegacyIssue[]): LegacyMigrationPreview {
  return { analysisId: 'a', expiresAt: '', signature: 's', counts, conflicts, issues, blockers: [], ignoredTables: [], discardedFieldCounts: {}, roles: [] }
}

describe('legacyMigrationDecisions', () => {
  it('applyToAll sets the choice for every item of the kind', () => {
    const items = [conflict('clientes:1'), conflict('clientes:2'), conflict('clientes:3', { allowedChoices: ['officeMovement'] })]
    const previous = new Map<string, LegacyDecision>([['clientes:1', { key: 'clientes:1', choice: 'regularClient' }]])
    const next = applyToAll(previous, items, { key: 'ignored', choice: 'regularClient' })
    expect(next.get('clientes:1')).toEqual({ key: 'clientes:1', choice: 'regularClient' })
    expect(next.get('clientes:2')).toEqual({ key: 'clientes:2', choice: 'regularClient' })
    // An item that does not allow the choice keeps what it had (here nothing).
    expect(next.has('clientes:3')).toBe(false)
    expect(previous.size).toBe(1)
    const office = applyToAll(next, items, { key: 'x', choice: 'officeMovement' })
    expect([...office.values()].map(decision => decision.choice)).toEqual(['officeMovement', 'officeMovement', 'officeMovement'])
  })

  it('pendingKeys excludes informational issues', () => {
    const current = preview([conflict('clientes:1'), conflict('usuarios:1', { kind: 'invalidUsername', sourceTable: 'usuarios', allowedChoices: ['create', 'reject'] })],
      [issue('pagoconcepto:p1'), issue('tareas:1', { kind: 'missingAttendant', allowedChoices: [], isInformational: true })])
    expect(pendingKeys(current, new Map())).toEqual(['clientes:1', 'usuarios:1', 'pagoconcepto:p1'])
    // `create` without a username is not a decision yet.
    const decisions = new Map<string, LegacyDecision>([['clientes:1', { key: 'clientes:1', choice: 'officeMovement' }], ['usuarios:1', { key: 'usuarios:1', choice: 'create' }]])
    expect(pendingKeys(current, decisions)).toEqual(['usuarios:1', 'pagoconcepto:p1'])
    decisions.set('usuarios:1', { key: 'usuarios:1', choice: 'create', username: 'ana.lopez' })
    decisions.set('pagoconcepto:p1', { key: 'pagoconcepto:p1', choice: 'reject' })
    expect(pendingKeys(current, decisions)).toEqual([])
  })

  it('carryOverDecisions drops decisions whose key or choice is no longer allowed', () => {
    const previous = new Map<string, LegacyDecision>([
      ['clientes:1', { key: 'clientes:1', choice: 'regularClient' }],
      ['clientes:2', { key: 'clientes:2', choice: 'officeMovement' }],
      ['usuarios:1', { key: 'usuarios:1', choice: 'link', targetId: hostUserId }],
      ['usuarios:2', { key: 'usuarios:2', choice: 'link', targetId: hostUserId }],
      ['pagoconcepto:p1', { key: 'pagoconcepto:p1', choice: 'reject' }],
      ['clientes:9', { key: 'clientes:9', choice: 'officeMovement' }],
    ])
    const next = carryOverDecisions(previous, preview([
      conflict('clientes:1', { allowedChoices: ['officeMovement'] }),
      conflict('clientes:2'),
      conflict('usuarios:1', { kind: 'userExists', sourceTable: 'usuarios', allowedChoices: ['link', 'create', 'reject'], candidates: [{ targetId: hostUserId, label: 'admin' }] }),
      conflict('usuarios:2', { kind: 'userExists', sourceTable: 'usuarios', allowedChoices: ['link', 'create', 'reject'], candidates: [] }),
    ], [issue('pagoconcepto:p1')]))
    expect([...next.keys()]).toEqual(['clientes:2', 'usuarios:1', 'pagoconcepto:p1'])
  })

  it('a rejected client makes its dependent payments required decisions', () => {
    const client = conflict('clientes:1', { kind: 'clientExists', allowedChoices: ['link', 'reject'], candidates: [{ targetId: hostUserId, label: 'Actual' }], dependentKeys: ['pagoconcepto:p1', 'pagomensual:m1', 'pagoconcepto:c1'] })
    // A changed payment of that client is its own conflict: rejecting the client removes `applyChange` from it.
    const changed = conflict('pagoconcepto:c1', { kind: 'changedSinceImport', sourceTable: 'pagoconcepto', allowedChoices: ['keepCurrent', 'applyChange', 'officeMovement'] })
    const current = preview([client, changed], [])
    const linked = new Map<string, LegacyDecision>([['clientes:1', { key: 'clientes:1', choice: 'link', targetId: hostUserId }], ['pagoconcepto:c1', { key: 'pagoconcepto:c1', choice: 'applyChange' }]])
    expect(pendingKeys(current, linked)).toEqual([])
    expect(decisionItems(current, linked).dependents).toEqual([])
    const rejected = new Map(linked).set('clientes:1', { key: 'clientes:1', choice: 'reject' })
    const items = decisionItems(current, rejected)
    expect(items.dependents.map(item => [item.key, item.kind, item.allowedChoices])).toEqual([['pagoconcepto:p1', 'orphanPayment', ['officeMovement', 'reject']], ['pagomensual:m1', 'orphanPayment', ['officeMovement', 'reject']]])
    expect(items.conflicts.find(item => item.key === 'pagoconcepto:c1')?.allowedChoices).toEqual(['keepCurrent', 'officeMovement'])
    expect(pendingKeys(current, rejected)).toEqual(['pagoconcepto:c1', 'pagoconcepto:p1', 'pagomensual:m1'])
    // "Aplicar a todos" on the dependents group resolves them in one step.
    const decided = applyToAll(applyToAll(rejected, items.dependents, { key: '', choice: 'officeMovement' }), items.conflicts, { key: '', choice: 'keepCurrent' })
    expect(pendingKeys(current, decided)).toEqual([])
    // Going back to link drops the dependents' decisions from what is sent (the Host would reject unused keys).
    const relinked = carryOverDecisions(new Map(decided).set('clientes:1', { key: 'clientes:1', choice: 'link', targetId: hostUserId }), current)
    expect([...relinked.keys()]).toEqual(['clientes:1', 'pagoconcepto:c1'])
    expect([...carryOverDecisions(decided, current).keys()]).toEqual(['clientes:1', 'pagoconcepto:c1', 'pagoconcepto:p1', 'pagomensual:m1'])
  })

  it('defaultPrimaryLegacyClientId follows the primary already chosen in the same RFC group', () => {
    const duplicate = (legacyId: string, rfc: string) => conflict('clientes:' + legacyId, { kind: 'duplicateRfc', legacyId, currentLabel: rfc, allowedChoices: ['primary', 'reject'] })
    const conflicts = [duplicate('1', 'AAA010101AAA'), duplicate('2', 'AAA010101AAA'), duplicate('3', 'BBB010101BBB')]
    expect(defaultPrimaryLegacyClientId(conflicts, new Map(), conflicts[1]!)).toBe('1')
    const decisions = new Map<string, LegacyDecision>([['clientes:1', { key: 'clientes:1', choice: 'primary', legacyClientId: '2' }]])
    expect(defaultPrimaryLegacyClientId(conflicts, decisions, conflicts[1]!)).toBe('2')
    expect(defaultPrimaryLegacyClientId(conflicts, decisions, conflicts[2]!)).toBe('3')
    // "Aplicar a todos" with primary keeps each group on one primary.
    const applied = applyToAll(new Map(), conflicts, { key: '', choice: 'primary', legacyClientId: 'ignored' })
    expect([...applied.values()].map(decision => decision.choice === 'primary' ? decision.legacyClientId : '')).toEqual(['1', '1', '3'])
  })

  it('inconsistentRfcGroups names groups whose non-rejected members disagree or point at a rejected primary', () => {
    const duplicate = (legacyId: string) => conflict('clientes:' + legacyId, { kind: 'duplicateRfc', legacyId, currentLabel: 'AAA010101AAA', allowedChoices: ['primary', 'reject'] })
    const current = preview([duplicate('1'), duplicate('2'), duplicate('3')], [])
    const primary = (legacyId: string, target: string): [string, LegacyDecision] => ['clientes:' + legacyId, { key: 'clientes:' + legacyId, choice: 'primary', legacyClientId: target }]
    const reject = (legacyId: string): [string, LegacyDecision] => ['clientes:' + legacyId, { key: 'clientes:' + legacyId, choice: 'reject' }]
    expect(inconsistentRfcGroups(current, new Map([primary('1', '1'), primary('2', '2'), primary('3', '1')]))).toEqual(['AAA010101AAA'])
    expect(inconsistentRfcGroups(current, new Map([reject('1'), primary('2', '1'), primary('3', '1')]))).toEqual(['AAA010101AAA'])
    expect(inconsistentRfcGroups(current, new Map([primary('1', '1'), primary('2', '1'), reject('3')]))).toEqual([])
    expect(inconsistentRfcGroups(current, new Map([reject('1'), reject('2'), reject('3')]))).toEqual([])
  })

  it('report csv escapes separators and neutralizes formulas', () => {
    const summary = { runId: 'run-1', backupId: 'backup-1', created: { clientes: 2 }, linked: {}, updated: {}, voided: 0, createdAmounts: { pagoconcepto: { income: '110.35', expense: '47.50' }, pagomensual: { income: '500.00', expense: '0.00' } }, pendingPasswordUserIds: ['u1'], clientIdByLegacyClientId: {} }
    const csv = buildLegacyReportCsv({ summary, preview: preview([conflict('clientes:1', { legacyLabel: '=HYPERLINK("x");gastos' })], []), decisions: new Map([['clientes:1', { key: 'clientes:1', choice: 'officeMovement' }]]), local: null })
    expect(csv).toContain('Resultado;clientes;Creados;2\r\n')
    expect(csv).toContain('Importes creados;pagoconcepto;Cobros;110.35\r\nImportes creados;pagoconcepto;Gastos;47.50\r\n')
    expect(csv).toContain('Importes creados;pagomensual;Cobros;500.00\r\n')
    const rejected = preview([conflict('clientes:4', { kind: 'clientExists', legacyLabel: 'Cliente 4', allowedChoices: ['link', 'reject'], dependentKeys: ['pagoconcepto:p4'] })], [])
    const withDependents = buildLegacyReportCsv({ summary, preview: rejected, decisions: new Map<string, LegacyDecision>([['clientes:4', { key: 'clientes:4', choice: 'reject' }], ['pagoconcepto:p4', { key: 'pagoconcepto:p4', choice: 'officeMovement' }]]), local: null })
    expect(withDependents).toContain('Pago de cliente rechazado;pagoconcepto;Pago p4 (pagoconcepto) de Cliente 4, cliente rechazado;officeMovement\r\n')
    expect(csv).toContain('Resultado;usuarios;Pendientes de contraseña;1\r\n')
    expect(csv).toContain('Conflicto;clientes · expenseClient;"\'=HYPERLINK(""x"");gastos";officeMovement\r\n')
    const tabbed = buildLegacyReportCsv({ summary, preview: preview([conflict('clientes:1', { legacyLabel: '\t=1+1' }), conflict('clientes:2', { legacyLabel: '\r=2' })], []), decisions: new Map(), local: null })
    expect(tabbed).toContain(";'\t=1+1;")
    expect(tabbed).toContain(';"\'\r=2";')
  })
})
