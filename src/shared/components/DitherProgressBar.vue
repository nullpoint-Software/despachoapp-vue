<script setup lang="ts">
import { computed } from 'vue'

/**
 * Barra de carga con **dithering** (pedido del usuario, 2026-10-17; [[../../../docs/15-DESIGN-GUIDELINES]]). Sustituye
 * las líneas de pasos numerados y los `<progress>` nativos de las tareas largas del SAT (CSF, CFDI por el portal y lotes
 * de opiniones).
 *
 * Cómo se dibuja (sólo CSS, sin canvas):
 * - **Hecho:** bloque sólido del color de texto, de 0 a `value / max`.
 * - **Frente** (sólo con `isActive`): una franja de tablero de ajedrez al 50 % que avanza en escalones; es el paso en
 *   curso. Con `prefers-reduced-motion` queda quieta.
 * - **Pendiente:** puntos dispersos al 25 % (un píxel de 2 × 2 por celda de 4 × 4), como el ejemplo del usuario.
 * - **Pasos:** si `max` es pequeño (≤ 12) se marcan las divisiones entre pasos con una línea del color de la superficie.
 * - `tone: 'error'` tiñe la barra con el color de error (la ejecución se detuvo en ese punto).
 * El texto visible (`label`) dice el paso o el conteo; la barra es `role="progressbar"` con `aria-valuetext` igual.
 */
const props = withDefaults(defineProps<{ value: number; max: number; label: string; isActive?: boolean; tone?: 'default' | 'error' }>(),
  { isActive: false, tone: 'default' })

const maximumMarkedSteps = 12
const safeMax = computed(() => Math.max(1, props.max))
const donePercent = computed(() => Math.min(100, Math.max(0, props.value / safeMax.value * 100)))
/** El frente ocupa un paso cuando hay pocos; con muchos (lotes) es una franja fija de 6 %. */
const frontPercent = computed(() => props.isActive && donePercent.value < 100 ? Math.min(100 - donePercent.value, safeMax.value <= maximumMarkedSteps ? 100 / safeMax.value : 6) : 0)
const hasStepMarks = computed(() => safeMax.value > 1 && safeMax.value <= maximumMarkedSteps)
</script>

<template>
  <div
    class="dither-progress"
    :class="{ 'is-error': tone === 'error' }"
  >
    <div
      class="dither-progress-track"
      role="progressbar"
      :aria-valuemin="0"
      :aria-valuemax="safeMax"
      :aria-valuenow="Math.min(value, safeMax)"
      :aria-valuetext="label"
      :style="{ '--doneWidth': donePercent + '%', '--frontWidth': frontPercent + '%', '--stepWidth': 100 / safeMax + '%' }"
    >
      <span class="dither-progress-done" />
      <span
        v-if="frontPercent"
        class="dither-progress-front"
      />
      <span
        v-if="hasStepMarks"
        class="dither-progress-marks"
      />
    </div>
    <span class="dither-progress-label">{{ label }}</span>
  </div>
</template>

<style scoped>
.dither-progress { --ditherColor: var(--textColor); display: grid; gap: 6px; min-width: 0; }
.dither-progress.is-error { --ditherColor: var(--errorColor); }
/* Pendiente: un píxel de 2 × 2 en cada celda de 4 × 4 (25 %), alineado a píxeles enteros para que no se difumine. */
.dither-progress-track { position: relative; height: 18px; overflow: hidden; border: 2px solid var(--borderColor); background-color: var(--surfaceColor);
  background-image: conic-gradient(var(--ditherColor) 0 25%, transparent 0); background-size: 4px 4px; }
.dither-progress-track > span { position: absolute; inset: 0 auto 0 0; }
.dither-progress-done { width: var(--doneWidth); background: var(--ditherColor); }
/* Frente: tablero de ajedrez al 50 % que camina un píxel por escalón. */
.dither-progress-track > .dither-progress-front { left: var(--doneWidth); width: var(--frontWidth); background-color: var(--surfaceColor);
  background-image: conic-gradient(var(--ditherColor) 0 25%, transparent 0 50%, var(--ditherColor) 0 75%, transparent 0); background-size: 4px 4px;
  animation: dither-walk .6s steps(2) infinite; }
.dither-progress-marks { width: 100%; background-image: repeating-linear-gradient(to right, transparent 0 calc(var(--stepWidth) - 2px), var(--surfaceColor) 0 var(--stepWidth));
  clip-path: inset(0 2px 0 0); /* La última marca caería sobre el borde derecho. */ }
.dither-progress-label { font-family: var(--monoFontFamily); font-size: 12px; color: var(--mutedTextColor); overflow-wrap: anywhere; }
.dither-progress.is-error .dither-progress-label { color: var(--errorColor); }
@keyframes dither-walk { to { background-position: 4px 0; } }
@media (prefers-reduced-motion: reduce) { .dither-progress-front { animation: none; } }
</style>
