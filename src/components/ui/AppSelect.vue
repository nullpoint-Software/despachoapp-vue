<template>
  <select :value="modelValue ?? ''" @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)">
    <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
    <option v-for="(option, index) in options" :key="optionValue ? String(option?.[optionValue]) : index" :value="optionValue ? option?.[optionValue] : option">
      {{ optionLabel ? option?.[optionLabel] : option }}
    </option>
  </select>
</template>
<script setup lang="ts">
defineProps<{ modelValue?: unknown; options?: any[]; optionLabel?: string; optionValue?: string; placeholder?: string }>();
const emit = defineEmits<{ (event: "update:modelValue", value: unknown): void }>();
</script>
<style scoped>
select{min-height:3rem;width:100%;border:1px solid var(--br-line-strong);border-radius:0;background:var(--br-control);color:var(--br-control-text,#141413);padding:.7rem 2.3rem .7rem .8rem;font:700 .9rem/1.2 "Courier New",monospace}select:focus{outline:2px solid var(--br-accent);outline-offset:2px}
</style>
