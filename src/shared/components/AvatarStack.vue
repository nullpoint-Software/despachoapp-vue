<script setup lang="ts">
import { computed } from 'vue'
import UserAvatar from './UserAvatar.vue'

/**
 * Fotos de varios trabajadores (2026-10-04), por ejemplo los responsables de una tarea: hasta `maximumVisible`
 * encimadas y "+N" con el resto. El texto accesible nombra a todos.
 */
const props = withDefaults(defineProps<{ users: Array<{ userId: string; displayName: string }>; maximumVisible?: number; size?: 'small' | 'medium' }>(), { maximumVisible: 3, size: 'small' })
const visible = computed(() => props.users.slice(0, props.maximumVisible))
const hiddenCount = computed(() => Math.max(0, props.users.length - props.maximumVisible))
const description = computed(() => props.users.map(user => user.displayName).join(', '))
</script>
<template>
  <span
    v-if="users.length"
    class="avatar-stack"
    role="img"
    :aria-label="'Fotos de ' + description"
  >
    <UserAvatar
      v-for="user in visible"
      :key="user.userId"
      :user-id="user.userId"
      :display-name="user.displayName"
      :size="size"
      is-decorative
    />
    <span
      v-if="hiddenCount"
      class="avatar-more"
      :class="'avatar-' + size"
      aria-hidden="true"
    >+{{ hiddenCount }}</span>
  </span>
</template>
<style scoped>
.avatar-stack { display: inline-flex; align-items: center; }
.avatar-stack > * + * { margin-left: -6px; }
.avatar-more { display: inline-grid; place-items: center; border: 2px solid var(--borderColor); background: var(--textColor); color: var(--surfaceColor); font-family: var(--monoFontFamily); font-size: 10px; font-weight: 800; }
.avatar-more.avatar-small { width: 24px; height: 24px; }
.avatar-more.avatar-medium { width: 32px; height: 32px; }
</style>
