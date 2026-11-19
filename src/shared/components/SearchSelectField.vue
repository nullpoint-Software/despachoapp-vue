<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Check, Search, X } from '@lucide/vue'
import { presenceLabels, type SearchSelectOption } from './searchSelectOption'
import UserAvatar from './UserAvatar.vue'
import { moveWithTab, usePopoverMenu } from './popoverMenu'

export type { SearchSelectOption }

/**
 * Selector con búsqueda (2026-10-04, pedido del usuario): el mismo combobox que el de Tareas (lupa, lista con ✓ y ayuda
 * de teclado), pero guarda un `value` como un `select`. Se usa para elegir clientes, regímenes fiscales, RFC y usuarios,
 * porque escribir unas letras es más rápido que recorrer una lista larga.
 *
 * - Sin foco muestra la etiqueta de lo elegido; al enfocarlo se puede escribir para buscar (sin acentos ni mayúsculas,
 *   en etiqueta, detalle y palabras clave).
 * - `multiple`: el modelo es una lista; lo elegido se ve como chips con × y la lista marca cada opción con ✓.
 * - `emptyLabel`: agrega una opción vacía ("Todos los clientes"); en múltiple no aplica.
 * - Muestra hasta `maximumVisibleCount` coincidencias para no saturar; pide escribir más si hay más.
 * Teclado: ↑ ↓ recorren (y Tab / Mayús+Tab después de escribir), Enter elige, Escape cierra y restaura, Retroceso con la búsqueda vacía quita el último chip.
 *
 * Selector de trabajadores (2026-10-06, pedido del usuario con un buscador de miembros como referencia):
 * - Las opciones con `person` llevan la foto del trabajador con un punto de presencia (verde en línea, ámbar ausente,
 *   gris desconectado), su nombre y, debajo, `detail` (su puesto). Los chips de lo elegido también llevan la foto.
 * - Las opciones con `group` se agrupan bajo un encabezado (por ejemplo, el rol).
 * - Botón × para borrar lo escrito (y, en sencillo con `emptyLabel`, volver a la opción vacía).
 * La presencia también se dice en texto para lectores de pantalla.
 */
const props = withDefaults(defineProps<{
  id: string; label: string; options: SearchSelectOption[]; placeholder?: string; emptyLabel?: string; help?: string; error?: string
  disabled?: boolean; multiple?: boolean; maximumVisibleCount?: number
}>(), { placeholder: 'Escribe para buscar', emptyLabel: undefined, help: undefined, error: undefined, maximumVisibleCount: 40 })
const value = defineModel<string | string[]>({ default: '' })
const emit = defineEmits<{ select: [value: string] }>()
const isOpen = ref(false), query = ref(''), activeIndex = ref(-1)
const list = ref<HTMLElement | null>(null), input = ref<HTMLInputElement | null>(null)
const control = ref<HTMLElement | null>(null), menu = ref<HTMLElement | null>(null)
// Lista en la capa superior, colocada junto al campo (ver `usePopoverMenu`).
const { menuStyle } = usePopoverMenu(control, menu, isOpen)
/** `true` tras escribir o recorrer con flechas: sólo entonces Tab recorre las opciones (`moveWithTab`). */
const isNavigating = ref(false)

const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('es-MX').trim()
const selectedValues = computed(() => Array.isArray(value.value) ? value.value : value.value ? [value.value] : [])
const selectedOptions = computed(() => selectedValues.value.map(item => props.options.find(option => option.value === item) ?? { value: item, label: item }))
const allOptions = computed<SearchSelectOption[]>(() => props.emptyLabel !== undefined && !props.multiple ? [{ value: '', label: props.emptyLabel }, ...props.options] : props.options)
const matches = computed(() => {
  const term = normalize(query.value)
  return term ? allOptions.value.filter(option => normalize([option.label, option.detail ?? '', option.keywords ?? '', option.value].join(' ')).includes(term)) : allOptions.value
})
const visibleOptions = computed(() => matches.value.slice(0, props.maximumVisibleCount))
/** Texto del campo: la búsqueda mientras está abierto; si no, la etiqueta de lo elegido (en sencillo). */
const displayText = computed(() => isOpen.value || props.multiple ? query.value : selectedOptions.value[0]?.label ?? (props.emptyLabel ?? ''))
watch(visibleOptions, () => { activeIndex.value = visibleOptions.value.length ? 0 : -1 })
watch(() => props.disabled, () => { isOpen.value = false })

