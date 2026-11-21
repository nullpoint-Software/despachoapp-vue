<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, useId, watch } from 'vue'

/**
 * Hold Button de Vue Bits (https://vue-bits.dev/r/HoldButton.json), adaptado como código propio (ADR-025):
 * sin Tailwind, con los tokens monocromos y el rojo de error, textos en español y movimiento reducido.
 * Mantener presionado (ratón, toque, Espacio o Intro) llena el botón; al completarse emite `hold`. Soltar antes
 * lo vacía. Un clic corto emite `tap` y muestra durante un momento "Mantén presionado…".
 * Uso: todas las acciones de eliminar de la aplicación (pulido 2026-10-03). Si la acción pide contraseña, el
 * llamador abre su diálogo al recibir `hold`; el Host sigue exigiéndola.
 * Aspecto (2026-10-10, botones parejos): el mismo bloque que ActionButton `danger` (marco rojo de 2 px, sombra dura roja,
 * peso 700 y alto de control); mantener presionado lo hunde como un sello en lugar de escalarlo. `isIconOnly` es un
 * cuadro con marco y sombra (no un icono suelto) y su `title` nombra la acción.
 */
const props = withDefaults(defineProps<{ doneLabel?: string; holdMilliseconds?: number; isDisabled?: boolean; size?: 'small' | 'medium'; ariaLabel?: string; isIconOnly?: boolean }>(),
  { doneLabel: 'Listo', holdMilliseconds: 1200, isDisabled: false, size: 'medium', ariaLabel: undefined, isIconOnly: false })
const emit = defineEmits<{ hold: []; tap: [] }>()

type Phase = 'idle' | 'holding' | 'done'
const tapMilliseconds = 250, releaseMilliseconds = 200, resetMilliseconds = 900, hitPadding = 10
const phase = ref<Phase>('idle'), isHinting = ref(false)
const button = ref<HTMLButtonElement | null>(null)
const hintId = useId()
const gesture = { pointerId: null as number | null, start: 0, rect: null as DOMRect | null }
const motion = { frame: 0, progress: 0, from: 0, to: 0, start: 0 }
let completeTimer = 0, resetTimer = 0, hintTimer = 0, inputKind: 'pointer' | 'key' | null = null
let resizeObserver: ResizeObserver | null = null

