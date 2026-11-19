import { describe, expect, it } from 'vitest'
import { parseLegacyDump } from '../../shared/legacyMigration/legacyDumpParser'
import { buildLegacySnapshot } from '../../shared/legacyMigration/legacySnapshot'
import { scrubLegacyPayload } from '../../shared/legacyMigration/legacyEventScrubber'
import { buildLegacyDump, encryptLegacyPassword, type LegacyDumpInput } from '../support/legacyDump'

const snapshotOf = (input: LegacyDumpInput) => buildLegacySnapshot(parseLegacyDump(buildLegacyDump(input)), 'sha')
const tinyPhoto = 'data:image/png;base64,iVBORw0KGgo='

describe('buildLegacySnapshot', () => {
  it('converts timestamp columns from utc', () => {
    const { global } = snapshotOf({ pagomensual: [{ fechapago: '2025-10-21 02:10:00' }] })
    expect(global.payments[0]).toMatchObject({ movementDate: '2025-10-20', movementTime: '20:10' })
  })
  it('keeps datetime columns as local wall time', () => {
    const { global } = snapshotOf({ pagoconcepto: [{ fecha: '2025-10-20 20:10:00' }] })
    expect(global.payments[0]).toMatchObject({ movementDate: '2025-10-20', movementTime: '20:10' })
  })
  it('maps pagomensual to income with month concept', () => {
    const { global } = snapshotOf({ pagomensual: [{ mes_ano: '2025-10-01 00:00:00', asunto: 'Contabilidad', honorarios: '1500' }] })
    expect(global.payments[0]).toMatchObject({ concept: 'Honorarios oct 2025 — Contabilidad', incomeAmount: '1500.00', expenseAmount: '0.00', sourceTable: 'pagomensual' })
  })
  it('rejects negative amounts as issues', () => {
    const { global } = snapshotOf({ pagoconcepto: [{ id: 'bad', cobramos: '-5.00' }] })
    expect(global.payments).toHaveLength(0)
    expect(global.normalizationIssues).toContainEqual({ kind: 'invalidAmount', sourceTable: 'pagoconcepto', legacyId: 'bad' })
  })
  it('moves valid ciec to local and reports invalid ones', () => {
    const { global, local } = snapshotOf({ clientes: [{ id_cliente: 7, ciecf: 'Abc12345' }, { id_cliente: 8, ciecf: 'x' }] })
    expect(local.ciecByLegacyClientId).toEqual({ 7: 'Abc12345' })
    expect(global.normalizationIssues).toContainEqual({ kind: 'invalidCiec', sourceTable: 'clientes', legacyId: '8' })
    expect(JSON.stringify(global)).not.toContain('Abc12345')
    expect(global.discardedFieldCounts['clientes.fiel']).toBe(2)
  })
  it('truncates text longer than its Fiscenix column and reports one issue per row', () => {
    const { global } = snapshotOf({
      usuarios: [{ id_usuario: 1, nombre: 'U'.repeat(150) }],
      clientes: [{ id_cliente: 7, nombre: 'N'.repeat(120), email: 'e'.repeat(300), telefono: '5'.repeat(50) }, { id_cliente: 8, nombre: 'Corto' }],
      tareas: [{ id_tarea: 3, titulo: 'T'.repeat(200), descripcion: 'D'.repeat(2500) }],
    })
    expect(global.users[0]!.displayName).toHaveLength(100)
    expect(global.clients[0]).toMatchObject({ displayName: 'N'.repeat(100), emailAddress: '', phoneNumber: '5'.repeat(40) })
    expect(global.tasks[0]!.title).toHaveLength(160)
    expect(global.tasks[0]!.description).toHaveLength(2000)
    expect(global.normalizationIssues.filter(issue => issue.kind === 'truncatedText')).toEqual([
      { kind: 'truncatedText', sourceTable: 'usuarios', legacyId: '1' }, { kind: 'truncatedText', sourceTable: 'clientes', legacyId: '7' }, { kind: 'truncatedText', sourceTable: 'tareas', legacyId: '3' },
    ])
  })
  it('cleans text the Fiscenix read paths would reject and reports one issue per row', () => {
    const { global } = snapshotOf({
      usuarios: [{ id_usuario: 1, nombre: '  ' }, { id_usuario: 2, nombre: 'Ana' }],
      clientes: [{ id_cliente: 7, nombre: 'Mi\tCliente\n', email: 'sin arroba', telefono: '55\u000112' }, { id_cliente: 8, nombre: '', email: ' ok@correo.mx ' }],
      tareas: [{ id_tarea: 3, titulo: '\n', descripcion: 'uno\r\ndos\u0007\ttres' }],
      pagoconcepto: [{ id: 5, asunto: '' }],
    })
    expect(global.users.map(user => user.displayName)).toEqual(['Usuario 1', 'Ana'])
    expect(global.clients[0]).toMatchObject({ displayName: 'Mi Cliente', emailAddress: '', phoneNumber: '55 12' })
    expect(global.clients[1]).toMatchObject({ displayName: 'Cliente 8', emailAddress: 'ok@correo.mx' })
    expect(global.tasks[0]).toMatchObject({ title: 'Tarea 3', description: 'uno\ndos\ttres' })
    expect(global.payments[0]!.concept).toBe('Sin concepto')
    expect(global.normalizationIssues).toEqual([
      { kind: 'cleanedText', sourceTable: 'usuarios', legacyId: '1' }, { kind: 'cleanedText', sourceTable: 'clientes', legacyId: '7' }, { kind: 'cleanedText', sourceTable: 'clientes', legacyId: '8' },
      { kind: 'cleanedText', sourceTable: 'tareas', legacyId: '3' }, { kind: 'cleanedText', sourceTable: 'pagoconcepto', legacyId: '5' },
    ])
  })
  it('keeps at most ten assignees per task and reports the rest', () => {
    const { global } = snapshotOf({ tareas: [{ id_tarea: 3 }], tareas_de_empleados: Array.from({ length: 12 }, (_, index) => ({ id_tarea_asig: 3, id_usuario_asig: index + 10 })) })
    expect(global.tasks[0]!.assigneeLegacyUserIds).toEqual(Array.from({ length: 10 }, (_, index) => String(index + 10)))
    expect(global.normalizationIssues).toEqual([{ kind: 'tooManyAssignees', sourceTable: 'tareas', legacyId: '3' }])
  })
  it('imports a client with an invalid rfc without rfc and reports it', () => {
    const { global } = snapshotOf({ clientes: [{ id_cliente: 7, rfc: 'AAA010101AAAX' }, { id_cliente: 8, rfc: 'NO ES RFC' }, { id_cliente: 9, rfc: ' aaa010101aaa ' }] })
    expect(global.clients.map(client => client.rfc)).toEqual([null, null, 'AAA010101AAA'])
    expect(global.normalizationIssues).toEqual([{ kind: 'invalidRfc', sourceTable: 'clientes', legacyId: '7' }, { kind: 'invalidRfc', sourceTable: 'clientes', legacyId: '8' }])
  })
  it('normalizes rfc and maps notes to local', () => {
    const { global, local } = snapshotOf({ clientes: [{ rfc: ' xaxx 010101 000 ' }, { id_cliente: 2, rfc: '' }], notas: [{ id: 4, pinned: 1 }] })
    expect(global.clients.map((client) => client.rfc)).toEqual(['XAXX010101000', null])
    expect(local.notes).toEqual([{ noteId: 'legacy-4', title: 'Nota', markdown: 'Texto de la nota', folder: 'General', isPinned: true, isArchived: false }])
  })
  it('keeps valid photos and reports invalid ones', () => {
    const { global } = snapshotOf({ usuarios: [{ id_usuario: 1, imagen: tinyPhoto }, { id_usuario: 2, imagen: 'not-a-photo' }] })
    expect(global.users.map((user) => user.photoDataUrl)).toEqual([tinyPhoto, null])
    expect(global.normalizationIssues).toContainEqual({ kind: 'invalidPhoto', sourceTable: 'usuarios', legacyId: '2' })
  })
  it('never includes passwords', () => {
    const encrypted = encryptLegacyPassword('secret', 'word')
    const { global } = snapshotOf({ usuarios: [{ password: encrypted }] })
    expect(JSON.stringify(global)).not.toContain(encrypted)
    expect(global.discardedFieldCounts['usuarios.password']).toBe(1)
  })
  it('maps tasks with assignees and due instant', () => {
    const { global } = snapshotOf({ tareas: [{ id_tarea: 3, estado: 'En Progreso', fecha_vencimiento: '2025-10-20 15:30:00' }], tareas_de_empleados: [{ id_tarea_asig: 3, id_usuario_asig: 2 }, { id_tarea_asig: 3, id_usuario_asig: 1 }] })
    expect(global.tasks[0]).toMatchObject({ legacyState: 'En Progreso', dueDate: '2025-10-20', dueInstant: '2025-10-20T21:30:00.000Z', assigneeLegacyUserIds: ['1', '2'] })
  })
  it('scrubs event payloads and reports invalid json', () => {
    const { global } = snapshotOf({ events: [{ id: 1, payload: '{"password":"x","a":1}' }, { id: 2, payload: '{oops' }] })
    expect(global.events).toHaveLength(1)
    expect(global.events[0]).toMatchObject({ payload: { a: 1 }, occurredAt: '2025-10-21T16:00:00.000Z' })
    expect(global.normalizationIssues).toContainEqual({ kind: 'invalidJson', sourceTable: 'events', legacyId: '2' })
  })
  it('reports out of range and zero dates as issues without aborting', () => {
    const { global } = snapshotOf({
      pagoconcepto: [{ id: 'old', fecha: '1999-12-31 10:00:00' }, { id: 'future', fecha: '2100-01-01 10:00:00' }, { id: 'zero', fecha: '0000-00-00 00:00:00' }],
      pagomensual: [{ id: 'epoch', fechapago: '1970-01-01 00:00:00' }],
      tareas: [{ id_tarea: 9, fecha_vencimiento: '1999-12-31 10:00:00' }],
    })
    expect(global.payments).toHaveLength(0)
    expect(global.normalizationIssues).toEqual(expect.arrayContaining([
      { kind: 'invalidDate', sourceTable: 'pagoconcepto', legacyId: 'old' },
      { kind: 'invalidDate', sourceTable: 'pagoconcepto', legacyId: 'future' },
      { kind: 'invalidDate', sourceTable: 'pagoconcepto', legacyId: 'zero' },
      { kind: 'invalidDate', sourceTable: 'pagomensual', legacyId: 'epoch' },
      { kind: 'invalidDate', sourceTable: 'tareas', legacyId: '9' },
    ]))
    expect(global.tasks[0]).toMatchObject({ dueDate: null, dueInstant: null })
  })
  it('row hash changes when a field changes and is stable otherwise', () => {
    const hashOf = (name: string) => snapshotOf({ clientes: [{ nombre: name }] }).global.clients[0]!.rowHash
    expect(hashOf('A')).toBe(hashOf('A'))
    expect(hashOf('A')).not.toBe(hashOf('B'))
  })
})

describe('scrubLegacyPayload', () => {
  it('scrubs nested sensitive keys', () => {
    expect(scrubLegacyPayload({ a: { password: 'x', b: [{ ciecf: 'y' }] }, imagen: 'z' })).toEqual({ a: { b: [{}] } })
  })
})
