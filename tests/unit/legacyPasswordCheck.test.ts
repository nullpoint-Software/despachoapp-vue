import { describe, expect, it } from 'vitest'
import { countUndecryptablePasswords, deriveLegacyCipherMaterial } from '../../shared/legacyMigration/legacyPasswordCheck'
import { encryptLegacyPassword } from '../support/legacyDump'

/** Comprobación de contraseñas heredadas (etapa 8.1): derivación de clave e IV y conteo de cifrados que no abren. */
describe('deriveLegacyCipherMaterial', () => {
  it('derives 32-byte key and 16-byte iv', () => {
    const { key, initializationVector } = deriveLegacyCipherMaterial('hanekawa')
    expect(key.length).toBe(32)
    expect(initializationVector.length).toBe(16)
    expect(key.toString('utf8')).toBe('hanekawa'.repeat(4))
    expect(initializationVector.toString('utf8')).toBe('hanekawa'.repeat(2))
  })

  it('rejects words outside 1-64 characters or with edge spaces', () => {
    for (const invalidWord of ['', ' monogatari', 'monogatari ', 'a'.repeat(65)]) {
      expect(() => deriveLegacyCipherMaterial(invalidWord)).toThrow('Invalid legacy word')
    }
  })
})

describe('countUndecryptablePasswords', () => {
  it('counts zero when all passwords decrypt', () => {
    const encryptedPasswords = ['clave uno', 'clave dos', 'clave tres'].map((password) => encryptLegacyPassword(password, 'monogatari'))
    expect(countUndecryptablePasswords(encryptedPasswords, 'monogatari')).toBe(0)
  })

  it('counts failures with a wrong word', () => {
    const encryptedPasswords = ['clave uno', 'clave dos', 'clave tres'].map((password) => encryptLegacyPassword(password, 'monogatari'))
    expect(countUndecryptablePasswords(encryptedPasswords, 'otra')).toBe(3)
  })

  it('counts malformed hex as failure', () => {
    expect(countUndecryptablePasswords(['zz', ''], 'monogatari')).toBe(2)
  })
})
