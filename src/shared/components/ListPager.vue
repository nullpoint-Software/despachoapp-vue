<script setup lang="ts">
import { computed } from 'vue'
import { ChevronLeft, ChevronRight } from '@lucide/vue'

/**
 * Paginador común (2026-10-04, pedido del usuario: "agrega paginadores" en Tareas, Clientes, Pagos y Fiscal), para que
 * las listas no se saturen con el tiempo. Muestra ‹ anterior, los números de página (con … cuando son muchas) y
 * siguiente ›, más "x–y de N". La página es base 0 (`v-model:page`); se oculta si todo cabe en una página.
 * `compact` lo reduce a "‹ 2 / 5 ›" para espacios angostos (columnas del tablero).
 */
const props = defineProps<{ pageCount: number; totalCount: number; pageSize: number; label: string; compact?: boolean }>()
const page = defineModel<number>('page', { default: 0 })
/** Páginas visibles: primera, última y dos alrededor de la actual; `null` marca un salto. */
const pages = computed(() => {
  const result: Array<number | null> = []
  for (let index = 0; index < props.pageCount; index++) {
    if (index === 0 || index === props.pageCount - 1 || Math.abs(index - page.value) <= 1) result.push(index)
    else if (result[result.length - 1] !== null) result.push(null)
  }
  return result
})
const rangeText = computed(() => {
  const first = page.value * props.pageSize + 1, last = Math.min(props.totalCount, (page.value + 1) * props.pageSize)
  return first + '–' + last + ' de ' + props.totalCount
})
function go(target: number): void { page.value = Math.max(0, Math.min(props.pageCount - 1, target)) }
</script>
<template>
  <nav
    v-if="pageCount > 1"
    class="list-pager"
    :class="{ 'is-compact': compact }"
    :aria-label="'Páginas de ' + label"
  >
    <button
      type="button"
      class="list-pager-button"
      :disabled="page === 0"
      :aria-label="'Página anterior de ' + label"
      @click="go(page - 1)"
    >
      <ChevronLeft
        :size="16"
        aria-hidden="true"
      />
    </button>
    <template v-if="compact">
      <span class="list-pager-status">{{ page + 1 }} / {{ pageCount }}</span>
    </template>
    <template v-else>
      <template
        v-for="(item, index) in pages"
        :key="item ?? 'gap-' + index"
      >
        <span
          v-if="item === null"
          class="list-pager-gap"
          aria-hidden="true"
        >…</span>
        <button
          v-else
          type="button"
          class="list-pager-button"
          :class="{ 'is-current': item === page }"
          :aria-current="item === page ? 'page' : undefined"
          :aria-label="'Página ' + (item + 1) + ' de ' + label"
          @click="go(item)"
        >
          {{ item + 1 }}
        </button>
      </template>
    </template>
    <button
      type="button"
      class="list-pager-button"
      :disabled="page >= pageCount - 1"
      :aria-label="'Página siguiente de ' + label"
      @click="go(page + 1)"
    >
      <ChevronRight
        :size="16"
        aria-hidden="true"
      />
    </button>
    <span
      v-if="!compact"
      class="list-pager-range"
    >{{ rangeText }}</span>
  </nav>
</template>
<style scoped>
.list-pager { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; font-family: var(--monoFontFamily); font-size: 12px; font-weight: 700; }
.list-pager.is-compact { justify-content: center; }
.list-pager-button { display: grid; place-items: center; min-width: 32px; height: 32px; padding: 0 6px; border: 2px solid var(--borderColor); background: var(--surfaceColor); color: var(--textColor); font: inherit; cursor: pointer; }
.list-pager-button:hover:not(:disabled) { background: var(--hoverColor); }
.list-pager-button.is-current { background: var(--primaryBackgroundColor); color: var(--primaryTextColor); box-shadow: 2px 2px 0 var(--borderColor); }
.list-pager-button:disabled { opacity: .4; cursor: not-allowed; }
.list-pager-button:focus-visible { outline: 3px solid var(--focusColor); outline-offset: 1px; }
.list-pager-gap { padding: 0 4px; color: var(--mutedTextColor); }
.list-pager-status { padding: 0 8px; }
.list-pager-range { margin-left: 8px; color: var(--mutedTextColor); font-weight: 600; }
</style>
