<script setup lang="ts">
import { computed, useId } from 'vue'
import { describeRfcInput, formatRfcInput } from '../formatting/inputFormats'

/**
 * Campo de RFC (2026-10-04): mayúsculas y sin espacios al escribir, tope de 13 caracteres, Geist Mono, y una ayuda que
 * dice el tipo de persona. `suggestions` ofrece RFC conocidos (por ejemplo de los clientes) en la lista del navegador.
 * No consulta al SAT: la estructura la valida el contrato compartido y el Host.
 */
const props = defineProps<{ id: string; label: string; help?: string; error?: string; disabled?: boolean; suggestions?: string[] }>()
const value = defineModel<string>({ default: '' })
const listId = useId()
const status = computed(() => {
  if (!value.value) return props.help ?? '12 caracteres para persona moral, 13 para persona física.'
  const { personType, isComplete } = describeRfcInput(value.value)
  if (isComplete && personType) return 'Persona ' + personType + '.'
  return value.value.length + ' de 12 o 13 caracteres.'
})
function update(event: Event): void {
  const input = event.target as HTMLInputElement
  const formatted = formatRfcInput(input.value)
  input.value = formatted
  value.value = formatted
}
</script>
<template>
  <div class="field">
    <label :for="id">{{ label }}</label>
    <input
      :id="id"
      class="formatted-mono"
      :value="value"
      type="text"
      inputmode="text"
      autocomplete="off"
      autocapitalize="characters"
      spellcheck="false"
      maxlength="13"
      :list="suggestions?.length ? listId : undefined"
      :disabled="disabled"
      :aria-invalid="Boolean(error)"
      :aria-describedby="id + '-help'"
      @input="update"
    >
    <datalist
      v-if="suggestions?.length"
      :id="listId"
    >
      <option
        v-for="suggestion in suggestions"
        :key="suggestion"
        :value="suggestion"
      />
    </datalist>
    <p
      :id="id + '-help'"
      class="field-help"
      :class="{ 'tone-error': error }"
    >
      {{ error || status }}
    </p>
  </div>
</template>
