<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { CalendarClock, RefreshCw } from '@lucide/vue'
import type { ScheduleDetail, ScheduleFrequency, ScheduleRun, ScheduleSettings } from '../../../shared/contracts/schedules'
import ActionButton from '../../shared/components/ActionButton.vue'
import CheckField from '../../shared/components/CheckField.vue'
import FormModal from '../../shared/components/FormModal.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import SelectField from '../../shared/components/SelectField.vue'
import StatusBadge from '../../shared/components/StatusBadge.vue'
import { useNotifications } from '../../shared/notifications/notificationStore'
import { readIpcErrorMessage } from '../../shared/ipcErrorMessage'

/**
 * Consultas programadas de opiniones (7.1), como "Centro de consultas" del original:
 * - **Tarjeta:** estado (activa o no), próxima ejecución en hora del despacho, último resultado y reintentos.
 * - **Modal "Programar consultas"** (`schedules.manage` + `opinions.query`): activar, frecuencia (diaria,
 *   días hábiles o semanal), hora, día de la semana y regímenes (vacío = todos), con el historial reciente.
 * Guardar envía la revisión vigente; si otro equipo la cambió, el Host lo rechaza y se recarga. Las consultas
 * se ejecutan en nombre de quien guarda. El Host ejecuta todo: esta vista sólo consulta y guarda.
 */
const { notify } = useNotifications()
const schedule = ref<ScheduleDetail | null>(null), draft = ref<ScheduleSettings | null>(null)
const isOpen = ref(false), isSaving = ref(false), error = ref('')
let isMounted = true

