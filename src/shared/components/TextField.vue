<script setup lang="ts">
defineProps<{ id: string; label: string; error?: string; help?: string; disabled?: boolean; type?: 'text' | 'password'; autocomplete?: 'current-password' | 'new-password' | 'off' }>()
const value = defineModel<string>({ default: '' })
</script>
<template>
  <div class="field">
    <label :for="id">{{ label }}</label>
    <input
      :id="id"
      v-model="value"
      :type="type ?? 'text'"
      :autocomplete="autocomplete ?? (type === 'password' ? 'new-password' : undefined)"
      :disabled="disabled"
      :aria-invalid="Boolean(error)"
      :aria-describedby="error || help ? id + '-help' : undefined"
    >
    <p
      v-if="error || help"
      :id="id + '-help'"
      class="field-help"
    >
      {{ error || help }}
    </p>
  </div>
</template>

