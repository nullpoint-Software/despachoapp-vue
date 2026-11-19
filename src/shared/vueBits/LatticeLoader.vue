<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

/**
 * "Lattice Loader" de Vue Bits (MIT + Commons Clause), adaptado para procesos largos (lote de opiniones,
 * conciliación, descargas del SAT, importación de XML):
 * - Retícula 3×3 con el patrón "orbit": las celdas se encienden en onda; al terminar dibuja una palomita
 *   (`done`, verde de estado) o un tache (`error`, rojo de estado).
 * - Etiqueta en español y cronómetro opcional; un aviso `role="status"` anuncia el estado.
 * - Tailwind del original convertido a CSS con alcance y tokens de base.css.
 * - Con movimiento reducido, las celdas parpadean despacio y sin desfase.
 */
type LatticeStatus = 'working' | 'done' | 'error'
const props = withDefaults(defineProps<{ label: string; doneLabel?: string; errorLabel?: string; status?: LatticeStatus; showTimer?: boolean }>(),
  { doneLabel: 'Terminado en', errorLabel: 'Falló después de', status: 'working', showTimer: true })

// Patrón "orbit" 3×3 del original: orden de encendido por celda (null = centro apagado).
const orbitCells: Array<number | null> = [0, 1, 2, 7, null, 3, 6, 5, 4]
const stepMilliseconds = 108, cycleMilliseconds = Math.round(8 * stepMilliseconds)
const marks: Record<'done' | 'error', number[]> = { done: [2, 3, 5, 7], error: [0, 2, 4, 6, 8] }
const elapsedTenths = ref(0)
let clock: ReturnType<typeof setInterval> | undefined
let lastMark: 'done' | 'error' = 'done'
const mark = computed(() => { if (props.status !== 'working') lastMark = props.status; return lastMark })
const announcement = computed(() => props.status === 'working' ? props.label + ', en curso' : (props.status === 'done' ? props.doneLabel : props.errorLabel) + ' ' + formatElapsed(elapsedTenths.value))

function formatElapsed(tenths: number): string { return tenths < 600 ? (tenths / 10).toFixed(1) + ' s' : Math.floor(tenths / 600) + ' min ' + ((tenths % 600) / 10).toFixed(1) + ' s' }
function syncClock(): void {
  clearInterval(clock)
  if (props.status !== 'working') return
  const startedAt = performance.now()
  elapsedTenths.value = 0
  clock = setInterval(() => { elapsedTenths.value = Math.floor((performance.now() - startedAt) / 100) }, 100)
}
onMounted(syncClock)
watch(() => props.status, syncClock)
onBeforeUnmount(() => clearInterval(clock))
</script>
<template>
  <span
    class="lattice-loader"
    :data-status="status"
    :style="{ '--latticeCycle': cycleMilliseconds + 'ms' }"
  >
    <span
      class="lattice-grids"
      aria-hidden="true"
    >
      <span class="lattice-run">
        <span
          v-for="(order, index) in orbitCells"
          :key="index"
          class="lattice-cell"
          :class="{ 'is-hole': order === null }"
          :style="order === null ? undefined : { animationDelay: order * stepMilliseconds + 'ms' }"
        />
      </span>
      <span class="lattice-mark">
        <span
          v-for="(order, index) in orbitCells"
          :key="index"
          class="lattice-cell"
          :class="{ 'is-on': marks[mark].includes(index) }"
        />
      </span>
    </span>
    <span
      class="lattice-label"
      aria-hidden="true"
    >{{ status === 'working' ? label : status === 'done' ? doneLabel : errorLabel }}</span>
    <span
      v-if="showTimer"
      class="lattice-timer"
      aria-hidden="true"
    >{{ formatElapsed(elapsedTenths) }}</span>
    <span
      class="sr-only"
      role="status"
    >{{ announcement }}</span>
  </span>
</template>
<style scoped>
.lattice-loader { --latticeCell: 6px; --latticeGap: 2px; --latticeIdle: .15; display: inline-flex; align-items: center; gap: 9px; font-size: 14px; line-height: 1; color: var(--textColor); }
.lattice-grids { display: grid; flex-shrink: 0; }
.lattice-run, .lattice-mark { grid-area: 1 / 1; display: grid; grid-template-columns: repeat(3, var(--latticeCell)); gap: var(--latticeGap); transition: opacity .2s ease, transform .2s cubic-bezier(.23, 1, .32, 1); }
.lattice-cell { width: var(--latticeCell); height: var(--latticeCell); border-radius: 50%; background: currentColor; opacity: var(--latticeIdle); }
.lattice-run .lattice-cell:not(.is-hole) { animation: lattice-on var(--latticeCycle) infinite cubic-bezier(.77, 0, .175, 1); }
.lattice-run .is-hole { opacity: calc(var(--latticeIdle) * .47); }
.lattice-mark { opacity: 0; transform: scale(.9); }
.lattice-mark .is-on { opacity: 1; }
.lattice-loader[data-status="done"] .lattice-mark .is-on { background: var(--successColor); }
.lattice-loader[data-status="error"] .lattice-mark .is-on { background: var(--errorColor); }
.lattice-loader:not([data-status="working"]) .lattice-run { opacity: 0; }
.lattice-loader:not([data-status="working"]) .lattice-run .lattice-cell { animation-play-state: paused; }
.lattice-loader:not([data-status="working"]) .lattice-mark { opacity: 1; transform: none; }
.lattice-label { font-weight: 500; }
.lattice-timer { font-family: var(--monoFontFamily); font-size: 12px; color: var(--mutedTextColor); font-variant-numeric: tabular-nums; }
@keyframes lattice-on { 0%, 100% { opacity: var(--latticeIdle); } 18%, 42% { opacity: 1; } 62% { opacity: var(--latticeIdle); } }
@media (prefers-reduced-motion: reduce) {
  .lattice-run .lattice-cell:not(.is-hole) { animation-delay: 0ms !important; animation-duration: 1400ms !important; }
  .lattice-mark { transform: none; }
}
</style>
