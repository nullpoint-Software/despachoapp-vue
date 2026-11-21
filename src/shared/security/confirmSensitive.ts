import { shallowRef } from 'vue'
import { isCriticalSensitiveOperation, readReauthenticationFailure, type ReauthenticationFailure, type SensitiveOperation } from '../../../shared/contracts/reauthentication'

/**
 * Confirmación de operaciones sensibles en la UI (ADR-038). Un único diálogo (`PasswordConfirmDialog`, montado en
 * App.vue) lee `passwordPrompt`; las vistas sólo llaman `withSensitiveConfirmation`.
 *
 * Flujo:
 * 1. Crítica, o no crítica sin gracia vigente según el Host (`sensitiveConfirmedUntil` del estado de sesión): pide la
 *    contraseña antes de enviar. No crítica con gracia: envía sin contraseña.
 * 2. Si el Host rechaza por gracia vencida (`required`), abre el diálogo y reintenta una vez con la contraseña.
 * 3. Contraseña incorrecta o bloqueada: el diálogo sigue abierto con el error y la persona puede reintentar o cancelar;
 *    el formulario de origen no se toca.
 * Cualquier otro error cierra el diálogo y llega al llamador como antes. La contraseña sólo vive en esta llamada y se
 * suelta al terminar. Manda el Host: esta clasificación sólo evita pedir de más o de menos.
 */
export interface PasswordPrompt { title: string; description: string; error: string; isBusy: boolean; submit: (password: string) => void; cancel: () => void }
export interface SensitiveRequest { operation: SensitiveOperation; title: string; description?: string }
export const passwordPrompt = shallowRef<PasswordPrompt | null>(null)

const failureMessages: Record<ReauthenticationFailure, string> = {
  required: 'Tu confirmación venció. Escribe tu contraseña para continuar.',
  denied: 'Contraseña incorrecta. Cinco fallos bloquean la confirmación durante quince minutos.',
  locked: 'Demasiados intentos. La confirmación queda bloqueada quince minutos.'
}

/** La gracia la calcula el Host con su reloj; aquí sólo importa si la reporta vigente. Sin respuesta, se pide. */
async function hasActiveGrace(): Promise<boolean> {
  try { return Boolean((await window.contapp.manageSession('status')).sensitiveConfirmedUntil) } catch { return false }
}

function askPassword(request: SensitiveRequest, error: string): Promise<string | null> {
  return new Promise(resolve => {
    const prompt: PasswordPrompt = {
      title: request.title, description: request.description ?? '', error, isBusy: false,
      submit: password => { passwordPrompt.value = { ...prompt, error: '', isBusy: true }; resolve(password) },
      cancel: () => { passwordPrompt.value = null; resolve(null) }
    }
    passwordPrompt.value = prompt
  })
}

/** Ejecuta `run` con la confirmación que corresponda. Resuelve `null` si la persona cancela (`run` nunca debe resolver `null`). */
export async function withSensitiveConfirmation<T>(request: SensitiveRequest, run: (proof: string | undefined) => Promise<T>): Promise<T | null> {
  let password: string | null | undefined = isCriticalSensitiveOperation(request.operation) || !(await hasActiveGrace()) ? await askPassword(request, '') : undefined
  try {
    for (;;) {
      if (password === null) return null
      try { return await run(password) } catch (error) {
        const failure = readReauthenticationFailure(error)
        // `required` con contraseña no se repite: sería un rechazo distinto que la vista ya explica.
        if (!failure || (failure === 'required' && password !== undefined)) throw error
        password = await askPassword(request, failureMessages[failure])
      }
    }
  } finally { passwordPrompt.value = null }
}
