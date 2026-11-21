<script setup lang="ts">
import { ref } from 'vue'

/**
 * "Spotlight Card" de Vue Bits (MIT + Commons Clause), adaptado: una luz radial que sigue al cursor
 * dentro de la tarjeta. Monocroma (tinta al 6 %, sin color) para no competir con los estados. Es sólo
 * decorativa (`::before` sin eventos); con movimiento reducido no se muestra. Se usa en indicadores.
 * Costo por movimiento (2026-10-13, caídas de fps sobre los fondos animados): la caja se mide al entrar el puntero, no en
 * cada movimiento, y la posición se escribe como variable CSS directa, sin render de Vue.
 */
const card = ref<HTMLElement | null>(null)
const isLit = ref(false)
// shortcut: la caja medida al entrar no sigue un desplazamiento de la página con el puntero quieto encima; se corrige al volver a entrar.
let cardBox = { left: 0, top: 0 }
function onPointerEnter(): void {
  isLit.value = true
  const rectangle = card.value?.getBoundingClientRect()
  if (rectangle) cardBox = { left: rectangle.left, top: rectangle.top }
}
function onPointerMove(event: PointerEvent): void {
  card.value?.style.setProperty('--spotX', event.clientX - cardBox.left + 'px')
  card.value?.style.setProperty('--spotY', event.clientY - cardBox.top + 'px')
}
</script>
<template>
  <div
    ref="card"
    class="spotlight-card"
    :class="{ 'is-lit': isLit }"
    @pointermove="onPointerMove"
    @pointerenter="onPointerEnter"
    @pointerleave="isLit = false"
  >
    <slot />
  </div>
</template>
<style scoped>
.spotlight-card { --spotX: 50%; --spotY: 50%; position: relative; isolation: isolate; overflow: hidden; }
.spotlight-card::before { content: ""; position: absolute; inset: 0; z-index: -1; pointer-events: none; opacity: 0; transition: opacity .3s ease;
  background: radial-gradient(240px circle at var(--spotX) var(--spotY), color-mix(in srgb, var(--textColor) 6%, transparent), transparent 70%); }
.spotlight-card.is-lit::before { opacity: 1; }
@media (prefers-reduced-motion: reduce) { .spotlight-card::before { display: none; } }
</style>
