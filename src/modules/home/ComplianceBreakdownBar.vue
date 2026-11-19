<script setup lang="ts">
import { computed } from 'vue'
import type { ComplianceSegment } from './homeDashboardMetrics'

/**
 * Reparto de la cartera por estado de la opinión de cumplimiento (tablero de Inicio, bento 2026-10-06), con la lista
 * de opiniones que el tablero ya consulta; no hay consultas nuevas.
 *
 * Decisiones (skill dataviz):
 * - Parte de un todo con 4 estados → una barra apilada horizontal. Los colores son los de **estado** del sistema
 *   (éxito, aviso, error y gris para "sin consultar"), reservados para eso; no son una paleta categórica.
 * - 2 px de aire (color del papel) entre segmentos; los segmentos vacíos no se dibujan.
 * - La identidad nunca depende sólo del color: la leyenda, siempre visible, nombra cada estado con su cifra en tinta.
 * - La barra es decorativa para lectores de pantalla; la leyenda es la lista accesible con los números.
 */
const props = defineProps<{ segments: ComplianceSegment[] }>()
const totalCount = computed(() => props.segments.reduce((total, segment) => total + segment.clientCount, 0))
const visibleSegments = computed(() => props.segments.filter(segment => segment.clientCount > 0))
</script>

<template>
  <div class="compliance-breakdown">
    <div
      v-if="totalCount"
      class="breakdown-bar"
      aria-hidden="true"
    >
      <span
        v-for="segment in visibleSegments"
        :key="segment.segmentKey"
        class="breakdown-segment"
        :class="'tone-' + segment.tone"
        :style="{ flexGrow: segment.clientCount }"
      />
    </div>
    <ul
      class="breakdown-legend"
      aria-label="Opiniones por estado"
    >
      <li
        v-for="segment in segments"
        :key="segment.segmentKey"
      >
        <span
          class="breakdown-swatch"
          :class="'tone-' + segment.tone"
          aria-hidden="true"
        />{{ segment.label }} <b>{{ segment.clientCount }}</b>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.compliance-breakdown { display: grid; gap: 8px; min-width: 0; }
.breakdown-bar { display: flex; gap: 2px; height: 14px; background: var(--surfaceColor); }
.breakdown-segment { flex-basis: 0; min-width: 4px; }
.breakdown-legend { display: flex; flex-wrap: wrap; gap: 4px 14px; margin: 0; padding: 0; list-style: none; font-size: 12px; color: var(--mutedTextColor); }
.breakdown-legend li { display: inline-flex; align-items: center; gap: 6px; }
.breakdown-legend b { font-family: var(--monoFontFamily); font-variant-numeric: tabular-nums; color: var(--textColor); }
.breakdown-swatch { display: inline-block; flex: none; width: 10px; height: 10px; }
.tone-success { background: var(--successColor); }
.tone-warning { background: var(--warningColor); }
.tone-error { background: var(--errorColor); }
/* "Sin consultar" no es un estado del cliente: gris de texto secundario atenuado, nunca un color de estado. */
.tone-neutral { background: color-mix(in srgb, var(--mutedTextColor) 45%, transparent); }
</style>
