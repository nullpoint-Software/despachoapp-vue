<script setup lang="ts">
import { onBeforeUnmount } from 'vue'
import { SlidersHorizontal } from '@lucide/vue'
import SearchBox from './SearchBox.vue'
import ActionButton from './ActionButton.vue'
import type { SearchSelectOption } from './searchSelectOption'

/**
 * Barra de toda lista (2026-10-04), igual en todas las vistas, ordenada como la ContaApp anterior en una sola fila:
 * `leading` (pestañas o título) → buscador que ocupa el espacio libre → "Filtros" con contador → `actions` (actualizar,
 * acción principal al final). En pantallas angostas el buscador toma la fila completa y las acciones bajan.
 *
 * - `filterCount`: `null` oculta "Filtros"; un número lo muestra con contador si es mayor que cero. Emite `openFilters`.
 * - `searchDelayMilliseconds`: si se da, `search` se emite al dejar de escribir (vistas que consultan a Main o al Host);
 *   Enter o limpiar lo emiten de inmediato. Sin él, la vista filtra en vivo con `v-model`.
 * - `suggestions`: coincidencias para el autocompletado del buscador; elegir una emite `pick` con su valor.
 */
const props = defineProps<{ searchId: string; searchLabel: string; placeholder: string; filterCount?: number | null; searchDelayMilliseconds?: number; isBusy?: boolean; label?: string; suggestions?: SearchSelectOption[] }>()
const search = defineModel<string>('search', { default: '' })
const emit = defineEmits<{ search: []; openFilters: []; pick: [value: string] }>()
let searchTimer: ReturnType<typeof setTimeout> | undefined

function scheduleSearch(value: string): void {
  search.value = value
  if (props.searchDelayMilliseconds === undefined) return
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => emit('search'), props.searchDelayMilliseconds)
}
function searchNow(): void { clearTimeout(searchTimer); emit('search') }
onBeforeUnmount(() => clearTimeout(searchTimer))
</script>
<template>
  <div
    class="list-toolbar"
    role="search"
    :aria-label="label ?? searchLabel"
  >
    <div
      v-if="$slots.leading"
      class="list-toolbar-leading"
    >
      <slot name="leading" />
    </div>
    <SearchBox
      :id="searchId"
      class="list-toolbar-search"
      :model-value="search"
      :label="searchLabel"
      :placeholder="placeholder"
      :suggestions="suggestions"
      @update:model-value="scheduleSearch"
      @submit="searchNow"
      @pick="emit('pick', $event)"
    />
    <div class="list-toolbar-actions">
      <ActionButton
        v-if="filterCount !== null && filterCount !== undefined"
        aria-label="Filtros"
        :disabled="isBusy"
        @click="emit('openFilters')"
      >
        <SlidersHorizontal
          :size="16"
          aria-hidden="true"
        /> Filtros<span
          v-if="filterCount"
          class="filter-count"
          aria-hidden="true"
        >{{ filterCount }}</span>
      </ActionButton>
      <slot name="actions" />
    </div>
  </div>
</template>
<!--
  Sin "scoped": las reglas alcanzan a los botones que llegan por el slot `actions`.
  Reparto del espacio, sin huecos (como la ContaApp anterior):
  - En una fila: inicio | buscador | acciones. El buscador crece con peso 1000 y se queda con casi todo el espacio libre.
  - Si las acciones no caben, bajan a su propia fila; ahí son el único elemento, ocupan el ancho completo y sus botones
    se reparten la fila (flex 1), en lugar de quedar alineados a la derecha con un hueco a la izquierda.
-->
<style>
.list-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; min-width: 0; }
.list-toolbar-leading { display: flex; align-items: center; gap: 12px; flex: 0 1 auto; min-width: 0; }
.list-toolbar-leading > * { min-width: 0; }
.list-toolbar-search { flex: 1000 1 16rem; min-width: min(100%, 14rem); }
/* Puede encogerse hasta el ancho disponible: así sus botones bajan de línea en vez de salirse (480 px). */
.list-toolbar-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; flex: 1 1 auto; min-width: 0; max-width: 100%; justify-content: flex-end; }
.list-toolbar-actions > * { flex: 1 1 auto; }
</style>
