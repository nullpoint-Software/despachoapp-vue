import { describe, expect, it } from 'vitest'
import { buildTicketGeometry } from '../../src/shared/vueBits/tearTicketGeometry'

/** Tear Ticket (Vue Bits, ADR-025): la perforación queda donde empieza el talón y los trazados son deterministas. */
describe('tear ticket geometry', () => {
  const options = { width: 460, height: 200, stubSize: 140, radius: 0, holeCount: 12, holeSize: 6, notch: 9, roughness: 0.6, isVertical: false }
  it('places one bridge per gap between holes along the perforation', () => {
    const geometry = buildTicketGeometry(options)
    expect(geometry.bridges).toHaveLength(13)
    for (const bridge of geometry.bridges) { expect(bridge.x).toBe(320); expect(bridge.start).toBeGreaterThanOrEqual(9); expect(bridge.end).toBeLessThanOrEqual(191) }
    expect(geometry.ends.map(end => [end.x, end.y])).toEqual([[320, 9], [320, 191]])
    expect(geometry.bodyPath).toMatch(/^M.*Z$/)
    expect(geometry.stubPath).toMatch(/^M.*Z$/)
    expect(buildTicketGeometry(options)).toEqual(geometry)
  })
  it('transposes the perforation for a vertical ticket', () => {
    const geometry = buildTicketGeometry({ ...options, width: 300, height: 420, isVertical: true })
    expect(geometry.crossLength).toBe(300)
    expect(geometry.bridges.every(bridge => bridge.y === 280)).toBe(true)
  })
})
