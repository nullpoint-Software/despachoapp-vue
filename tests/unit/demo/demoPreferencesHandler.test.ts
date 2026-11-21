import { describe, expect, it } from 'vitest'
import { defaultPreferences } from '../../../shared/contracts/localPreferences'
import { createDemoPreferencesHandler, demoPreferencesStorageKey } from '../../../src/demo/handlers/demoPreferencesHandler'

function createMemoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial))
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }
}

describe('demoPreferencesHandler', () => {
  it('reads defaults when nothing is stored', async () => {
    expect(await createDemoPreferencesHandler(createMemoryStorage()).readLocalPreferences()).toEqual(defaultPreferences)
  })

  it('persists an update and reads it back with a new handler', async () => {
    const storage = createMemoryStorage()
    await createDemoPreferencesHandler(storage).updateLocalPreferences({ theme: 'dark' })
    expect((await createDemoPreferencesHandler(storage).readLocalPreferences()).theme).toBe('dark')
  })

  it('falls back to defaults when storage throws', async () => {
    const throwing = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }
    const handler = createDemoPreferencesHandler(throwing)
    expect(await handler.readLocalPreferences()).toEqual(defaultPreferences)
    expect((await handler.updateLocalPreferences({ theme: 'light' })).theme).toBe('light')
  })

  it('falls back to defaults when storage is null', async () => {
    const handler = createDemoPreferencesHandler(null)
    expect(await handler.readLocalPreferences()).toEqual(defaultPreferences)
    expect((await handler.updateLocalPreferences({ isSidebarCollapsed: true })).isSidebarCollapsed).toBe(true)
  })

  it('ignores corrupt stored preferences', async () => {
    for (const corrupt of ['{not json', '{"theme":"neon"}']) {
      const handler = createDemoPreferencesHandler(createMemoryStorage({ [demoPreferencesStorageKey]: corrupt }))
      expect(await handler.readLocalPreferences()).toEqual(defaultPreferences)
      await handler.updateLocalPreferences({ theme: 'dark' })
      expect((await handler.readLocalPreferences()).theme).toBe('dark')
    }
  })
})
