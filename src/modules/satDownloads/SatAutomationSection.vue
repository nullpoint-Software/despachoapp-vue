<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Play } from '@lucide/vue'
import { getOfficeToday } from '../../../shared/contracts/movements'
import type { SatCredentialDevice } from '../../../shared/contracts/satDownloads'
import type { SatPlatformStatus, SatScheduleDetail, SatScheduleDirections, SatScheduleFrequency, SatScheduleSettings, SatScheduleState } from '../../../shared/contracts/satDownloadSchedules'
import { satScheduleOverlapDays } from '../../../shared/contracts/satDownloadSchedules'
import ActionButton from '../../shared/components/ActionButton.vue'
import CheckField from '../../shared/components/CheckField.vue'
import DateField from '../../shared/components/DateField.vue'
import HelpTip from '../../shared/components/HelpTip.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import SelectField from '../../shared/components/SelectField.vue'
import StatusBadge from '../../shared/components/StatusBadge.vue'
import TimeField from '../../shared/components/TimeField.vue'
import { readIpcErrorMessage } from '../../shared/ipcErrorMessage'
import { useNotifications } from '../../shared/notifications/notificationStore'
import { formatBusinessDate } from '../../../shared/presentation/movementLabels'
import { describeExecutorCheckIn, describePlatform, executorRunText, formatOfficeInstant, isExecutorOffline, portalFallbackText, shouldSuggestPortal } from './satAutomationPresentation'

/**
 * Sección "Automático" del modal "Descargar CFDI del SAT" (2026-10-11, pedido del usuario: "automatízalo con
 * recuperación en caso de que falle la plataforma"). Ver [[SAT-DOWNLOADS-AUTOMATION]].
 * - **Estado:** próxima ejecución, cobertura (marca de agua) por dirección, último resultado y estado de la plataforma
 *   (normal o "pausa por fallas del SAT hasta HH:MM"), con avisos de e.firma detenida, equipo sin conexión y la
 *   sugerencia de "Descargar con RFC y CIEC" cuando el servicio web lleva 24 h fallando.
 * - **Configuración** (asignación de lectura y escritura): activar, direcciones, frecuencia, hora, día, equipo ejecutor
 *   (sólo los que tienen la e.firma del cliente) y desde qué fecha cubrir. "Ejecutar ahora" no espera la hora.
 * El Host guarda todo (GLOBAL) y valida permisos, revisión y la e.firma del equipo elegido; esta vista no ejecuta nada.
 * - **Dónde corre (2026-10-12, ADR-037):** en el equipo ejecutor siempre que Fiscenix esté abierto en él, con o sin sesión;
 *   se muestra su último reporte (`executorCheckInAt`) y por cuenta de quién trabaja. Si esa persona pierde el acceso,
 *   la programación queda "Pausada" con el motivo hasta que alguien con acceso la guarde de nuevo.
 */
const props = defineProps<{ clientId: string; devices: SatCredentialDevice[] }>()
const { notify } = useNotifications()
const schedule = ref<SatScheduleDetail | null>(null), platform = ref<SatPlatformStatus | null>(null), canManage = ref(false)
const draft = ref<SatScheduleSettings | null>(null), isSaving = ref(false), isRunning = ref(false), error = ref('')
const now = ref(new Date())
let timer: ReturnType<typeof setInterval> | undefined, isMounted = true

