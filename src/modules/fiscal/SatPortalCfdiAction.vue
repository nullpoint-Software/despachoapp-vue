<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { KeyRound, RotateCw } from '@lucide/vue'
import { getOfficeToday } from '../../../shared/contracts/movements'
import type { SatDirection } from '../../../shared/contracts/satDownloads'
import { activeSatPortalCfdiRunStates, satPortalCfdiDirections, type SatPortalCfdiDirection, type SatPortalCfdiDirectionProgress, type SatPortalCfdiDirectionState, type SatPortalCfdiRun } from '../../../shared/contracts/satPortalCfdi'
import ActionButton from '../../shared/components/ActionButton.vue'
import DateField from '../../shared/components/DateField.vue'
import DitherProgressBar from '../../shared/components/DitherProgressBar.vue'
import HelpTip from '../../shared/components/HelpTip.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import SatCaptchaPanel, { type SatCaptchaPanelPhase } from '../../shared/components/SatCaptchaPanel.vue'
import SelectField from '../../shared/components/SelectField.vue'
import StatusBadge from '../../shared/components/StatusBadge.vue'
import { readIpcErrorMessage } from '../../shared/ipcErrorMessage'
import { requestNavigation } from '../../shared/navigation/navigationRequests'
import { useNotifications } from '../../shared/notifications/notificationStore'
import SatPortalRecoveryList from './SatPortalRecoveryList.vue'
import { rememberPortalClientName } from './satPortalRecoveryWatcher'

/**
 * "Con RFC y CIEC" (2026-10-11, [[SAT-PORTAL]], [[../changes/SAT-PORTAL-CFDI]]), montado en la pestaña "RFC y CIEC" del
 * modal de descarga del SAT de Fiscal. Descarga los XML (CFDI) del cliente por el portal "Consulta y recuperación de
 * CFDI", **automática después del captcha** (2026-10-14, [[../decisions/ADR-040-SAT-PORTAL-BROWSER-ENGINE]]).
 *
 * Flujo de la vista:
 * 1. Lee si ESTE equipo tiene la CIEC del cliente (sólo si existe). Sin CIEC explica cómo guardarla.
 * 2. La persona elige emitidas, recibidas o ambas y el periodo y pulsa «Descargar con RFC y CIEC» (`start`).
 * 3. `SatCaptchaPanel` muestra la imagen del captcha que tomó Main; la persona escribe su texto (`submitCaptcha`) o pide
 *    «Otra imagen». Después Main consulta, descarga, valida e importa solo.
 * 4. Mientras la ejecución siga activa consulta `read` cada segundo y muestra la etapa, los pasos y los conteos de cada
 *    dirección; «Cancelar» la detiene (lo importado se queda). Al terminar avisa y emite `completed` para que Fiscal
 *    recargue la tabla. Con error o cancelado, «Reintentar» inicia otra ejecución, que **retoma** los pasos pendientes.
 * 5. **Paquete en preparación** (2026-10-17): con muchos XML el SAT tarda horas; la ejecución queda en `waitingForSat`
 *    ("siguiente intento HH:MM") y Main reintenta sólo la recuperación cada hora. «Recuperar ahora» la adelanta. Si la
 *    sesión del SAT venció, aquí vuelve a aparecer el captcha (y `satPortalRecoveryWatcher` avisa en cualquier sección).
 *    `SatPortalRecoveryList` muestra las recuperaciones pendientes guardadas en el Host.
 * 6. La vista **adopta** la ejecución en curso de este cliente aunque la haya iniciado otra vista (el aviso, la lista o
 *    un modal anterior): sondea `read` cada segundo mientras está activa y cada 5 s si no.
 * La vista nunca recibe RFC, CIEC, UUID, folios ni XML.
 */
const props = defineProps<{ clientId: string; clientDisplayName: string; canUse: boolean }>()
const emit = defineEmits<{ completed: [run: SatPortalCfdiRun] }>()
const { notify } = useNotifications()

const today = getOfficeToday()
const direction = ref<string>('both'), fromDate = ref(today.slice(0, 8) + '01'), toDate = ref(today)
const hasCiec = ref<boolean | null>(null), run = ref<SatPortalCfdiRun | null>(null), error = ref(''), isStarting = ref(false)
const pollingIntervalMilliseconds = 1000
let pollTimer: ReturnType<typeof setTimeout> | undefined
let isMounted = true
/** Ejecución que inició este componente: sólo esa se muestra y se notifica. */
let ownRunId: string | null = null

