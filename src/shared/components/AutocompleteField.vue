<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { Search, Check } from '@lucide/vue'
import { moveWithTab, usePopoverMenu } from './popoverMenu'
const props = defineProps<{ id: string; label: string; options: string[]; disabled?: boolean; help?: string; error?: string }>()
const value = defineModel<string>({ default: '' })
const emit = defineEmits<{ select: [value: string] }>()
const isOpen = ref(false)
const activeIndex = ref(-1)
const list = ref<HTMLElement | null>(null), control = ref<HTMLElement | null>(null), menu = ref<HTMLElement | null>(null)
// Lista en la capa superior (encima de un modal, sin barra de desplazamiento extra en él).
const { menuStyle } = usePopoverMenu(control, menu, isOpen)
/** `true` tras escribir o recorrer con flechas: sólo entonces Tab recorre las sugerencias (`moveWithTab`). */
const isNavigating = ref(false)
function openMenu(isTyping: boolean): void { isOpen.value = true; isNavigating.value = isTyping }
function closeMenu(): void { isOpen.value = false; activeIndex.value = -1; isNavigating.value = false }
async function revealActive(): Promise<void> { await nextTick(); list.value?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }) }
// La búsqueda tolera acentos y mayúsculas; nunca consulta servicios ni inventa registros.
const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-MX').trim()
const options = computed(() => [...new Set(props.options)].filter(option => normalize(option).includes(normalize(value.value))).slice(0, 10))
watch(options, () => { activeIndex.value = -1 })
watch(() => props.disabled, () => { isOpen.value = false })
function selectOption(option: string): void { value.value = option; closeMenu(); emit('select', option) }
/** Foco en el input y aria-activedescendant; Escape cierra, Enter sólo confirma una opción activa; Tab recorre tras escribir. */
async function handleKey(event: KeyboardEvent): Promise<void> {
  if (event.isComposing) return
  if (event.key === 'Tab') {
    const nextIndex = isOpen.value ? moveWithTab(event, activeIndex.value, options.value.length, isNavigating.value) : null
    if (nextIndex === null) { closeMenu(); return }
    activeIndex.value = nextIndex
    await revealActive()
    return
  }
  // Con la lista abierta, Escape sólo la cierra: no debe cerrar el modal que contiene el campo (y perder la captura).
  if (event.key === 'Escape') { if (isOpen.value) { event.preventDefault(); event.stopPropagation() } closeMenu(); return }
  if (event.key === 'Enter' && isOpen.value && activeIndex.value >= 0) {
    event.preventDefault()
    const option = options.value[activeIndex.value]
    if (option) selectOption(option)
  }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault(); isOpen.value = true; isNavigating.value = true
    activeIndex.value = options.value.length ? (activeIndex.value < 0 ? (event.key === 'ArrowDown' ? 0 : options.value.length - 1) : (activeIndex.value + (event.key === 'ArrowDown' ? 1 : -1) + options.value.length) % options.value.length) : -1
    await revealActive()
  }
}
</script>
<template>
  <div class="field autocomplete-field">
    <label :for="id">{{ label }}</label>
    <div
      ref="control"
      class="input-icon-wrap"
    >
      <Search
        :size="18"
        aria-hidden="true"
      />
      <input
        :id="id"
        v-model="value"
        role="combobox"
        autocomplete="off"
        aria-autocomplete="list"
        :aria-expanded="isOpen"
        :aria-controls="id + '-options'"
        :aria-activedescendant="isOpen && activeIndex >= 0 ? id + '-option-' + activeIndex : undefined"
        :aria-invalid="Boolean(error)"
        :aria-describedby="error ? id + '-error' : help ? id + '-help' : undefined"
        :disabled="disabled"
        @focus="openMenu(false)"
        @input="openMenu(true)"
        @blur="closeMenu"
        @keydown="handleKey"
      >
    </div>
    <div
      v-if="isOpen && !disabled"
      ref="menu"
      v-motion="'reveal'"
      popover="manual"
      class="autocomplete-menu"
      :style="menuStyle"
    >
      <ul
        :id="id + '-options'"
        ref="list"
        role="listbox"
        :aria-label="label"
      >
        <li
          v-for="(option, index) in options"
          :id="id + '-option-' + index"
          :key="option"
          role="option"
          :aria-selected="index === activeIndex"
          @pointerdown.prevent
          @click="selectOption(option)"
        >
          {{ option }}<Check
            v-if="value === option"
            :size="16"
            aria-hidden="true"
          />
        </li>
      </ul>
      <p
        v-if="!options.length"
        role="status"
      >
        Sin coincidencias. Puedes seguir escribiendo.
      </p>
      <p
        v-else
        class="autocomplete-hint"
      >
        ↑ ↓ o Tab para recorrer · Enter para elegir
      </p>
    </div>
    <p
      v-if="error"
      :id="id + '-error'"
      class="field-help tone-error"
    >
      {{ error }}
    </p>
    <p
      v-if="help"
      :id="id + '-help'"
      class="field-help"
    >
      {{ help }}
    </p>
  </div>
</template>