const directionLabels: Record<SatScheduleDirections, string> = { both: 'Emitidas y recibidas', issued: 'Sólo emitidas', received: 'Sólo recibidas (vigentes)' }
const frequencyLabels: Record<SatScheduleFrequency, string> = { daily: 'Todos los días', weekly: 'Una vez por semana' }
const dayLabels = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const stateLabels: Record<SatScheduleState, string> = { idle: 'En espera', running: 'Descargando', credentialBlocked: 'Detenida: e.firma', ownerBlocked: 'Pausada: sin acceso' }
const stateTones: Record<SatScheduleState, 'neutral' | 'info' | 'error'> = { idle: 'neutral', running: 'info', credentialBlocked: 'error', ownerBlocked: 'error' }
const directionOptions = (Object.keys(directionLabels) as SatScheduleDirections[]).map(value => ({ value, label: directionLabels[value] }))
const frequencyOptions = (Object.keys(frequencyLabels) as SatScheduleFrequency[]).map(value => ({ value, label: frequencyLabels[value] }))
const dayOptions = dayLabels.map((label, index) => ({ value: String(index), label }))
const deviceOptions = computed(() => props.devices.map(device => ({ value: device.deviceId, label: (device.isThisDevice ? 'Este equipo' : device.deviceAlias) + ' · e.firma hasta ' + formatBusinessDate(device.validUntil.slice(0, 10)) })))
const platformState = computed(() => platform.value ? describePlatform(platform.value, now.value) : null)
const isOffline = computed(() => schedule.value ? isExecutorOffline(schedule.value, now.value) : false)
const checkInText = computed(() => schedule.value ? describeExecutorCheckIn(schedule.value.executorCheckInAt, now.value) : '')
/** Etiqueta del estado; `ownerBlocked` se muestra "Pausada: sin acceso" (el dueño perdió el acceso). */
const stateBadge = computed(() => {
  const current = schedule.value
  if (!current?.settings.isEnabled) return { label: 'Desactivada', tone: 'neutral' as const }
  return { label: stateLabels[current.state], tone: stateTones[current.state] }
})
const suggestsPortal = computed(() => schedule.value ? shouldSuggestPortal(schedule.value, now.value) : false)
const today = getOfficeToday()

function defaultSettings(): SatScheduleSettings {
  const thisDevice = props.devices.find(device => device.isThisDevice) ?? props.devices[0]
  return { isEnabled: true, directions: 'both', frequency: 'daily', runTime: '06:00', dayOfWeek: 1, executorDeviceId: thisDevice?.deviceId ?? null, coverageStartDate: today.slice(0, 8) + '01' }
}
function resetDraft(): void { draft.value = schedule.value ? { ...schedule.value.settings } : defaultSettings() }

