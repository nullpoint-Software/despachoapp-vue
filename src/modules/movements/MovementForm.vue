<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { getOfficeTime, getOfficeToday, movementTypes, officeCategories, parseBusinessTime, parseMovementAmount, paymentMethods, type Movement, type MovementDraft, type MovementType, type OfficeCategory, type PaymentMethod } from '../../../shared/contracts/movements'
import { commonMovementConcepts, formatBusinessDateTime, movementTypeLabels, officeCategoryLabels, paymentMethodLabels } from '../../../shared/presentation/movementLabels'
import MoneyField from '../../shared/components/MoneyField.vue'
import { formatMoneyDisplay } from '../../shared/formatting/inputFormats'
import SelectField from '../../shared/components/SelectField.vue'
import DateTimeField from '../../shared/components/DateTimeField.vue'
import AutocompleteField from '../../shared/components/AutocompleteField.vue'
import ActionButton from '../../shared/components/ActionButton.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import CaptureSteps from '../../shared/components/CaptureSteps.vue'

/**
 * Captura y edición de un movimiento, por pasos (ADR-034): Para quién → Importe → Revisar. Sólo valida para
 * orientar al usuario; el Host vuelve a validar
 * todo. La fecha y la hora propuestas son "ahora" en la zona del despacho, no la del equipo (2026-10-10: la hora del pago
 * se captura para auditoría y para los cortes por turno; al editar se conserva la guardada).
 * - "Registrar para" elige un **cliente** o el **despacho** (4.3a, sólo con `officeMovements.create`);
 *   el del despacho lleva categoría. Al editar, el cliente o "Despacho" quedan fijos; la categoría se puede cambiar.
 */
/** Para quién se registra: un cliente o el despacho con su categoría. */
export type MovementParty = { kind: 'client'; clientId: string } | { kind: 'office'; officeCategory: OfficeCategory }
const props = defineProps<{ movement: Movement | null; clientOptions: { clientId: string; label: string }[]; canUseOffice: boolean; isBusy: boolean; recentConcepts?: string[] }>()
const emit = defineEmits<{ submit: [value: { party: MovementParty; draft: MovementDraft }]; cancel: [] }>()
const partyKind = ref<'client' | 'office'>('client'), officeCategory = ref<string>('other')
const partyOptions = [{ value: 'client', label: 'Un cliente' }, { value: 'office', label: 'El despacho' }]
const categoryOptions = officeCategories.map(value => ({ value, label: officeCategoryLabels[value] }))
const isOffice = computed(() => props.movement ? props.movement.clientId === null : partyKind.value === 'office')
const clientLabel = ref(''), movementType = ref<string>('income'), amount = ref(''), paymentMethod = ref<string>('cash'), concept = ref(''), movementDate = ref(getOfficeToday()), movementTime = ref(getOfficeTime()), error = ref('')
const typeOptions = movementTypes.map(value => ({ value, label: movementTypeLabels[value] }))
const methodOptions = paymentMethods.map(value => ({ value, label: paymentMethodLabels[value] }))
const labels = computed(() => props.clientOptions.map(option => option.label))
// Frecuentes primero y luego los ya usados en la lista cargada; AutocompleteField quita repetidos y filtra al escribir.
const conceptOptions = computed(() => [...commonMovementConcepts, ...(props.recentConcepts ?? [])])
const currentStep = ref(0)
const steps = [{ stepId: 'party', title: 'Para quién' }, { stepId: 'amount', title: 'Importe' }]
watch(() => props.movement, movement => {
  clientLabel.value = movement ? movement.clientDisplayName : ''
  partyKind.value = !movement && !props.clientOptions.length && props.canUseOffice ? 'office' : 'client'; officeCategory.value = movement?.officeCategory ?? 'other'
  movementType.value = movement?.movementType ?? 'income'; amount.value = movement?.amount ?? ''; paymentMethod.value = movement?.paymentMethod ?? 'cash'
  concept.value = movement?.concept ?? ''; movementDate.value = movement?.movementDate ?? getOfficeToday()
  movementTime.value = movement?.movementTime ?? getOfficeTime(); error.value = ''; currentStep.value = 0
}, { immediate: true })

