<script setup lang="ts">
import { LoaderCircle } from '@lucide/vue'
withDefaults(defineProps<{ variant?: 'primary' | 'secondary' | 'danger'; isLoading?: boolean; type?: 'button' | 'submit' }>(), { variant: 'secondary', isLoading: false, type: 'button' })
</script>
<template>
  <button
    v-motion="'interactive'"
    :type="type"
    class="action-button"
    :class="'button-' + variant"
    :disabled="isLoading || undefined"
    :aria-busy="isLoading"
  >
    <span
      v-if="isLoading"
      v-motion="'spin'"
      class="button-spinner"
    ><LoaderCircle
      :size="18"
      aria-hidden="true"
    /></span>
    <span :class="{ 'button-label-loading': isLoading }"><slot /></span>
    <span
      v-if="isLoading"
      class="sr-only"
    >Procesando</span>
  </button>
</template>
