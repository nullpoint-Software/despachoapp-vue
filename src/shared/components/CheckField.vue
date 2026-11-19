<script setup lang="ts">
defineProps<{ id: string; label: string; disabled?: boolean }>()
const value = defineModel<boolean>({ default: false })
</script>
<template>
  <label
    class="check-field"
    :for="id"
  ><input
    :id="id"
    v-model="value"
    type="checkbox"
    :disabled="disabled"
  >{{ label }}</label>
</template>
