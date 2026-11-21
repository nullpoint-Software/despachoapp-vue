<script setup lang="ts">
withDefaults(defineProps<{ tone?: 'neutral' | 'info' | 'success' | 'warning' | 'error' }>(), { tone: 'neutral' })
</script>
<template>
  <span
    class="status-label"
    :class="'tone-' + tone"
  ><slot /></span>
</template>
