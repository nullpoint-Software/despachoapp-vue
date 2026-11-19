<script setup lang="ts">
import type { DueDay } from './homeDashboardMetrics'

/**
 * "Vence esta semana" del tablero de Inicio (bento, 2026-10-06): una casilla por día, de hoy a seis días después,
 * con cuántas tareas abiertas visibles vencen ese día. Sale de la lista de tareas que el tablero ya consulta.
 *
 * - Se lee como un calendario de escritorio: rótulo mono del día, número del día y la cifra de tareas.
 * - Un día con vencimientos se marca con una franja superior en el acento y la cifra en tinta; uno sin vencimientos
 *   queda en gris. La marca acompaña a la cifra: nunca es la única señal.
 * - Hoy lleva el rótulo "Hoy" en lugar del nombre del día.
 * - Lista accesible: cada casilla se lee como "lunes 6: 2 tareas".
 */
defineProps<{ days: DueDay[] }>()
</script>

<template>
  <ol
    class="due-week"
    aria-label="Tareas que vencen en los próximos 7 días"
  >
    <li
      v-for="day in days"
      :key="day.businessDate"
      class="due-day"
      :class="{ 'has-tasks': day.taskCount > 0, 'is-today': day.isToday }"
    >
      <span class="sr-only">{{ day.weekdayName }} {{ day.dayNumber }}: {{ day.taskCount }} {{ day.taskCount === 1 ? 'tarea' : 'tareas' }}</span>
      <span
        class="due-weekday"
        aria-hidden="true"
      >{{ day.isToday ? 'Hoy' : day.weekdayLabel }}</span>
      <span
        class="due-number"
        aria-hidden="true"
      >{{ day.dayNumber }}</span>
      <span
        class="due-count"
        aria-hidden="true"
      >{{ day.taskCount || '·' }}</span>
    </li>
  </ol>
</template>

<style scoped>
/* Siete casillas que se reparten el ancho; bajo ~330 px pasan a dos filas sin desbordar. */
.due-week { display: grid; grid-template-columns: repeat(auto-fit, minmax(42px, 1fr)); gap: 6px; margin: 0; padding: 0; list-style: none; }
.due-day { position: relative; display: grid; justify-items: center; gap: 2px; padding: 8px 2px 6px; border: 2px solid var(--hairlineColor); background: var(--surfaceColor); }
.due-day.is-today { border-color: var(--borderColor); }
.due-day.has-tasks { border-top: 6px solid var(--accentColor); padding-top: 4px; }
.due-weekday { font-family: var(--monoFontFamily); font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--mutedTextColor); }
.due-number { font-size: 13px; color: var(--mutedTextColor); font-variant-numeric: tabular-nums; }
.due-count { font-family: var(--monoFontFamily); font-size: 20px; font-weight: 800; line-height: 1.1; font-variant-numeric: tabular-nums; color: var(--mutedTextColor); }
.due-day.has-tasks .due-count { color: var(--textColor); }
</style>
