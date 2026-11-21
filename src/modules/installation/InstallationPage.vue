<script setup lang="ts">
import ClientConnectionPanel from './ClientConnectionPanel.vue'
import DiagnosticsPanel from './DiagnosticsPanel.vue'
import { computed, onMounted, ref } from 'vue'
import { Activity, Cpu } from '@lucide/vue'
import type { HostState } from '../../../shared/contracts/host'
import { describeHostState, hostStateMessages } from './hostStateMessages'
import { useNotifications } from '../../shared/notifications/notificationStore'
const { notify } = useNotifications()
import HostDatabasePanel from './HostDatabasePanel.vue'
import type { InstallationInformation } from '../../../shared/contracts/installation'
import ActionButton from '../../shared/components/ActionButton.vue'
import SelectField from '../../shared/components/SelectField.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import StatusBadge from '../../shared/components/StatusBadge.vue'
import ConfirmDialog from '../../shared/components/ConfirmDialog.vue'
import HelpTip from '../../shared/components/HelpTip.vue'
import SettingsSectionHeader from '../settings/SettingsSectionHeader.vue'
const information = ref<InstallationInformation | null>(null)
const selectedMode = ref('client')
const isLoading = ref(false)
const errorMessage = ref('')
const isRecoveryOpen = ref(false)
/**
 * `setup`: instalación a pantalla completa, una sola vez. `settings`: la misma configuración dentro
 * de Configuración > Este equipo, con una sesión iniciada.
 */
const props = withDefaults(defineProps<{ context?: 'setup' | 'settings' }>(), { context: 'setup' })
/**
 * Configuración › Este equipo en mosaico (2026-10-06, pedido del usuario), por importancia:
 * 1. **Estado del servicio** (sólo Host): lo más alto, con insignia de color y el mensaje del estado; a su lado,
 *    **Función de este equipo** (identidad y cambio de función).
 * 2. **Diagnóstico** del equipo, a todo el ancho.
 * 3. La conexión (Cliente) o la administración del despacho (Host: equipos, USB y conexión segura).
 * 4. Al final, la alternativa avanzada de usar MySQL propio (dentro de HostDatabasePanel).
 * En la instalación (`setup`) se conserva el flujo por pasos de siempre.
 * Estructura común (2026-10-10): en Configuración el encabezado es `SettingsSectionHeader` con índice; Estado del
 * servicio y Función llevan su ayuda "?", y cada bloque tiene el `id` al que salta el índice.
 */
const hostState = ref<HostState>('starting')
const hostSummary = computed(() => describeHostState(hostState.value))
/**
 * Índice "En esta sección" de Configuración › Este equipo (2026-10-10), en el orden del mosaico. En el Host la
 * última ficha lleva al grupo "Avanzado" (MySQL propio, dentro de HostDatabasePanel).
 */
const sectionLinks = computed(() => {
  const isHost = information.value?.activeMode === 'host'
  return [
    ...(isHost ? [{ targetId: 'device-status', label: 'Estado' }] : []),
    { targetId: 'device-function', label: 'Función' },
    { targetId: 'device-diagnostics', label: 'Diagnóstico' },
    { targetId: 'device-connection', label: isHost ? 'Equipos y conexión' : 'Conexión con el Host' },
    ...(isHost ? [{ targetId: 'device-advanced', label: 'Avanzado' }] : [])
  ]
})
const emit = defineEmits<{ modeChanged: [mode: string] }>()