async function load(): Promise<void> {
  if (!props.clientId) return
  try {
    const result = await window.contapp.manageSatDownloads({ action: 'readSchedule', clientId: props.clientId })
    if (!isMounted || result.status !== 'schedule') return
    const hadDraft = draft.value !== null && schedule.value?.revision === result.schedule?.revision
    schedule.value = result.schedule; platform.value = result.platform; canManage.value = result.canManage; now.value = new Date()
    // Una actualización periódica no pisa lo que la persona está editando, salvo que otro equipo cambió la configuración.
    if (!hadDraft) resetDraft()
  } catch (caught) { if (isMounted) error.value = readIpcErrorMessage(caught, 'No se pudo consultar la descarga automática.') }
}
async function save(): Promise<void> {
  if (!draft.value || isSaving.value) return
  isSaving.value = true; error.value = ''
  try {
    const result = await window.contapp.manageSatDownloads({ action: 'saveSchedule', clientId: props.clientId, revision: schedule.value?.revision ?? null, settings: { ...draft.value } })
    if (result.status === 'schedule') {
      schedule.value = result.schedule; platform.value = result.platform; resetDraft()
      notify('Descarga automática guardada', result.schedule?.settings.isEnabled && result.schedule.nextRunAt ? 'Próxima ejecución: ' + formatOfficeInstant(result.schedule.nextRunAt) + '.' : 'La descarga automática quedó desactivada.', 'success')
    }
  } catch (caught) {
    error.value = readIpcErrorMessage(caught, 'No se guardó. El equipo elegido debe tener la e.firma vigente del cliente; si otro equipo cambió la configuración, revisa los datos y guarda de nuevo.')
    draft.value = null; await load()
  } finally { isSaving.value = false }
}
async function runNow(): Promise<void> {
  if (!schedule.value || isRunning.value) return
  isRunning.value = true; error.value = ''
  try {
    const result = await window.contapp.manageSatDownloads({ action: 'runScheduleNow', clientId: props.clientId, revision: schedule.value.revision })
    if (result.status === 'schedule') { schedule.value = result.schedule; platform.value = result.platform }
    notify('Descarga automática en marcha', 'El equipo ejecutor la inicia en su siguiente ciclo (hasta 1 minuto) mientras Fiscenix esté abierto en él, aunque no haya sesión.', 'info')
  } catch (caught) { error.value = readIpcErrorMessage(caught, 'No se pudo iniciar. Revisa que esté activa y que el equipo ejecutor tenga la e.firma vigente.') }
  finally { isRunning.value = false }
}
function describeCoverage(direction: 'issued' | 'received'): string {
  const coverage = schedule.value?.coverage.find(item => item.direction === direction)
  if (!coverage) return '—'
  const parts = [coverage.coveredThrough ? 'hasta ' + formatBusinessDate(coverage.coveredThrough) : 'sin cubrir aún']
  if (coverage.hasActiveRequest) parts.push('descargando')
  else if (coverage.waitUntil && Date.parse(coverage.waitUntil) > now.value.getTime()) parts.push('espera al SAT hasta ' + formatOfficeInstant(coverage.waitUntil))
  return parts.join(' · ')
}
const lastResult = computed(() => {
  const current = schedule.value
  if (!current?.lastRunOutcome || !current.lastRunFinishedAt) return null
  const tone = current.lastRunOutcome === 'completed' ? 'success' as const : 'error' as const
  const label = current.lastRunOutcome === 'completed' ? 'Completa' : current.lastRunOutcome === 'failed' ? 'Con falla' : current.lastRunOutcome === 'ownerBlocked' ? 'Pausada' : 'e.firma'
  return { tone, label, detail: formatOfficeInstant(current.lastRunFinishedAt) + ' · ' + current.lastRunMessage }
})

