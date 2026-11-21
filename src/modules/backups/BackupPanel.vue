<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ArrowRightLeft, DatabaseBackup, FolderOpen, History, Play, RefreshCw, Settings2, TriangleAlert } from '@lucide/vue'
import SettingsSectionHeader from '../settings/SettingsSectionHeader.vue'
import SettingsCard from '../settings/SettingsCard.vue'
import SettingsGroup from '../settings/SettingsGroup.vue'
import { backupRetention, minimumBackupPasswordLength, type BackupRun, type BackupStatus } from '../../../shared/contracts/backups'
import ActionButton from '../../shared/components/ActionButton.vue'
import CheckField from '../../shared/components/CheckField.vue'
import FormModal from '../../shared/components/FormModal.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import StatusBadge from '../../shared/components/StatusBadge.vue'
import TextField from '../../shared/components/TextField.vue'
import LatticeLoader from '../../shared/vueBits/LatticeLoader.vue'
import { useNotifications } from '../../shared/notifications/notificationStore'
import BackupRestoreSection from './BackupRestoreSection.vue'
import LegacyMigrationSection from '../legacyMigration/LegacyMigrationSection.vue'
import { workspaceAccess } from '../workspace/sessionState'
import { readIpcErrorMessage } from '../../shared/ipcErrorMessage'
import { withSensitiveConfirmation } from '../../shared/security/confirmSensitive'

/**
 * Respaldos del Host (7.2), en Configuración y sólo en el equipo Host con `backups.manage`:
 * - **Estado:** carpeta, programación diaria de las 02:00 (activar o pausar), próxima ejecución, retención y si
 *   la clave de este Host está disponible.
 * - **Configurar** (modal): elegir carpeta con el diálogo nativo, contraseña de respaldo dos veces y la
 *   contraseña de la sesión. Avisa que sin la contraseña de respaldo no se puede restaurar.
 * - **Respaldar ahora** y el historial de los últimos 20, que se actualiza cada 3 s mientras hay uno en curso.
 * El Host hace todo el trabajo; esta vista sólo consulta y envía solicitudes cerradas.
 *
 * Estructura común (2026-10-10): encabezado con ayuda "?" e índice (Estado, Historial, Zona de riesgo); tarjetas
 * `SettingsCard` para el estado y el historial, y la restauración al final dentro de un `SettingsGroup` en rojo.
 * Migración desde la app anterior (8.1): tarjeta antes de la zona de riesgo, sólo con `migration.run` (el Host lo vuelve a
 * exigir). Su enlace a Usuarios y accesos sube como `openSection` a Configuración.
 */
const emit = defineEmits<{ openSection: [section: 'access'] }>()
const { notify } = useNotifications()
const status = ref<BackupStatus | null>(null)
/** Fichas de "En esta sección": sólo las de los bloques que se ven ahora. */
const sectionLinks = computed(() => [
  { targetId: 'backup-status', label: 'Estado' },
  ...(status.value?.runs.length ? [{ targetId: 'backup-history', label: 'Historial' }] : []),
  ...(workspaceAccess.value.canRunLegacyMigration ? [{ targetId: 'backup-legacy-migration', label: 'Migrar' }] : []),
  ...(status.value?.canRestore ? [{ targetId: 'backup-restore-zone', label: 'Zona de riesgo' }] : [])
])
const error = ref(''), formError = ref('')
const isOpen = ref(false), isSaving = ref(false), isStarting = ref(false), isToggling = ref(false)
const destination = ref(''), backupPassword = ref(''), backupPasswordConfirmation = ref('')
let pollTimer: ReturnType<typeof setTimeout> | null = null
let isMounted = true