function setProgress(value: number): void { motion.progress = value; button.value?.style.setProperty('--hold-progress', value.toFixed(4)) }
/** Avanza el relleno con requestAnimationFrame; al llegar a 1 completa la acción. */
function drive(to: number, duration: number, ease: (value: number) => number): void {
  cancelAnimationFrame(motion.frame)
  motion.from = motion.progress; motion.to = to; motion.start = performance.now()
  const step = (now: number) => {
    const ratio = duration > 0 ? Math.min(1, (now - motion.start) / duration) : 1
    setProgress(motion.from + (motion.to - motion.from) * ease(ratio))
    if (ratio < 1) { motion.frame = requestAnimationFrame(step); return }
    motion.frame = 0
    if (motion.to === 1) complete()
  }
  motion.frame = requestAnimationFrame(step)
}
const linear = (value: number) => value
const easeOut = (value: number) => 1 - Math.pow(1 - value, 3)
function clearTimers(): void { clearTimeout(completeTimer); clearTimeout(resetTimer) }
function complete(): void {
  if (phase.value !== 'holding' || performance.now() - gesture.start < props.holdMilliseconds - 50) return
  clearTimers(); phase.value = 'done'; emit('hold')
  resetTimer = window.setTimeout(() => { phase.value = 'idle'; drive(0, releaseMilliseconds, easeOut) }, resetMilliseconds)
}
function begin(kind: 'pointer' | 'key'): boolean {
  if (props.isDisabled || phase.value !== 'idle' || !button.value) return false
  gesture.start = performance.now(); gesture.rect = button.value.getBoundingClientRect()
  phase.value = 'holding'; inputKind = kind; isHinting.value = false
  drive(1, props.holdMilliseconds, linear)
  completeTimer = window.setTimeout(complete, props.holdMilliseconds + 100)
  return true
}
function release(isDrifted = false): void {
  if (phase.value !== 'holding') return
  clearTimers()
  const held = performance.now() - gesture.start
  phase.value = 'idle'; inputKind = null
  drive(0, releaseMilliseconds, easeOut)
  if (!isDrifted && held < tapMilliseconds) {
    emit('tap')
    isHinting.value = true; clearTimeout(hintTimer); hintTimer = window.setTimeout(() => { isHinting.value = false }, 1400)
  }
}
function onPointerDown(event: PointerEvent): void {
  if (event.button !== 0 || !event.isPrimary || gesture.pointerId !== null || !begin('pointer')) return
  gesture.pointerId = event.pointerId
  try { (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId) } catch { /* Sin captura: se suelta al salir. */ }
}
function endPointer(event: PointerEvent, isDrifted = false): void {
  if (event.pointerId !== gesture.pointerId) return
  gesture.pointerId = null
  const element = event.currentTarget as HTMLElement
  try { if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId) } catch { /* Ya liberada. */ }
  release(isDrifted)
}
function onPointerMove(event: PointerEvent): void {
  const rect = gesture.rect
  if (event.pointerId !== gesture.pointerId || !rect) return
  if (event.clientX < rect.left - hitPadding || event.clientX > rect.right + hitPadding || event.clientY < rect.top - hitPadding || event.clientY > rect.bottom + hitPadding) endPointer(event, true)
}
function onKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Escape') { if (inputKind === 'key') release(true); return }
  if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); if (!event.repeat) begin('key') }
}
function onKeyUp(event: KeyboardEvent): void {
  if ((event.key === ' ' || event.key === 'Enter') && inputKind === 'key') { event.preventDefault(); release() }
}
// Perder el foco de la ventana a media pulsación cancela: nunca se elimina "solo".
watch(phase, (next, _previous, onCleanup) => {
  if (next !== 'holding') return
  const cancel = () => release(true)
  const onVisibility = () => { if (document.hidden) cancel() }
  window.addEventListener('blur', cancel); document.addEventListener('visibilitychange', onVisibility)
  onCleanup(() => { window.removeEventListener('blur', cancel); document.removeEventListener('visibilitychange', onVisibility) })
})
onMounted(() => {
  const element = button.value
  if (!element) return
  const measure = () => { element.style.setProperty('--hold-width', element.offsetWidth + 'px'); element.style.setProperty('--hold-height', element.offsetHeight + 'px') }
  measure(); resizeObserver = new ResizeObserver(measure); resizeObserver.observe(element)
})
onUnmounted(() => { resizeObserver?.disconnect(); clearTimers(); clearTimeout(hintTimer); cancelAnimationFrame(motion.frame) })
const seconds = computed(() => (Math.round(props.holdMilliseconds / 100) / 10).toLocaleString('es-MX'))
</script>

