import { describe, expect, it } from 'vitest'
import { formatTypedDate } from '../../src/shared/components/typedDate'

/** Máscara dd/mm/aaaa de "Escribir fecha" (2026-10-17). */
describe('formatTypedDate', () => {
  it('adds the slashes while typing digits', () => {
    expect(formatTypedDate('1', true)).toBe('1')
    expect(formatTypedDate('13', true)).toBe('13/')
    expect(formatTypedDate('13/1', true)).toBe('13/1')
    expect(formatTypedDate('13/12', true)).toBe('13/12/')
    expect(formatTypedDate('13/12/1970', true)).toBe('13/12/1970')
    expect(formatTypedDate('13121970', true)).toBe('13/12/1970')
    expect(formatTypedDate('13/12/19701', true)).toBe('13/12/1970')
  })
  it('lets the slash be deleted and leaves other formats alone', () => {
    expect(formatTypedDate('13/12', false)).toBe('13/12')
    expect(formatTypedDate('13', false)).toBe('13')
    expect(formatTypedDate('13-12-1970', true)).toBe('13-12-1970')
  })
})
