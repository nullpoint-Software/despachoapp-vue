<script setup lang="ts">
import { Info, CircleCheck, TriangleAlert, CircleAlert } from '@lucide/vue'
withDefaults(defineProps<{ title: string; tone?: 'info' | 'success' | 'warning' | 'error' }>(), { tone: 'info' })
const icons = { info: Info, success: CircleCheck, warning: TriangleAlert, error: CircleAlert }
</script>
<template>
  <section
    v-motion="'reveal'"
    class="inline-notice"
    :class="'tone-' + tone"
    :role="tone === 'error' ? 'alert' : 'status'"
  >
    <component
      :is="icons[tone]"
      :size="20"
      aria-hidden="true"
    /><div><strong>{{ title }}</strong><div><slot /></div></div>
  </section>
</template>
