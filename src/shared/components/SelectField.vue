<script setup lang="ts">
defineProps<{ id: string; label: string; options: { value: string; label: string }[]; disabled?: boolean }>()
const value = defineModel<string>({ default: '' })
</script>
<template>
  <div class="field">
    <label :for="id">{{ label }}</label>
    <select
      :id="id"
      v-model="value"
      :disabled="disabled"
    >
      <!-- Select personalizable de Chromium: el texto elegido va en <selectedcontent> para recortarse con "…" sin tapar la flecha. -->
      <button type="button">
        <selectedcontent />
      </button>
      <option
        v-for="option in options"
        :key="option.value"
        :value="option.value"
      >
        {{ option.label }}
      </option>
    </select>
  </div>
</template>
