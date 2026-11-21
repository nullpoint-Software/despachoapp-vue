import { afterEach, describe, expect, it, vi } from 'vitest'
import { criticalSensitiveOperations, isCriticalSensitiveOperation, parseSensitiveConfirmation, readReauthenticationFailure, rethrowReauthenticationFailure, sensitiveOperations } from '../../shared/contracts/reauthentication'
import { parseSessionStatus } from '../../shared/contracts/session'
import { passwordPrompt, withSensitiveConfirmation } from '../../src/shared/security/confirmSensitive'

// Confirmación sensible (ADR-038): clasificación única y flujo del diálogo con la gracia de 10 minutos.
describe('sensitive operation classification', () => {
  it('keeps cancel, void, delete and configuration in the critical zone; only editing a movement uses the grace', () => {
    expect(sensitiveOperations.filter(operation => !isCriticalSensitiveOperation(operation))).toEqual(['movements.update'])
    for (const operation of ['movements.void', 'backups.configure', 'backups.restore', 'documents.delete', 'clients.delete', 'access.manage', 'clients.assign', 'devices.link', 'branding.save', 'credential.copy', 'migration.run'] as const) expect(criticalSensitiveOperations).toContain(operation)
  })
  it('accepts a missing proof only for non-critical operations and never an empty or oversized one', () => {
    expect(parseSensitiveConfirmation('movements.update', undefined)).toEqual({ operation: 'movements.update', password: null })
    expect(() => parseSensitiveConfirmation('movements.void', undefined)).toThrow('Reauthentication required')
    expect(() => parseSensitiveConfirmation('movements.update', '')).toThrow('Reauthentication required')
    expect(() => parseSensitiveConfirmation('documents.delete', 'x'.repeat(129))).toThrow('Reauthentication required')
    expect(parseSensitiveConfirmation('documents.delete', 'Contraseña ficticia')).toEqual({ operation: 'documents.delete', password: 'Contraseña ficticia' })
  })
  it('recognizes the failure through IPC wrapping and cause chains, and lets Main rethrow it bare', () => {
    expect(readReauthenticationFailure(new Error("Error invoking remote method 'movements:operate': Error: Reauthentication denied"))).toBe('denied')
    expect(readReauthenticationFailure(new Error('Mensaje para la vista', { cause: new Error('Reauthentication locked') }))).toBe('locked')
    expect(readReauthenticationFailure(new Error('Session denied'))).toBeNull()
    expect(() => rethrowReauthenticationFailure(new Error('x', { cause: new Error('Reauthentication required') }))).toThrow('Reauthentication required')
    expect(() => rethrowReauthenticationFailure(new Error('Host operation failed'))).not.toThrow()
  })
  it('exposes the grace in the session status only as a valid instant', () => {
    const base = { state: 'authenticated', user: { userId: '2f1d6f64-7f3b-4c1d-9a51-2b7a8f7f6c10', displayName: 'Usuaria ficticia' }, expiresAt: '2026-10-12T20:00:00.000Z' }
    expect(parseSessionStatus(base)).not.toHaveProperty('sensitiveConfirmedUntil')
    expect(parseSessionStatus({ ...base, sensitiveConfirmedUntil: '2026-10-12T10:10:00.000Z' }).sensitiveConfirmedUntil).toBe('2026-10-12T10:10:00.000Z')
    expect(() => parseSessionStatus({ ...base, sensitiveConfirmedUntil: 'mañana' })).toThrow()
  })
})

describe('withSensitiveConfirmation', () => {
  afterEach(() => { vi.unstubAllGlobals(); passwordPrompt.value = null })
  const stubSession = (sensitiveConfirmedUntil?: string) => vi.stubGlobal('window', { contapp: { manageSession: vi.fn(async () => ({ state: 'authenticated', ...(sensitiveConfirmedUntil ? { sensitiveConfirmedUntil } : {}) })) } })
  /** Responde el diálogo en cuanto aparece, como lo haría la persona. */
  async function answer(value: string | null): Promise<string> {
    await vi.waitFor(() => { if (!passwordPrompt.value || passwordPrompt.value.isBusy) throw new Error('waiting') })
    const prompt = passwordPrompt.value!
    if (value === null) prompt.cancel(); else prompt.submit(value)
    return prompt.error
  }

  it('sends no proof and opens no dialog while the Host reports the grace for a non-critical operation', async () => {
    stubSession('2026-10-12T10:10:00.000Z')
    const run = vi.fn(async (proof: string | undefined) => proof ?? 'sin contraseña')
    await expect(withSensitiveConfirmation({ operation: 'movements.update', title: 'Editar' }, run)).resolves.toBe('sin contraseña')
    expect(run).toHaveBeenCalledTimes(1)
    expect(passwordPrompt.value).toBeNull()
  })
  it('asks first when the grace expired, and always for a critical operation even with grace', async () => {
    stubSession()
    const expired = withSensitiveConfirmation({ operation: 'movements.update', title: 'Editar' }, async proof => proof)
    await answer('Contraseña ficticia')
    await expect(expired).resolves.toBe('Contraseña ficticia')
    stubSession('2026-10-12T10:10:00.000Z')
    const critical = withSensitiveConfirmation({ operation: 'movements.void', title: 'Anular' }, async proof => proof)
    await answer('Contraseña ficticia')
    await expect(critical).resolves.toBe('Contraseña ficticia')
    expect(passwordPrompt.value).toBeNull()
  })
  it('opens the dialog and retries once when the Host says the grace ended in between', async () => {
    stubSession('2026-10-12T10:10:00.000Z')
    const run = vi.fn(async (proof: string | undefined) => { if (proof === undefined) throw new Error("Error invoking remote method 'x': Error: Reauthentication required"); return 'guardado' })
    const pending = withSensitiveConfirmation({ operation: 'movements.update', title: 'Editar' }, run)
    expect(await answer('Contraseña ficticia')).toContain('venció')
    await expect(pending).resolves.toBe('guardado')
    expect(run.mock.calls.map(call => call[0])).toEqual([undefined, 'Contraseña ficticia'])
  })
  it('keeps the dialog open with the Host error after a wrong password, and resolves null when cancelled', async () => {
    stubSession()
    const run = vi.fn(async (proof: string | undefined) => { if (proof !== 'correcta') throw new Error('Reauthentication denied'); return 'ok' })
    const retried = withSensitiveConfirmation({ operation: 'documents.delete', title: 'Eliminar' }, run)
    await answer('incorrecta')
    expect(await answer('correcta')).toContain('Contraseña incorrecta')
    await expect(retried).resolves.toBe('ok')
    const cancelled = withSensitiveConfirmation({ operation: 'documents.delete', title: 'Eliminar' }, run)
    await answer(null)
    await expect(cancelled).resolves.toBeNull()
  })
  it('closes the dialog and passes any other error to the view', async () => {
    stubSession()
    const pending = withSensitiveConfirmation({ operation: 'backups.configure', title: 'Configurar' }, async () => { throw new Error('Carpeta sin permiso') })
    await answer('Contraseña ficticia')
    await expect(pending).rejects.toThrow('Carpeta sin permiso')
    expect(passwordPrompt.value).toBeNull()
  })
})