/** Mantiene selección ante error; sólo Main persiste y valida el modo. */
async function runOperation(operation: () => Promise<InstallationInformation>): Promise<void> {
  isLoading.value = true
  errorMessage.value = ''
  try {
    information.value = await operation()
    selectedMode.value = information.value.mode ?? 'client'
    emit('modeChanged', information.value.activeMode ?? 'Sin configurar')
  } catch { errorMessage.value = 'No se pudo leer o guardar la configuración. Se conservan los datos existentes. Puedes reintentar o recuperar la copia anterior.' }
  finally { isLoading.value = false }
}
async function restorePrevious(): Promise<void> {
  await runOperation(() => window.contapp.restorePreviousInstallation())
  isRecoveryOpen.value = false
}
async function restartApplication(): Promise<void> {
  try { await window.contapp.restartApplication() }
  catch { errorMessage.value = 'No se pudo reiniciar. Cierra y abre la aplicación para aplicar el cambio.' }
}
function loadInstallation(): Promise<void> { return runOperation(() => window.contapp.getInstallationInformation()) }
async function saveInstallation(): Promise<void> {
  await runOperation(() => window.contapp.configureInstallation({ mode: selectedMode.value === 'host' ? 'host' : 'client' }))
  if (!errorMessage.value) notify('Configuración guardada', 'Reinicia la aplicación para aplicar la función del equipo.', 'success')
}
onMounted(loadInstallation)
</script>
<template>
  <section>
    <template v-if="props.context === 'setup'">
      <h1>Configura tu equipo</h1>
      <p class="lede">
        Elige cómo participará este equipo en el despacho. Sólo se hace una vez.
      </p>
    </template>
    <SettingsSectionHeader
      v-else
      title="Este equipo"
      description="Función del equipo, conexión con el despacho y equipos vinculados."
      help-title="Host y Clientes"
      help-text="El Host es la computadora que guarda los datos compartidos del despacho (clientes, pagos, tareas, respaldos) y atiende a las demás. Los Clientes se conectan a él por la red local. Las notas y los XML se quedan siempre en cada equipo."
      :links="sectionLinks"
    />
    <InlineNotice
      v-if="errorMessage"
      title="Configuración no disponible"
      tone="error"
    >
      <p>{{ errorMessage }}</p>
      <div class="actions">
        <ActionButton
          :is-loading="isLoading"
          @click="loadInstallation"
        >
          Reintentar
        </ActionButton>
        <ActionButton
          :disabled="isLoading"
          @click="isRecoveryOpen = true"
        >
          Recuperar copia anterior
        </ActionButton>
      </div>
    </InlineNotice>
    <p
      v-if="isLoading && !information"
      role="status"
    >
      Leyendo configuración…
    </p>
    <div
      v-if="information"
      :class="{ 'device-bento': props.context === 'settings' }"
    >
      <section
        v-if="props.context === 'settings' && information.activeMode === 'host'"
        id="device-status"
        class="surface-panel bento-status"
        :class="'tone-' + hostSummary.tone"
        aria-labelledby="host-service-title"
        tabindex="-1"
      >
        <div class="bento-status-heading">
          <div class="help-title-row">
            <h2 id="host-service-title">
              <Activity
                :size="20"
                aria-hidden="true"
              /> Estado del servicio
            </h2>
            <HelpTip
              title="Estado del servicio"
              text="Indica si el Host está listo para atender a los demás equipos. Se revisa solo cada pocos segundos. Si no está listo, los Clientes no pueden trabajar con datos del despacho; el Diagnóstico de abajo dice qué revisar."
            />
          </div>
          <StatusBadge :tone="hostSummary.tone">
            {{ hostSummary.label }}
          </StatusBadge>
        </div>
        <p
          class="bento-status-message"
          data-testid="host-status"
          :data-state="hostState"
        >
          {{ hostStateMessages[hostState] }}
        </p>
      </section>
      <section
        :id="props.context === 'settings' ? 'device-function' : undefined"
        :class="props.context === 'settings' ? 'surface-panel bento-function' : undefined"
        :aria-label="props.context === 'settings' ? 'Función de este equipo' : undefined"
        :tabindex="props.context === 'settings' ? -1 : undefined"
      >
        <div
          v-if="props.context === 'settings'"
          class="help-title-row"
        >
          <h2 class="bento-card-title">
            <Cpu
              :size="18"
              aria-hidden="true"
            /> Función de este equipo
          </h2>
          <HelpTip
            title="Cambiar de función"
            text="Pasar de Cliente a Host (o al revés) requiere reiniciar Fiscenix. Los datos del despacho no se borran, pero un equipo nuevo como Host empieza sin ellos: para mover el despacho usa un respaldo."
          />
        </div>
        <details :open="props.context === 'setup' && (!information.mode || information.requiresRestart)">
          <summary>{{ information.mode ? 'Función de este equipo: ' + (information.mode === 'host' ? 'Host' : 'Cliente') : 'Elegir función de este equipo' }}</summary>
          <div class="section-heading">
            <h2>Identidad del dispositivo</h2><StatusBadge>{{ information.mode === 'host' ? 'Host' : information.mode === 'client' ? 'Cliente' : 'Sin configurar' }}</StatusBadge>
          </div>
          <dl class="device-information">
            <div><dt>Nombre del equipo</dt><dd>{{ information.computerName }}</dd></div><div>
              <dt>Identificador del dispositivo</dt><dd class="device-id">
                {{ information.deviceId }}
              </dd>
            </div>
          </dl>
          <form
            class="configuration-form"
            @submit.prevent="saveInstallation"
          >
            <SelectField
              id="installation-mode"
              v-model="selectedMode"
              label="Función de este equipo"
              :disabled="isLoading"
              :options="[{ value: 'client', label: 'Cliente — conectar con un Host' }, { value: 'host', label: 'Host — centralizar el despacho' }]"
            />
            <p class="field-help">
              Host conserva los datos compartidos. Cliente se conecta al Host. Las notas y los XML permanecen en cada dispositivo.
            </p>
            <ActionButton
              type="submit"
              variant="primary"
              :is-loading="isLoading"
            >
              Guardar configuración
            </ActionButton>
          </form>
        </details>
      </section>
      <!-- Diagnóstico (7.4): sólo en Configuración, con o sin Host listo; justo debajo del estado y la función. -->
      <DiagnosticsPanel
        v-if="props.context === 'settings'"
        id="device-diagnostics"
        class="bento-wide"
        tabindex="-1"
      />
      <InlineNotice
        v-if="information.requiresRestart"
        class="bento-wide"
        title="Cambio guardado"
        tone="success"
      >
        <p>Reinicia Fiscenix para aplicar la función seleccionada. Los datos existentes se conservan.</p>
        <ActionButton @click="restartApplication">
          Reiniciar aplicación
        </ActionButton>
      </InlineNotice>
      <ClientConnectionPanel
        v-if="information.activeMode === 'client'"
        :id="props.context === 'settings' ? 'device-connection' : undefined"
        class="bento-wide"
        :tabindex="props.context === 'settings' ? -1 : undefined"
        :context="props.context"
      />
      <HostDatabasePanel
        v-if="information.activeMode === 'host'"
        :id="props.context === 'settings' ? 'device-connection' : undefined"
        class="bento-wide"
        :tabindex="props.context === 'settings' ? -1 : undefined"
        :context="props.context"
        @state-changed="hostState = $event"
      />
    </div>
    <ConfirmDialog
      :is-open="isRecoveryOpen"
      title="Recuperar configuración anterior"
      :is-loading="isLoading"
      @close="isRecoveryOpen = false"
      @confirm="restorePrevious"
    >
      <p>Se restaurará la última copia válida de este perfil. El archivo actual se conservará para diagnóstico. No se borran documentos ni se crea otro identificador.</p>
    </ConfirmDialog>
  </section>
