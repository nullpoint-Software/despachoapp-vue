<script setup lang="ts">
import { animate, motionValue, useReducedMotion, type AnimationPlaybackControls } from 'motion-v'
import { onMounted, onUnmounted, ref, watch, watchPostEffect } from 'vue'

/**
 * Spring Check de Vue Bits (https://vue-bits.dev/r/SpringCheck.json), adaptado como código propio (ADR-025):
 * sin Tailwind ni íconos externos, con los tokens monocromos y movimiento reducido. Un resorte llena la casilla,
 * dibuja la palomita y (si hay texto en el slot) atenúa y tacha el texto.
 * En las notas (pulido 2026-10-03) se usa sólo la casilla: el texto de la tarea es contenido editable que se
 * tacha con CSS según `data-checked`.
 */
const props = withDefaults(defineProps<{ isChecked: boolean; isDisabled?: boolean; ariaLabel?: string; boxSize?: number }>(), { isDisabled: false, ariaLabel: undefined, boxSize: 20 })
const emit = defineEmits<{ change: [isChecked: boolean] }>()
const swell = 0.35, doneOpacity = 0.45, strikeLag = 0.12, ruleEnd = 0.84
const clamp = (value: number) => Math.min(1, Math.max(0, value))
const reduceMotion = useReducedMotion()
const progress = motionValue(props.isChecked ? 1 : 0)
const box = ref<HTMLSpanElement | null>(null), fill = ref<HTMLSpanElement | null>(null), tick = ref<SVGPathElement | null>(null)
const word = ref<HTMLSpanElement | null>(null), rule = ref<HTMLSpanElement | null>(null)
let controls: AnimationPlaybackControls | null = null, stopListening: (() => void) | undefined, isPointerToggle = false

/** El relleno, la palomita y el tachado siguen al resorte directamente, sin esperar a Vue. */
function paint(): void {
  const value = progress.get(), held = clamp(value)
  if (fill.value) fill.value.style.transform = 'scale(' + Math.max(value, 0) + ')'
  if (box.value) box.value.style.transform = 'scale(' + (1 + swell * Math.max(0, value - 1)) + ')'
  if (tick.value) tick.value.style.strokeDashoffset = String(1 - held)
  if (word.value) word.value.style.opacity = String(1 - (1 - doneOpacity) * held)
  if (rule.value) rule.value.style.transform = 'scaleX(' + clamp((held - strikeLag) / (ruleEnd - strikeLag)) + ')'
}
watchPostEffect(paint)
onMounted(() => { stopListening = progress.on('change', paint); paint() })
onUnmounted(() => { stopListening?.(); controls?.stop() })
watch(() => props.isChecked, isChecked => {
  const target = isChecked ? 1 : 0
  controls?.stop()
  // Con teclado o con movimiento reducido el cambio es inmediato; con el ratón, con resorte.
  if (reduceMotion.value || !isPointerToggle) { progress.jump(target); isPointerToggle = false; return }
  isPointerToggle = false
  controls = animate(progress, target, { type: 'spring', visualDuration: 0.2, bounce: 0.35 })
}, { flush: 'post' })
function markPointerToggle(): void { isPointerToggle = true }
function toggle(): void { if (!props.isDisabled) emit('change', !props.isChecked) }
</script>

<template>
  <button
    type="button"
    role="checkbox"
    class="spring-check"
    :aria-checked="isChecked"
    :aria-label="ariaLabel"
    :disabled="isDisabled"
    :style="{ '--spring-box': boxSize + 'px' }"
    contenteditable="false"
    @pointerdown="markPointerToggle"
    @mousedown.prevent
    @click="toggle"
  >
    <span class="spring-box">
      <span
        ref="box"
        class="spring-inner"
      >
        <span
          class="spring-ring"
          aria-hidden="true"
        />
        <span
          ref="fill"
          class="spring-fill"
          style="transform: scale(0)"
        />
        <svg
          class="spring-tick"
          viewBox="0 0 24 24"
          aria-hidden="true"
        ><path
          ref="tick"
          d="M5 12.5l4.5 4.5L19 7"
          pathLength="1"
          stroke-dasharray="1"
          style="stroke-dashoffset: 1"
        /></svg>
      </span>
    </span>
    <span
      v-if="$slots.default"
      class="spring-text"
    >
      <span ref="word"><slot /></span>
      <span
        ref="rule"
        class="spring-rule"
        aria-hidden="true"
        style="transform: scaleX(0)"
      />
    </span>
  </button>
</template>

<style scoped>
.spring-check { display: inline-flex; align-items: center; gap: 10px; padding: 0; border: 0; background: transparent; color: var(--textColor); cursor: pointer; font: inherit; user-select: none; -webkit-tap-highlight-color: transparent; }
.spring-check:disabled { opacity: .5; cursor: not-allowed; }
.spring-box { flex: none; width: var(--spring-box); height: var(--spring-box); border-radius: 0; transition: transform 160ms cubic-bezier(.23, 1, .32, 1); }
.spring-check:active .spring-box { transform: scale(.92); }
.spring-check:focus-visible .spring-box { outline: 2px solid var(--focusColor); outline-offset: 3px; }
.spring-inner { position: relative; display: grid; place-items: center; width: 100%; height: 100%; border-radius: inherit; overflow: hidden; }
.spring-ring { position: absolute; inset: 0; border-radius: inherit; box-shadow: inset 0 0 0 1.5px var(--textColor); opacity: .35; transition: opacity 120ms ease; }
.spring-check:hover .spring-ring { opacity: .6; }
.spring-fill { position: absolute; inset: 0; border-radius: inherit; background: var(--textColor); }
.spring-tick { position: relative; width: 72%; height: 72%; fill: none; stroke: var(--surfaceColor); stroke-width: 2.8; stroke-linecap: round; stroke-linejoin: round; overflow: visible; }
.spring-text { position: relative; display: inline-block; }
.spring-rule { position: absolute; inset-inline: 0; top: 50%; height: 1.5px; background: currentColor; transform-origin: left center; pointer-events: none; }
</style>
