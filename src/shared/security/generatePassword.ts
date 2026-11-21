/** 20 caracteres de alfabeto de 64 símbolos: 120 bits aleatorios sin sesgo ni llamadas externas. */
export function generatePassword(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
  return Array.from(crypto.getRandomValues(new Uint8Array(20)), value => alphabet[value & 63]).join('')
}
