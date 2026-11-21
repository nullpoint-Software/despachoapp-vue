<script setup lang="ts">
import { ref, watch } from 'vue'
import ConfirmDialog from './ConfirmDialog.vue'
import TextField from './TextField.vue'
import { passwordPrompt } from '../security/confirmSensitive'

/**
 * Diálogo único "Confirma tu contraseña" (ADR-038), montado una vez en App.vue. Lo abre `withSensitiveConfirmation`.
 * El campo se vacía al enviar, al cancelar y con cada error del Host; la contraseña no se guarda en ningún estado.
 */
const password = ref('')
watch(() => passwordPrompt.value, () => { password.value = '' })
function submit(): void {
  const prompt = passwordPrompt.value
  if (!prompt || !password.value || prompt.isBusy) return
  const value = password.value
  password.value = ''
  prompt.submit(value)
}
</script>
<template>
  <ConfirmDialog
    :is-open="Boolean(passwordPrompt)"
    :title="passwordPrompt?.title ?? 'Confirma tu contraseña'"
    :is-loading="passwordPrompt?.isBusy"
    :is-confirm-disabled="!password"
    @close="passwordPrompt?.cancel()"
    @confirm="submit"
  >
    <p v-if="passwordPrompt?.description">
      {{ passwordPrompt.description }}
    </p>
    <form @submit.prevent="submit">
      <TextField
        v-if="passwordPrompt"
        id="sensitive-operation-password"
        v-model="password"
        type="password"
        autocomplete="current-password"
        label="Tu contraseña para confirmar"
        :disabled="passwordPrompt.isBusy"
        :error="passwordPrompt.error"
        help="Se verifica en el Host. Después, durante 10 minutos no se vuelve a pedir en esta sesión, salvo en operaciones críticas."
      />
    </form>
  </ConfirmDialog>
</template>