</template>
<style scoped>
/* Mosaico de 12 columnas: estado y función arriba (8 + 4), diagnóstico y el resto a todo el ancho. */
.device-bento { container-type: inline-size; display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: var(--spaceMedium); align-items: start; }
.device-bento > * { grid-column: span 12; min-width: 0; margin: 0; }
.device-bento > .bento-status { grid-column: span 8; align-self: stretch; }
.device-bento > .bento-function { grid-column: span 4; align-self: stretch; }
.bento-status { display: grid; align-content: start; gap: 10px; border-left-width: 8px; }
.bento-status.tone-success { border-left-color: var(--successColor); }
.bento-status.tone-warning { border-left-color: var(--warningColor); }
.bento-status.tone-error { border-left-color: var(--errorColor); }
.bento-status.tone-info { border-left-color: var(--infoColor); }
.bento-status-heading { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 16px; }
.bento-status-heading h2, .bento-card-title { display: inline-flex; align-items: center; gap: 10px; margin: 0; }
.bento-status-message { margin: 0; font-size: 18px; font-weight: 700; line-height: 1.4; }
.bento-function { display: grid; align-content: start; gap: 8px; }
/* Por el ancho real del contenido (no de la ventana): con escalado de Windows la ventana CSS es más angosta. */
@container (max-width: 680px) { .device-bento > .bento-status, .device-bento > .bento-function { grid-column: span 12; } }
</style>


