<script setup lang="ts">
import { ref } from 'vue'
import { Eye, EyeOff } from '@lucide/vue'

/**
 * Campo de contraseña con «Mostrar / Ocultar» (2026-10-17, pedido del usuario: "falta para poder verla"). Mismo patrón
 * que el inicio de sesión (`LoginPage`): el botón de ojo cambia el tipo del campo entre `password` y `text` y anuncia su
 * estado con `aria-pressed`. Cada campo recuerda su propio estado; al desmontarse vuelve a ocultarse.
 */
defineProps<{ id: string; label: string; error?: string; help?: string; disabled?: boolean; autocomplete?: 'current-password' | 'new-password' }>()
const value = defineModel<string>({ default: '' })
const isVisible = ref(false)
</script>

<template>
  <div class="field">
    <label :for="id">{{ label }}</label>
    <div class="password-field-row">
      <input
        :id="id"
        v-model="value"
        :type="isVisible ? 'text' : 'password'"
        :autocomplete="autocomplete ?? 'new-password'"
        :disabled="disabled"
        spellcheck="false"
        :aria-invalid="Boolean(error)"
        :aria-describedby="error || help ? id + '-help' : undefined"
      >
      <button
        type="button"
        class="icon-button password-field-toggle"
        :aria-label="(isVisible ? 'Ocultar ' : 'Mostrar ') + label.toLocaleLowerCase('es-MX')"
        :aria-pressed="isVisible"
        :disabled="disabled"
        @click="isVisible = !isVisible"
      >
        <EyeOff
          v-if="isVisible"
          :size="18"
          aria-hidden="true"
        /><Eye
          v-else
          :size="18"
          aria-hidden="true"
        />
      </button>
    </div>
    <p
      v-if="error || help"
      :id="id + '-help'"
      class="field-help"
    >
      {{ error || help }}
    </p>
  </div>
</template>

<style scoped>
.password-field-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; }
.password-field-toggle { height: var(--controlHeight); width: var(--controlHeight); border: 2px solid var(--borderColor); border-radius: var(--radiusControl); }
</style>
