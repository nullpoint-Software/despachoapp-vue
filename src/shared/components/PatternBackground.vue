<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { drawBackgroundPattern, type CanvasPatternStyle } from './backgroundPatterns'
import { readColorToken, useBackgroundMotion } from './backgroundMotion'

/**
 * Fondo de la mesa con un patrón Canvas 2D (ADR-039): Dot Grid, Squares, Waves, Threads, Hyperspeed, Grid Distortion,
 * Ribbons o Iridescence (ver `backgroundPatterns.ts`).
 * Mismo contrato que `AnimatedBackground` (Dither): clase `.animated-background`, `aria-hidden`, sin eventos de puntero y
 * `data-motion` / `data-background` para las pruebas.
 * Costo acotado: ~20 fps, devicePixelRatio máximo 1.5, dibujo agrupado (ver el presupuesto en backgroundPatterns.ts) y nada
 * se dibuja con la ventana sin foco u oculta, pausado o con movimiento reducido (queda el cuadro fijo).
 * Sin puntero (2026-10-13): el fondo ya no escucha `pointermove`; la interacción con el ratón causaba las caídas de fps.
 */
const props = defineProps<{ pattern: CanvasPatternStyle; isPaused: boolean }>()
const canvasElement = ref<HTMLCanvasElement | null>(null)
const maximumPixelRatio = 1.5
let context: CanvasRenderingContext2D | null = null
let width = 0, height = 0
let inkColor = '#0B0B0B', accentColor = '#1F3BD6'

function render(timeMilliseconds: number): void {
  if (!context) return
  drawBackgroundPattern(context, props.pattern, { width, height, timeSeconds: timeMilliseconds / 1000, inkColor, accentColor, opacityScale: 1 })
}
const { motionState, start, stop, renderStill } = useBackgroundMotion({
  isPaused: () => props.isPaused,
  frameIntervalMilliseconds: 50,
  isAvailable: () => context !== null,
  render,
  onAppearanceChange: () => { readColors(); renderStill() }
})
function readColors(): void { inkColor = readColorToken('--textColor', inkColor); accentColor = readColorToken('--accentColor', accentColor) }
function resize(): void {
  const canvas = canvasElement.value
  if (!canvas || !context) return
  const pixelRatio = Math.min(window.devicePixelRatio || 1, maximumPixelRatio)
  width = canvas.clientWidth; height = canvas.clientHeight
  canvas.width = Math.max(1, Math.round(width * pixelRatio)); canvas.height = Math.max(1, Math.round(height * pixelRatio))
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  renderStill()
}

onMounted(() => {
  context = canvasElement.value?.getContext('2d') ?? null
  readColors()
  window.addEventListener('resize', resize)
  resize()
  start()
})
// Cambiar de un patrón Canvas a otro reutiliza el lienzo: basta con redibujar el cuadro vigente.
watch(() => props.pattern, renderStill)
onBeforeUnmount(() => {
  stop()
  window.removeEventListener('resize', resize)
  context = null
})
</script>
<template>
  <div
    class="animated-background"
    aria-hidden="true"
    :data-background="props.pattern"
    :data-motion="motionState"
  >
    <canvas
      ref="canvasElement"
      class="pattern-canvas"
    />
  </div>
</template>
<style scoped>
.pattern-canvas { display: block; width: 100%; height: 100%; image-rendering: auto; }
</style>