/** Para quién se registra; `null` si el cliente escrito no está en la lista. */
function resolveParty(): MovementParty | null {
  if (isOffice.value) return { kind: 'office', officeCategory: officeCategory.value as OfficeCategory }
  const clientId = props.movement?.clientId ?? props.clientOptions.find(option => option.label === clientLabel.value)?.clientId
  return clientId ? { kind: 'client', clientId } : null
}
function validateStep(index: number): boolean {
  error.value = ''
  if (index === 0 && !resolveParty()) error.value = 'Elige un cliente de la lista con acceso de lectura y escritura.'
  if (index === 1) {
    try { parseMovementAmount(amount.value) } catch { error.value = 'Escribe un importe mayor que cero con hasta dos decimales. Ejemplo: 1,250.50' }
    if (!error.value && !concept.value.trim()) error.value = 'Describe el concepto del movimiento.'
    if (!error.value && !/^\d{4}-\d{2}-\d{2}$/.test(movementDate.value)) error.value = 'Elige la fecha del movimiento.'
    if (!error.value) { try { parseBusinessTime(movementTime.value) } catch { error.value = 'Escribe la hora del movimiento en formato de 24 horas. Ejemplo: 14:30' } }
  }
  return !error.value
}
const reviewItems = computed(() => [
  { label: 'Registrado para', value: isOffice.value ? 'El despacho · ' + (officeCategoryLabels[officeCategory.value as OfficeCategory] ?? '') : props.movement?.clientDisplayName ?? clientLabel.value },
  { label: 'Tipo', value: movementTypeLabels[movementType.value as MovementType] ?? movementType.value },
  { label: 'Importe', value: amount.value ? formatMoneyDisplay(amount.value) || amount.value : '' },
  { label: 'Método de pago', value: paymentMethodLabels[paymentMethod.value as PaymentMethod] ?? paymentMethod.value },
  { label: 'Concepto', value: concept.value.trim() },
  { label: 'Fecha y hora', value: movementDate.value ? formatBusinessDateTime(movementDate.value, movementTime.value) : '' }
])
function submit(): void {
  for (const index of [0, 1]) if (!validateStep(index)) { currentStep.value = index; return }
  emit('submit', { party: resolveParty()!, draft: { movementType: movementType.value as MovementType, amount: parseMovementAmount(amount.value), paymentMethod: paymentMethod.value as PaymentMethod, concept: concept.value.trim(), movementDate: movementDate.value, movementTime: movementTime.value } })
}
</script>
<template>
  <form
    class="movement-form"
    data-testid="movement-form"
    @submit.prevent
  >
    <!-- El título y la explicación los da el FormModal que lo contiene (MovementsPage). -->
    <InlineNotice
      v-if="error"
      title="Revisa el movimiento"
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
      :complete-label="movement ? 'Guardar cambios' : 'Registrar movimiento'"
      @complete="submit"
    >
      <template #step-party>
        <SelectField
          v-if="!movement && canUseOffice"
          id="movement-party"
          v-model="partyKind"
          label="Registrar para"
          :options="partyOptions"
        />
        <SelectField
          v-if="isOffice"
          id="movement-category"
          v-model="officeCategory"
          label="Categoría del despacho"
          :options="categoryOptions"
        />
        <AutocompleteField
          v-if="!movement && !isOffice"
          id="movement-client"
          v-model="clientLabel"
          label="Cliente"
          :options="labels"
          :disabled="isBusy"
          help="Sólo aparecen clientes con acceso de lectura y escritura."
        />
        <div
          v-else-if="movement"
          class="field"
        >
          <span class="field-label">{{ isOffice ? 'Registrado para' : 'Cliente' }}</span>
          <p class="movement-fixed">
            {{ movement.clientDisplayName }}
          </p>
        </div>
        <SelectField
          id="movement-type"
          v-model="movementType"
          label="Tipo"
          :options="typeOptions"
        />
      </template>
      <template #step-amount>
        <MoneyField
          id="movement-amount"
          v-model="amount"
          label="Importe"
        />
        <SelectField
          id="movement-method"
          v-model="paymentMethod"
          label="Método de pago"
          :options="methodOptions"
        />
        <AutocompleteField
          id="movement-concept"
          v-model="concept"
          label="Concepto"
          :options="conceptOptions"
          :disabled="isBusy"
          help="Elige uno frecuente o escribe otro."
        />
        <DateTimeField
          v-model:date="movementDate"
          v-model:time="movementTime"
          date-id="movement-date"
          time-id="movement-time"
          label="Fecha y hora del pago"
          help="Hora del despacho. La hora de registro se guarda aparte para la auditoría."
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
.movement-form { display: grid; gap: var(--spaceMedium); }
.field-label { font-weight: 700; font-size: 13px; }
.movement-fixed { margin: 6px 0 0; min-height: var(--controlHeight); display: flex; align-items: center; overflow-wrap: anywhere; }
</style>
