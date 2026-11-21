<script setup lang="ts">
import DeviceAdministrationPanel from './DeviceAdministrationPanel.vue'
import LinkFilePanel from './LinkFilePanel.vue'
import HostTrustPanel from './HostTrustPanel.vue'
import AdministratorSetupPanel from './AdministratorSetupPanel.vue'
import SetupRestorePanel from './SetupRestorePanel.vue'
import ManagedDatabasePanel from './ManagedDatabasePanel.vue'
import { ref, onMounted, onUnmounted } from 'vue'
import { useNotifications } from '../../shared/notifications/notificationStore'
const { notify } = useNotifications()
import type { HostState } from '../../../shared/contracts/host'
import TextField from '../../shared/components/TextField.vue'
import ActionButton from '../../shared/components/ActionButton.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import ConfirmDialog from '../../shared/components/ConfirmDialog.vue'
import { hostStateMessages } from './hostStateMessages'
import SettingsGroup from '../settings/SettingsGroup.vue'
import { Wrench } from '@lucide/vue'
/**
 * `setup`: pasos de instalación. `settings`: administración con sesión, en mosaico (2026-10-06):
 * "Equipos del despacho" y "Conectar otro equipo (USB)" lado a lado, la conexión segura a todo el ancho y, al final,
 * la alternativa de MySQL propio. En Configuración, "Estado del servicio" lo muestra InstallationPage arriba de todo
 * (este panel le avisa cada cambio con `stateChanged`); en la instalación se sigue viendo aquí.
 */
const props = withDefaults(defineProps<{ context?: 'setup' | 'settings' }>(), { context: 'setup' })
const emit = defineEmits<{ stateChanged: [state: HostState] }>()
const state = ref<HostState>('starting')
const database = ref('contapp')
const port = ref('3306')
const user = ref('')
const password = ref('')
const migrationUser = ref('')
const migrationPassword = ref('')
const error = ref('')
const isBusy = ref(false)
const isConfirming = ref(false)
const messages = hostStateMessages
/** Atributos del grupo "Avanzado" sólo en Configuración: en la instalación el contenedor es un `div` sin nada. */
const advancedGroupAttributes = props.context === 'settings'
  ? { id: 'device-advanced', title: 'Avanzado', icon: Wrench, tone: 'advanced' as const, description: 'Sólo para quien administra MySQL por su cuenta. El servidor automático ya resuelve la base de datos.' }
  : {}