<template>
  <button
    ref="button"
    type="button"
    class="hold-button"
    :class="['hold-' + size, { 'hold-icon-only': isIconOnly }]"
    :title="isIconOnly ? (isHinting ? 'Mantén presionado' : ariaLabel) : undefined"
    :disabled="isDisabled"
    :data-phase="phase"
    :aria-label="ariaLabel"
    :aria-describedby="hintId"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="endPointer($event)"
    @pointercancel="endPointer($event, true)"
    @lostpointercapture="endPointer($event, true)"
    @pointerleave="$event.pointerType !== 'touch' && endPointer($event, true)"
    @keydown="onKeyDown"
    @keyup="onKeyUp"
    @contextmenu.prevent
  >
    <span class="hold-label">
      <span
        class="hold-idle"
        :aria-hidden="phase === 'done'"
      ><slot name="icon" /><template v-if="!isIconOnly"><template v-if="isHinting">Mantén presionado…</template><slot v-else>Eliminar</slot></template></span>
      <span
        class="hold-done"
        :aria-hidden="phase !== 'done'"
      ><template v-if="!isIconOnly">{{ doneLabel }}</template><template v-else>✓</template></span>
    </span>
    <span
      class="hold-fill"
      aria-hidden="true"
    >
      <span class="hold-label">
        <span class="hold-idle"><slot name="icon" /><template v-if="!isIconOnly"><template v-if="isHinting">Mantén presionado…</template><slot v-else>Eliminar</slot></template></span>
        <span class="hold-done"><template v-if="!isIconOnly">{{ doneLabel }}</template><template v-else>✓</template></span>
      </span>
    </span>
    <span
      :id="hintId"
      class="sr-only"
    >Mantén presionado {{ seconds }} segundos para confirmar</span>
  </button>
</template>

<style scoped>
/*
 * `flex: none` (2026-10-19): con `overflow: hidden`, un elemento flex puede encogerse por debajo de su texto; junto a
 * una descripción larga (renglones de obligaciones) el botón quedaba cortado contra su borde.
 */
.hold-button { --hold-progress: 0; --hold-width: 0px; --hold-height: 0px; flex: none; position: relative; isolation: isolate; display: inline-grid; place-items: center; min-height: var(--controlHeight); padding: 8px 16px; border: 2px solid var(--errorColor); border-radius: 0; background: var(--surfaceColor); color: var(--errorColor); box-shadow: 3px 3px 0 var(--errorColor); font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; user-select: none; touch-action: manipulation; -webkit-tap-highlight-color: transparent; transition: transform 160ms cubic-bezier(.23, 1, .32, 1), box-shadow 160ms cubic-bezier(.23, 1, .32, 1), background-color 160ms ease; overflow: hidden; }
/* Chico: para renglones densos; conserva marco y sombra (2 px) para no verse distinto de sus vecinos. */
.hold-button.hold-small { min-height: 32px; padding: 4px 12px; font-size: 13px; box-shadow: 2px 2px 0 var(--errorColor); }
.hold-button.hold-icon-only { min-height: 0; width: 36px; height: 36px; padding: 0; box-shadow: 2px 2px 0 var(--errorColor); }
.hold-button.hold-icon-only.hold-small { width: 32px; height: 32px; }
.hold-button:hover:not(:disabled) { background: var(--errorFill); }
.hold-button:focus-visible { outline: 3px solid var(--focusColor); outline-offset: 2px; }
.hold-button[data-phase="holding"], .hold-button[data-phase="done"] { transform: translate(2px, 2px); box-shadow: 0 0 0 var(--errorColor); }
.hold-button:disabled { cursor: not-allowed; opacity: .5; box-shadow: none; }
.hold-label { display: grid; place-items: center; }
.hold-idle, .hold-done { grid-area: 1 / 1; display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; transition: opacity 200ms ease, filter 200ms ease; }
.hold-done { opacity: 0; filter: blur(2px); }
.hold-button[data-phase="done"] .hold-idle { opacity: 0; filter: blur(2px); }
.hold-button[data-phase="done"] .hold-done { opacity: 1; filter: none; }
/* Relleno rojo que avanza de izquierda a derecha con el progreso; su texto blanco queda recortado. */
.hold-fill { position: absolute; inset: 0; display: grid; place-items: center; background: var(--errorColor); color: #FFFFFF; pointer-events: none; clip-path: inset(0 calc((1 - var(--hold-progress)) * 100%) 0 0); }
@media (prefers-reduced-motion: reduce) {
  .hold-button { transform: none !important; transition: border-color 160ms ease; }
  .hold-fill { clip-path: inset(0); opacity: var(--hold-progress); }
  .hold-idle, .hold-done { filter: none !important; }
}
</style>