const frequencyLabels: Record<ScheduleFrequency, string> = { daily: 'Todos los días', weekdays: 'Días hábiles (lunes a viernes)', weekly: 'Una vez por semana' }
const dayLabels = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const triggerLabels: Record<ScheduleRun['runTrigger'], string> = { scheduled: 'A tiempo', recovered: 'Recuperada', skipped: 'Omitida' }
const stateLabels: Record<ScheduleRun['state'], string> = { running: 'En curso', success: 'Completa', partial: 'Parcial', error: 'Con error', cancelled: 'Cancelada', skipped: 'Omitida' }
const stateTones: Record<ScheduleRun['state'], 'success' | 'warning' | 'error' | 'info' | 'neutral'> = { running: 'info', success: 'success', partial: 'warning', error: 'error', cancelled: 'neutral', skipped: 'neutral' }
const frequencyOptions = (Object.keys(frequencyLabels) as ScheduleFrequency[]).map(value => ({ value, label: frequencyLabels[value] }))
const dayOptions = dayLabels.map((label, index) => ({ value: String(index), label }))
const formatInstant = (value: string) => new Date(value).toLocaleString('es-MX', { timeZone: 'America/Mexico_City', weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const summary = computed(() => {
  const current = schedule.value
  if (!current) return ''
  if (!current.settings.isEnabled) return 'Desactivada. Las opiniones sólo se consultan a mano.'
  const when = current.settings.frequency === 'weekly' ? 'cada ' + dayLabels[current.settings.dayOfWeek]!.toLowerCase() : current.settings.frequency === 'weekdays' ? 'de lunes a viernes' : 'todos los días'
  const regimes = current.settings.regimes.length ? ' · regímenes ' + current.settings.regimes.join(', ') : ' · todos los regímenes'
  return 'Activa ' + when + ' a las ' + current.settings.runTime + regimes + '.'
})
const lastRun = computed(() => schedule.value?.runs[0] ?? null)

async function load(): Promise<void> {
  error.value = ''
  try { const result = await window.contapp.manageSchedules({ action: 'get', jobKey: 'complianceOpinions' }); if (isMounted) schedule.value = result.schedule }
  catch (caught) { if (isMounted) error.value = readIpcErrorMessage(caught, 'No se pudo consultar la programación.') }
}
function openEditor(): void {
  if (!schedule.value) return
  draft.value = JSON.parse(JSON.stringify(schedule.value.settings)) as ScheduleSettings
  isOpen.value = true
}
function toggleRegime(regime: string, isChecked: boolean): void {
  if (!draft.value) return
  draft.value.regimes = isChecked ? [...new Set([...draft.value.regimes, regime])] : draft.value.regimes.filter(item => item !== regime)
}
async function save(): Promise<void> {
  if (!schedule.value || !draft.value || isSaving.value) return
  isSaving.value = true; error.value = ''
  try {
    const result = await window.contapp.manageSchedules({ action: 'save', jobKey: 'complianceOpinions', revision: schedule.value.revision, settings: JSON.parse(JSON.stringify(draft.value)) as ScheduleSettings })
    schedule.value = result.schedule; isOpen.value = false
    notify('Programación guardada', result.schedule.settings.isEnabled && result.schedule.nextRunAt ? 'Próxima consulta: ' + formatInstant(result.schedule.nextRunAt) : 'Las consultas programadas quedaron desactivadas.', 'success')
  } catch (caught) { error.value = readIpcErrorMessage(caught, 'No se guardó la programación.'); await load() }
  finally { isSaving.value = false }
}
onMounted(() => { void load() })
onBeforeUnmount(() => { isMounted = false })
</script>
<template>
  <section
    class="surface-panel schedule-card"
    aria-labelledby="schedule-title"
    data-testid="opinion-schedule"
  >
    <div class="schedule-heading">
      <div>
        <h2 id="schedule-title">
          Consultas programadas
        </h2>
        <p class="field-help">
          {{ summary || 'Consultando…' }}
        </p>
      </div>
      <div class="actions">
        <ActionButton
          aria-label="Actualizar programación"
          @click="load"
        >
          <RefreshCw
            :size="16"
            aria-hidden="true"
          />
        </ActionButton>
        <ActionButton
          v-if="schedule?.canManage"
          variant="primary"
          @click="openEditor"
        >
          <CalendarClock
            :size="16"
            aria-hidden="true"
          /> Programar consultas
        </ActionButton>
      </div>
    </div>
    <InlineNotice
      v-if="error && !isOpen"
      title="Programación no disponible"
      tone="error"
    >
      <p>{{ error }}</p>
    </InlineNotice>
    <dl
      v-if="schedule"
      class="schedule-facts"
    >
      <div><dt>Próxima ejecución</dt><dd>{{ schedule.settings.isEnabled && schedule.nextRunAt ? formatInstant(schedule.nextRunAt) : '—' }}</dd></div>
      <div>
        <dt>Última ejecución</dt><dd>
          <template v-if="lastRun">
            <StatusBadge :tone="stateTones[lastRun.state]">
              {{ stateLabels[lastRun.state] }}
            </StatusBadge> {{ formatInstant(lastRun.startedAt) }}
          </template><template v-else>
            Ninguna
          </template>
        </dd>
      </div>
      <div><dt>Reintentos</dt><dd>{{ schedule.pendingRetryCount }} pendiente(s) · {{ schedule.exhaustedRetryCount }} agotado(s)</dd></div>
    </dl>

    <FormModal
      :is-open="isOpen"
      title="Programar consultas"
      description="El Host consulta al SAT a la hora indicada, aunque nadie tenga Fiscenix abierto. Se consulta en tu nombre."
      :is-busy="isSaving"
      test-id="schedule-modal"
      @close="isOpen = false"
    >
      <form
        v-if="draft"
        class="schedule-form"
        @submit.prevent="save"
      >
        <InlineNotice
          v-if="error"
          title="No se guardó"
          tone="error"
        >
          <p>{{ error }}</p>
        </InlineNotice>
        <CheckField
          id="schedule-enabled"
          v-model="draft.isEnabled"
          label="Activar consultas programadas"
        />
        <div class="schedule-grid">
          <SelectField
            id="schedule-frequency"
            :model-value="draft.frequency"
            label="Frecuencia"
            :options="frequencyOptions"
            :disabled="!draft.isEnabled"
            @update:model-value="draft.frequency = $event as ScheduleFrequency"
          />
          <div class="field">
            <label for="schedule-time">Hora (despacho)</label>
            <input
              id="schedule-time"
              v-model="draft.runTime"
              type="time"
              required
              :disabled="!draft.isEnabled"
            >
          </div>
          <SelectField
            v-if="draft.frequency === 'weekly'"
            id="schedule-day"
            :model-value="String(draft.dayOfWeek)"
            label="Día"
            :options="dayOptions"
            :disabled="!draft.isEnabled"
            @update:model-value="draft.dayOfWeek = Number($event)"
          />
        </div>
        <fieldset
          class="schedule-regimes"
          :disabled="!draft.isEnabled"
        >
          <legend>Regímenes incluidos</legend>
          <p class="field-help">
            Sin selección se consultan todos. Sólo entran clientes con RFC válido asignados a ti con lectura y escritura.
          </p>
          <label
            v-for="regime in schedule?.availableRegimes ?? []"
            :key="regime"
            class="check-field"
          >
            <input
              type="checkbox"
              :checked="draft.regimes.includes(regime)"
              @change="toggleRegime(regime, ($event.target as HTMLInputElement).checked)"
            > {{ regime }}
          </label>
        </fieldset>
        <p class="field-help">
          Si el Host estaba apagado a la hora programada, al encender ejecuta una sola vez la consulta pendiente de las últimas 24 horas.
          Los clientes que fallen por red o por el SAT se reintentan a los 5, 15, 30 y 60 minutos.
        </p>
        <section
          v-if="schedule?.runs.length"
          aria-label="Ejecuciones recientes"
        >
          <h3 class="metric-label">
            Ejecuciones recientes
          </h3>
          <ul class="schedule-runs">
            <li
              v-for="run in schedule.runs"
              :key="run.runId"
            >
              <StatusBadge :tone="stateTones[run.state]">
                {{ stateLabels[run.state] }}
              </StatusBadge>
              <span>{{ formatInstant(run.scheduledFor) }} · {{ triggerLabels[run.runTrigger] }}<template v-if="run.totalCount"> · {{ run.answeredCount }} de {{ run.totalCount }} consultados</template></span>
              <span
                v-if="run.message"
                class="field-help"
              >{{ run.message }}</span>
            </li>
          </ul>
        </section>
        <div class="actions form-footer">
          <ActionButton
            variant="primary"
            type="submit"
            :is-loading="isSaving"
          >
            Guardar programación
          </ActionButton>
          <ActionButton
            :disabled="isSaving"
            @click="isOpen = false"
          >
            Cancelar
          </ActionButton>
        </div>
      </form>
    </FormModal>
  </section>
</template>
<style scoped>
.schedule-card { display: grid; gap: var(--spaceMedium); margin-bottom: var(--spaceMedium); }
.schedule-heading { display: flex; flex-wrap: wrap; justify-content: space-between; gap: var(--spaceMedium); align-items: flex-start; }
.schedule-heading h2 { margin: 0 0 4px; }
.schedule-facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: var(--spaceMedium); margin: 0; }
.schedule-facts dt { font-family: var(--monoFontFamily); font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--mutedTextColor); }
.schedule-facts dd { margin: 4px 0 0; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.schedule-form { display: grid; gap: var(--spaceMedium); }
.schedule-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap: var(--spaceMedium); align-items: start; }
.schedule-regimes { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 4px 12px; margin: 0; padding: 14px 16px; border: 2px solid var(--borderColor); border-radius: var(--radiusNested); }
.schedule-regimes legend { font-weight: 500; padding: 0 4px; }
.schedule-regimes .field-help { grid-column: 1 / -1; margin-bottom: 6px; }
.schedule-runs { list-style: none; margin: 8px 0 0; padding: 0; display: grid; gap: 8px; }
.schedule-runs li { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 2px 10px; align-items: center; }
.schedule-runs li .field-help { grid-column: 2; }
</style>
