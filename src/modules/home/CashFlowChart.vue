<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { formatMoney } from '../../../shared/presentation/movementLabels'
import { calculateAxisTicks, formatCompactMoney, subtractAmounts, type CashFlowPoint } from './homeDashboardMetrics'
import { useMeasuredSize } from './useMeasuredSize'

/**
 * Columnas agrupadas de ingresos y gastos por mes (tablero de Inicio, 2026-10-06), en SVG propio: sin librería.
 * Lo usan el tablero (últimos 6 meses) y el panel del equipo (los 12 meses del ejercicio).
 *
 * Decisiones (skill dataviz + DESIGN.md):
 * - Un solo eje de importes con marcas "redondas" y líneas guía de 1 px en hilo; las columnas crecen de la base.
 * - Dos series: ingresos en el azul de sello (el único acento) y gastos en gris neutro. El gris no pasa el piso de
 *   croma de una paleta categórica, a propósito (DESIGN.md prohíbe un segundo acento); por eso la identidad nunca
 *   depende sólo del color: leyenda siempre visible, detalle al pasar o enfocar y tabla accesible con las cifras.
 *   En Dark el azul baja a #6E84F2 para quedar en la banda de luminosidad validada contra el papel oscuro.
 * - Columnas de ≤ 24 px con 2 px de aire entre ingreso y gasto; esquinas rectas (el sistema no redondea nada).
 * - Etiqueta directa sólo en el último mes (el que se está viviendo); los demás valores, en el detalle y la tabla.
 * - Cada mes tiene un área de toque del alto completo, enfocable con teclado, que abre el detalle con el neto exacto.
 * - Tamaño (bento, 2026-10-06): el SVG ya no se escala desde un `viewBox` fijo. Se mide el área de la gráfica
 *   (`useMeasuredSize`) y el `viewBox` es ese tamaño en píxeles: los rótulos quedan en 12 px en cualquier ancho y la
 *   gráfica llena el alto que le dé su mosaico (mínimo `--chartMinimumHeight`, 240 px por omisión).
 */
const props = defineProps<{ points: CashFlowPoint[]; accessibleTitle: string; accessibleDescription: string }>()
const chartId = useId()
const plotElement = ref<HTMLElement | null>(null)
const { width: chartWidth, height: chartHeight } = useMeasuredSize(plotElement, 640, 240)
const marginLeft = 60, marginRight = 8, marginTop = 22, marginBottom = 28
const maximumBarWidth = 24, pairGap = 2, tickCount = 4
const plotWidth = computed(() => Math.max(1, chartWidth.value - marginLeft - marginRight))
const plotHeight = computed(() => Math.max(1, chartHeight.value - marginTop - marginBottom))
const baselineY = computed(() => marginTop + plotHeight.value)
const activeIndex = ref<number | null>(null)

const ticks = computed(() => calculateAxisTicks(Math.max(0, ...props.points.flatMap(point => [Number(point.incomeAmount), Number(point.expenseAmount)])), tickCount))
const axisMaximum = computed(() => ticks.value[ticks.value.length - 1] || 1)
function scaleY(amount: number): number { return baselineY.value - amount / axisMaximum.value * plotHeight.value }

/** Geometría de cada mes: ranura, par de columnas centrado y área de toque. */
const columns = computed(() => {
  const baseline = baselineY.value
  const slotWidth = plotWidth.value / Math.max(1, props.points.length)
  const barWidth = Math.min(maximumBarWidth, (slotWidth * 0.7 - pairGap) / 2)
  return props.points.map((point, index) => {
    const slotX = marginLeft + index * slotWidth, groupX = slotX + (slotWidth - (barWidth * 2 + pairGap)) / 2
    const incomeY = scaleY(Number(point.incomeAmount)), expenseY = scaleY(Number(point.expenseAmount))
    return {
      ...point, slotX, slotWidth, centerX: slotX + slotWidth / 2, barWidth,
      incomeX: groupX, incomeY, incomeHeight: baseline - incomeY,
      expenseX: groupX + barWidth + pairGap, expenseY, expenseHeight: baseline - expenseY,
      netAmount: subtractAmounts(point.incomeAmount, point.expenseAmount),
      summary: point.fullLabel + ': ingresos ' + formatMoney(point.incomeAmount) + ', gastos ' + formatMoney(point.expenseAmount)
    }
  })
})
const lastColumn = computed(() => columns.value[columns.value.length - 1] ?? null)
const activeColumn = computed(() => activeIndex.value === null ? null : columns.value[activeIndex.value] ?? null)
/** El detalle se centra sobre el mes, sin salirse del marco en los extremos. */
const tooltipLeftPercent = computed(() => activeColumn.value ? Math.min(82, Math.max(18, activeColumn.value.centerX / chartWidth.value * 100)) : 0)
</script>

