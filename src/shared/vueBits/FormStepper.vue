<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { gsap } from 'gsap'
import { Check } from '@lucide/vue'
import ActionButton from '../components/ActionButton.vue'

/**
 * Stepper de Vue Bits adaptado como FormStepper (rediseño de Clientes, ADR-032), sin Tailwind y con los tokens de la app:
 * - Indicadores numerados unidos por una línea que se llena al avanzar; un paso terminado muestra ✓ y se puede
 *   volver a él con un clic. No se salta hacia adelante: cada paso se valida con `validate` antes de avanzar.
 * - El contenido entra desde el lado hacia el que se avanza y la altura se ajusta suavemente (GSAP, 260 ms).
 *   Con movimiento reducido no hay animación.
 * - Al pie: "Atrás" y "Continuar"; en el último paso el botón principal dice `completeLabel` y emite `complete`.
 * El paso actual es `v-model` para que el formulario pueda mandar al paso de un campo con error.
 * `canContinue` (por omisión true) desactiva "Continuar" mientras el paso actual no puede avanzar (p. ej. un bloqueo).
 */
export interface StepperStep { stepId: string; title: string; description?: string }
// canComplete vale true si no se pasa: Vue convierte un booleano ausente en false.
const props = withDefaults(defineProps<{ steps: StepperStep[]; completeLabel: string; isBusy?: boolean; validate?: (index: number) => boolean; canComplete?: boolean; canContinue?: boolean }>(), { canComplete: true, canContinue: true, validate: () => true })
const emit = defineEmits<{ complete: [] }>()
const current = defineModel<number>({ default: 0 })
const content = ref<HTMLElement | null>(null)
const media = gsap.matchMedia()
let isReducedMotion = false
media.add('(prefers-reduced-motion: reduce)', () => { isReducedMotion = true; return () => { isReducedMotion = false } })

/** Altura y dirección: se mide antes y después del cambio de paso para animar sin saltos. */
watch(current, async (next, previous) => {
  const element = content.value
  if (!element || isReducedMotion) return
  const startHeight = element.offsetHeight
  await nextTick()
  const endHeight = element.offsetHeight
  const direction = next > previous ? 1 : -1
  // Sólo se recorta mientras dura la animación: así el anillo de foco y las listas no quedan cortados.
  gsap.fromTo(element, { height: startHeight, overflow: 'hidden' }, { height: endHeight, duration: .26, ease: 'power2.out', clearProps: 'height,overflow' })
  gsap.from(element.firstElementChild, { x: 28 * direction, opacity: 0, duration: .26, ease: 'power2.out', clearProps: 'transform,opacity' })
})

function goTo(index: number): void {
  if (props.isBusy || index === current.value) return
  // Hacia atrás siempre; hacia adelante sólo de uno en uno y con el paso actual válido.
  if (index < current.value) { current.value = index; return }
  if (index === current.value + 1 && (props.validate?.(current.value) ?? true)) current.value = index
}
function advance(): void {
  if (props.isBusy) return
  if (!(props.validate?.(current.value) ?? true)) return
  if (current.value < props.steps.length - 1) current.value++
  else emit('complete')
}
onBeforeUnmount(() => media.revert())
</script>
<template>
  <div class="stepper">
    <ol
      class="stepper-indicators"
      aria-label="Pasos"
    >
      <li
        v-for="(step, index) in steps"
        :key="step.stepId"
        class="stepper-item"
        :data-state="index < current ? 'complete' : index === current ? 'active' : 'pending'"
      >
        <button
          type="button"
          class="stepper-indicator"
          :aria-current="index === current ? 'step' : undefined"
          :aria-label="'Paso ' + (index + 1) + ': ' + step.title + (index < current ? ' (terminado)' : '')"
          :disabled="isBusy || index > current + 1"
          @click="goTo(index)"
        >
          <Check
            v-if="index < current"
            :size="14"
            :stroke-width="2.5"
            aria-hidden="true"
          />
          <span
            v-else
            aria-hidden="true"
          >{{ index + 1 }}</span>
        </button>
        <span class="stepper-title">{{ step.title }}</span>
        <span
          v-if="index < steps.length - 1"
          class="stepper-connector"
          aria-hidden="true"
        ><span class="stepper-connector-fill" /></span>
      </li>
    </ol>
    <div
      ref="content"
      class="stepper-content"
    >
      <div :key="steps[current]?.stepId">
        <slot
          :step="steps[current]"
          :index="current"
        />
      </div>
    </div>
    <div class="stepper-footer">
      <slot name="footer-start" />
      <span class="stepper-spacer" />
      <ActionButton
        v-if="current > 0"
        :disabled="isBusy"
        @click="current--"
      >
        Atrás
      </ActionButton>
      <ActionButton
        variant="primary"
        :is-loading="isBusy && current === steps.length - 1"
        :disabled="isBusy || (current === steps.length - 1 ? canComplete === false : canContinue === false)"
        @click="advance"
      >
        {{ current === steps.length - 1 ? completeLabel : 'Continuar' }}
      </ActionButton>
    </div>
  </div>
</template>
<style scoped>
.stepper { display: grid; gap: 20px; }
.stepper-indicators { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; margin: 0; padding: 0; list-style: none; }
.stepper-item { position: relative; display: grid; justify-items: center; gap: 8px; min-width: 0; text-align: center; }
.stepper-indicator { position: relative; z-index: 1; display: grid; place-items: center; width: 30px; height: 30px; border: 2px solid var(--borderColor); border-radius: 0; background: var(--surfaceColor); color: var(--mutedTextColor); font: inherit; font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; cursor: pointer; transition: background-color 200ms ease, color 200ms ease, border-color 200ms ease, transform 120ms ease; }
.stepper-indicator:disabled { cursor: default; }
.stepper-indicator:not(:disabled):active { transform: scale(.94); }
.stepper-indicator:focus-visible { outline: 2px solid var(--focusColor); outline-offset: 2px; }
.stepper-item[data-state="active"] .stepper-indicator { background: var(--primaryBackgroundColor); color: var(--primaryTextColor); box-shadow: var(--buttonShadow); }
.stepper-item[data-state="complete"] .stepper-indicator { background: var(--inkColor); color: var(--canvasColor); }
.stepper-title { font-family: var(--monoFontFamily); font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--mutedTextColor); overflow-wrap: anywhere; transition: color 200ms ease; }
.stepper-item[data-state="active"] .stepper-title { color: var(--textColor); }
/* La línea va del centro de un indicador al centro del siguiente, por detrás de ambos. */
.stepper-connector { position: absolute; top: 15px; left: calc(50% + 15px); width: calc(100% - 30px); height: 2px; background: var(--hairlineColor); overflow: hidden; }
.stepper-connector-fill { display: block; height: 100%; background: var(--textColor); transform: scaleX(0); transform-origin: left; transition: transform 320ms cubic-bezier(.2, .8, .2, 1); }
.stepper-item[data-state="complete"] .stepper-connector-fill { transform: scaleX(1); }
.stepper-content { min-width: 0; }
.stepper-footer { display: flex; align-items: center; gap: 8px; padding-top: 16px; border-top: 2px solid var(--borderColor); }
.stepper-spacer { flex: 1; }
@media (prefers-reduced-motion: reduce) { .stepper-indicator, .stepper-title, .stepper-connector-fill { transition: none; } }
</style>
