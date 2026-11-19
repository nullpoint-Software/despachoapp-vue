import { describe, expect, it } from 'vitest'
import { describeRfcInput, formatEmailInput, formatMoneyDisplay, formatPhoneInput, formatRfcInput, sanitizeMoneyInput, suggestEmailAddresses } from '../../src/shared/formatting/inputFormats'

/** Formato al escribir de RFC, teléfono, dinero y correo (2026-10-04). Funciones puras usadas por los campos compartidos. */
describe('input formats', () => {
  it('normalizes RFC as the user types', () => {
    expect(formatRfcInput('xaxx-010101 000')).toBe('XAXX010101000')
    expect(formatRfcInput('ñañ&010101abcdef')).toBe('ÑAÑ&010101ABC')
    expect(describeRfcInput('ABC010101AB1')).toEqual({ personType: 'moral', isComplete: true })
    expect(describeRfcInput('PFIS010101AAA')).toEqual({ personType: 'física', isComplete: true })
    expect(describeRfcInput('ABC01')).toEqual({ personType: null, isComplete: false })
  })

  it('groups Mexican phone numbers and drops the country code', () => {
    expect(formatPhoneInput('5512345678')).toBe('55 1234 5678')
    expect(formatPhoneInput('+52 (55) 1234-5678')).toBe('55 1234 5678')
    expect(formatPhoneInput('551')).toBe('55 1')
    expect(formatPhoneInput('55123456789999')).toBe('55 1234 5678')
    expect(formatPhoneInput('')).toBe('')
  })

  it('keeps money as a plain decimal and shows it formatted', () => {
    expect(sanitizeMoneyInput('$1,250.505')).toBe('1250.50')
    expect(sanitizeMoneyInput('00012')).toBe('12')
    expect(sanitizeMoneyInput('.5')).toBe('0.5')
    expect(sanitizeMoneyInput('1.2.3')).toBe('1.23')
    expect(sanitizeMoneyInput('abc')).toBe('')
    expect(formatMoneyDisplay('1250.5')).toBe('$1,250.50')
    expect(formatMoneyDisplay('')).toBe('')
  })

  it('cleans email addresses and suggests common domains', () => {
    expect(formatEmailInput(' Ana.Perez @Gmail.com ')).toBe('ana.perez@gmail.com')
    expect(suggestEmailAddresses('ana@')).toContain('ana@gmail.com')
    expect(suggestEmailAddresses('ana@hot')).toEqual(['ana@hotmail.com'])
    expect(suggestEmailAddresses('ana@gmail.com')).toEqual([])
    expect(suggestEmailAddresses('ana')).toEqual([])
    expect(suggestEmailAddresses('@gm')).toEqual([])
  })
})

describe('tax regime search options', () => {
  it('offers regimes by person type and keeps retired ones only when requested', async () => {
    const { taxRegimeOptions } = await import('../../src/modules/clients/clientPresentation')
    const moral = taxRegimeOptions({ personType: 'moral' })
    expect(moral.map(option => option.value)).toContain('601')
    expect(moral.map(option => option.value)).not.toContain('605')
    expect(moral.find(option => option.value === '601')?.label).toBe('601 · General de Ley Personas Morales')
    expect(taxRegimeOptions().map(option => option.value)).not.toContain('609')
    expect(taxRegimeOptions({ keepCode: '609' }).map(option => option.value)).toContain('609')
    expect(taxRegimeOptions({ includeRetired: true }).map(option => option.value)).toContain('609')
  })
})
