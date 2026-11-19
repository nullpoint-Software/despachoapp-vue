<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue'
import ActionButton from './ActionButton.vue'
import { generatePassword } from '../security/generatePassword'
defineProps<{ disabled?: boolean }>()
const emit = defineEmits<{ use: [password: string] }>()
const suggestion = ref('')
/** Sólo vive en memoria y se aplica por decisión del usuario; no usa clipboard ni logs. */
function suggest(): void { suggestion.value = generatePassword() }
function apply(): void { emit('use', suggestion.value); suggestion.value = '' }
onBeforeUnmount(() => { suggestion.value = '' })
</script>
<template>
  <div class="password-suggestion">
    <ActionButton
      :disabled="disabled"
      @click="suggest"
    >
      Sugerir contraseña segura
    </ActionButton>
    <div
      v-if="suggestion"
      role="status"
    >
      <p>Guárdala en tu gestor de contraseñas antes de continuar.</p>
      <code>{{ suggestion }}</code>
      <ActionButton
        :disabled="disabled"
        @click="apply"
      >
        Usar contraseña sugerida
      </ActionButton>
    </div>
  </div>
</template>
<style scoped>
.password-suggestion { display: grid; gap: 12px; }
code { display: block; overflow-wrap: anywhere; margin-block: 12px; }
</style>
