import type { DesktopApi } from '../../shared/contracts/desktop'

/** Error de las operaciones del Host real que la demo web no simula. */
export class DemoUnavailableError extends Error {
  constructor(message: string) { super(message); this.name = 'DemoUnavailableError' }
}

/** Método del contrato sin equivalente en la demo: rechaza siempre con un mensaje legible. */
export function rejectInDemo(methodName: keyof DesktopApi): () => Promise<never> {
  return () => Promise.reject(new DemoUnavailableError(`${methodName} no está disponible en la demo web.`))
}
