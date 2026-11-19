<script setup lang="ts">
import { computed } from 'vue'
import type { PipelineStage } from './homeDashboardMetrics'

/**
 * Embudo de tareas del tablero de Inicio (2026-10-06): una barra horizontal por etapa, en el orden en que avanza
 * el trabajo (sin responsable → pendiente → en progreso → completada hoy).
 * - Es una sola serie: un solo color (el azul de sello) y sin leyenda; el rótulo de cada fila nombra la etapa.
 * - Las barras se escalan a la etapa mayor; la cifra va al final de cada barra, en tinta, nunca en el color de la serie.
 * - Se dibuja con HTML (no SVG) para que los rótulos se acomoden solos hasta 480 px de ancho.
 * - La lista lleva nombre accesible y cada fila se lee como "Etapa: N tareas" (la barra es decorativa).
 */
const props = defineProps<{ stages: PipelineStage[] }>()
const maximumCount = computed(() => Math.max(1, ...props.stages.map(stage => stage.taskCount)))
</script>

<template>
  <ol
    class="task-pipeline"
    aria-label="Tareas por etapa"
  >
    <li
      v-for="stage in stages"
      :key="stage.stageKey"
    >
      <span class="pipeline-label">{{ stage.label }}<span class="sr-only">: {{ stage.taskCount }} {{ stage.taskCount === 1 ? 'tarea' : 'tareas' }}</span></span>
      <span
        class="pipeline-track"
        aria-hidden="true"
      >
        <span
          class="pipeline-bar"
          :style="{ width: stage.taskCount ? Math.max(2, stage.taskCount / maximumCount * 100) + '%' : '0' }"
        />
        <span class="pipeline-count">{{ stage.taskCount }}</span>
      </span>
    </li>
  </ol>
</template>

<style scoped>
.task-pipeline { display: grid; gap: 10px; margin: 0; padding: 0; list-style: none; }
.task-pipeline li { display: grid; grid-template-columns: minmax(7.5rem, 32%) minmax(0, 1fr); align-items: center; gap: 12px; }
.pipeline-label { font-family: var(--monoFontFamily); font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--mutedTextColor); }
.pipeline-track { display: flex; align-items: center; gap: 8px; min-width: 0; padding-bottom: 2px; border-bottom: 1px solid var(--hairlineColor); }
.pipeline-bar { display: block; height: 20px; max-width: calc(100% - 3.5ch); background: var(--accentColor); }
.pipeline-count { flex: none; font-family: var(--monoFontFamily); font-size: 15px; font-weight: 800; font-variant-numeric: tabular-nums; color: var(--textColor); }
@media (prefers-reduced-motion: no-preference) { .pipeline-bar { transition: width var(--durationFast) var(--easeSmoothOut); } }
@media (max-width: 480px) { .task-pipeline li { grid-template-columns: minmax(0, 1fr); gap: 4px; } }
</style>
