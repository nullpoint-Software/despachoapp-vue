<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { X } from '@lucide/vue'

/**
 * Filtros activos como chips removibles (Removable Filter Chip, 2026-10-06), debajo de `ListToolbar`.
 *
 * Flujo:
 * - La vista calcula sus filtros activos (sólo los distintos de su valor por defecto) como `ActiveFilterChip[]`, con
 *   valores legibles (etiquetas, no códigos). Este componente no conoce el estado de la vista: sólo lo muestra.
 * - La × de un chip (clic, Enter/Espacio) o Retroceso/Suprimir con el chip enfocado emite `remove` con su `filterId`;
 *   la vista devuelve ese filtro a su valor por defecto y recarga como ya lo hacía al aplicar el modal "Filtros".
 * - "Quitar todos" aparece con dos o más chips y emite `clear` (la vista reutiliza su "Limpiar").
 *
 * Foco: al quitar un chip con el teclado o el ratón el foco nunca se pierde. Pasa al chip siguiente (o al anterior si
 * era el último); si ya no quedan chips, a "Quitar todos" si sigue visible y, si no, al elemento `fallbackFocusId`
 * (el buscador de la barra). Se resuelve después de `nextTick`, cuando la vista ya quitó el chip de `chips`.
 *
 * La fila se oculta sin chips; así el contador de "Filtros" en la barra y los chips muestran siempre lo mismo.
 */
export interface ActiveFilterChip { filterId: string; label: string; value: string }

/** `isStandalone`: la barra es su propio panel (Tareas, Opiniones); la fila va sin sangría bajo ese panel. */
const props = defineProps<{ chips: ActiveFilterChip[]; fallbackFocusId?: string; isStandalone?: boolean }>()
const emit = defineEmits<{ remove: [filterId: string]; clear: [] }>()
const rootElement = ref<HTMLElement | null>(null)

/** Elige a quién pasar el foco antes de emitir; tras el render enfoca el primer destino que siga en pantalla. */
async function removeChip(filterId: string): Promise<void> {
  const index = props.chips.findIndex(chip => chip.filterId === filterId)
  const nextChipId = props.chips[index + 1]?.filterId ?? props.chips[index - 1]?.filterId ?? null
  emit('remove', filterId)
  await nextTick()
  focusAfterRemoval(nextChipId)
}

async function clearChips(): Promise<void> {
  emit('clear')
  await nextTick()
  focusAfterRemoval(null)
}

/**
 * Los chips que salen siguen en el DOM durante su animación; por eso se busca por `filterId` entre los chips vigentes
 * (`props.chips`) y no por posición en el DOM.
 */
function focusAfterRemoval(nextChipId: string | null): void {
  const isChipStillActive = nextChipId !== null && props.chips.some(chip => chip.filterId === nextChipId)
  const chipButton = isChipStillActive ? rootElement.value?.querySelector<HTMLButtonElement>('[data-filter-id="' + CSS.escape(nextChipId) + '"]') : null
  const clearButton = props.chips.length >= 2 ? rootElement.value?.querySelector<HTMLButtonElement>('.filter-chips-clear') : null
  const fallbackElement = props.fallbackFocusId ? document.getElementById(props.fallbackFocusId) : null
  ;(chipButton ?? clearButton ?? fallbackElement)?.focus()
}

/** Retroceso o Suprimir sobre un chip enfocado lo quitan, como en un campo de etiquetas. */
function handleChipKeydown(event: KeyboardEvent, filterId: string): void {
  if (event.key !== 'Backspace' && event.key !== 'Delete') return
  event.preventDefault()
  void removeChip(filterId)
}
</script>
<template>
  <div
    v-if="chips.length"
    ref="rootElement"
    class="filter-chips"
    :class="{ 'is-standalone': isStandalone }"
    role="group"
    aria-label="Filtros activos"
  >
    <TransitionGroup
      tag="ul"
      name="filter-chip"
      class="filter-chips-list"
    >
      <li
        v-for="chip in chips"
        :key="chip.filterId"
        class="filter-chip"
      >
        <span class="filter-chip-label">{{ chip.label }}:</span>
        <span class="filter-chip-value">{{ chip.value }}</span>
        <button
          type="button"
          class="filter-chip-remove"
          :data-filter-id="chip.filterId"
          :aria-label="'Quitar filtro ' + chip.label + ': ' + chip.value"
          @click="removeChip(chip.filterId)"
          @keydown="handleChipKeydown($event, chip.filterId)"
        >
          <X
            :size="14"
            aria-hidden="true"
          />
        </button>
      </li>
    </TransitionGroup>
    <button
      v-if="chips.length >= 2"
      type="button"
      class="filter-chips-clear"
      @click="clearChips"
    >
      Quitar todos
    </button>
  </div>
</template>
<!--
  Chip brutalista: marco de 2 px en tinta, sombra dura pequeña (2 px), rótulo mono en mayúsculas y valor en peso normal.
  Entra y sale con escala + opacidad (150 ms, escala de transitions.dev); con movimiento reducido no se anima.
-->
<style scoped>
/* Dentro de un panel de tabla: alineada con la barra (20 px) y separada del contenido. */
.filter-chips { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; min-width: 0; padding: 0 20px var(--spaceMedium); }
.filter-chips.is-standalone { padding: 0 0 var(--spaceMedium); }
.filter-chips-list { display: flex; flex-wrap: wrap; gap: 8px; min-width: 0; max-width: 100%; margin: 0; padding: 0; list-style: none; position: relative; }
.filter-chip { display: inline-flex; align-items: center; gap: 6px; min-width: 0; max-width: 100%; min-height: 30px; padding: 2px 2px 2px 10px; border: 2px solid var(--borderColor); background: var(--surfaceColor); color: var(--textColor); box-shadow: 2px 2px 0 var(--shadowInk); }
.filter-chip-label { flex: none; font-family: var(--monoFontFamily); font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--mutedTextColor); }
.filter-chip-value { min-width: 0; font-size: 13px; font-weight: 400; overflow-wrap: anywhere; }
.filter-chip-remove { flex: none; display: inline-grid; place-items: center; width: 24px; height: 24px; padding: 0; border: 0; background: transparent; color: var(--textColor); cursor: pointer; transition: background-color var(--durationQuick) var(--easeSmoothOut), color var(--durationQuick) var(--easeSmoothOut); }
.filter-chip-remove:hover { background: var(--inkColor); color: var(--surfaceColor); }
.filter-chip-remove:focus-visible, .filter-chips-clear:focus-visible { outline: 3px solid var(--focusColor); outline-offset: 1px; }
.filter-chips-clear { padding: 4px 2px; border: 0; background: transparent; color: var(--textColor); font-size: 13px; font-weight: 700; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
.filter-chips-clear:hover { color: var(--accentColor); }
.filter-chip-enter-active, .filter-chip-leave-active { transition: transform var(--durationQuick) var(--easeSmoothOut), opacity var(--durationQuick) var(--easeSmoothOut); }
.filter-chip-enter-from, .filter-chip-leave-to { transform: scale(.9); opacity: 0; }
/* El chip que sale deja de ocupar espacio para que los demás se acomoden (clase `move`). */
.filter-chip-leave-active { position: absolute; }
.filter-chip-move { transition: transform var(--durationQuick) var(--easeSmoothOut); }
@media (prefers-reduced-motion: reduce) {
  .filter-chip-enter-active, .filter-chip-leave-active, .filter-chip-move { transition: none; }
}
</style>
