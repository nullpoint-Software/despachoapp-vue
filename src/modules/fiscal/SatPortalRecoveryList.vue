<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { RotateCw } from '@lucide/vue'
import type { SatPortalCfdiRecovery, SatPortalCfdiRun } from '../../../shared/contracts/satPortalCfdi'
import ActionButton from '../../shared/components/ActionButton.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import { readIpcErrorMessage } from '../../shared/ipcErrorMessage'
import { formatBusinessDate } from '../../../shared/presentation/movementLabels'
import { rememberPortalClientName } from './satPortalRecoveryWatcher'

/**
 * Descargas del portal que el SAT todavía prepara (2026-10-17, [[SAT-PORTAL#Recuperación pendiente]]), en la pestaña
 * «RFC y CIEC» y en el Historial del modal de Fiscal. Los registros vienen del Host (`listRecoveries`), así que se ven
 * aunque Fiscenix se haya cerrado; sólo los de ESTE equipo, porque sólo él puede retomarlos.
 *
 * «Recuperar ahora»:
 * - si la ejecución en curso es la que espera al SAT, la adelanta (`recoverNow`);
 * - si no hay ejecución activa, inicia una con el periodo y la dirección del registro (`start`): el Host la retoma y Main
 *   va directo a «Recuperar Descargas» con los folios guardados (pide el captcha si hace falta). Nunca pide otro paquete.
 * La vista no recibe los folios, sólo cuántos son.
 */
const props = defineProps<{ clientId: string; clientDisplayName: string; canUse: boolean }>()
const recoveries = ref<SatPortalCfdiRecovery[]>([]), run = ref<SatPortalCfdiRun | null>(null), error = ref(''), isWorking = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
let isMounted = true
const directionTitles = { issued: 'Emitidas', received: 'Recibidas' } as const
const formatInstant = (value: string) => new Date(value).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })

async function refresh(): Promise<void> {
  clearTimeout(timer)
  try {
    const [listed, current] = await Promise.all([window.contapp.manageSatPortalCfdi({ action: 'listRecoveries', clientId: props.clientId }), window.contapp.manageSatPortalCfdi({ action: 'read' })])
    if (!isMounted) return
    recoveries.value = listed.recoveries
    run.value = current.run?.clientId === props.clientId ? current.run : null
  } catch { /* Sin Host o sin permiso momentáneo: se reintenta en la siguiente vuelta. */ }
  if (isMounted) timer = setTimeout(() => { void refresh() }, 30000)
}

/** El registro coincide con la ejecución que espera al SAT (mismo periodo y una de sus direcciones). */
function isWaitingRun(recovery: SatPortalCfdiRecovery): boolean {
  const current = run.value
  return Boolean(current && current.state === 'waitingForSat' && current.fromDate === recovery.fromDate && current.toDate === recovery.toDate && (current.direction === 'both' || current.direction === recovery.direction))
}

async function recoverNow(recovery: SatPortalCfdiRecovery): Promise<void> {
  if (isWorking.value || !props.canUse) return
  isWorking.value = true; error.value = ''
  rememberPortalClientName(props.clientId, props.clientDisplayName)
  try {
    if (isWaitingRun(recovery)) await window.contapp.manageSatPortalCfdi({ action: 'recoverNow' })
    else await window.contapp.manageSatPortalCfdi({ action: 'start', clientId: props.clientId, direction: recovery.direction, fromDate: recovery.fromDate, toDate: recovery.toDate })
  } catch (failure) { error.value = readIpcErrorMessage(failure, 'No se pudo iniciar la recuperación.') }
  finally { isWorking.value = false }
  await refresh()
}

watch(() => props.clientId, () => { recoveries.value = []; run.value = null; void refresh() }, { immediate: true })
onBeforeUnmount(() => { isMounted = false; clearTimeout(timer) })
</script>

<template>
  <section
    v-if="recoveries.length || error"
    class="sat-recoveries"
    data-testid="sat-portal-recoveries"
    aria-label="Descargas que el SAT está preparando"
  >
    <h4>El SAT está preparando</h4>
    <InlineNotice
      v-if="error"
      title="Recuperar descarga"
      tone="error"
    >
      <p>{{ error }}</p>
    </InlineNotice>
    <ul>
      <li
        v-for="recovery in recoveries"
        :key="recovery.requestId"
        :data-testid="'sat-portal-recovery-' + recovery.direction"
      >
        <div>
          <strong>{{ directionTitles[recovery.direction] }} · {{ formatBusinessDate(recovery.fromDate) }} – {{ formatBusinessDate(recovery.toDate) }}</strong>
          <span class="field-help">{{ recovery.folioCount }} paquete(s) pedidos el {{ formatInstant(recovery.requestedAt) }}. Fiscenix vuelve a intentarlo cada hora, hasta 72 horas.</span>
          <span
            v-if="isWaitingRun(recovery) && run?.nextRecoveryAt"
            class="field-help"
          >Siguiente intento: {{ formatInstant(run.nextRecoveryAt) }}</span>
        </div>
        <ActionButton
          :is-loading="isWorking"
          :disabled="!canUse || isWorking"
          @click="recoverNow(recovery)"
        >
          <RotateCw
            :size="15"
            aria-hidden="true"
          /> Recuperar ahora
        </ActionButton>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.sat-recoveries { display: grid; gap: var(--spaceSmall); min-width: 0; }
.sat-recoveries h4 { margin: 0; font-size: 13px; letter-spacing: .05em; text-transform: uppercase; }
.sat-recoveries ul { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
.sat-recoveries li { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 10px 12px; border: 2px solid var(--borderColor); background: var(--surfaceColor); border-radius: var(--radiusNested); }
.sat-recoveries li > div { display: grid; gap: 2px; min-width: 0; overflow-wrap: anywhere; }
@media (max-width: 560px) { .sat-recoveries li { grid-template-columns: 1fr; } }
</style>