const helpText = 'Fiscenix abre el portal del SAT (Consulta y recuperación de CFDI) en segundo plano y te muestra aquí la imagen del captcha: escribe su texto (Fiscenix no lo resuelve). Después Fiscenix entra con el RFC del cliente y la CIEC guardada en este equipo y hace todo solo: consulta emitidas por tramos de un mes y recibidas por mes, pide los paquetes, los recupera con su folio de descarga y valida e importa los XML a la biblioteca de este equipo. Si algo falla, «Reintentar» continúa desde el paso pendiente. Cada dirección queda como un registro propio en el historial.'
const directionOptions = [{ value: 'both', label: 'Emitidas y recibidas' }, { value: 'received', label: 'Recibidas' }, { value: 'issued', label: 'Emitidas' }]
const directionTitles: Readonly<Record<SatDirection, string>> = { issued: 'Emitidas', received: 'Recibidas' }
const directionStateLabels: Readonly<Record<SatPortalCfdiDirectionState, string>> = { open: 'En curso', completed: 'Terminado', empty: 'Sin CFDI', failed: 'Con error', cancelled: 'Cancelado' }
const directionStateTones: Readonly<Record<SatPortalCfdiDirectionState, 'neutral' | 'info' | 'success' | 'warning' | 'error'>> = { open: 'info', completed: 'success', empty: 'neutral', failed: 'error', cancelled: 'neutral' }
/** Fase del panel para cada estado de Main. */
const phases: Readonly<Record<SatPortalCfdiRun['state'], SatCaptchaPanelPhase>> = { authorizing: 'preparing', preparing: 'preparing', waitingForCaptcha: 'captcha', signingIn: 'signingIn', downloading: 'working', waitingForSat: 'waiting', completed: 'done', cancelled: 'cancelled', failed: 'error' }
const stepLabels = ['Preparando navegador', 'Captcha', 'Entrando', 'Descargando', 'Listo'] as const
const isActive = computed(() => Boolean(run.value && activeSatPortalCfdiRunStates.includes(run.value.state)))
const isPeriodValid = computed(() => Boolean(fromDate.value && toDate.value && fromDate.value <= toDate.value && toDate.value <= today))
/** Conteos de una dirección o del total: CFDI recibidos del SAT, nuevos, existentes y rechazados. */
function describeCounts(counts: Pick<SatPortalCfdiRun, 'foundCount' | 'importedCount' | 'duplicateCount' | 'rejectedCount'>): string {
  return counts.foundCount + ' recibidos · ' + counts.importedCount + ' nuevos · ' + counts.duplicateCount + ' ya estaban · ' + counts.rejectedCount + ' rechazados'
}
/** Pasos de la ejecución: tramos o meses ya consultados de todos los pasos. */
const stepProgress = computed(() => {
  const directions = run.value?.directions ?? []
  return { completed: directions.reduce((sum, item) => sum + item.completedStepCount, 0), total: directions.reduce((sum, item) => sum + item.totalStepCount, 0) }
})
const directionRows = computed<SatPortalCfdiDirectionProgress[]>(() => run.value && run.value.state !== 'authorizing' ? run.value.directions : [])
function toDirection(value: string): SatPortalCfdiDirection {
  return (satPortalCfdiDirections as readonly string[]).includes(value) ? value as SatPortalCfdiDirection : 'both'
}

function stopPolling(): void { clearTimeout(pollTimer); pollTimer = undefined }
function schedulePolling(): void {
  stopPolling()
  if (!isMounted) return
  pollTimer = setTimeout(() => { void refresh() }, isActive.value ? pollingIntervalMilliseconds : 5000)
}

async function refresh(): Promise<void> {
  try {
    const result = await window.contapp.manageSatPortalCfdi({ action: 'read' })
    if (!isMounted) return
    // Se adopta cualquier ejecución activa de este cliente (iniciada desde el aviso, la lista o un modal anterior).
    if (result.run && result.run.clientId === props.clientId && activeSatPortalCfdiRunStates.includes(result.run.state)) ownRunId = result.run.runId
    const current = result.run && result.run.runId === ownRunId ? result.run : null
    if (current) {
      const wasActive = isActive.value
      run.value = current
      if (wasActive && !activeSatPortalCfdiRunStates.includes(current.state)) finishRun(current)
    }
  } catch { /* Se reintenta en el siguiente ciclo. */ }
  schedulePolling()
}

