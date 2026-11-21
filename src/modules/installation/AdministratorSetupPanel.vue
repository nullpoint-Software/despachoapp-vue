<script setup lang="ts">
import { ref } from 'vue'
import PasswordSuggestion from '../../shared/components/PasswordSuggestion.vue'
import { isValidNewPassword } from '../../../shared/contracts/passwordPolicy'
import ActionButton from '../../shared/components/ActionButton.vue'
import TextField from '../../shared/components/TextField.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import type { HostState } from '../../../shared/contracts/host'
const emit = defineEmits<{ completed: [state: HostState] }>()
const displayName = ref('')
const username = ref('')
const password = ref('')
const confirmation = ref('')
const error = ref('')
const isBusy = ref(false)
/** Contraseñas efímeras: se limpian tanto al fallar como al confirmar, sin almacenamiento de UI. */
async function submit(): Promise<void> {
  if (isBusy.value) return
  error.value = ''
  if (!isValidNewPassword(password.value)) { error.value = 'Usa entre 8 y 128 caracteres.'; return }
  if (password.value !== confirmation.value) { error.value = 'Las contraseñas no coinciden.'; return }
  isBusy.value = true
  try {
    const result = await window.contapp.createAdministrator({ displayName: displayName.value, username: username.value, password: password.value })
    // El alta prepara también TLS; un fallo conserva el administrador y ofrece reintento en HostTrustPanel.
    try { await window.contapp.manageHostTrust('prepare'); emit('completed', (await window.contapp.getHostStatus()).state) }
    catch { emit('completed', result.state) }
  } catch { error.value = 'No se pudo crear el administrador. Revisa los datos o actualiza el estado antes de reintentar.' }
  finally { password.value = ''; confirmation.value = ''; isBusy.value = false }
}
</script>
<template>
  <form
    class="configuration-form"
    aria-labelledby="administrator-setup-title"
    @submit.prevent="submit"
  >
    <h3 id="administrator-setup-title">
      Primer administrador
    </h3>
    <p>Esta cuenta administrará el despacho. El alta inicial sólo puede realizarse una vez desde este Host.</p>
    <InlineNotice
      v-if="error"
      title="No se pudo completar"
      tone="error"
    >
      {{ error }}
    </InlineNotice>
    <TextField
      id="administrator-name"
      v-model="displayName"
      label="Nombre del administrador"
      :disabled="isBusy"
    />
    <TextField
      id="administrator-username"
      v-model="username"
      label="Usuario del administrador"
      help="De 3 a 64 letras, números, puntos o guiones; sin espacios."
      :disabled="isBusy"
    />
    <TextField
      id="administrator-password"
      v-model="password"
      label="Contraseña del administrador"
      type="password"
      help="Entre 8 y 128 caracteres. Evita claves comunes o que ya uses en otro servicio."
      :disabled="isBusy"
    />
    <TextField
      id="administrator-confirmation"
      v-model="confirmation"
      label="Confirmar contraseña"
      type="password"
      :disabled="isBusy"
    />
    <PasswordSuggestion
      :disabled="isBusy"
      @use="value => { password = value; confirmation = value }"
    />
    <ActionButton
      type="submit"
      variant="primary"
      :is-loading="isBusy"
    >
      Crear primer administrador
    </ActionButton>
    <p class="field-help">
      La conexión de Clientes se habilitará después de configurar la conexión segura y el emparejamiento.
    </p>
  </form>
</template>
