<script setup lang="ts">
import { ref } from 'vue'
import { formatMoneyDisplay, sanitizeMoneyInput } from '../formatting/inputFormats'

/**
 * Campo de dinero (2026-10-04): mientras se escribe sólo acepta dígitos y un punto con hasta dos decimales (las comas
 * se ignoran). Mientras no se edita muestra "$1,250.50"; desde la primera tecla muestra el decimal limpio y al salir del
 * campo vuelve el formato. El valor del modelo es el decimal sin formato ("1250.50"), que es lo que validan los
 * contratos. Teclado decimal y sin autocompletado del navegador.
 *
 * El texto no se cambia al enfocar: Chromium aplica la selección de `select()` después del foco, así que reemplazar el
 * texto en el foco dejaba el cursor al final y lo escrito se pegaba al importe anterior. Como el saneado ignora "$" y
 * ",", seleccionar todo y escribir, borrar o agregar cifras sobre el texto con formato da el mismo resultado.
 */
defineProps<{ id: string; label: string; help?: string; error?: string; disabled?: boolean }>()
const value = defineModel<string>({ default: '' })
const isEditing = ref(false)
function update(event: Event): void {
  const input = event.target as HTMLInputElement
  isEditing.value = true
  const sanitized = sanitizeMoneyInput(input.value)
  input.value = sanitized
  value.value = sanitized
}
</script>
<template>
  <div class="field">
    <label :for="id">{{ label }}</label>
    <div class="money-input">
      <input
        :id="id"
        class="formatted-mono"
        :value="isEditing ? value : formatMoneyDisplay(value) || value"
        type="text"
        inputmode="decimal"
        autocomplete="off"
        placeholder="$0.00"
        :disabled="disabled"
        :aria-invalid="Boolean(error)"
        :aria-describedby="id + '-help'"
        @blur="isEditing = false"
        @input="update"
      >
      <span
        class="money-currency"
        aria-hidden="true"
      >MXN</span>
    </div>
    <p
      :id="id + '-help'"
      class="field-help"
      :class="{ 'tone-error': error }"
    >
      {{ error || help || 'Pesos con hasta dos decimales.' }}
    </p>
  </div>
</template>
<style scoped>
.money-input { position: relative; }
.money-input input { padding-right: 56px; text-align: right; }
.money-currency { position: absolute; top: 50%; right: 14px; transform: translateY(-50%); font-family: var(--monoFontFamily); font-size: 11px; font-weight: 700; letter-spacing: .06em; color: var(--mutedTextColor); pointer-events: none; }
</style>
