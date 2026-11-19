<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import StatusBadge from '../../shared/components/StatusBadge.vue'
import type { DeviceAdministration, DeviceAdministrationRequest, PairingEntry } from '../../../shared/contracts/pairing'
import ActionButton from '../../shared/components/ActionButton.vue'
import TextField from '../../shared/components/TextField.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import ConfirmDialog from '../../shared/components/ConfirmDialog.vue'
import FormModal from '../../shared/components/FormModal.vue'
import CaptureSteps from '../../shared/components/CaptureSteps.vue'
const entries = ref<DeviceAdministration | null>(null)
const localDeviceId = ref('')
const username = ref('')
const password = ref('')
const code = ref('')
const alias = ref('')
const selected = ref<PairingEntry | null>(null)
const confirmation = ref<{ action: 'deny' | 'revoke' | 'block' | 'unblock' | 'closeSessions'; targetId: string; name: string } | null>(null)
const isBusy = ref(false)
const error = ref('')
const message = ref('')
const actionLabels = { deny: 'Rechazar solicitud', revoke: 'Revocar equipo', block: 'Bloquear equipo', unblock: 'Desbloquear equipo', closeSessions: 'Cerrar sesiones del equipo' }
/**
 * Autorizar un equipo agrega un dato: ocurre en el modal de captura de la app (como "Nuevo pago"). El modal pide
 * el código del Cliente, el alias y otra vez la contraseña administrativa, porque el campo de arriba queda detrás.
 */
