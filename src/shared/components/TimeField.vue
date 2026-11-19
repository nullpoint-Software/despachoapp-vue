<script setup lang="ts">
/**
 * Hora (HH:MM, 24 h) con el formato de los campos de la app (2026-10-05): input nativo `time` (teclado y lector de
 * pantalla) con el marco de 2 px y Geist Mono. Se usa junto a DateField, por ejemplo en el corte de caja.
 */
defineProps<{ id: string; label: string; help?: string; error?: string; disabled?: boolean }>()
const value = defineModel<string>({ default: '' })
</script>
<template>
  <div class="field">
    <label :for="id">{{ label }}</label>
    <input
      :id="id"
      v-model="value"
      class="formatted-mono"
      type="time"
      step="60"
      :disabled="disabled"
      :aria-invalid="Boolean(error)"
      :aria-describedby="error || help ? id + '-help' : undefined"
    >
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
