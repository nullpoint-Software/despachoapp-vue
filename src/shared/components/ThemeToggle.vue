<script setup lang="ts">
import { computed } from 'vue'
import { Sun, Moon } from '@lucide/vue'
import ActionButton from './ActionButton.vue'
import WarmTooltip from '../vueBits/WarmTooltip.vue'
import { effectiveTheme, updatePreferences } from '../../modules/settings/localPreferencesState'
/** Fija un tema explícito, opuesto al efectivo; "Seguir al sistema" se elige en Configuración. */
const isDarkTheme = computed(() => effectiveTheme.value === 'dark')
function toggleTheme(): void { void updatePreferences({ theme: isDarkTheme.value ? 'light' : 'dark' }) }
</script>
<template>
  <WarmTooltip
    :content="isDarkTheme ? 'Usar tema claro' : 'Usar tema oscuro'"
    side="bottom"
  >
    <ActionButton
      class="theme-button"
      :aria-label="isDarkTheme ? 'Usar tema claro' : 'Usar tema oscuro'"
      :aria-pressed="isDarkTheme"
      @click="toggleTheme"
    >
      <Sun
        v-if="isDarkTheme"
        :size="18"
        aria-hidden="true"
      /><Moon
        v-else
        :size="18"
        aria-hidden="true"
      />
    </ActionButton>
  </WarmTooltip>
</template>
