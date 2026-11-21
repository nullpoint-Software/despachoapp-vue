<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { X } from '@lucide/vue'
import { parseEmailAddress } from '../../../shared/contracts/mail'
import { moveWithTab, usePopoverMenu } from '../../shared/components/popoverMenu'

/**
 * Correos como chips (2026-10-18, pedido del usuario: "si ya se escribió uno, se pone en un chip y puedes poner el
 * siguiente"). Al escribir coma, punto y coma, espacio o Intro, o al salir del campo, cada correo válido pasa a chip; uno
 * inválido se queda escrito con un aviso. Retroceso con el campo vacío quita el último chip; cada chip tiene su ×.
 * Pegar varios correos a la vez también los separa.
 * `suggestions` (2026-10-20, correos ya usados): al escribir se abre la lista de la casa en la capa superior
 * (`usePopoverMenu`; el `datalist` del navegador no se mostraba en Electron). ↑ ↓ o Tab recorren, Enter o clic eligen.
 * `v-model` es la lista de correos ya validados (minúsculas, sin repetir), hasta `maximum`.
 */
const props = withDefaults(defineProps<{ id: string; label: string; help?: string; suggestions?: string[]; maximum?: number; disabled?: boolean }>(), { help: '', suggestions: () => [], maximum: 10, disabled: false })
const addresses = defineModel<string[]>({ required: true })
const draft = ref(''), error = ref('')
const availableSuggestions = computed(() => props.suggestions.filter(address => !addresses.value.includes(address)))
const isOpen = ref(false), activeIndex = ref(-1), isNavigating = ref(false)
const control = ref<HTMLElement | null>(null), menu = ref<HTMLElement | null>(null), list = ref<HTMLElement | null>(null)
const matches = computed(() => { const term = draft.value.trim().toLowerCase(); return availableSuggestions.value.filter(address => address.includes(term)).slice(0, 8) })
const isMenuVisible = computed(() => isOpen.value && !props.disabled && matches.value.length > 0)
const { menuStyle } = usePopoverMenu(control, menu, isMenuVisible)

/** Pasa a chips lo escrito; devuelve `false` si algo no era un correo válido (se queda en el campo). */
function commit(): boolean {
  const pending = draft.value.split(/[,;\s]+/).map(item => item.trim()).filter(Boolean)
  const invalid: string[] = []
  const next = [...addresses.value]
  for (const item of pending) {
    try {
      const address = parseEmailAddress(item)
      if (!next.includes(address)) next.push(address)
    } catch { invalid.push(item) }
  }
  if (next.length > props.maximum) { error.value = 'Puedes enviar a ' + props.maximum + ' correos como máximo.'; return false }
  addresses.value = next
  draft.value = invalid.join(' ')
  error.value = invalid.length ? 'Revisa: ' + invalid.join(', ') + ' no es un correo válido.' : ''
  return !invalid.length
}
defineExpose({ commit })
function closeMenu(): void { isOpen.value = false; activeIndex.value = -1; isNavigating.value = false }
function choose(address: string): void { draft.value = address; commit(); closeMenu() }
async function revealActive(): Promise<void> { await nextTick(); list.value?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }) }
async function handleKeydown(event: KeyboardEvent): Promise<void> {
  if (event.isComposing) return
  const activeAddress = isMenuVisible.value ? matches.value[activeIndex.value] : undefined
  if (event.key === 'Enter' && activeAddress) { event.preventDefault(); choose(activeAddress); return }
  // Escape cierra sólo la lista; no debe cerrar el modal del redactor.
  if (event.key === 'Escape' && isMenuVisible.value) { event.preventDefault(); event.stopPropagation(); closeMenu(); return }
  if (event.key === 'Tab') {
    const nextIndex = isMenuVisible.value ? moveWithTab(event, activeIndex.value, matches.value.length, isNavigating.value) : null
    if (nextIndex === null) closeMenu()
    else { activeIndex.value = nextIndex; await revealActive() }
    return
  }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault(); isOpen.value = true; isNavigating.value = true
    const count = matches.value.length
    activeIndex.value = count ? (activeIndex.value + (event.key === 'ArrowDown' ? 1 : -1) + count) % count : -1
    await revealActive()
    return
  }
  if ([',', ';', ' ', 'Enter'].includes(event.key) && draft.value.trim()) { event.preventDefault(); commit() }
  else if (event.key === 'Backspace' && !draft.value && addresses.value.length) addresses.value = addresses.value.slice(0, -1)
}
function handleInput(): void {
  isOpen.value = Boolean(draft.value.trim()); isNavigating.value = true; activeIndex.value = -1
  if (/[,;\s]/.test(draft.value.trim())) commit()
}
function handleBlur(): void { closeMenu(); commit() }
function remove(address: string): void { addresses.value = addresses.value.filter(item => item !== address) }
</script>

