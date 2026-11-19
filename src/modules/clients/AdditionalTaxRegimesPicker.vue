<script setup lang="ts">
import { computed } from 'vue'
import { taxRegimeOptions } from './clientPresentation'

/**
 * Regímenes adicionales del cliente (2026-10-18, pedido del usuario: un contribuyente puede tener más de un régimen).
 * Casillas con los regímenes del catálogo que aplican al tipo de persona del RFC, sin el principal. Sólo se muestra
 * con un régimen principal elegido; el Host vuelve a validar con `validateClientProfileForSave`.
 * Un adicional que ya no aplica (cambió el RFC o el principal) sigue visible para poder quitarlo.
 */
const props = defineProps<{ rfc: string; mainRegime: string; error?: string; disabled?: boolean }>()
const selected = defineModel<string[]>({ default: () => [] })
const personType = computed(() => props.rfc.length === 12 ? 'moral' : props.rfc.length === 13 ? 'física' : null)
const options = computed(() => {
  const applicable = taxRegimeOptions({ personType: personType.value }).filter(option => option.value !== props.mainRegime)
  const stale = selected.value.filter(code => !applicable.some(option => option.value === code)).map(code => ({ value: code, label: code + ' · no aplica a este RFC o es el principal' }))
  return [...stale, ...applicable]
})
function toggle(code: string, isChecked: boolean): void {
  selected.value = isChecked ? [...selected.value, code] : selected.value.filter(item => item !== code)
}
</script>
<template>
  <fieldset
    class="additional-regimes"
    data-testid="client-additional-regimes"
    :disabled="disabled"
  >
    <legend>Regímenes adicionales <small>(opcional)</small></legend>
    <p class="field-help">
      Si la constancia trae más de un régimen, marca aquí los demás. Las obligaciones fiscales se sugieren con todos.
    </p>
    <div class="additional-regimes-list">
      <label
        v-for="option in options"
        :key="option.value"
        class="check-field"
      ><input
        type="checkbox"
        :checked="selected.includes(option.value)"
        @change="toggle(option.value, ($event.target as HTMLInputElement).checked)"
      > {{ option.label }}</label>
    </div>
    <p
      v-if="error"
      class="field-error"
      role="alert"
    >
      {{ error }}
    </p>
  </fieldset>
</template>
<style scoped>
.additional-regimes { display: grid; gap: 8px; min-width: 0; margin: 0; padding: 0; border: 0; }
.additional-regimes legend { padding: 0; font-weight: 700; }
.additional-regimes legend small { font-weight: 400; color: var(--mutedTextColor); }
.additional-regimes .field-help { margin: 0; }
.additional-regimes-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: 2px 16px; max-height: 220px; overflow-y: auto; padding: 4px 8px; border: 2px solid var(--borderColor); }
.additional-regimes .check-field { font-size: 13px; }
.field-error { margin: 0; color: var(--errorText); font-size: 13px; }
</style>
