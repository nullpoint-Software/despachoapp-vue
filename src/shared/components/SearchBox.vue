<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Search, X } from '@lucide/vue'
import type { SearchSelectOption } from './searchSelectOption'

/**
 * Buscador canónico de Fiscenix (2026-10-04, como el `.app-search-control` de la ContaApp anterior): celda con la lupa,
 * campo con placeholder y, si hay texto, un botón para limpiar. La etiqueta es sólo para lectores de pantalla; el
 * placeholder dice qué se busca. Mismo alto que los botones (`--controlHeight`) para alinearse en la barra.
 *
 * Contrato: `v-model` cambia en cada tecla; `submit` se emite con Enter o al limpiar, para las vistas que consultan al
 * Host o a Main. Escape limpia el texto.
 *
 * Autocompletado (2026-10-04): si la vista pasa `suggestions` (las coincidencias que ya calculó), mientras se escribe
 * aparecen debajo, hasta 8, como combobox accesible; ↑ ↓ recorren, Enter o clic eligen y se emite `pick` con su
 * `value` (por ejemplo, para llevar la vista a esa tarjeta). Sin `suggestions`, se comporta como antes.
 */
// La clase que pone quien lo usa (por ejemplo `list-toolbar-search`) va en el contenedor, no en el campo.
defineOptions({ inheritAttrs: false })
const props = defineProps<{ id: string; label: string; placeholder: string; disabled?: boolean; suggestions?: SearchSelectOption[] }>()
const value = defineModel<string>({ default: '' })
const emit = defineEmits<{ submit: []; pick: [value: string] }>()
const isOpen = ref(false), activeIndex = ref(-1), list = ref<HTMLElement | null>(null)
const visibleSuggestions = computed(() => value.value.trim() ? (props.suggestions ?? []).slice(0, 8) : [])
const isListVisible = computed(() => isOpen.value && Boolean(props.suggestions) && value.value.trim().length > 0)
watch(visibleSuggestions, () => { activeIndex.value = visibleSuggestions.value.length ? 0 : -1 })
function clear(): void { value.value = ''; emit('submit') }
function pick(option: SearchSelectOption): void { isOpen.value = false; emit('pick', option.value) }
async function handleKey(event: KeyboardEvent): Promise<void> {
  if (event.isComposing) return
  if (isListVisible.value && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
    event.preventDefault()
    const count = visibleSuggestions.value.length
    if (count) activeIndex.value = (activeIndex.value + (event.key === 'ArrowDown' ? 1 : -1) + count) % count
    await nextTick()
    list.value?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
    return
  }
  if (event.key === 'Enter') {
    event.preventDefault()
    const option = visibleSuggestions.value[activeIndex.value]
    if (isListVisible.value && option) pick(option); else emit('submit')
  } else if (event.key === 'Escape') {
    if (isListVisible.value) { event.preventDefault(); event.stopPropagation(); isOpen.value = false }
    else if (value.value) { event.preventDefault(); event.stopPropagation(); clear() }
  }
}
</script>
<template>
  <div
    class="search-box-wrap"
    :class="$attrs.class"
  >
    <div
      class="search-box"
      :class="{ 'is-disabled': disabled }"
    >
      <span
        class="search-box-icon"
        aria-hidden="true"
      ><Search :size="16" /></span>
      <label
        class="sr-only"
        :for="id"
      >{{ label }}</label>
      <input
        :id="id"
        v-model="value"
        type="search"
        autocomplete="off"
        spellcheck="false"
        :placeholder="placeholder"
        :disabled="disabled"
        :role="suggestions ? 'combobox' : undefined"
        :aria-autocomplete="suggestions ? 'list' : undefined"
        :aria-expanded="suggestions ? isListVisible : undefined"
        :aria-controls="suggestions ? id + '-suggestions' : undefined"
        :aria-activedescendant="isListVisible && activeIndex >= 0 ? id + '-suggestion-' + activeIndex : undefined"
        @keydown="handleKey"
        @input="isOpen = true"
        @focus="isOpen = true"
        @blur="isOpen = false"
      >
      <button
        v-if="value && !disabled"
        type="button"
        class="search-box-clear"
        :aria-label="'Limpiar ' + label.toLowerCase()"
        @click="clear"
      >
        <X
          :size="14"
          aria-hidden="true"
        />
      </button>
    </div>
    <div
      v-if="isListVisible"
      v-motion="'reveal'"
      class="autocomplete-menu search-box-menu"
    >
      <ul
        :id="id + '-suggestions'"
        ref="list"
        role="listbox"
        :aria-label="'Coincidencias de ' + label.toLowerCase()"
      >
        <li
          v-for="(option, index) in visibleSuggestions"
          :id="id + '-suggestion-' + index"
          :key="option.value"
          role="option"
          :aria-selected="index === activeIndex"
          :data-active="index === activeIndex"
          @pointerdown.prevent
          @click="pick(option)"
        >
          <span class="search-box-option"><span>{{ option.label }}</span><span
            v-if="option.detail"
            class="search-box-detail"
          >{{ option.detail }}</span></span>
        </li>
      </ul>
      <p
        v-if="!visibleSuggestions.length"
        role="status"
      >
        Sin coincidencias.
      </p>
      <p
        v-else
        class="autocomplete-hint"
      >
        {{ (suggestions?.length ?? 0) > visibleSuggestions.length ? visibleSuggestions.length + ' de ' + suggestions!.length + ' · ' : '' }}↑ ↓ para recorrer · Enter para ir
      </p>
    </div>
  </div>
</template>
<style scoped>
.search-box-wrap { position: relative; min-width: 0; }
.search-box { display: grid; grid-template-columns: var(--controlHeight) minmax(0, 1fr) auto; align-items: stretch; min-height: var(--controlHeight); min-width: 0; border: 2px solid var(--borderColor); background: var(--inputColor); color: var(--textColor); }
/* El foco lo dibuja DitherFocusRing alrededor de la caja (2026-10-17). */
.search-box:focus-within { outline: none; }
.search-box.is-disabled { opacity: .6; }
.search-box-icon { display: grid; place-items: center; border-right: 2px solid var(--borderColor); background: var(--subtleColor); color: var(--textColor); }
.search-box input { min-width: 0; border: 0; outline: none; background: transparent; color: var(--textColor); font: inherit; font-weight: 600; padding: 0 12px; box-shadow: none; }
.search-box input::placeholder { color: var(--mutedTextColor); font-weight: 500; }
.search-box input::-webkit-search-cancel-button { display: none; }
.search-box-clear { display: grid; place-items: center; width: calc(var(--controlHeight) - 4px); border: 0; border-left: 2px solid var(--borderColor); background: transparent; color: var(--textColor); cursor: pointer; }
.search-box-clear:hover { background: var(--subtleColor); }
.search-box-menu { top: calc(100% + 4px); z-index: 20; }
.search-box-option { display: grid; gap: 1px; min-width: 0; }
.search-box-detail { font-family: var(--monoFontFamily); font-size: 12px; color: var(--mutedTextColor); }
li[data-active="true"] { background: var(--hoverColor); outline: 2px solid var(--focusColor); outline-offset: -2px; }
</style>
