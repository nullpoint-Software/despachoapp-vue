import { describe, expect, it } from 'vitest'
import { getOfficeInstant } from '../../shared/contracts/movements'

describe('getOfficeInstant', () => {
  it('converts office wall time to the UTC instant', () => {
    expect(getOfficeInstant('2025-10-20', '15:30:00').toISOString()).toBe('2025-10-20T21:30:00.000Z')
  })
  it('honours daylight saving time before 2022', () => {
    expect(getOfficeInstant('2021-07-01', '12:00:00').toISOString()).toBe('2021-07-01T17:00:00.000Z')
  })
})
