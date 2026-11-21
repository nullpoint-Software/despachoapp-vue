/**
 * Mensaje que Main dejó en un error de IPC. Electron lo entrega como
 * "Error invoking remote method 'canal': Error: <mensaje>"; aquí se conserva sólo `<mensaje>`.
 * Sólo se usa con canales cuyos errores redacta Main para el usuario (por ejemplo `printing:*`), que no
 * contienen rutas, SQL ni secretos. Sin mensaje reconocible se usa `fallback`.
 */
export function readIpcErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback
  const message = error.message.replace(/^Error invoking remote method '[^']*': /, '').replace(/^(Error: )+/, '').trim()
  return message && message.length <= 300 ? message : fallback
}
