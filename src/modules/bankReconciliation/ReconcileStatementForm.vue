<script setup lang="ts">
import LatticeLoader from '../../shared/vueBits/LatticeLoader.vue'
import { computed, ref } from 'vue'
import CaptureSteps from '../../shared/components/CaptureSteps.vue'
import type { ReconciliationResult } from '../../../shared/contracts/bankReconciliation'
import ActionButton from '../../shared/components/ActionButton.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import TextField from '../../shared/components/TextField.vue'
import MoneyField from '../../shared/components/MoneyField.vue'
import { readIpcErrorMessage } from '../../shared/ipcErrorMessage'
import { monthNames } from '../reports/reportLabels'

/**
 * "Conciliar estado de cuenta" (6.5), dentro de un `FormModal`. La vista sólo manda cliente, mes,
 * tolerancia, ventana de días y, si el PDF está protegido, su contraseña. Main abre el diálogo, lee el
 * archivo en memoria (nunca lo guarda) y el Host concilia contra los reportes mensuales del cliente.
 * Volver a conciliar el mes reemplaza la conciliación anterior y su revisión.
 * Por pasos (ADR-034): Criterios (tolerancia y ventana) → Archivo (contraseña del PDF y formatos) → Revisar.
 */
const props = defineProps<{ clientId: string; clientName: string; fiscalYear: number; fiscalMonth: number; hasPrevious: boolean }>()
const emit = defineEmits<{ reconciled: [result: ReconciliationResult]; cancel: []; busy: [isBusy: boolean] }>()
// Valores por omisión del original: 1 peso de tolerancia y 3 días de ventana.
const tolerance = ref('1.00'), dateWindowDays = ref('3'), pdfPassword = ref('')
const isWorking = ref(false), error = ref('')

function validate(): string {
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(tolerance.value.trim()) || Number(tolerance.value) > 1000) return 'La tolerancia debe ser un importe de 0 a 1000 pesos.'
  if (!/^\d{1,2}$/.test(dateWindowDays.value.trim()) || Number(dateWindowDays.value) > 31) return 'La ventana debe ser de 0 a 31 días.'
  return ''
}
const currentStep = ref(0)
const steps = [{ stepId: 'criteria', title: 'Criterios' }, { stepId: 'file', title: 'Archivo' }]
function validateStep(index: number): boolean { error.value = index === 0 ? validate() : ''; return !error.value }
const reviewItems = computed(() => [
  { label: 'Cliente', value: props.clientName },
  { label: 'Periodo', value: monthNames[props.fiscalMonth - 1] + ' ' + props.fiscalYear },
  { label: 'Tolerancia', value: '$' + Number(tolerance.value || 0).toFixed(2) },
  { label: 'Ventana de fechas', value: dateWindowDays.value + ' día(s)' },
  { label: 'PDF protegido', value: pdfPassword.value ? 'Con contraseña (no se guarda)' : 'No' }
])
async function reconcile(): Promise<void> {
  if (isWorking.value) return
  error.value = validate()
  if (error.value) { currentStep.value = 0; return }
  isWorking.value = true; emit('busy', true)
  try {
    const outcome = await window.contapp.reconcileBankStatement({ clientId: props.clientId, fiscalYear: props.fiscalYear, fiscalMonth: props.fiscalMonth, tolerance: Number(tolerance.value).toFixed(2),
      dateWindowDays: Number(dateWindowDays.value), pdfPassword: pdfPassword.value || null })
    if (outcome.status !== 'cancelled') emit('reconciled', outcome)
  } catch (caught) { error.value = readIpcErrorMessage(caught, 'No se concilió el estado de cuenta.') }
  finally { pdfPassword.value = ''; isWorking.value = false; emit('busy', false) }
}
</script>
<template>
  <form
    class="reconcile-form"
    data-testid="reconcile-form"
    @submit.prevent
  >
    <InlineNotice
      v-if="error"
      title="No se concilió"
      tone="error"
    >
      <p>{{ error }}</p>
    </InlineNotice>
    <InlineNotice
      v-if="hasPrevious"
      title="Se reemplaza la conciliación del mes"
      tone="warning"
    >
      <p>Ya hay una conciliación de {{ monthNames[fiscalMonth - 1] }} {{ fiscalYear }}. Al conciliar de nuevo se borran sus confirmaciones, enlaces y notas.</p>
    </InlineNotice>
    <dl class="reconcile-facts">
      <div><dt>Cliente</dt><dd>{{ clientName }}</dd></div>
      <div><dt>Periodo</dt><dd>{{ monthNames[fiscalMonth - 1] }} {{ fiscalYear }}</dd></div>
    </dl>
    <CaptureSteps
      v-model="currentStep"
      :steps="steps"
      :review-items="reviewItems"
      :validate="validateStep"
      :is-busy="isWorking"
      complete-label="Elegir archivo y conciliar"
      @complete="reconcile"
    >
      <template #step-criteria>
        <div class="reconcile-grid">
          <MoneyField
            id="reconcile-tolerance"
            v-model="tolerance"
            label="Tolerancia de importe (MXN)"
            :disabled="isWorking"
            help="Diferencia máxima para proponer una coincidencia; las que no son exactas quedan en revisar."
          />
          <TextField
            id="reconcile-window"
            v-model="dateWindowDays"
            label="Ventana de fechas (días)"
            :disabled="isWorking"
            help="Días entre el movimiento y el CFDI o pago para considerarlos del mismo cobro."
          />
        </div>
      </template>
      <template #step-file>
        <TextField
          id="reconcile-password"
          v-model="pdfPassword"
          type="password"
          autocomplete="off"
          label="Contraseña del PDF (opcional)"
          :disabled="isWorking"
          help="Sólo si el banco protege el PDF. Se usa para leerlo en este equipo y no se guarda."
        />
        <p class="field-help">
          Formatos: PDF con texto (no escaneado), CSV/TXT o XML exportados por el banco, de hasta 15 MB. El archivo se lee en este equipo y no se guarda; en el Host
          quedan los movimientos y el resultado. Se compara con los reportes mensuales del cliente y con los complementos de pago de la biblioteca XML de este equipo.
        </p>
      </template>
      <template #footer-start>
        <ActionButton
          :disabled="isWorking"
          @click="emit('cancel')"
        >
          Cancelar
        </ActionButton>
      </template>
    </CaptureSteps>
    <LatticeLoader
      v-if="isWorking"
      label="Leyendo y conciliando el estado de cuenta"
    />
  </form>
</template>
<style scoped>
.reconcile-form { display: grid; gap: var(--spaceMedium); }
.reconcile-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: var(--spaceMedium); align-items: start; }
.reconcile-facts { margin: 0; display: grid; gap: 8px; }
.reconcile-facts div { display: flex; justify-content: space-between; gap: 12px; border-bottom: 1px solid var(--hairlineColor); padding-bottom: 6px; }
.reconcile-facts dt { font-family: var(--monoFontFamily); font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--mutedTextColor); }
.reconcile-facts dd { margin: 0; text-align: right; overflow-wrap: anywhere; }
</style>
