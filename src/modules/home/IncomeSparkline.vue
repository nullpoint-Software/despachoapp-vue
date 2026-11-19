<script setup lang="ts">
import { computed, ref } from 'vue'
import { formatMoney } from '../../../shared/presentation/movementLabels'
import type { CashFlowPoint } from './homeDashboardMetrics'
import { useMeasuredSize } from './useMeasuredSize'

/**
 * Línea de tendencia del ingreso mensual dentro del indicador principal de Inicio (bento, 2026-10-06).
 *
 * Decisiones (skill dataviz, "stat tile" con tendencia):
 * - Una sola serie: línea de 2 px en el acento, lavado del mismo tono al 10 % y punto final de 8 px con anillo de
 *   2 px del color del papel. Sin ejes ni leyenda: el rótulo del mosaico ya dice qué se grafica.
 * - El `viewBox` es el tamaño medido (`useMeasuredSize`), así el trazo no se deforma al cambiar el ancho.
 * - Al pasar el puntero (o enfocar) un mes, el pie muestra su importe exacto; sin interacción muestra el mes en curso.
 * - Accesible como imagen: su nombre lista los importes de cada mes.
 */
const props = defineProps<{ points: CashFlowPoint[] }>()
const containerElement = ref<HTMLElement | null>(null)
const { width } = useMeasuredSize(containerElement, 320, 56)
const sparklineHeight = 56, paddingX = 6, paddingY = 7
const activeIndex = ref<number | null>(null)

const coordinates = computed(() => {
  const values = props.points.map(point => Number(point.incomeAmount))
  const maximumValue = Math.max(1, ...values)
  const stepX = props.points.length > 1 ? (width.value - paddingX * 2) / (props.points.length - 1) : 0
  return values.map((value, index) => ({ x: paddingX + index * stepX, y: paddingY + (1 - value / maximumValue) * (sparklineHeight - paddingY * 2) }))
})
const linePath = computed(() => coordinates.value.map((point, index) => (index ? 'L' : 'M') + point.x.toFixed(1) + ' ' + point.y.toFixed(1)).join(' '))
const areaPath = computed(() => {
  const first = coordinates.value[0], last = coordinates.value[coordinates.value.length - 1]
  return first && last ? linePath.value + ' L' + last.x.toFixed(1) + ' ' + sparklineHeight + ' L' + first.x.toFixed(1) + ' ' + sparklineHeight + ' Z' : ''
})
const highlightedIndex = computed(() => activeIndex.value ?? props.points.length - 1)
const highlightedPoint = computed(() => props.points[highlightedIndex.value] ?? null)
const highlightedCoordinate = computed(() => coordinates.value[highlightedIndex.value] ?? null)
const accessibleSummary = computed(() => 'Ingresos por mes: ' + props.points.map(point => point.fullLabel + ' ' + formatMoney(point.incomeAmount)).join(', '))
/** Ancho de cada franja de toque: la mitad del paso a cada lado del punto. */
const hitWidth = computed(() => props.points.length > 1 ? (width.value - paddingX * 2) / (props.points.length - 1) : width.value)
</script>

<template>
  <figure class="income-sparkline">
    <div
      ref="containerElement"
      class="sparkline-plot"
      @mouseleave="activeIndex = null"
    >
      <svg
        :viewBox="'0 0 ' + width + ' ' + sparklineHeight"
        role="img"
        :aria-label="accessibleSummary"
        preserveAspectRatio="none"
      >
        <path
          :d="areaPath"
          class="sparkline-area"
        />
        <path
          :d="linePath"
          class="sparkline-line"
        />
        <circle
          v-if="highlightedCoordinate"
          :cx="highlightedCoordinate.x"
          :cy="highlightedCoordinate.y"
          r="4"
          class="sparkline-dot"
        />
        <rect
          v-for="(coordinate, index) in coordinates"
          :key="'hit-' + index"
          :x="coordinate.x - hitWidth / 2"
          y="0"
          :width="hitWidth"
          :height="sparklineHeight"
          class="sparkline-hit"
          aria-hidden="true"
          @mouseenter="activeIndex = index"
        />
      </svg>
    </div>
    <figcaption
      v-if="highlightedPoint"
      class="sparkline-caption"
    >
      <span>{{ points[0]?.label }}–{{ points[points.length - 1]?.label }}</span>
      <span><b class="sparkline-month">{{ highlightedPoint.fullLabel }}</b> {{ formatMoney(highlightedPoint.incomeAmount) }}</span>
    </figcaption>
  </figure>
</template>

<style scoped>
.income-sparkline { display: grid; gap: 4px; margin: 0; min-width: 0; }
.sparkline-plot { height: 56px; min-width: 0; }
.sparkline-plot svg { display: block; width: 100%; height: 56px; overflow: visible; }
.sparkline-area { fill: var(--accentColor); opacity: .1; }
.sparkline-line { fill: none; stroke: var(--accentColor); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; vector-effect: non-scaling-stroke; }
/* Anillo del color del papel para que el punto se lea encima de la línea. */
.sparkline-dot { fill: var(--accentColor); stroke: var(--surfaceColor); stroke-width: 2; }
.sparkline-hit { fill: transparent; }
.sparkline-caption { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 4px 12px; font-family: var(--monoFontFamily); font-size: 11px; font-variant-numeric: tabular-nums; color: var(--mutedTextColor); }
.sparkline-month { font-weight: 700; color: var(--textColor); text-transform: capitalize; }
</style>
