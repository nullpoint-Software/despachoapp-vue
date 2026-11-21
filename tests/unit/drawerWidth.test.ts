import { afterEach, describe, expect, it, vi } from 'vitest'
import { clampDrawerWidth, computeDrawerWidthBounds, maximumDrawerWidthPixels, minimumDrawerWidthPixels, readStoredDrawerWidth, storeDrawerWidth } from '../../src/shared/components/drawerWidth'

afterEach(() => vi.unstubAllGlobals())

describe('drawer width', () => {
  it('limits the width to 480 px and min(90 % of the window, 1400 px)', () => {
    expect(computeDrawerWidthBounds(1000)).toEqual({ minimumWidth: minimumDrawerWidthPixels, maximumWidth: 900 })
    expect(computeDrawerWidthBounds(3000).maximumWidth).toBe(maximumDrawerWidthPixels)
    expect(clampDrawerWidth(100, 1000)).toBe(480)
    expect(clampDrawerWidth(1200, 1000)).toBe(900)
    expect(clampDrawerWidth(640.4, 1000)).toBe(640)
  })

  it('never exceeds a very narrow window', () => {
    expect(computeDrawerWidthBounds(300)).toEqual({ minimumWidth: 270, maximumWidth: 270 })
    expect(clampDrawerWidth(500, 300)).toBe(270)
    expect(clampDrawerWidth(Number.NaN, 1000)).toBe(900)
  })

  it('remembers the width per drawer and tolerates missing storage', () => {
    const values = new Map<string, string>()
    vi.stubGlobal('window', { localStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) }, removeItem: (key: string) => { values.delete(key) } } })
    storeDrawerWidth('fiscal-reports-drawer', 812.6)
    expect(readStoredDrawerWidth('fiscal-reports-drawer')).toBe(813)
    expect(readStoredDrawerWidth('xml-library-drawer')).toBeNull()
    storeDrawerWidth('fiscal-reports-drawer', null)
    expect(readStoredDrawerWidth('fiscal-reports-drawer')).toBeNull()
    vi.stubGlobal('window', { get localStorage(): Storage { throw new Error('blocked') } })
    expect(readStoredDrawerWidth('fiscal-reports-drawer')).toBeNull()
    expect(() => storeDrawerWidth('fiscal-reports-drawer', 500)).not.toThrow()
  })
})