function isSelected(option: SearchSelectOption): boolean { return props.multiple ? selectedValues.value.includes(option.value) : (value.value || '') === option.value }
function open(): void { if (props.disabled) return; isOpen.value = true; query.value = ''; isNavigating.value = false }
function close(): void { isOpen.value = false; query.value = ''; activeIndex.value = -1; isNavigating.value = false }
function choose(option: SearchSelectOption): void {
  if (props.multiple) {
    value.value = isSelected(option) ? selectedValues.value.filter(item => item !== option.value) : [...selectedValues.value, option.value]
    query.value = ''
  } else { value.value = option.value; close(); input.value?.blur() }
  emit('select', option.value)
}
function remove(optionValue: string): void { value.value = selectedValues.value.filter(item => item !== optionValue) }
async function handleKey(event: KeyboardEvent): Promise<void> {
  if (event.isComposing) return
  if (event.key === 'Escape') { if (isOpen.value) { event.preventDefault(); event.stopPropagation() } close(); return }
  if (event.key === 'Tab') {
    const nextIndex = isOpen.value ? moveWithTab(event, activeIndex.value, visibleOptions.value.length, isNavigating.value) : null
    if (nextIndex === null) { close(); return }
    activeIndex.value = nextIndex
    await nextTick()
    list.value?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
    return
  }
  if (event.key === 'Backspace' && props.multiple && !query.value && selectedValues.value.length) { remove(selectedValues.value[selectedValues.value.length - 1]!); return }
  if (event.key === 'Enter') {
    event.preventDefault()
    const option = visibleOptions.value[activeIndex.value]
    if (isOpen.value && option) choose(option)
    return
  }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    if (!isOpen.value) open()
    isNavigating.value = true
    const count = visibleOptions.value.length
    activeIndex.value = count ? (activeIndex.value + (event.key === 'ArrowDown' ? 1 : -1) + count) % count : -1
    await nextTick()
    list.value?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }
}
function updateQuery(event: Event): void { query.value = (event.target as HTMLInputElement).value; isOpen.value = true; isNavigating.value = true }
/** Encabezado antes de la primera opción visible de cada grupo. */
function groupBefore(index: number): string | null {
  const group = visibleOptions.value[index]?.group
  return group && group !== visibleOptions.value[index - 1]?.group ? group : null
}
const canClear = computed(() => !props.disabled && (Boolean(query.value) || (!props.multiple && props.emptyLabel !== undefined && Boolean(value.value))))
/** Borra lo escrito; si no había búsqueda, vuelve a la opción vacía. El foco se queda en el campo. */
function clear(): void {
  if (query.value) query.value = ''
  else if (!props.multiple) value.value = ''
  input.value?.focus()
}
</script>
<template>
  <div
    class="field autocomplete-field search-select"
    :class="{ 'is-multiple': multiple }"
  >
    <label :for="id">{{ label }}</label>
    <div
      v-if="multiple && selectedOptions.length"
      class="search-select-chips"
    >
      <span
        v-for="option in selectedOptions"
        :key="option.value"
        class="search-select-chip"
      ><UserAvatar
        v-if="'person' in option && option.person"
        :user-id="option.person.userId"
        :display-name="option.label"
        size="small"
        is-decorative
      />{{ option.label }}<button
        type="button"
        :aria-label="'Quitar ' + option.label"
        :disabled="disabled"
        @pointerdown.prevent
        @click="remove(option.value)"
      ><X
        :size="12"
        aria-hidden="true"
      /></button></span>
    </div>
    <div
      ref="control"
      class="input-icon-wrap search-select-control"
    >
      <Search
        :size="18"
        aria-hidden="true"
      />
      <input
        :id="id"
        ref="input"
        :value="displayText"
        role="combobox"
        autocomplete="off"
        spellcheck="false"
        aria-autocomplete="list"
        :aria-expanded="isOpen"
        :aria-controls="id + '-options'"
        :aria-activedescendant="isOpen && activeIndex >= 0 ? id + '-option-' + activeIndex : undefined"
        :aria-invalid="Boolean(error)"
        :aria-describedby="error ? id + '-error' : help ? id + '-help' : undefined"
        :placeholder="multiple && selectedOptions.length ? 'Agregar…' : placeholder"
        :disabled="disabled"
        @focus="open"
        @click="isOpen || open()"
        @input="updateQuery"
        @blur="close"
        @keydown="handleKey"
      >
      <button
        v-if="canClear"
        type="button"
        class="search-select-clear"
        :aria-label="'Borrar ' + label.toLowerCase()"
        @pointerdown.prevent
        @click="clear"
      >
        <X
          :size="16"
          aria-hidden="true"
        />
      </button>
      <div
        v-if="isOpen && !disabled"
        ref="menu"
        v-motion="'reveal'"
        popover="manual"
        class="autocomplete-menu search-select-menu"
        :style="menuStyle"
      >
        <ul
          :id="id + '-options'"
          ref="list"
          role="listbox"
          :aria-label="'Opciones de ' + label.toLowerCase()"
          :aria-multiselectable="multiple || undefined"
        >
          <template
            v-for="(option, index) in visibleOptions"
            :key="option.value || '(vacío)'"
          >
            <li
              v-if="groupBefore(index)"
              class="search-select-group"
              role="presentation"
            >
              {{ groupBefore(index) }}
            </li>
            <li
              :id="id + '-option-' + index"
              role="option"
              :aria-selected="isSelected(option)"
              :data-active="index === activeIndex"
              :class="{ 'is-person': option.person }"
              @pointerdown.prevent
              @click="choose(option)"
            >
              <span
                v-if="option.person"
                class="search-select-person"
              >
                <UserAvatar
                  :user-id="option.person.userId"
                  :display-name="option.label"
                  size="medium"
                  is-decorative
                />
                <span
                  v-if="option.person.presence"
                  class="presence-dot"
                  :class="'presence-' + option.person.presence"
                  aria-hidden="true"
                />
              </span>
              <span class="search-select-text"><span class="search-select-label">{{ option.label }}</span><span
                v-if="option.detail"
                class="search-select-detail"
              >{{ option.detail }}</span><span
                v-if="option.person?.presence"
                class="sr-only"
              >{{ presenceLabels[option.person.presence] }}</span></span><Check
                v-if="isSelected(option)"
                :size="16"
                aria-hidden="true"
              />
            </li>
          </template>
        </ul>
        <p
          v-if="!visibleOptions.length"
          role="status"
        >
          Sin coincidencias.
        </p>
        <p
          v-else
          class="autocomplete-hint"
        >
          {{ matches.length > visibleOptions.length ? 'Se muestran ' + visibleOptions.length + ' de ' + matches.length + '; escribe más para afinar · ' : '' }}↑ ↓ para recorrer · Enter para elegir
        </p>
      </div>
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
<style scoped>
/* El menú vive dentro del campo (relativo) y sale justo debajo: .field es un grid y un absoluto sin top se iría arriba. */
.search-select .autocomplete-menu { top: calc(100% + 4px); }
.search-select-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.search-select-chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 4px 2px 8px; border: 2px solid var(--borderColor); background: var(--subtleColor); font-size: 13px; font-weight: 700; white-space: nowrap; }
.search-select-chip button { display: grid; place-items: center; width: 20px; height: 20px; padding: 0; border: 0; background: transparent; color: inherit; cursor: pointer; }
.search-select-chip button:hover { background: var(--hoverColor); }
.search-select-text { display: grid; gap: 1px; min-width: 0; }
.search-select-detail { font-family: var(--monoFontFamily); font-size: 12px; color: var(--mutedTextColor); }
li[data-active="true"] { background: var(--hoverColor); outline: 2px solid var(--focusColor); outline-offset: -2px; }
.search-select-chip :deep(.user-avatar) { margin-right: 2px; }
/* Borrar: dentro del campo, a la derecha, como en un buscador. */
.search-select-control input { padding-right: 40px; }
.search-select-clear { position: absolute; top: 50%; right: 8px; display: grid; place-items: center; width: 28px; height: 28px; padding: 0; border: 2px solid transparent; transform: translateY(-50%); background: transparent; color: var(--mutedTextColor); cursor: pointer; }
.search-select-clear:hover { border-color: var(--borderColor); color: var(--textColor); }
.search-select-clear:focus-visible { outline: 2px solid var(--focusColor); outline-offset: 1px; }
.search-select-group { padding: 10px 12px 4px; font-family: var(--monoFontFamily); font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--mutedTextColor); cursor: default; }
/* Trabajador: foto, nombre y puesto juntos a la izquierda; la ✓ al final. */
li.is-person { justify-content: flex-start; gap: 12px; }
li.is-person .search-select-text { flex: 1; }
.search-select-group:hover { background: transparent; }
.search-select-person { position: relative; display: inline-flex; flex: none; }
.search-select-label { font-weight: 700; }
li.is-person .search-select-detail { font-family: inherit; font-size: 13px; }
/* Punto de presencia sobre la esquina de la foto, con aro del color de la lista para separarlo. */
.presence-dot { position: absolute; right: -4px; bottom: -4px; width: 12px; height: 12px; border: 2px solid var(--surfaceColor); border-radius: 50%; }
.presence-online { background: var(--successColor); }
.presence-away { background: var(--warningColor); }
.presence-offline { background: var(--mutedTextColor); }
</style>
