import { computed, onBeforeUnmount, ref } from 'vue'
import { activeSatPortalRunStates, type SatPortalRun, type SatPortalViewRequest } from '../../../shared/contracts/satPortal'
import { readIpcErrorMessage } from '../../shared/ipcErrorMessage'

type StartRequest = Extract<SatPortalViewRequest, { action: 'start' | 'startThirdParty' }>
type OperateRequest = Extract<SatPortalViewRequest, { action: 'cancel' | 'refreshCaptcha' | 'submitCaptcha' }>

/**
 * Ejecución del portal del SAT vista desde el Renderer ([[SAT-PORTAL]]), común a «Obtener CSF con RFC y CIEC» del
 * cliente (`SatPortalAction`) y a la consulta sin ficha (`RfcLookupPanel`, 2026-10-17).
 * - `start` pide la ejecución a Main y recuerda su `runId`: sólo esa se muestra (puede haber otra de otra vista).
 * - Mientras está activa consulta `read` cada segundo; al terminar llama `onFinished` una vez.
 * - `operate` manda cancelar o el captcha y muestra el estado que devuelve Main.
 * - `reset` olvida la ejecución (por ejemplo, al cambiar de cliente). Al desmontar se detiene el sondeo.
 */
export function useSatPortalRun(onFinished: (run: SatPortalRun) => void) {
  const run = ref<SatPortalRun | null>(null), error = ref(''), isStarting = ref(false)
  const pollingIntervalMilliseconds = 1000
  let pollTimer: ReturnType<typeof setTimeout> | undefined
  let isMounted = true
  let ownRunId: string | null = null
  const isActive = computed(() => Boolean(run.value && activeSatPortalRunStates.includes(run.value.state)))

  function stopPolling(): void { clearTimeout(pollTimer); pollTimer = undefined }
  function schedulePolling(): void {
    stopPolling()
    if (!isMounted || !isActive.value) return
    pollTimer = setTimeout(() => { void refresh() }, pollingIntervalMilliseconds)
  }

  async function refresh(): Promise<void> {
    try {
      const result = await window.contapp.manageSatPortal({ action: 'read' })
      if (!isMounted) return
      const current = result.run && result.run.runId === ownRunId ? result.run : null
      if (current) {
        const wasActive = isActive.value
        run.value = current
        if (wasActive && !activeSatPortalRunStates.includes(current.state)) onFinished(current)
      }
    } catch { /* Se reintenta en el siguiente ciclo. */ }
    schedulePolling()
  }

  async function start(request: StartRequest): Promise<void> {
    if (isActive.value || isStarting.value) return
    isStarting.value = true; error.value = ''
    try {
      const result = await window.contapp.manageSatPortal(request)
      if (!isMounted || !result.run) return
      ownRunId = result.run.runId; run.value = result.run
      schedulePolling()
    } catch (failure) { error.value = readIpcErrorMessage(failure, 'No se pudo abrir el portal del SAT.') }
    finally { isStarting.value = false }
  }

  async function operate(request: OperateRequest, failureMessage: string): Promise<void> {
    error.value = ''
    try { const result = await window.contapp.manageSatPortal(request); if (result.run?.runId === ownRunId) run.value = result.run }
    catch (failure) { error.value = readIpcErrorMessage(failure, failureMessage) }
  }

  function reset(): void { stopPolling(); run.value = null; ownRunId = null; error.value = '' }

  onBeforeUnmount(() => { isMounted = false; stopPolling() })
  return { run, error, isStarting, isActive, start, operate, reset }
}