function selectRequest(request: PairingEntry): void { selected.value = request; alias.value = request.computerName; code.value = ''; approvalStep.value = 0; approvalError.value = '' }
/** Por pasos (ADR-034): Código y alias → Confirmar identidad → Revisar. La contraseña no aparece en la revisión. */
const approvalStep = ref(0), approvalError = ref('')
const approvalSteps = [{ stepId: 'code', title: 'Código' }, { stepId: 'identity', title: 'Confirmar identidad' }]
const approvalReview = computed(() => [{ label: 'Equipo', value: selected.value?.computerName ?? '' }, { label: 'Alias', value: alias.value.trim() }, { label: 'Código', value: code.value.trim() }, { label: 'Autoriza', value: username.value.trim() }])
function validateApproval(index: number): boolean {
  approvalError.value = index === 0 && !/^[0-9]{8}$/.test(code.value.trim()) ? 'Escribe el código de ocho dígitos que muestra el Cliente.' : index === 0 && !alias.value.trim() ? 'Escribe un alias para el equipo.' : index === 1 && (!username.value.trim() || !password.value) ? 'Escribe el usuario y la contraseña para administrar equipos.' : ''
  return !approvalError.value
}
/** Cada decisión reautentica: no guardar contraseña ni inferir permiso por ser una ventana Host. */
async function administer(action: DeviceAdministrationRequest['action'], targetId?: string): Promise<void> {
  if (isBusy.value) return
  isBusy.value = true; error.value = ''; message.value = ''
  try {
    entries.value = await window.contapp.administerDevices({ action, username: username.value, password: password.value, ...(targetId ? { targetId } : {}), ...(action === 'approve' ? { code: code.value, alias: alias.value } : {}) })
    message.value = action === 'list' ? 'Lista actualizada con autorización administrativa.' : 'Decisión guardada en el Host.'
    if (action !== 'list') selected.value = null
    confirmation.value = null
  } catch { error.value = 'No se pudo completar. Revisa usuario, contraseña, permiso para administrar equipos, vigencia y código de comparación. Tras cinco fallos de autenticación, espera quince minutos.' }
  finally { password.value = ''; isBusy.value = false }
}
onMounted(async () => { localDeviceId.value = (await window.contapp.getInstallationInformation()).deviceId })
onBeforeUnmount(() => { password.value = ''; entries.value = null })
</script>
<template>
  <section class="surface-panel device-administration">
    <h3>Equipos del despacho</h3>
    <p>Cada consulta o decisión requiere credenciales con permiso para administrar equipos. Compara el código directamente con la pantalla del Cliente antes de autorizarlo.</p>
    <form
      class="configuration-form"
      @submit.prevent="administer('list')"
    >
      <TextField
        id="device-admin-user"
        v-model="username"
        :disabled="isBusy"
        label="Usuario para administrar equipos"
      />
      <TextField
        id="device-admin-password"
        v-model="password"
        :disabled="isBusy"
        type="password"
        label="Contraseña para administrar equipos"
      />
      <ActionButton
        type="submit"
        :is-loading="isBusy"
      >
        Consultar equipos
      </ActionButton>
    </form>
    <InlineNotice
      v-if="error || message"
      title="Administración de equipos"
      :tone="error ? 'error' : 'success'"
    >
      <p data-testid="device-administration-message">
        {{ error || message }}
      </p>
    </InlineNotice>
    <template v-if="entries">
      <h4>Solicitudes vigentes</h4>
      <p v-if="!entries.requests.length">
        No hay solicitudes pendientes.
      </p>
      <ul class="device-entries">
        <li
          v-for="request in entries.requests"
          :key="request.requestId"
        >
          <strong>{{ request.computerName }}</strong><p>{{ request.observedAddress }} · {{ request.state === 'approved' ? 'Aprobada; entrega pendiente' : 'Pendiente' }}</p>
          <p class="device-identifier">
            {{ request.deviceId }}
          </p>
          <ActionButton
            :disabled="isBusy || request.state !== 'pending'"
            @click="selectRequest(request)"
          >
            Revisar solicitud
          </ActionButton>
          <ActionButton
            :disabled="isBusy"
            @click="confirmation = { action: 'deny', targetId: request.requestId, name: request.computerName }"
          >
            Rechazar solicitud
          </ActionButton>
        </li>
      </ul>
      <FormModal
        :is-open="Boolean(selected)"
        title="Autorizar equipo"
        :description="selected ? selected.computerName + '. Compara el código con la pantalla de ese equipo.' : ''"
        :is-busy="isBusy"
        test-id="device-approval-modal"
        @close="selected = null"
      >
        <form
          v-if="selected"
          class="device-approval"
          @submit.prevent
        >
          <p
            v-if="approvalError"
            role="alert"
            class="tone-error"
          >
            {{ approvalError }}
          </p>
          <CaptureSteps
            v-model="approvalStep"
            :steps="approvalSteps"
            :review-items="approvalReview"
            :validate="validateApproval"
            :is-busy="isBusy"
            complete-label="Autorizar equipo"
            @complete="administer('approve', selected!.requestId)"
          >
            <template #step-code>
              <TextField
                id="pairing-comparison"
                v-model="code"
                :disabled="isBusy"
                label="Código de ocho dígitos del Cliente"
              />
              <TextField
                id="device-alias"
                v-model="alias"
                :disabled="isBusy"
                label="Alias del equipo"
              />
            </template>
            <template #step-identity>
              <TextField
                id="device-approval-user"
                v-model="username"
                :disabled="isBusy"
                label="Usuario para administrar equipos"
              />
              <TextField
                id="device-approval-password"
                v-model="password"
                :disabled="isBusy"
                type="password"
                label="Contraseña para administrar equipos"
              />
            </template>
            <template #footer-start>
              <ActionButton
                :disabled="isBusy"
                @click="selected = null"
              >
                Cancelar
              </ActionButton>
            </template>
          </CaptureSteps>
        </form>
      </FormModal>
      <h4>Registro de equipos</h4>
      <p v-if="!entries.devices.length">
        No hay equipos registrados.
      </p>
      <ul class="device-entries">
        <li
          v-for="device in entries.devices"
          :key="device.deviceId"
        >
          <strong>{{ device.alias }}</strong><p>
            {{ device.computerName }} · <StatusBadge :tone="device.isRevoked || device.isBlocked ? 'error' : 'success'">
              {{ device.isRevoked ? 'Revocado' : device.isBlocked ? 'Bloqueado' : device.lastSeenAt ? 'Autorizado' : 'Entrega pendiente' }}
            </StatusBadge>
          </p>
          <p>{{ device.observedAddress }} · Última comprobación: {{ device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString('es-MX') : 'Todavía no se conectó' }}</p>
          <p class="device-identifier">
            {{ device.deviceId }}
          </p>
          <ActionButton
            :disabled="isBusy || device.isRevoked"
            @click="confirmation = { action: 'revoke', targetId: device.deviceId, name: device.alias }"
          >
            Revocar equipo
          </ActionButton>
          <ActionButton
            :disabled="isBusy || device.isRevoked || device.deviceId === localDeviceId"
            @click="confirmation = { action: device.isBlocked ? 'unblock' : 'block', targetId: device.deviceId, name: device.alias }"
          >
            {{ device.isBlocked ? 'Desbloquear equipo' : 'Bloquear equipo' }}
          </ActionButton>
          <ActionButton
            :disabled="isBusy || device.isRevoked"
            @click="confirmation = { action: 'closeSessions', targetId: device.deviceId, name: device.alias }"
          >
            Cerrar sesiones del equipo
          </ActionButton>
        </li>
      </ul>
    </template>
    <ConfirmDialog
      :is-open="!!confirmation"
      :title="confirmation ? actionLabels[confirmation.action] : 'Confirmar decisión'"
      :is-loading="isBusy"
      :hold-label="confirmation && ['revoke', 'block', 'deny'].includes(confirmation.action) ? 'Mantén para confirmar' : undefined"
      @close="confirmation = null"
      @confirm="confirmation && administer(confirmation.action, confirmation.targetId)"
    >
      <p>{{ confirmation?.name }} · {{ confirmation ? actionLabels[confirmation.action] : '' }}. Bloquear impide el acceso; desbloquear exige iniciar sesión nuevamente. Cerrar sesiones conserva la autorización del equipo. Sus notas, XML y archivos locales se conservarán. La contraseña administrativa del formulario confirma esta decisión.</p>
    </ConfirmDialog>
  </section>
</template>
<style scoped>
.device-approval { display: grid; gap: var(--spaceMedium); }
.device-administration { min-width: 0; }
.device-entries { padding-inline-start: 1.25rem; }
.device-entries li { margin-bottom: 1.25rem; }
.device-identifier { overflow-wrap: anywhere; }
</style>