function finishRun(finished: SatPortalCfdiRun): void {
  if (finished.state === 'completed') notify('CFDI descargados', props.clientDisplayName + ': ' + finished.message, 'success')
  else if (finished.state === 'failed') notify('Portal del SAT', props.clientDisplayName + ': ' + finished.message, 'warning')
  emit('completed', finished)
}

async function readCiecStatus(clientId: string): Promise<void> {
  hasCiec.value = null
  try { const status = await window.contapp.manageClientCredentials({ action: 'read', clientId }); if (isMounted && clientId === props.clientId) hasCiec.value = status.isCiecSaved }
  catch { if (isMounted) hasCiec.value = false }
}

/** Inicia una ejecución (también «Reintentar»: el Host retoma el registro y Main se salta los pasos terminados). */
async function start(): Promise<void> {
  if (!props.canUse || !hasCiec.value || isActive.value || isStarting.value || !isPeriodValid.value) return
  isStarting.value = true; error.value = ''
  rememberPortalClientName(props.clientId, props.clientDisplayName)
  try {
    const result = await window.contapp.manageSatPortalCfdi({ action: 'start', clientId: props.clientId, direction: toDirection(direction.value), fromDate: fromDate.value, toDate: toDate.value })
    if (!isMounted || !result.run) return
    ownRunId = result.run.runId; run.value = result.run
    schedulePolling()
  } catch (failure) { error.value = readIpcErrorMessage(failure, 'No se pudo abrir el portal del SAT.') }
  finally { isStarting.value = false }
}

/** Envía una acción de la ejecución en curso (cancelar o captcha) y muestra el estado que devuelve Main. */
async function operate(request: { action: 'cancel' } | { action: 'refreshCaptcha' } | { action: 'recoverNow' } | { action: 'submitCaptcha'; captchaText: string }, failureMessage: string): Promise<void> {
  error.value = ''
  try { const result = await window.contapp.manageSatPortalCfdi(request); if (result.run?.runId === ownRunId) run.value = result.run }
  catch (failure) { error.value = readIpcErrorMessage(failure, failureMessage) }
}

function openCiecCapture(): void {
  requestNavigation({ section: 'clients', itemId: props.clientId, view: 'editCiec', label: 'la ficha de ' + props.clientDisplayName })
}

watch(() => props.clientId, clientId => { stopPolling(); run.value = null; ownRunId = null; error.value = ''; rememberPortalClientName(clientId, props.clientDisplayName); void readCiecStatus(clientId); void refresh() }, { immediate: true })
onBeforeUnmount(() => { isMounted = false; stopPolling() })
</script>

