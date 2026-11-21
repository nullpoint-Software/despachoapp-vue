import { createDecipheriv } from 'node:crypto'

/**
 * Legacy password cipher material (kanbanpagos): AES-256-CBC with key and IV derived from a configured word.
 * PROVISIONAL RULE, pending confirmation with a real office hash: the word's UTF-8 bytes are repeated and truncated
 * to 32 bytes (key) and 16 bytes (IV), so 'hanekawa' gives 'hanekawa'.repeat(4) / 'hanekawa'.repeat(2).
 * Change the rule here only: the test fixture and the importer share this function.
 * The word is validated first: an empty word would otherwise produce a zero-filled key instead of failing.
 */
export function deriveLegacyCipherMaterial(word: string): { key: Buffer; initializationVector: Buffer } {
  if (word.length < 1 || word.length > 64 || word !== word.trim()) throw new Error('Invalid legacy word')
  const wordBytes = Buffer.from(word, 'utf8')
  const repeatToLength = (length: number): Buffer => {
    const bytes = Buffer.alloc(length)
    for (let index = 0; index < length; index += 1) bytes[index] = wordBytes[index % wordBytes.length] ?? 0
    return bytes
  }
  return { key: repeatToLength(32), initializationVector: repeatToLength(16) }
}

/** Legacy password format: hex text whose length is a non-empty multiple of 32 characters (whole AES blocks). */
const legacyEncryptedPasswordPattern = /^(?:[a-fA-F0-9]{32})+$/

/**
 * Counts stored legacy passwords that the office word cannot decrypt. Each password is decrypted only to check
 * PKCS7 padding; the plaintext is discarded immediately and never returned or logged.
 * Malformed hex and any decipher error count as failures, so a wrong word or a corrupt row never throws here.
 */
export function countUndecryptablePasswords(encryptedPasswords: readonly string[], word: string): number {
  const { key, initializationVector } = deriveLegacyCipherMaterial(word)
  let undecryptablePasswordCount = 0
  for (const encryptedPassword of encryptedPasswords) {
    if (!legacyEncryptedPasswordPattern.test(encryptedPassword) || !canDecrypt(encryptedPassword, key, initializationVector)) undecryptablePasswordCount += 1
  }
  return undecryptablePasswordCount
}

/** Returns true when the ciphertext decrypts with valid padding; the plaintext is dropped, not kept. */
function canDecrypt(encryptedPassword: string, key: Buffer, initializationVector: Buffer): boolean {
  try {
    const decipher = createDecipheriv('aes-256-cbc', key, initializationVector)
    decipher.update(Buffer.from(encryptedPassword, 'hex'))
    decipher.final()
    return true
  } catch {
    return false
  }
}
