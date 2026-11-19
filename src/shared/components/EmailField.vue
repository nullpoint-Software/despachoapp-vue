<script setup lang="ts">
import { computed, useId } from 'vue'
import { formatEmailInput, suggestEmailAddresses } from '../formatting/inputFormats'

/**
 * Campo de correo (2026-10-04): sin espacios y en minúsculas, con el autocompletado de correo del sistema y, al escribir
 * "@", sugerencias de los dominios más usados (gmail.com, hotmail.com, outlook.com…) en la lista del navegador.
 */
defineProps<{ id: string; label: string; help?: string; error?: string; disabled?: boolean }>()
const value = defineModel<string>({ default: '' })
const listId = useId()
const suggestions = computed(() => suggestEmailAddresses(value.value))
function update(event: Event): void {
  const input = event.target as HTMLInputElement
  const formatted = formatEmailInput(input.value)
  if (formatted !== input.value) input.value = formatted
  value.value = formatted
}
</script>
<template>
  <div class="field">
    <label :for="id">{{ label }}</label>
    <input
      :id="id"
      :value="value"
      type="email"
      inputmode="email"
      autocomplete="email"
      spellcheck="false"
      placeholder="nombre@dominio.com"
      :list="listId"
      :disabled="disabled"
      :aria-invalid="Boolean(error)"
      :aria-describedby="error || help ? id + '-help' : undefined"
      @input="update"
    >
    <datalist :id="listId">
      <option
        v-for="suggestion in suggestions"
        :key="suggestion"
        :value="suggestion"
      />
    </datalist>
    <p
      v-if="error || help"
      :id="id + '-help'"
      class="field-help"
      :class="{ 'tone-error': error }"
    >
      {{ error || help }}
    </p>
  </div>
</template>
