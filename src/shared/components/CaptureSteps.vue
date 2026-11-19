<script setup lang="ts">
import { computed } from 'vue'
import FormStepper, { type StepperStep } from '../vueBits/FormStepper.vue'

/**
 * Captura por pasos con revisión final (decisión del usuario, 2026-10-04: toda alta va en el modal de "Nuevo pago",
 * por pasos, y termina en "Revisar"). Envuelve a FormStepper:
 * - `steps` son los pasos de datos; cada uno se pinta con el slot `step-<stepId>`.
 * - Se agrega al final el paso "Revisar": lista `reviewItems` (rótulo y valor) para confirmar antes de guardar.
 * - `validate(index)` valida el paso de datos al continuar; el paso "Revisar" siempre es válido.
 * - `complete` se emite desde "Revisar"; el formulario dueño envía y muestra errores.
 * El paso actual es `v-model`, para volver al paso de un campo con error.
 * - El slot `review-extra` va debajo de la lista de "Revisar" (p. ej. una confirmación escrita); `canContinue` pasa a FormStepper.
 */
export interface ReviewItem { label: string; value: string }
// canComplete vale true si no se pasa: Vue convierte un booleano ausente en false.
const props = withDefaults(defineProps<{ steps: StepperStep[]; reviewItems: ReviewItem[]; completeLabel: string; isBusy?: boolean; validate?: (index: number) => boolean; canComplete?: boolean; canContinue?: boolean }>(), { canComplete: true, canContinue: true, validate: () => true })
const emit = defineEmits<{ complete: [] }>()
const current = defineModel<number>({ default: 0 })
const allSteps = computed<StepperStep[]>(() => [...props.steps, { stepId: 'review', title: 'Revisar' }])
function validateStep(index: number): boolean { return index >= props.steps.length || (props.validate?.(index) ?? true) }
</script>
<template>
  <FormStepper
    v-model="current"
    :steps="allSteps"
    :complete-label="completeLabel"
    :is-busy="isBusy"
    :validate="validateStep"
    :can-complete="canComplete"
    :can-continue="canContinue"
    @complete="emit('complete')"
  >
    <template #default="{ step }">
      <dl
        v-if="step?.stepId === 'review'"
        class="capture-review"
        aria-label="Revisa antes de guardar"
      >
        <div
          v-for="item in reviewItems"
          :key="item.label"
        >
          <dt>{{ item.label }}</dt>
          <dd>{{ item.value || 'Sin capturar' }}</dd>
        </div>
      </dl>
      <div
        v-else-if="step"
        class="capture-step"
      >
        <slot :name="'step-' + step.stepId" />
      </div>
      <slot
        v-if="step?.stepId === 'review'"
        name="review-extra"
      />
    </template>
    <template #footer-start>
      <slot name="footer-start" />
    </template>
  </FormStepper>
</template>
<style scoped>
.capture-step { display: grid; gap: var(--spaceMedium); padding: 2px; min-width: 0; }
.capture-review { display: grid; margin: 0; border: 2px solid var(--borderColor); }
.capture-review div { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 3fr); gap: 12px; padding: 10px 14px; }
.capture-review div + div { border-top: 1px solid var(--hairlineColor); }
.capture-review dt { font-family: var(--monoFontFamily); font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--mutedTextColor); align-self: center; }
.capture-review dd { margin: 0; font-weight: 600; overflow-wrap: anywhere; }
@container (max-width: 480px) { .capture-review div { grid-template-columns: minmax(0, 1fr); gap: 2px; } }
</style>