<template>
  <div class="cash-flow-chart">
    <ul
      class="cash-flow-legend"
      aria-label="Series"
    >
      <li><span class="legend-swatch is-income" />Ingresos</li>
      <li><span class="legend-swatch is-expense" />Gastos</li>
    </ul>
    <div
      ref="plotElement"
      class="cash-flow-plot"
    >
      <svg
        :viewBox="'0 0 ' + chartWidth + ' ' + chartHeight"
        role="group"
        :aria-labelledby="chartId + '-title'"
        :aria-describedby="chartId + '-description'"
        @mouseleave="activeIndex = null"
      >
        <title :id="chartId + '-title'">{{ accessibleTitle }}</title>
        <desc :id="chartId + '-description'">{{ accessibleDescription }}</desc>
        <g aria-hidden="true">
          <g
            v-for="tick in ticks"
            :key="tick"
          >
            <line
              :x1="marginLeft"
              :x2="chartWidth - marginRight"
              :y1="scaleY(tick)"
              :y2="scaleY(tick)"
              :class="tick === 0 ? 'chart-baseline' : 'chart-grid'"
            />
            <text
              :x="marginLeft - 8"
              :y="scaleY(tick) + 4"
              text-anchor="end"
              class="chart-tick"
            >{{ formatCompactMoney(tick) }}</text>
          </g>
          <g
            v-for="(column, index) in columns"
            :key="column.monthKey"
            :class="{ 'is-dimmed': activeIndex !== null && activeIndex !== index }"
          >
            <rect
              :x="column.incomeX"
              :y="column.incomeY"
              :width="column.barWidth"
              :height="column.incomeHeight"
              class="bar-income"
            />
            <rect
              :x="column.expenseX"
              :y="column.expenseY"
              :width="column.barWidth"
              :height="column.expenseHeight"
              class="bar-expense"
            />
            <text
              :x="column.centerX"
              :y="chartHeight - 8"
              text-anchor="middle"
              class="chart-tick"
            >{{ column.label }}</text>
          </g>
          <text
            v-if="lastColumn && Number(lastColumn.incomeAmount) > 0"
            :x="lastColumn.incomeX + lastColumn.barWidth / 2"
            :y="lastColumn.incomeY - 6"
            text-anchor="middle"
            class="chart-value"
          >{{ formatCompactMoney(Number(lastColumn.incomeAmount)) }}</text>
        </g>
        <!-- Áreas de toque: más grandes que la columna, enfocables y con el resumen del mes como nombre accesible. -->
        <rect
          v-for="(column, index) in columns"
          :key="'hit-' + column.monthKey"
          :x="column.slotX"
          :y="marginTop"
          :width="column.slotWidth"
          :height="plotHeight"
          class="chart-hit"
          tabindex="0"
          role="img"
          :aria-label="column.summary"
          @mouseenter="activeIndex = index"
          @focus="activeIndex = index"
          @blur="activeIndex = null"
        />
      </svg>
      <div
        v-if="activeColumn"
        class="cash-flow-tooltip"
        :style="{ left: tooltipLeftPercent + '%' }"
        aria-hidden="true"
      >
        <strong>{{ activeColumn.fullLabel }}</strong>
        <span><span class="legend-swatch is-income" />Ingresos <b>{{ formatMoney(activeColumn.incomeAmount) }}</b></span>
        <span><span class="legend-swatch is-expense" />Gastos <b>{{ formatMoney(activeColumn.expenseAmount) }}</b></span>
        <span>Neto <b :class="{ 'tone-error': activeColumn.netAmount.startsWith('-') }">{{ formatMoney(activeColumn.netAmount) }}</b></span>
      </div>
    </div>
    <!-- Vista de tabla para lectores de pantalla: las cifras exactas de cada mes. -->
    <table class="sr-only">
      <caption>{{ accessibleTitle }}</caption>
      <thead><tr><th>Mes</th><th>Ingresos</th><th>Gastos</th><th>Neto</th></tr></thead>
      <tbody>
        <tr
          v-for="column in columns"
          :key="'row-' + column.monthKey"
        >
          <th>{{ column.fullLabel }}</th><td>{{ formatMoney(column.incomeAmount) }}</td><td>{{ formatMoney(column.expenseAmount) }}</td><td>{{ formatMoney(column.netAmount) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
/* Colores de las series validados con el script de la skill dataviz (contraste ≥ 3:1 contra el papel de cada tema).
   Ingresos usan el color principal elegido (ADR-039): todos los presets superan 4.5:1 contra el papel. */
/* Dos filas: leyenda y área de la gráfica; el área se estira al alto disponible (el mosaico bento lo reparte). */
.cash-flow-chart { --chartIncomeColor: var(--accentColor); --chartExpenseColor: #8A8A84; display: grid; grid-template-rows: auto minmax(0, 1fr); gap: 8px; min-width: 0; min-height: 0; }
.cash-flow-legend { display: flex; flex-wrap: wrap; gap: 16px; margin: 0; padding: 0; list-style: none; font-size: 12px; color: var(--mutedTextColor); }
.cash-flow-legend li { display: inline-flex; align-items: center; gap: 6px; }
.legend-swatch { display: inline-block; flex: none; width: 10px; height: 10px; }
.legend-swatch.is-income { background: var(--chartIncomeColor); }
.legend-swatch.is-expense { background: var(--chartExpenseColor); }
/* El SVG va en posición absoluta para no aportar alto propio: así medir el área no realimenta su tamaño. */
.cash-flow-plot { position: relative; min-width: 0; min-height: var(--chartMinimumHeight, 240px); }
.cash-flow-plot svg { position: absolute; inset: 0; display: block; width: 100%; height: 100%; overflow: visible; }
.chart-grid { stroke: var(--hairlineColor); stroke-width: 1; }
.chart-baseline { stroke: var(--borderColor); stroke-width: 2; }
.chart-tick { font-family: var(--monoFontFamily); font-size: 12px; fill: var(--mutedTextColor); font-variant-numeric: tabular-nums; }
.chart-value { font-family: var(--monoFontFamily); font-size: 12px; font-weight: 700; fill: var(--textColor); }
.bar-income { fill: var(--chartIncomeColor); }
.bar-expense { fill: var(--chartExpenseColor); }
.is-dimmed { opacity: .35; }
.chart-hit { fill: transparent; cursor: default; outline: none; }
.chart-hit:focus-visible { stroke: var(--focusColor); stroke-width: 3; }
.cash-flow-tooltip { position: absolute; top: 0; transform: translateX(-50%); display: grid; gap: 2px; min-width: 170px; padding: 8px 10px; border: 2px solid var(--borderColor); background: var(--surfaceColor); box-shadow: var(--buttonShadow); font-size: 12px; pointer-events: none; z-index: 1; }
.cash-flow-tooltip strong { font-weight: 800; text-transform: capitalize; }
.cash-flow-tooltip span { display: flex; align-items: center; gap: 6px; color: var(--mutedTextColor); }
.cash-flow-tooltip b { margin-left: auto; color: var(--textColor); font-family: var(--monoFontFamily); font-variant-numeric: tabular-nums; }
.cash-flow-tooltip b.tone-error { color: var(--errorColor); }
@media (prefers-reduced-motion: no-preference) { .cash-flow-plot g { transition: opacity var(--durationQuick) ease; } }
</style>
