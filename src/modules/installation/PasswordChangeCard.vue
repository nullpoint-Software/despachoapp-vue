<script setup lang="ts">
import { computed, ref } from 'vue'
import { Lock } from '@lucide/vue'
import { isValidNewPassword, maximumPasswordLength, minimumPasswordLength } from '../../../shared/contracts/passwordPolicy'
import ActionButton from '../../shared/components/ActionButton.vue'
import FormModal from '../../shared/components/FormModal.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import PasswordField from '../../shared/components/PasswordField.vue'
import PasswordSuggestion from '../../shared/components/PasswordSuggestion.vue'
import { readIpcErrorMessage } from '../../shared/ipcErrorMessage'
import { useNotifications } from '../../shared/notifications/notificationStore'
import SettingsCard from '../settings/SettingsCard.vue'

/**
 * Configuración → Mi sesión → «Cambiar contraseña» (2026-10-17, pedido del usuario). La tarjeta sólo tiene el botón;
 * el formulario va en un **modal** (segundo pedido: "cambiar contraseña será un modal") con la actual, la nueva y su
 * confirmación, cada una con «Mostrar / Ocultar» (`PasswordField`). `changeOwnPassword` las manda una vez a Main y el
 * Host verifica la actual (5 fallos en 15 min bloquean), guarda la nueva y cierra las demás sesiones de la persona
 * (ésta sigue abierta).
 * Las contraseñas no se guardan en la vista: al cerrar el modal o al cambiarla se vacían los tres campos; si el Host
 * rechaza, sólo se vacía la actual para volver a escribirla.
 */
const { notify } = useNotifications()
const isOpen = ref(false)
const currentPassword = ref(''), newPassword = ref(''), confirmation = ref('')
const hasTriedSubmit = ref(false), isSaving = ref(false), error = ref('')
const newPasswordError = computed(() => {
  if (!hasTriedSubmit.value) return ''
  if (!isValidNewPassword(newPassword.value)) return 'Escribe de ' + minimumPasswordLength + ' a ' + maximumPasswordLength + ' caracteres.'
  return newPassword.value === currentPassword.value ? 'Debe ser distinta de la actual.' : ''
})
const confirmationError = computed(() => hasTriedSubmit.value && confirmation.value !== newPassword.value ? 'No coincide con la nueva contraseña.' : '')
const currentError = computed(() => hasTriedSubmit.value && !currentPassword.value ? 'Escribe tu contraseña actual.' : '')

function clearForm(): void { currentPassword.value = ''; newPassword.value = ''; confirmation.value = ''; hasTriedSubmit.value = false; error.value = '' }
function open(): void { clearForm(); isOpen.value = true }
function close(): void { if (isSaving.value) return; isOpen.value = false; clearForm() }
function useSuggestion(password: string): void { newPassword.value = password; confirmation.value = password }

async function save(): Promise<void> {
  hasTriedSubmit.value = true; error.value = ''
  if (isSaving.value || currentError.value || newPasswordError.value || confirmationError.value) return
  isSaving.value = true
  try {
    await window.contapp.changeOwnPassword({ currentPassword: currentPassword.value, newPassword: newPassword.value })
    notify('Contraseña cambiada', 'Tus otras sesiones se cerraron; ésta sigue abierta.', 'success')
    isSaving.value = false
    close()
  } catch (failure) {
    error.value = readIpcErrorMessage(failure, 'No se pudo cambiar la contraseña.')
    currentPassword.value = ''; hasTriedSubmit.value = false
  } finally { isSaving.value = false }
}
</script>

<template>
  <SettingsCard
    title="Cambiar contraseña"
    :icon="Lock"
    description="Necesitas tu contraseña actual. Al cambiarla se cierran tus sesiones en los demás equipos."
  >
    <div class="actions">
      <ActionButton
        data-testid="password-change-open"
        @click="open"
      >
        <Lock
          :size="16"
          aria-hidden="true"
        /> Cambiar contraseña
      </ActionButton>
    </div>
  </SettingsCard>
  <FormModal
    :is-open="isOpen"
    title="Cambiar contraseña"
    description="Escribe tu contraseña actual y la nueva dos veces. Tus sesiones en otros equipos se cerrarán; ésta sigue abierta."
    :is-busy="isSaving"
    test-id="password-change-modal"
    @close="close"
  >
    <form
      class="password-change"
      data-testid="password-change"
      novalidate
      @submit.prevent="save"
    >
      <PasswordField
        id="password-change-current"
        v-model="currentPassword"
        label="Contraseña actual"
        autocomplete="current-password"
        :error="currentError"
        :disabled="isSaving"
      />
      <PasswordField
        id="password-change-new"
        v-model="newPassword"
        label="Nueva contraseña"
        :error="newPasswordError"
        :help="'De ' + minimumPasswordLength + ' a ' + maximumPasswordLength + ' caracteres, distinta de la actual.'"
        :disabled="isSaving"
      />
      <PasswordField
        id="password-change-confirmation"
        v-model="confirmation"
        label="Confirma la nueva"
        :error="confirmationError"
        :disabled="isSaving"
      />
      <PasswordSuggestion
        :disabled="isSaving"
        @use="useSuggestion"
      />
      <InlineNotice
        v-if="error"
        title="Contraseña"
        tone="error"
      >
        <p>{{ error }}</p>
      </InlineNotice>
      <div class="actions form-footer">
        <ActionButton
          type="submit"
          variant="primary"
          :is-loading="isSaving"
          :disabled="isSaving"
        >
          <Lock
            :size="16"
            aria-hidden="true"
          /> Cambiar contraseña
        </ActionButton>
        <ActionButton
          :disabled="isSaving"
          @click="close"
        >
          Cancelar
        </ActionButton>
      </div>
    </form>
  </FormModal>
</template>

<style scoped>
.password-change { display: grid; gap: var(--spaceMedium); min-width: 0; }
</style>
