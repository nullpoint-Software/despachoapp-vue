<script setup lang="ts">
import type { Component } from 'vue'
import WarmTooltip from '../../../shared/vueBits/WarmTooltip.vue'

/**
 * Botón de la cinta del editor (pulido 2026-10-03), como en Microsoft Office:
 * - `small`: sólo ícono, con su nombre (y atajo) en un Warm Tooltip;
 * - `large`: ícono arriba y nombre abajo, para las acciones principales de un grupo.
 * `mousedown.prevent` conserva la selección del documento al pulsar.
 */
withDefaults(defineProps<{ label: string; icon: Component; shortcut?: string; isActive?: boolean; isDisabled?: boolean; size?: 'small' | 'large' }>(), { shortcut: '', isActive: undefined, isDisabled: false, size: 'small' })
const emit = defineEmits<{ press: [] }>()
</script>

<template>
  <WarmTooltip
    :content="shortcut ? label + ' (' + shortcut + ')' : label"
    side="bottom"
  >
    <template #default="{ describedby }">
      <button
        type="button"
        class="ribbon-button"
        :class="'ribbon-' + size"
        :aria-label="label"
        :aria-pressed="isActive"
        :aria-describedby="describedby"
        :disabled="isDisabled"
        @mousedown.prevent
        @click="emit('press')"
      >
        <component
          :is="icon"
          :size="size === 'large' ? 22 : 17"
          aria-hidden="true"
        />
        <span
          v-if="size === 'large'"
          class="ribbon-caption"
        >{{ label }}</span>
      </button>
    </template>
  </WarmTooltip>
</template>
