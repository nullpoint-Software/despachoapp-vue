<script setup lang="ts">
import { computed, ref } from 'vue'
import { maximumObligationNoteLength } from '../../../shared/contracts/taxObligations'
import ActionButton from '../../shared/components/ActionButton.vue'
import CaptureSteps from '../../shared/components/CaptureSteps.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import TextField from '../../shared/components/TextField.vue'

/**
 * Marcar una obligación como cumplida en un periodo (2026-10-18), por pasos con revisión (ADR-034): Acuse → Revisar.
 * La nota es opcional: número de operación del acuse, fecha de presentación o cualquier aclaración. Quién y cuándo lo
 * registra el Host. El formulario sólo emite `save`; quien lo usa envía y muestra errores.
 */
const props = defineProps<{ clientName: string; obligationDescription: string; periodLabel: string; dueDateLabel: string; isBusy: boolean }>()
const emit = defineEmits<{ save: [note: string]; cancel: [] }>()
const note = ref(''), error = ref(''), currentStep = ref(0)
const steps = [{ stepId: 'receipt', title: 'Acuse' }]
function validateStep(): boolean {
  error.value = note.value.trim().length > maximumObligationNoteLength ? 'La nota admite hasta ' + maximumObligationNoteLength + ' caracteres.' : ''
  return !error.value
}
const reviewItems = computed(() => [
  { label: 'Cliente', value: props.clientName },
  { label: 'Obligación', value: props.obligationDescription },
  { label: 'Periodo', value: props.periodLabel },
  { label: 'Fecha límite', value: props.dueDateLabel },
  { label: 'Nota o acuse', value: note.value.trim() || 'Sin nota' }
])
function submit(): void { if (validateStep()) emit('save', note.value.trim()); else currentStep.value = 0 }
</script>
<template>
  <form
    class="mark-form"
    data-testid="tax-obligation-mark-form"
    @submit.prevent
  >
    <InlineNotice
      v-if="error"
      title="Revisa la nota"
      tone="error"
    >
      <p>{{ error }}</p>
    </InlineNotice>
    <CaptureSteps
      v-model="currentStep"
      :steps="steps"
      :review-items="reviewItems"
      :validate="validateStep"
      :is-busy="isBusy"
      complete-label="Marcar como cumplida"
      @complete="submit"
    >
      <template #step-receipt>
        <p class="mark-context">
          <strong>{{ obligationDescription }}</strong>
          <span>{{ periodLabel }} · vence {{ dueDateLabel }}</span>
        </p>
        <TextField
          id="obligation-note"
          v-model="note"
          label="Nota o número de acuse (opcional)"
          help="Por ejemplo, el número de operación del acuse del SAT o la fecha en que se presentó."
          autocomplete="off"
          :disabled="isBusy"
        />
      </template>
      <template #footer-start>
        <ActionButton
          :disabled="isBusy"
          @click="emit('cancel')"
        >
          Cancelar
        </ActionButton>
      </template>
    </CaptureSteps>
  </form>
</template>
<style scoped>
.mark-form { display: grid; gap: var(--spaceMedium); }
.mark-context { display: grid; gap: 2px; margin: 0; }
.mark-context span { color: var(--mutedTextColor); font-family: var(--monoFontFamily); font-size: 12px; }
</style>