const stateLabels: Record<BackupRun['state'], string> = { pending: 'En espera', running: 'En curso', success: 'Correcto', error: 'Con error', pruned: 'Depurado' }
const stateTones: Record<BackupRun['state'], 'success' | 'warning' | 'error' | 'info' | 'neutral'> = { pending: 'info', running: 'info', success: 'success', error: 'error', pruned: 'neutral' }
const triggerLabels: Record<BackupRun['trigger'], string> = { scheduled: 'Programado', manual: 'Manual' }
const formatInstant = (value: string) => new Date(value).toLocaleString('es-MX', { timeZone: 'America/Mexico_City', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
function formatSize(bytes: number | null): string {
  if (bytes === null) return ''
  if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + ' KB'
  return (bytes / (1024 * 1024)).toLocaleString('es-MX', { maximumFractionDigits: 1 }) + ' MB'
}
const canRunNow = computed(() => Boolean(status.value?.isConfigured && status.value.keyAvailability === 'ready' && !status.value.isBusy))
const runningBackup = computed(() => status.value?.runs.find(run => run.state === 'running' || run.state === 'pending') ?? null)

/** Mientras hay un respaldo pendiente o en curso se vuelve a consultar cada 3 s. */
function schedulePoll(): void {
  if (pollTimer) clearTimeout(pollTimer)
  pollTimer = status.value?.isBusy && isMounted ? setTimeout(() => { void load() }, 3000) : null
}
async function load(): Promise<void> {
  try {
    const result = await window.contapp.manageBackups({ action: 'get' })
    if (!isMounted || result.status !== 'backups') return
    const wasBusy = status.value?.isBusy
    status.value = result.backups; error.value = ''
    if (wasBusy && !result.backups.isBusy) {
      const last = result.backups.runs[0]
      if (last?.state === 'success') notify('Respaldo terminado', 'Archivo verificado: ' + (last.fileName ?? '') + '.', 'success')
      else if (last?.state === 'error') notify('El respaldo falló', last.message, 'error')
    }
  } catch (caught) { if (isMounted) error.value = readIpcErrorMessage(caught, 'No se pudo consultar los respaldos.') }
  finally { schedulePoll() }
}
function openConfiguration(): void {
  destination.value = status.value?.destination ?? ''
  backupPassword.value = ''; backupPasswordConfirmation.value = ''; formError.value = ''
  isOpen.value = true
}
async function chooseDestination(): Promise<void> {
  try {
    const result = await window.contapp.manageBackups({ action: 'chooseDestination' })
    if (result.status === 'destination' && result.destination) destination.value = result.destination
  } catch (caught) { formError.value = readIpcErrorMessage(caught, 'No se pudo abrir el selector de carpetas.') }
}
async function saveConfiguration(): Promise<void> {
  if (!status.value || isSaving.value) return
  formError.value = ''
  if (!destination.value) { formError.value = 'Elige la carpeta donde se guardarán los respaldos.'; return }
  if (backupPassword.value.length < minimumBackupPasswordLength) { formError.value = 'La contraseña de respaldo debe tener al menos ' + minimumBackupPasswordLength + ' caracteres.'; return }
  if (backupPassword.value !== backupPasswordConfirmation.value) { formError.value = 'Las contraseñas de respaldo no coinciden.'; return }
  isSaving.value = true
  // Configurar es zona crítica (ADR-038): el diálogo único pide la contraseña siempre. Cancelarlo conserva el formulario.
  let isCancelled = false
  try {
    const request = { action: 'configure' as const, revision: status.value.revision, destination: destination.value, backupPassword: backupPassword.value }
    const result = await withSensitiveConfirmation({ operation: 'backups.configure', title: 'Confirmar configuración de respaldos' }, proof => window.contapp.manageBackups(request, proof))
    if (!result) { isCancelled = true; return }
    if (result.status === 'backups') status.value = result.backups
    isOpen.value = false
    notify('Respaldos configurados', 'Se respaldará todos los días a las 02:00. Guarda la contraseña de respaldo en un lugar seguro.', 'success')
  } catch (caught) { formError.value = readIpcErrorMessage(caught, 'No se guardó la configuración.'); await load() }
  finally { isSaving.value = false; if (!isCancelled) { backupPassword.value = ''; backupPasswordConfirmation.value = '' } }
}
async function setEnabled(isEnabled: boolean): Promise<void> {
  if (!status.value || isToggling.value) return
  isToggling.value = true
  try {
    const result = await window.contapp.manageBackups({ action: 'setEnabled', revision: status.value.revision, isEnabled })
    if (result.status === 'backups') status.value = result.backups
  } catch (caught) { error.value = readIpcErrorMessage(caught, 'No se cambió la programación.'); await load() }
  finally { isToggling.value = false }
}
async function runNow(): Promise<void> {
  if (isStarting.value) return
  isStarting.value = true
  try {
    const result = await window.contapp.manageBackups({ action: 'runNow' })
    if (result.status === 'backups') status.value = result.backups
    schedulePoll()
  } catch (caught) { error.value = readIpcErrorMessage(caught, 'No se pudo iniciar el respaldo.') }
  finally { isStarting.value = false }
}
/** Desde la migración (respaldo ausente o fallido): lleva a la tarjeta de estado para configurar o revisar. */
function focusBackupStatus(): void { const card = document.getElementById('backup-status'); card?.scrollIntoView({ block: 'start' }); card?.focus() }
onMounted(() => { void load() })
onBeforeUnmount(() => { isMounted = false; if (pollTimer) clearTimeout(pollTimer) })
</script>

<template>
  <section
    class="backup-panel"
    data-testid="backup-panel"
  >
    <SettingsSectionHeader
      title="Respaldos"
      description="Copia cifrada de la base del despacho, el expediente y las claves del Host. Con la contraseña de respaldo se puede restaurar en otra PC."
      help-title="Cómo funcionan los respaldos"
      help-text="Cada día a las 02:00 el Host guarda un archivo cifrado con la base de datos, los documentos de los clientes y sus claves, y comprueba que se pueda leer. Sólo se abre con la contraseña de respaldo: sin ella no hay forma de restaurarlo. Las notas y los XML de cada equipo no van en el respaldo."
      :links="sectionLinks"
    />
    <InlineNotice
      v-if="error"
      title="Respaldos no disponibles"
      tone="error"
    >
      <p>{{ error }}</p>
    </InlineNotice>
    <InlineNotice
      v-if="status && !status.isConfigured"
      title="Todavía no hay respaldos"
      tone="warning"
    >
      <p>Elige una carpeta (de preferencia un disco externo o una carpeta de red) y una contraseña de respaldo.</p>
    </InlineNotice>
    <InlineNotice
      v-if="status?.keyAvailability === 'missing'"
      title="La clave de respaldo de este equipo no está disponible"
      tone="error"
    >
      <p>Este Host no tiene la clave con la que se configuraron los respaldos (por ejemplo, tras reinstalar). Vuelve a configurarlos; los respaldos anteriores se abren con su contraseña.</p>
    </InlineNotice>

    <!-- 1. Estado y programación: lo primero que se revisa. -->
    <SettingsCard
      id="backup-status"
      class="backup-card"
      tabindex="-1"
      title="Respaldo diario"
      :icon="DatabaseBackup"
      :description="'Todos los días a las ' + (status?.runTime ?? '02:00') + ' (hora del despacho). Se conservan los últimos ' + backupRetention.dailyCount + ' días y ' + backupRetention.weeklyCount + ' semanas.'"
    >
      <template #actions>
        <ActionButton
          aria-label="Actualizar respaldos"
          @click="load"
        >
          <RefreshCw
            :size="16"
            aria-hidden="true"
          />
        </ActionButton>
        <ActionButton
          v-if="status"
          @click="openConfiguration"
        >
          <Settings2
            :size="16"
            aria-hidden="true"
          /> {{ status.isConfigured ? 'Cambiar carpeta o contraseña' : 'Configurar respaldos' }}
        </ActionButton>
        <ActionButton
          v-if="status?.isConfigured"
          variant="primary"
          :disabled="!canRunNow"
          :is-loading="isStarting"
          @click="runNow"
        >
          <Play
            :size="16"
            aria-hidden="true"
          /> Respaldar ahora
        </ActionButton>
      </template>
      <dl
        v-if="status?.isConfigured"
        class="backup-facts"
      >
        <div>
          <dt>Carpeta</dt><dd class="backup-destination">
            {{ status.destination }}
          </dd>
        </div>
        <div><dt>Próximo respaldo</dt><dd>{{ status.isEnabled && status.nextRunAt ? formatInstant(status.nextRunAt) : 'Pausado' }}</dd></div>
        <div>
          <dt>Configuró</dt><dd>
            {{ status.updatedByDisplayName ?? '—' }}<template v-if="status.updatedAt">
              · {{ formatInstant(status.updatedAt) }}
            </template>
          </dd>
        </div>
      </dl>
      <CheckField
        v-if="status?.isConfigured"
        id="backup-enabled"
        :model-value="status.isEnabled"
        label="Respaldar automáticamente todos los días"
        :disabled="isToggling"
        @update:model-value="setEnabled($event)"
      />
      <LatticeLoader
        v-if="runningBackup"
        label="Respaldando: base de datos, expediente y verificación de integridad"
      />
    </SettingsCard>

    <!-- 2. Historial: renglones alineados (sello de estado | cuándo y quién | archivo o mensaje). -->
    <SettingsCard
      v-if="status?.runs.length"
      id="backup-history"
      class="backup-card"
      tabindex="-1"
      title="Historial"
      :icon="History"
      description="Los últimos 20 respaldos, del más reciente al más antiguo. Depurado: el archivo ya salió de la retención."
    >
      <ul
        class="backup-runs"
        aria-label="Respaldos recientes"
      >
        <li
          v-for="run in status.runs"
          :key="run.backupId"
          :data-state="run.state"
        >
          <StatusBadge :tone="stateTones[run.state]">
            {{ stateLabels[run.state] }}
          </StatusBadge>
          <span>{{ formatInstant(run.requestedAt) }} · {{ triggerLabels[run.trigger] }}<template v-if="run.requestedByDisplayName"> · {{ run.requestedByDisplayName }}</template></span>
          <span
            v-if="run.state === 'success' || run.state === 'pruned'"
            class="field-help"
          >{{ run.fileName }} · {{ formatSize(run.sizeBytes) }} · {{ run.tableCount }} tablas, {{ run.rowCount.toLocaleString('es-MX') }} filas, {{ run.documentCount }} documentos</span>
          <span
            v-else-if="run.message"
            class="field-help"
          >{{ run.message }}</span>
        </li>
      </ul>
    </SettingsCard>

    <!-- 3. Migración desde la app anterior (8.1): antes de la zona de riesgo. -->
    <SettingsCard
      v-if="workspaceAccess.canRunLegacyMigration"
      id="backup-legacy-migration"
      class="backup-card"
      tabindex="-1"
      title="Migrar desde la app anterior"
      :icon="ArrowRightLeft"
      description="Trae usuarios, clientes, tareas, movimientos y eventos de la exportación SQL de la app anterior. Las CIEC y notas quedan en este equipo."
      help-title="Cómo funciona la migración"
      help-text="Fiscenix analiza el archivo sin cambiar nada y te muestra qué creará, qué ya existe y qué necesita una decisión. Al migrar, el Host hace antes un respaldo verificado y aplica todo en una sola transacción; repetirla con el mismo archivo no duplica nada."
    >
      <LegacyMigrationSection
        @open-access="emit('openSection', 'access')"
        @open-backup-settings="focusBackupStatus"
      />
    </SettingsCard>

    <!-- 4. Zona de riesgo al final: restaurar reemplaza los datos del despacho. -->
    <SettingsGroup
      v-if="status?.canRestore"
      id="backup-restore-zone"
      title="Zona de riesgo"
      :icon="TriangleAlert"
      tone="danger"
      description="Restaurar reemplaza los datos actuales del despacho y reinicia el Host. Prueba antes el respaldo; la base actual se conserva para volver a ella."
    >
      <BackupRestoreSection
        :restores="status.restores"
        @changed="load"
      />
    </SettingsGroup>

    <FormModal
      :is-open="isOpen"
      title="Configurar respaldos"
      description="El Host guardará un archivo cifrado por día en esta carpeta. Los cambios pedirán tu contraseña."
      :is-busy="isSaving"
      test-id="backup-modal"
      @close="isOpen = false"
    >
      <form
        class="backup-form"
        @submit.prevent="saveConfiguration"
      >
        <InlineNotice
          v-if="formError"
          title="No se guardó"
          tone="error"
        >
          <p>{{ formError }}</p>
        </InlineNotice>
        <div class="field">
          <span class="field-label">Carpeta de respaldos</span>
          <div class="backup-destination-row">
            <span
              class="backup-destination"
              data-testid="backup-destination"
            >{{ destination || 'Sin elegir' }}</span>
            <ActionButton @click="chooseDestination">
              <FolderOpen
                :size="16"
                aria-hidden="true"
              /> Elegir carpeta
            </ActionButton>
          </div>
          <p class="field-help">
            Usa un disco externo, una USB o una carpeta de red: si el disco del Host falla, los respaldos siguen a salvo.
          </p>
        </div>
        <TextField
          id="backup-password"
          v-model="backupPassword"
          type="password"
          autocomplete="new-password"
          label="Contraseña de respaldo"
          :help="'Al menos ' + minimumBackupPasswordLength + ' caracteres. Sin ella no se puede restaurar ningún respaldo: guárdala fuera de la computadora.'"
        />
        <TextField
          id="backup-password-confirmation"
          v-model="backupPasswordConfirmation"
          type="password"
          autocomplete="new-password"
          label="Repite la contraseña de respaldo"
        />
        <p
          v-if="status?.isConfigured"
          class="field-help"
        >
          Los respaldos que ya existen conservan la contraseña con la que se hicieron.
        </p>
        <div class="actions form-footer">
          <ActionButton
            variant="primary"
            type="submit"
            :is-loading="isSaving"
          >
            Guardar y activar
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
.backup-panel { display: grid; gap: var(--spaceMedium); }
.backup-panel > .settings-section-header { margin-bottom: 0; }
.backup-panel > :deep(.inline-notice) { margin: 0; }
.backup-facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: var(--spaceMedium); margin: 0; }
.backup-facts dt { font-family: var(--monoFontFamily); font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--mutedTextColor); }
.backup-facts dd { margin: 4px 0 0; }
.backup-destination { font-family: var(--monoFontFamily); font-size: 13px; overflow-wrap: anywhere; }
.backup-destination-row { display: flex; flex-wrap: wrap; gap: var(--spaceSmall); align-items: center; justify-content: space-between; padding: 10px 12px; border: 2px solid var(--borderColor); border-radius: var(--radiusNested); }
.backup-runs { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
/* Columna fija para el sello: las fechas y los archivos quedan alineados renglón a renglón. */
.backup-runs li { display: grid; grid-template-columns: 7.5rem minmax(0, 1fr); gap: 2px 12px; align-items: center; padding-bottom: 10px; border-bottom: 1px solid var(--hairlineColor); }
.backup-runs li:last-child { padding-bottom: 0; border-bottom: 0; }
.backup-runs li > :first-child { justify-self: start; }
.backup-runs li .field-help { grid-column: 2; overflow-wrap: anywhere; }
.backup-form { display: grid; gap: var(--spaceMedium); }
</style>
