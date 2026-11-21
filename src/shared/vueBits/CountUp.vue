<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

/**
 * "Count Up" de Vue Bits (MIT + Commons Clause), adaptado. Decisión del usuario (2026-10-03): sólo
 * para **conteos** (usuarios, tareas, opiniones, renglones), **nunca para importes de dinero**.
 * - Resorte amortiguado del original (~0.8 s) desde el valor anterior hasta el nuevo; formato es-MX.
 * - El valor exacto está siempre en `aria-label`; el número animado es sólo visual.
 * - Con `prefers-reduced-motion: reduce` muestra el valor final sin animar.
 */
const props = withDefaults(defineProps<{ value: number; durationSeconds?: number }>(), { durationSeconds: .8 })
const displayedValue = ref(0)
const formatter = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 })
let frameRequest = 0

function animateTo(target: number): void {
  cancelAnimationFrame(frameRequest)
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { displayedValue.value = target; return }
  // Resorte del original: rigidez y amortiguamiento derivados de la duración.
  const stiffness = 100 / props.durationSeconds, damping = 20 + 40 / props.durationSeconds
  let current = displayedValue.value, velocity = 0
  const step = () => {
    const displacement = target - current
    velocity += (displacement * stiffness - velocity * damping) * .016
    current += velocity * .016
    if (Math.abs(displacement) < .5 && Math.abs(velocity) < .5) { displayedValue.value = target; return }
    displayedValue.value = current
    frameRequest = requestAnimationFrame(step)
  }
  frameRequest = requestAnimationFrame(step)
}
onMounted(() => animateTo(props.value))
watch(() => props.value, animateTo)
onBeforeUnmount(() => cancelAnimationFrame(frameRequest))
</script>
<template>
  <span
    class="count-up"
    :aria-label="formatter.format(value)"
  ><span aria-hidden="true">{{ formatter.format(Math.round(displayedValue)) }}</span></span>
</template>
<style scoped>
.count-up { font-variant-numeric: tabular-nums; }
</style>
