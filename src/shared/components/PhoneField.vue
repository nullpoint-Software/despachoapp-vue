<script setup lang="ts">
import { formatPhoneInput } from '../formatting/inputFormats'

/**
 * Campo de teléfono (2026-10-04): agrupa los 10 dígitos como "55 1234 5678" al escribir, quita la lada +52 y usa el
 * teclado numérico y el autocompletado de teléfono del sistema. El valor se guarda sólo con dígitos
 * (`normalizePhoneNumber` del contrato), así que el agrupado es sólo presentación.
 */
defineProps<{ id: string; label: string; help?: string; error?: string; disabled?: boolean }>()
const value = defineModel<string>({ default: '' })
function update(event: Event): void {
  const input = event.target as HTMLInputElement
  const formatted = formatPhoneInput(input.value)
  input.value = formatted
  value.value = formatted
}
</script>
<template>
  <div class="field">
    <label :for="id">{{ label }}</label>
    <input
      :id="id"
      class="formatted-mono"
      :value="value"
      type="tel"
      inputmode="tel"
      autocomplete="tel-national"
      placeholder="55 1234 5678"
      maxlength="12"
      :disabled="disabled"
      :aria-invalid="Boolean(error)"
      :aria-describedby="id + '-help'"
      @input="update"
    >
    <p
      :id="id + '-help'"
      class="field-help"
      :class="{ 'tone-error': error }"
    >
      {{ error || help || '10 dígitos, sin lada de país.' }}
    </p>
  </div>
</template>