let timer: ReturnType<typeof setInterval> | undefined
/** Sólo consulta un DTO de estado; las contraseñas nunca vuelven desde Main. */
async function refreshStatus(): Promise<void> {
  try { state.value = (await window.contapp.getHostStatus()).state; emit('stateChanged', state.value) } catch { error.value = 'No se pudo consultar el servicio.' }
}
async function saveConnection(): Promise<void> {
  isBusy.value = true
  error.value = ''
  try { state.value = (await window.contapp.configureHostDatabase({ port: Number(port.value), database: database.value, user: user.value, password: password.value })).state; notify('Conexión guardada', 'Se está comprobando la disponibilidad de MySQL.', 'info') }
  catch { error.value = 'No se pudo guardar. Revisa los campos y que este equipo esté activo como Host.' }
  finally { password.value = ''; isBusy.value = false }
}
async function prepareDatabase(): Promise<void> {
  isBusy.value = true
  error.value = ''
  try { state.value = (await window.contapp.prepareHostDatabase({ user: migrationUser.value, password: migrationPassword.value })).state }
  catch { error.value = 'No se pudo solicitar la preparación de la base.' }
  finally { migrationPassword.value = ''; isBusy.value = false; isConfirming.value = false }
}
onMounted(() => { void refreshStatus(); timer = setInterval(() => { void refreshStatus() }, 1500) })
onUnmounted(() => { if (timer) clearInterval(timer) })
</script>
<template>
  <section class="reference-section">
    <template v-if="props.context === 'setup'">
      <h2>Prepara el despacho</h2>
      <p>1. Prepara el servidor · 2. Crea tu usuario · 3. Inicia sesión y conecta los demás equipos</p>
      <ManagedDatabasePanel v-if="!['setupRequired', 'securityRequired', 'pairingRequired'].includes(state)" />
      <AdministratorSetupPanel
        v-if="state === 'setupRequired'"
        @completed="state = $event"
      />
      <SetupRestorePanel v-if="state === 'setupRequired'" />
      <HostTrustPanel
        v-if="state === 'securityRequired'"
        mode="host"
      />
    </template>
    <div
      v-else
      class="host-bento"
    >
      <h2 class="host-bento-title">
        Equipos y conexión del despacho
      </h2>
      <template v-if="state === 'pairingRequired'">
        <DeviceAdministrationPanel class="host-bento-devices" />
        <LinkFilePanel
          class="host-bento-link"
          mode="host"
        />
        <HostTrustPanel
          class="host-bento-trust"
          mode="host"
        />
      </template>
      <ManagedDatabasePanel
        v-if="!['setupRequired', 'securityRequired', 'pairingRequired'].includes(state)"
        class="host-bento-wide"
      />
    </div>
    <InlineNotice
      v-if="props.context === 'setup'"
      title="Estado del servicio"
    >
      <p
        data-testid="host-status"
        :data-state="state"
      >
        {{ messages[state] }}
      </p>
    </InlineNotice>
    <InlineNotice
      v-if="error"
      title="No se pudo completar la operación"
      tone="error"
    >
      {{ error }}
    </InlineNotice>
    <!--
      En Configuración la alternativa de MySQL propio va al final en el grupo "Avanzado" (2026-10-10), separada de lo
      de todos los días; en la instalación se ve igual que siempre (sin grupo).
    -->
    <component
      :is="props.context === 'settings' ? SettingsGroup : 'div'"
      v-bind="advancedGroupAttributes"
    >
      <details>
        <summary>Alternativa avanzada: usar un MySQL instalado sin Docker</summary>
        <p>Utiliza esta opción sólo si administrarás MySQL por tu cuenta. El servidor automático ya prepara la conexión y las cuentas.</p>
        <form
          class="configuration-form"
          @submit.prevent="saveConnection"
        >
          <h3>MySQL local sin Docker</h3>
          <p>Usa una base nueva de Fiscenix en este equipo. La cuenta de conexión debe tener permisos de lectura y escritura, sin permisos para cambiar tablas.</p>
          <TextField
            id="database-name"
            v-model="database"
            label="Base de datos"
          />
          <TextField
            id="database-port"
            v-model="port"
            label="Puerto local de MySQL"
          />
          <TextField
            id="database-user"
            v-model="user"
            label="Usuario de conexión"
          />
          <TextField
            id="database-password"
            v-model="password"
            label="Contraseña de conexión"
            type="password"
          />
          <ActionButton
            type="submit"
            variant="primary"
            :is-loading="isBusy"
          >
            Guardar conexión
          </ActionButton>
        </form>
        <form
          v-if="state === 'migrationRequired' || state === 'migrationFailed'"
          class="configuration-form"
          @submit.prevent="isConfirming = true"
        >
          <h3>Preparar esquema</h3>
          <p>Usa una cuenta distinta con permiso para crear tablas. Esta contraseña se utilizará sólo para la preparación y no se guardará. Una base existente requiere revisión y respaldo antes de cambiar su estructura.</p>
          <TextField
            id="migration-user"
            v-model="migrationUser"
            label="Usuario de migración"
          />
          <TextField
            id="migration-password"
            v-model="migrationPassword"
            label="Contraseña de migración"
            type="password"
          />
          <ActionButton
            type="submit"
            :is-loading="isBusy"
          >
            Preparar base de datos
          </ActionButton>
        </form>
      </details>
    </component>
    <ConfirmDialog
      :is-open="isConfirming"
      title="Preparar esquema de Fiscenix"
      :is-loading="isBusy"
      @close="isConfirming = false"
      @confirm="prepareDatabase"
    >
      <p>Se crearán las tablas iniciales en la base configurada. No se importan datos antiguos ni se crea un administrador. No continúes si has seleccionado una base del sistema original.</p>
    </ConfirmDialog>
  </section>
</template>
<style scoped>
/* Mosaico de Configuración › Este equipo: equipos (7) y USB (5) lado a lado; la conexión segura a todo el ancho. */
.host-bento { container-type: inline-size; display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: var(--spaceMedium); align-items: stretch; }
.host-bento > * { grid-column: span 12; min-width: 0; margin: 0; }
.host-bento-title { margin: var(--spaceMedium) 0 0; }
.host-bento > .host-bento-devices { grid-column: span 7; }
.host-bento > .host-bento-link { grid-column: span 5; }
/* Por el ancho real del contenido (no de la ventana): con escalado de Windows la ventana CSS es más angosta. */
@container (max-width: 640px) { .host-bento > .host-bento-devices, .host-bento > .host-bento-link { grid-column: span 12; } }
</style>