<template>
  <!-- Sin la clase .field: su input interno no debe recibir el anillo de foco propio de los campos (lo lleva el recuadro). -->
  <div class="recipient-chips-field">
    <label :for="id">{{ label }}</label>
    <div
      ref="control"
      class="recipient-chips"
      :class="{ 'is-disabled': disabled }"
    >
      <span
        v-for="address in addresses"
        :key="address"
        class="recipient-chip"
      >
        {{ address }}
        <button
          type="button"
          class="recipient-chip-remove"
          :aria-label="'Quitar ' + address"
          :disabled="disabled"
          @click="remove(address)"
        >
          <X
            :size="14"
            aria-hidden="true"
          />
        </button>
      </span>
      <input
        :id="id"
        v-model="draft"
        type="text"
        inputmode="email"
        autocomplete="off"
        spellcheck="false"
        role="combobox"
        aria-autocomplete="list"
        :aria-expanded="isMenuVisible"
        :aria-controls="id + '-options'"
        :aria-activedescendant="isMenuVisible && activeIndex >= 0 ? id + '-option-' + activeIndex : undefined"
        :placeholder="addresses.length ? '' : 'nombre@dominio.com'"
        :disabled="disabled || addresses.length >= maximum"
        :aria-invalid="Boolean(error)"
        :aria-describedby="id + '-help'"
        @keydown="handleKeydown"
        @input="handleInput"
        @blur="handleBlur"
      >
      <div
        v-if="isMenuVisible"
        ref="menu"
        popover="manual"
        class="autocomplete-menu"
        :style="menuStyle"
      >
        <ul
          :id="id + '-options'"
          ref="list"
          role="listbox"
          aria-label="Correos usados antes"
        >
          <li
            v-for="(address, index) in matches"
            :id="id + '-option-' + index"
            :key="address"
            role="option"
            :aria-selected="index === activeIndex"
            @pointerdown.prevent
            @click="choose(address)"
          >
            {{ address }}
          </li>
        </ul>
        <p class="autocomplete-hint">
          ↑ ↓ o Tab para recorrer · Enter para elegir
        </p>
      </div>
    </div>
    <p
      :id="id + '-help'"
      class="field-help"
      :class="{ 'tone-error': error }"
    >
      {{ error || help || 'Escribe un correo y presiona Intro o coma para agregar otro.' }}
    </p>
  </div>
</template>

<style scoped>
.recipient-chips-field { display: grid; gap: 6px; min-width: 0; }
.recipient-chips-field > label { font-weight: 500; font-size: 14px; }
.recipient-chips { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; min-height: var(--controlHeight); padding: 4px 6px; border: 2px solid var(--borderColor); background: var(--inputColor); }
.recipient-chips:focus-within { outline: 3px solid var(--focusColor); outline-offset: 2px; }
.recipient-chips.is-disabled { opacity: .6; }
.recipient-chips input { flex: 1 1 180px; min-width: 120px; height: 28px; padding: 0 4px; border: 0; background: transparent; color: var(--textColor); font: inherit; outline: none; box-shadow: none; }
.recipient-chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 4px 2px 8px; border: 2px solid var(--borderColor); background: var(--surfaceColor); font-family: var(--monoFontFamily); font-size: 12px; }
.recipient-chip-remove { display: inline-grid; place-items: center; width: 20px; height: 20px; padding: 0; border: 0; background: transparent; color: var(--mutedTextColor); cursor: pointer; }
.recipient-chip-remove:hover:not(:disabled) { color: var(--textColor); background: var(--hoverColor); }
.recipient-chip-remove:focus-visible { outline: 2px solid var(--focusColor); outline-offset: 1px; }
</style>
