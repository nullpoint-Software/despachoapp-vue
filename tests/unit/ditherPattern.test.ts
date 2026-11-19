import { describe, expect, it } from 'vitest'
import { bayerThreshold, isCellLit, waveFor } from '../../src/shared/components/ditherPattern'

/** Dithering procedural del resaltado de foco (2026-10-17). */
describe('ditherPattern', () => {
  it('uses every Bayer 4×4 threshold once per tile, repeating across tiles', () => {
    const thresholds = Array.from({ length: 16 }, (_, index) => bayerThreshold(Math.floor(index / 4), index % 4)).sort((first, second) => first - second)
    expect(thresholds).toEqual(Array.from({ length: 16 }, (_, index) => index / 16))
    expect(bayerThreshold(5, 6)).toBe(bayerThreshold(1, 2))
  })
  it('lights about as many cells per tile as the density asks for', () => {
    const litCount = (density: number) => Array.from({ length: 16 }, (_, index) => isCellLit(Math.floor(index / 4), index % 4, density)).filter(Boolean).length
    expect(litCount(0.5)).toBe(8)
    expect(litCount(0.25)).toBe(4)
  })
  it('keeps the wave between 40 % and 80 % and moves it with time', () => {
    for (let position = 0; position <= 1; position += 0.05) {
      const density = waveFor(position, 1.3)
      expect(density).toBeGreaterThanOrEqual(0.4 - 1e-9)
      expect(density).toBeLessThanOrEqual(0.8 + 1e-9)
    }
    expect(waveFor(0.1, 0)).not.toBeCloseTo(waveFor(0.1, 0.4))
  })
})
