import { describe, expect, it } from 'vitest'
import { noWorkspaceAccess } from '../../../shared/contracts/workspace'
import { createDemoStore } from '../../../src/demo/demoStore'
import { createDemoSessionHandler, demoSessionDurationMilliseconds } from '../../../src/demo/handlers/demoSessionHandler'

describe('demoSessionHandler', () => {
  const fixedNow = new Date('2026-11-18T10:00:00Z')
  const signIn = async (username = 'admin.demo') => {
    const store = createDemoStore()
    const handler = createDemoSessionHandler(store, () => fixedNow)
    const status = await handler.authenticateUser({ username, password: 'demo1234' })
    return { store, handler, status }
  }

  it('signs in a profile with the demo password', async () => {
    const { store, status } = await signIn()
    expect(status).toEqual({ state: 'authenticated', user: { userId: store.users[0]!.userId, displayName: 'Ana Torres' }, expiresAt: '2026-11-18T18:00:00.000Z' })
  })

  it('accepts the username regardless of case and spaces', async () => {
    const { status } = await signIn('  Admin.Demo ')
    expect(status.state).toBe('authenticated')
  })

  it('rejects a wrong password or unknown user without creating a session', async () => {
    const store = createDemoStore()
    const handler = createDemoSessionHandler(store, () => fixedNow)
    await expect(handler.authenticateUser({ username: 'admin.demo', password: 'nope' })).rejects.toThrow('Invalid credentials')
    await expect(handler.authenticateUser({ username: 'ghost', password: 'demo1234' })).rejects.toThrow('Invalid credentials')
    expect(store.session).toBeNull()
  })

  it('reports status, keeps it on activity and clears it on logout and logoutAll', async () => {
    const { handler, status } = await signIn()
    expect(await handler.manageSession('status')).toEqual(status)
    expect(await handler.manageSession('activity')).toEqual(status)
    const signedOutStatus = { state: 'signedOut', user: null, expiresAt: null }
    expect(await handler.manageSession('logout')).toEqual(signedOutStatus)
    await handler.authenticateUser({ username: 'admin.demo', password: 'demo1234' })
    expect(await handler.manageSession('logoutAll')).toEqual(signedOutStatus)
    expect(await handler.manageSession('status')).toEqual(signedOutStatus)
  })

  it('reports signedOut after the session expires', async () => {
    let currentNow = fixedNow
    const store = createDemoStore()
    const handler = createDemoSessionHandler(store, () => currentNow)
    await handler.authenticateUser({ username: 'admin.demo', password: 'demo1234' })
    currentNow = new Date(fixedNow.getTime() + demoSessionDurationMilliseconds + 1)
    expect((await handler.manageSession('status')).state).toBe('signedOut')
    expect(store.session).toBeNull()
  })

  it('returns the profile access while signed in and noWorkspaceAccess otherwise', async () => {
    const store = createDemoStore()
    const handler = createDemoSessionHandler(store, () => fixedNow)
    expect(await handler.readWorkspaceAccess()).toEqual(noWorkspaceAccess)
    await handler.authenticateUser({ username: 'contador.demo', password: 'demo1234' })
    expect(await handler.readWorkspaceAccess()).toEqual(noWorkspaceAccess)
  })

  it('refuses to change the demo password', async () => {
    const { handler } = await signIn()
    await expect(handler.changeOwnPassword({ currentPassword: 'demo1234', newPassword: 'Another1234!' })).rejects.toThrow('La contraseña de la demo no se puede cambiar.')
  })

  it('starts every store fresh and signed out', () => {
    const first = createDemoStore()
    const second = createDemoStore()
    expect(first).not.toBe(second)
    expect(first.session).toBeNull()
    first.users[0]!.displayName = 'Changed'
    first.branding.officeName = 'Changed'
    expect(second.users[0]!.displayName).toBe('Ana Torres')
    expect(second.branding.officeName).toBe('Despacho Demo')
  })
})
