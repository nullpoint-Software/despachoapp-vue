import { describe, expect, it, vi } from 'vitest'
import { createDemoApi } from '../../../src/demo/createDemoApi'
import { createDemoStore } from '../../../src/demo/demoStore'
import { DemoUnavailableError } from '../../../src/demo/demoUnavailable'

describe('createDemoApi', () => {
  it('rejects unavailable methods with DemoUnavailableError', async () => {
    const api = createDemoApi(createDemoStore(), { storage: null })
    await expect(api.manageLinkFile('export')).rejects.toBeInstanceOf(DemoUnavailableError)
    await expect(api.manageClients({ action: 'list', afterClientId: null })).rejects.toThrow('manageClients no está disponible en la demo web.')
  })

  it('takes the client startup path', async () => {
    const api = createDemoApi(createDemoStore(), { storage: null })
    expect((await api.getInstallationInformation()).activeMode).toBe('client')
    expect((await api.managePairing('status')).state).toBe('paired')
  })

  it('serves the seeded branding', async () => {
    expect((await createDemoApi(createDemoStore(), { storage: null }).getOfficeBranding()).officeName).toBe('Despacho Demo')
  })

  it('signs in through the assembled api', async () => {
    const api = createDemoApi(createDemoStore(), { storage: null })
    expect((await api.authenticateUser({ username: 'admin.demo', password: 'demo1234' })).state).toBe('authenticated')
  })

  it('calls reloadPage on quit and restart', async () => {
    const reloadPage = vi.fn()
    const api = createDemoApi(createDemoStore(), { storage: null, reloadPage })
    await api.quitApplication(); await api.restartApplication()
    expect(reloadPage).toHaveBeenCalledTimes(2)
  })
})
