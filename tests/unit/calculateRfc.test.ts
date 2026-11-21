import { describe, expect, it } from 'vitest'
import { rfcPattern } from '../../shared/contracts/localXml'
import { calculateRfc, calculateVerificationDigit } from '../../shared/fiscal/calculateRfc'

/** Calculadora de RFC (2026-10-17): letras, fecha, homoclave y dígito verificador con casos conocidos. */
describe('calculateRfc', () => {
  it('computes a natural person RFC with homoclave and verification digit', () => {
    expect(calculateRfc({ kind: 'natural', name: 'Juan', firstLastName: 'Barrios', secondLastName: 'Fernández', birthDate: '1970-12-13' })).toBe('BAFJ701213SBA')
  })

  it('applies the natural person special cases', () => {
    const rfcOf = (name: string, firstLastName: string, secondLastName: string) => calculateRfc({ kind: 'natural', name, firstLastName, secondLastName, birthDate: '1990-01-31' }).slice(0, 10)
    expect(rfcOf('María Luisa', 'Pérez', 'Gómez')).toBe('PEGL900131')
    expect(rfcOf('Juan', 'Martínez', '')).toBe('MAJU900131')
    expect(rfcOf('Juan', '', 'Martínez')).toBe('MAJU900131')
    expect(rfcOf('Ernesto', 'Ek', 'Rivera')).toBe('ERER900131')
    expect(rfcOf('Ana', 'de la Peña', 'Ruiz')).toBe('PERA900131')
    // "PUTO" no se permite: la última letra se cambia por X.
    expect(rfcOf('Oscar', 'Putin', 'Toledo')).toBe('PUTX900131')
  })

  it('computes a juristic person RFC without the company type or empty words', () => {
    const rfc = calculateRfc({ kind: 'juristic', legalName: 'Sonora Industrial Azucarera, S. de R.L.', creationDate: '1982-11-29' })
    expect(rfc.slice(0, 9)).toBe('SIA821129')
    expect(rfc).toHaveLength(12)
    expect(calculateVerificationDigit(rfc.slice(0, 11))).toBe(rfc[11])
    expect(rfcPattern.test(rfc)).toBe(true)
    expect(calculateRfc({ kind: 'juristic', legalName: 'Compañía de Tacos El Güero, S.A. de C.V.', creationDate: '2001-05-04' }).slice(0, 9)).toBe('TGU010504')
  })

  it('rejects impossible dates and missing names', () => {
    expect(() => calculateRfc({ kind: 'natural', name: 'Juan', firstLastName: 'Pérez', secondLastName: 'López', birthDate: '1990-02-30' })).toThrow()
    expect(() => calculateRfc({ kind: 'natural', name: '', firstLastName: 'Pérez', secondLastName: 'López', birthDate: '1990-02-01' })).toThrow()
    expect(() => calculateRfc({ kind: 'juristic', legalName: 'S.A. de C.V.', creationDate: '1990-02-01' })).toThrow()
  })
})