watch(() => props.clientId, () => { schedule.value = null; draft.value = null; error.value = ''; void load() })
watch(() => props.devices, () => { if (!schedule.value && draft.value && !draft.value.executorDeviceId) resetDraft() })
onMounted(() => { void load(); timer = setInterval(() => { void load() }, 20000) })
onBeforeUnmount(() => { isMounted = false; clearInterval(timer) })
</script>
<template>
  <section
    class="sat-section"
    aria-labelledby="sat-automation-title"
    data-testid="sat-automation"
  >
    <div class="section-heading">
      <h3 id="sat-automation-title">
        Automático
      </h3>
      <HelpTip
        title="Descarga automática"
        :text="'El equipo elegido pide al SAT, a la hora indicada, todo lo que falta desde el último día cubierto hasta ayer, y repite los últimos ' + satScheduleOverlapDays + ' días por los CFDI que el SAT publica tarde (los repetidos se descartan). Si el SAT falla, espera y reintenta solo; si falla mucho, pausa todas las llamadas y las reanuda cuando responde. ' + executorRunText"
      />
      <!-- Chip (2026-10-12, pedido del usuario), con el mismo marco que los filtros; el punto lleva el tono. -->
      <span
        v-if="platformState"
        class="sat-platform-chip"
        :data-tone="platformState.tone"
        data-testid="sat-platform-state"
      ><span
        class="sat-platform-dot"
        aria-hidden="true"
      />{{ platformState.label }}</span>
    </div>

    <div
      class="field-help sat-automation-runs-where"
      data-testid="sat-automation-runs-where"
    >
      <span>Corre en el equipo elegido siempre que Fiscenix esté abierto en él, aunque nadie haya iniciado sesión.</span>
      <HelpTip
        title="Sin sesión"
        :text="executorRunText + ' La e.firma y los XML no salen de ese equipo.'"
      />
    </div>
    <InlineNotice
      v-if="error"
      title="Descarga automática"
      tone="error"
    >
      <p>{{ error }}</p>
    </InlineNotice>
    <InlineNotice
      v-if="schedule?.isPaused"
      title="Pausada"
      tone="error"
      data-testid="sat-automation-paused"
    >
      <p>{{ schedule.lastRunMessage }}</p>
    </InlineNotice>
    <InlineNotice
      v-if="schedule?.state === 'credentialBlocked'"
      title="Detenida por la e.firma"
      tone="error"
    >
      <p>{{ schedule.lastRunMessage }} Al capturar la e.firma vigente en el equipo ejecutor se reanuda sola.</p>
    </InlineNotice>
    <InlineNotice
      v-if="isOffline"
      title="Equipo ejecutor sin conexión"
      tone="warning"
    >
      <p>{{ schedule?.executorDeviceAlias ?? 'El equipo ejecutor' }} no se reporta desde hace más de 24 horas. La descarga sólo avanza con Fiscenix abierto en ese equipo (no hace falta sesión); elige otro equipo con la e.firma si no volverá pronto.</p>
    </InlineNotice>
    <InlineNotice
      v-if="suggestsPortal"
      title="Alternativa mientras tanto"
      tone="info"
      data-testid="sat-portal-fallback"
    >
      <p>{{ portalFallbackText }}</p>
    </InlineNotice>

    <dl
      v-if="schedule"
      class="sat-automation-facts"
    >
      <div>
        <dt>Estado</dt>
        <dd>
          <StatusBadge :tone="stateBadge.tone">
            {{ stateBadge.label }}
          </StatusBadge>
        </dd>
      </div>
      <div>
        <dt>Próxima ejecución</dt>
        <dd>{{ schedule.settings.isEnabled && schedule.nextRunAt ? formatOfficeInstant(schedule.nextRunAt) : schedule.state === 'running' ? 'En curso' : '—' }}</dd>
      </div>
      <div>
        <dt>Equipo ejecutor</dt>
        <dd data-testid="sat-executor-check-in">
          {{ schedule.executorDeviceAlias ?? '—' }} · último reporte {{ checkInText }}
        </dd>
      </div>
      <div>
        <dt>Por cuenta de</dt>
        <dd>{{ schedule.updatedByDisplayName }}</dd>
      </div>
      <div>
        <dt>Emitidas</dt>
        <dd data-testid="sat-coverage-issued">
          {{ describeCoverage('issued') }}
        </dd>
      </div>
      <div>
        <dt>Recibidas</dt>
        <dd data-testid="sat-coverage-received">
          {{ describeCoverage('received') }}
        </dd>
      </div>
      <div class="sat-automation-wide">
        <dt>Último resultado</dt>
        <dd>
          <template v-if="lastResult">
            <StatusBadge :tone="lastResult.tone">
              {{ lastResult.label }}
            </StatusBadge>
            <span>{{ lastResult.detail }}</span>
          </template>
          <template v-else>
            Ninguna ejecución todavía
          </template>
        </dd>
      </div>
    </dl>
    <p
      v-else
      class="field-help"
    >
      Este cliente no tiene descarga automática.
    </p>

    <InlineNotice
      v-if="canManage && !devices.length"
      title="Sin equipo con e.firma"
      tone="warning"
    >
      <p>Captura la e.firma del cliente en el equipo que hará la descarga (arriba) para poder activarla.</p>
    </InlineNotice>
    <form
      v-if="canManage && draft && devices.length"
      class="sat-automation-form"
      data-testid="sat-automation-form"
      @submit.prevent="save"
    >
      <CheckField
        id="sat-automation-enabled"
        v-model="draft.isEnabled"
        label="Descargar automáticamente"
      />
      <div class="sat-automation-grid">
        <SelectField
          id="sat-automation-directions"
          :model-value="draft.directions"
          label="CFDI"
          :options="directionOptions"
          :disabled="!draft.isEnabled"
          @update:model-value="draft.directions = $event as SatScheduleDirections"
        />
        <SelectField
          id="sat-automation-frequency"
          :model-value="draft.frequency"
          label="Frecuencia"
          :options="frequencyOptions"
          :disabled="!draft.isEnabled"
          @update:model-value="draft.frequency = $event as SatScheduleFrequency"
        />
        <TimeField
          id="sat-automation-time"
          v-model="draft.runTime"
          label="Hora (despacho)"
          :disabled="!draft.isEnabled"
        />
        <SelectField
          v-if="draft.frequency === 'weekly'"
          id="sat-automation-day"
          :model-value="String(draft.dayOfWeek)"
          label="Día"
          :options="dayOptions"
          :disabled="!draft.isEnabled"
          @update:model-value="draft.dayOfWeek = Number($event)"
        />
        <SelectField
          id="sat-automation-device"
          :model-value="draft.executorDeviceId ?? ''"
          label="Equipo que descarga"
          :options="deviceOptions"
          :disabled="!draft.isEnabled"
          @update:model-value="draft.executorDeviceId = $event || null"
        />
        <DateField
          id="sat-automation-start"
          v-model="draft.coverageStartDate"
          label="Cubrir desde"
          :max="today"
          :disabled="!draft.isEnabled"
        />
      </div>
      <p class="field-help">
        Sólo aparecen los equipos con la e.firma del cliente; los XML quedan en la biblioteca de ese equipo. Cambiar "Cubrir desde" vuelve a cubrir desde esa fecha.
      </p>
      <div class="actions">
        <ActionButton
          type="submit"
          variant="primary"
          :is-loading="isSaving"
          :disabled="draft.isEnabled && !draft.executorDeviceId"
        >
          Guardar automático
        </ActionButton>
        <ActionButton
          v-if="schedule?.settings.isEnabled && schedule.state !== 'running' && !schedule.isPaused"
          :is-loading="isRunning"
          @click="runNow"
        >
          <Play
            :size="15"
            aria-hidden="true"
          /> Ejecutar ahora
        </ActionButton>
      </div>
    </form>
  </section>