<template>
  <section
    class="sat-portal-cfdi"
    data-testid="sat-portal-cfdi"
    aria-labelledby="sat-portal-cfdi-title"
    :aria-busy="isActive"
  >
    <div class="help-title-row">
      <h3 id="sat-portal-cfdi-title">
        Con RFC y CIEC
      </h3>
      <HelpTip
        title="Descargar CFDI con RFC y CIEC"
        :text="helpText"
      />
    </div>
    <InlineNotice
      v-if="error"
      title="Portal del SAT"
      tone="error"
    >
      <p>{{ error }}</p>
    </InlineNotice>
    <InlineNotice
      v-if="hasCiec === false"
      title="Este equipo no tiene la CIEC del cliente"
      tone="info"
    >
      <p>La CIEC se guarda cifrada sólo en este equipo. Captúrala en Editar ficha, paso «Acceso SAT», y vuelve aquí.</p>
      <ActionButton
        v-if="canUse"
        @click="openCiecCapture"
      >
        <KeyRound
          :size="15"
          aria-hidden="true"
        /> Guardar la CIEC
      </ActionButton>
    </InlineNotice>
    <p
      v-else-if="!canUse"
      class="field-help"
    >
      Para usar la CIEC necesitas permiso de editar clientes, descargar del SAT y usar los XML, y el cliente asignado con lectura y escritura.
    </p>
    <div class="sat-portal-cfdi-grid">
      <SelectField
        id="sat-portal-cfdi-direction"
        v-model="direction"
        label="CFDI"
        :options="directionOptions"
        :disabled="isActive"
      />
      <DateField
        id="sat-portal-cfdi-from"
        v-model="fromDate"
        label="Desde"
        :max="toDate || today"
      />
      <DateField
        id="sat-portal-cfdi-to"
        v-model="toDate"
        label="Hasta"
        :min="fromDate || undefined"
        :max="today"
      />
    </div>
    <div class="actions">
      <ActionButton
        variant="primary"
        :is-loading="isStarting"
        :disabled="!canUse || !hasCiec || isActive || isStarting || !isPeriodValid"
        @click="start"
      >
        <KeyRound
          :size="16"
          aria-hidden="true"
        /> Descargar con RFC y CIEC
      </ActionButton>
    </div>
    <p class="field-help">
      Sólo escribes el captcha; Fiscenix hace el resto. Periodo de hasta un año; cada dirección queda en el historial del cliente.
    </p>
    <SatCaptchaPanel
      v-if="run"
      id="sat-portal-cfdi-status"
      :phase="phases[run.state]"
      :message="run.message"
      :captcha-image="run.captchaImage"
      :step-labels="stepLabels"
      @submit-captcha="captchaText => operate({ action: 'submitCaptcha', captchaText }, 'No se pudo enviar el captcha.')"
      @refresh-captcha="operate({ action: 'refreshCaptcha' }, 'No se pudo pedir otra imagen.')"
      @cancel="operate({ action: 'cancel' }, 'No se pudo cancelar.')"
      @retry="start"
    >
      <div
        v-if="run.state === 'waitingForSat'"
        class="actions"
      >
        <ActionButton @click="operate({ action: 'recoverNow' }, 'No se pudo recuperar ahora.')">
          <RotateCw
            :size="15"
            aria-hidden="true"
          /> Recuperar ahora
        </ActionButton>
      </div>
      <template v-if="directionRows.length">
        <DitherProgressBar
          v-if="stepProgress.total"
          data-testid="sat-portal-cfdi-steps"
          :value="stepProgress.completed"
          :max="stepProgress.total"
          :label="'Consultas: ' + stepProgress.completed + ' de ' + stepProgress.total"
          :is-active="isActive"
          :tone="run.state === 'failed' ? 'error' : 'default'"
        />
        <ul
          class="sat-portal-cfdi-directions"
          aria-label="Avance por dirección"
        >
          <li
            v-for="item in directionRows"
            :key="item.direction"
            :data-testid="'sat-portal-cfdi-direction-' + item.direction"
          >
            <strong>{{ directionTitles[item.direction] }}</strong>
            <StatusBadge :tone="directionStateTones[item.state]">
              {{ directionStateLabels[item.state] }}
            </StatusBadge>
            <span class="field-help sat-portal-cfdi-counts">{{ describeCounts(item) }}</span>
            <span
              v-if="item.message"
              class="field-help"
            >{{ item.message }}</span>
          </li>
        </ul>
        <span
          v-if="directionRows.length > 1"
          class="field-help sat-portal-cfdi-counts"
          data-testid="sat-portal-cfdi-counts"
        >Total: {{ describeCounts(run) }}</span>
      </template>
    </SatCaptchaPanel>
    <SatPortalRecoveryList
      v-if="!isActive"
      :client-id="clientId"
      :client-display-name="clientDisplayName"
      :can-use="canUse && hasCiec === true"
    />
  </section>
</template>

<style scoped>
/* Vive en su pestaña "RFC y CIEC" del modal: sin línea divisoria arriba (2026-10-12). */
.sat-portal-cfdi { display: grid; gap: var(--spaceMedium); min-width: 0; }
.sat-portal-cfdi h3 { margin: 0; font-size: 13px; letter-spacing: .05em; text-transform: uppercase; }
.sat-portal-cfdi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 170px), 1fr)); gap: var(--spaceMedium); align-items: end; }
.sat-portal-cfdi-counts { font-family: var(--monoFontFamily); }
/* Dentro del modal, la fila de botones no lleva el margen ni la alineación a la derecha del pie (`dialog .actions`). */
.sat-portal-cfdi .actions { margin: 0; justify-content: flex-start; }
.sat-portal-cfdi-directions { display: grid; gap: var(--spaceSmall); margin: 0; padding: 0; list-style: none; }
.sat-portal-cfdi-directions li { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; padding-left: 10px; border-left: 2px solid var(--borderColor); min-width: 0; }
.sat-portal-cfdi-directions strong { font-size: 13px; }
</style>