</template>
<style scoped>
/* Mismo encabezado que las demás secciones del modal (el estilo del panel no alcanza a este componente). */
.sat-section h3 { margin: 0; font-size: 13px; letter-spacing: .05em; text-transform: uppercase; }
.section-heading { gap: 8px; justify-content: flex-start; border-top: none; padding-top: 0; }
.sat-automation-facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr)); gap: var(--spaceMedium); margin: 0; }
.sat-automation-facts dt { font-family: var(--monoFontFamily); font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--mutedTextColor); }
.sat-automation-facts dd { margin: 4px 0 0; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; overflow-wrap: anywhere; }
.sat-automation-wide { grid-column: 1 / -1; }
.sat-automation-runs-where { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.sat-platform-chip { display: inline-flex; align-items: center; gap: 6px; min-height: 30px; padding: 2px 10px; border: 2px solid var(--borderColor); background: var(--surfaceColor); color: var(--textColor); box-shadow: 2px 2px 0 var(--shadowInk); font-size: 13px; font-weight: 600; }
.sat-platform-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--successColor); }
.sat-platform-chip[data-tone="warning"] .sat-platform-dot { background: var(--warningColor); }
.sat-platform-chip[data-tone="error"] .sat-platform-dot { background: var(--errorColor); }
.sat-platform-chip[data-tone="info"] .sat-platform-dot { background: var(--infoColor); }
.sat-automation-form { display: grid; gap: var(--spaceMedium); }
.sat-automation-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 190px), 1fr)); gap: var(--spaceMedium); align-items: end; }
</style>
