<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { FileUp, FolderOpen, Plus, Trash2 } from '@lucide/vue'
import { maximumObligationsPerAddition, type ObligationSource, type TaxObligationDraft } from '../../../shared/contracts/taxObligations'
import { describeDueRule, obligationPeriodicities, periodicityLabels, type ObligationPeriodicity } from '../../../shared/fiscal/taxObligationSchedule'
import { listKnownTaxObligations, suggestTaxObligations } from '../../../shared/fiscal/suggestTaxObligations'
import { describeTaxRegime } from '../../../shared/fiscal/taxRegimes'
import ActionButton from '../../shared/components/ActionButton.vue'
import AutocompleteField from '../../shared/components/AutocompleteField.vue'
import CaptureSteps from '../../shared/components/CaptureSteps.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import SelectField from '../../shared/components/SelectField.vue'
import { readCertificateObligations } from './readCertificateObligations'
import { readIpcErrorMessage } from '../../shared/ipcErrorMessage'
import type { CertificateObligation } from '../../../shared/fiscal/extractTaxObligations'

/**
 * Alta de obligaciones fiscales de un cliente por pasos (2026-10-18, ADR-034): Origen → Obligaciones → Revisar.
 * 1. **Origen** (decisión del usuario: "el catálogo es el del SAT"):
 *    - *Constancia (PDF)*: se leen la tabla de obligaciones y sus vencimientos. Dos caminos (2026-10-19):
 *      «Usar la constancia del expediente» (Main lee la CSF más reciente de Documentos, `readStoredCertificateObligations`)
 *      o «Elegir PDF de este equipo» (`readCertificateObligations`, en esta ventana). Ninguno guarda el PDF. Si el RFC
 *      impreso no es el del cliente, no se usa.
 *    - *Por régimen*: sugerencias de `suggestTaxObligations` con los regímenes de la ficha (principal y adicionales).
 *    - *Captura manual*: renglones vacíos (p. ej. contabilidad electrónica, que la constancia no lista).
 * 2. **Obligaciones**: cada renglón se puede quitar o corregir (descripción, periodicidad y vencimiento). La
 *    descripción se autocompleta con el catálogo de Fiscenix (`listKnownTaxObligations`) y elegir una llena su regla. Lo que el
 *    texto del SAT no dejó claro llega vacío y debe elegirse. Siempre se pueden agregar renglones manuales.
 * 3. **Revisar** y guardar: emite `save` con los borradores; el Host omite las que el cliente ya tiene.
 */
const props = defineProps<{ clientId: string; clientRfc: string; taxRegimes: string[]; isBusy: boolean }>()
const emit = defineEmits<{ save: [obligations: TaxObligationDraft[]]; cancel: [] }>()

interface CandidateRow { key: number; isIncluded: boolean; description: string; periodicity: ObligationPeriodicity | ''; dueMonthsAfter: string; dueDay: string; startsOn: string | null; source: ObligationSource; endedOn: string | null }
const steps = [{ stepId: 'source', title: 'Origen' }, { stepId: 'obligations', title: 'Obligaciones' }]
const currentStep = ref(0), error = ref('')
const source = ref<ObligationSource>('certificate')
const selectedRegimes = ref<string[]>([...props.taxRegimes])
const rows = ref<CandidateRow[]>([])
const isReading = ref(false), certificateSummary = ref('')
const isCompany = computed(() => props.clientRfc.length === 12)
let nextKey = 1

const sourceLabels: Record<ObligationSource, string> = { certificate: 'Constancia de situación fiscal (PDF)', regime: 'Sugeridas por régimen', manual: 'Captura manual' }
const periodicityOptions = [{ value: '', label: 'Elige la periodicidad' }, ...obligationPeriodicities.map(value => ({ value, label: periodicityLabels[value] }))]
const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
/** Anual: el mes de vencimiento del año siguiente; las demás: cuántos meses después de terminar el periodo. */
function dueMonthOptions(periodicity: ObligationPeriodicity | ''): { value: string; label: string }[] {
  if (periodicity === 'annual') return monthNames.map((name, index) => ({ value: String(index + 1), label: name + ' del año siguiente' }))
  return [1, 2, 3].map(value => ({ value: String(value), label: value === 1 ? 'Mes siguiente' : value + '.º mes siguiente' }))
}
const dueDayOptions = [...Array.from({ length: 30 }, (_, index) => ({ value: String(index + 1), label: 'Día ' + (index + 1) })), { value: '31', label: 'Último día' }]

function row(values: Partial<CandidateRow> & Pick<CandidateRow, 'source'>): CandidateRow {
  return { key: nextKey++, isIncluded: true, description: '', periodicity: '', dueMonthsAfter: '1', dueDay: '17', startsOn: null, endedOn: null, ...values }
}
/** Sugerencias por régimen: se rehacen al cambiar los regímenes elegidos (se pierde lo editado en el paso 2). */
function buildRegimeRows(): void {
  rows.value = suggestTaxObligations(selectedRegimes.value, isCompany.value).map(item => row({ source: 'regime', description: item.description, periodicity: item.periodicity, dueMonthsAfter: String(item.dueMonthsAfter), dueDay: String(item.dueDay) }))
}
watch(source, value => {
  error.value = ''; certificateSummary.value = ''
  if (value === 'regime') buildRegimeRows()
  else rows.value = value === 'manual' ? [row({ source: 'manual' })] : []
})
watch(selectedRegimes, () => { if (source.value === 'regime') buildRegimeRows() })

/**
 * Lleva lo leído de una constancia a los renglones. Común a la del expediente y a la del equipo: rechaza la de otro RFC
 * y la que no trae tabla; las obligaciones dadas de baja por el SAT llegan desmarcadas.
 */
function applyCertificateReading(reading: { rfc: string | null; obligations: Omit<CertificateObligation, 'dueText'>[] }, sourceName: string): void {
  if (reading.rfc && props.clientRfc && reading.rfc !== props.clientRfc) { error.value = 'La constancia es del RFC ' + reading.rfc + ', no de este cliente (' + props.clientRfc + ').'; return }
  if (!reading.obligations.length) { error.value = 'No se encontró la tabla de obligaciones en la constancia. Usa la descargada del SAT (no una imagen escaneada) o elige "Sugeridas por régimen".'; return }
  rows.value = reading.obligations.map(item => row({ source: 'certificate', isIncluded: item.endsOn === null, description: item.description, periodicity: item.periodicity ?? '',
    dueMonthsAfter: String(item.dueMonthsAfter ?? 1), dueDay: String(item.dueDay ?? 17), startsOn: item.startsOn, endedOn: item.endsOn }))
  const unclear = reading.obligations.filter(item => item.periodicity === null || item.dueDay === null).length
  certificateSummary.value = reading.obligations.length + ' obligación(es) leídas de ' + sourceName + (unclear ? ' · ' + unclear + ' sin periodicidad o vencimiento claro: complétalas en el siguiente paso.' : '.')
}
function startReading(): void { isReading.value = true; error.value = ''; certificateSummary.value = ''; rows.value = [] }

/**
 * Constancia del expediente (2026-10-19, pedido del usuario: "actualizar con PDF de CSF dentro de la app"): Main toma
 * la CSF más reciente de Documentos del cliente y devuelve sólo RFC y obligaciones; el PDF no llega a esta ventana.
 */
async function readStoredCertificate(): Promise<void> {
  startReading()
  try {
    const result = await window.contapp.readStoredCertificateObligations({ clientId: props.clientId })
    if (result.status === 'missing') { error.value = 'El expediente del cliente no tiene constancia de situación fiscal. Súbela en Clientes → Documentos o elige el PDF de este equipo.'; return }
    applyCertificateReading(result, '«' + result.documentName + '» del expediente (' + new Date(result.createdAt).toLocaleDateString('es-MX', { dateStyle: 'medium' }) + ')')
  } catch (caught) { error.value = readIpcErrorMessage(caught, 'No se pudo leer la constancia del expediente.') }
  finally { isReading.value = false }
}

async function readCertificate(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  startReading()
  try { applyCertificateReading(await readCertificateObligations(file, isCompany.value), file.name) }
  catch { error.value = 'No se pudo leer el PDF. Elige la constancia de situación fiscal en PDF (hasta 20 MB).' }
  finally { isReading.value = false }
}
/**
 * Autocompletado de la descripción con el catálogo de Fiscenix (2026-10-19): al elegir una, se llenan su periodicidad
 * y vencimiento; la persona los puede corregir. Escribir libremente sigue permitido.
 */
const knownObligations = computed(() => listKnownTaxObligations(isCompany.value))
const knownDescriptions = computed(() => knownObligations.value.map(item => item.description))
function chooseKnownObligation(item: CandidateRow, description: string): void {
  const known = knownObligations.value.find(candidate => candidate.description === description)
  if (!known) return
  item.periodicity = known.periodicity; item.dueMonthsAfter = String(known.dueMonthsAfter); item.dueDay = String(known.dueDay)
}
function addManualRow(): void { rows.value = [...rows.value, row({ source: 'manual' })] }
function removeRow(key: number): void { rows.value = rows.value.filter(item => item.key !== key) }
/** Al cambiar a anual se propone abril (físicas) o marzo (morales), día 30/31; al volver a mensual, día 17 del mes siguiente. */
function changePeriodicity(item: CandidateRow, value: string): void {
  item.periodicity = value as CandidateRow['periodicity']
  if (value === 'annual') { item.dueMonthsAfter = isCompany.value ? '3' : '4'; item.dueDay = isCompany.value ? '31' : '30' }
  else if (Number(item.dueMonthsAfter) > 3) { item.dueMonthsAfter = '1'; item.dueDay = '17' }
}

const includedRows = computed(() => rows.value.filter(item => item.isIncluded))
function validateStep(index: number): boolean {
  if (index === 0) {
    if (isReading.value) error.value = 'Espera a que termine de leerse la constancia.'
    else if (source.value === 'certificate' && !rows.value.length) error.value = error.value || 'Usa la constancia del expediente o elige el PDF de la constancia del cliente.'
    else if (source.value === 'regime' && !rows.value.length) error.value = 'Elige al menos un régimen con obligaciones (616 no tiene).'
    else error.value = ''
  }
  if (index === 1) {
    if (!includedRows.value.length) error.value = 'Deja marcada al menos una obligación.'
    else if (includedRows.value.length > maximumObligationsPerAddition) error.value = 'Se pueden agregar hasta ' + maximumObligationsPerAddition + ' obligaciones a la vez.'
    else if (includedRows.value.some(item => !item.description.trim() || item.description.trim().length > 300)) error.value = 'Escribe la descripción de cada obligación marcada (hasta 300 caracteres).'
    else if (includedRows.value.some(item => !item.periodicity)) error.value = 'Elige la periodicidad de cada obligación marcada.'
    else error.value = ''
  }
  return !error.value
}
const ruleOf = (item: CandidateRow) => item.periodicity ? describeDueRule({ periodicity: item.periodicity, dueMonthsAfter: Number(item.dueMonthsAfter), dueDay: Number(item.dueDay) }) : 'Sin periodicidad'
const reviewItems = computed(() => [
  { label: 'Origen', value: sourceLabels[source.value] },
  { label: 'Obligaciones', value: String(includedRows.value.length) },
  ...includedRows.value.map((item, index) => ({ label: (index + 1) + '. ' + (item.periodicity ? periodicityLabels[item.periodicity] : ''), value: item.description.trim() + ' — ' + ruleOf(item) }))
])
function submit(): void {
  if (!validateStep(1)) { currentStep.value = 1; return }
  emit('save', includedRows.value.map(item => ({ description: item.description.trim(), periodicity: item.periodicity as ObligationPeriodicity, dueMonthsAfter: Number(item.dueMonthsAfter),
    dueDay: Number(item.dueDay), startsOn: item.startsOn, source: item.source })))
}
</script>
<template>
  <form
    class="obligation-form"
    data-testid="tax-obligation-form"
    @submit.prevent
  >
    <InlineNotice
      v-if="error"
      title="Revisa las obligaciones"
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
      complete-label="Guardar obligaciones"
      @complete="submit"
    >
      <template #step-source>
        <fieldset
          class="obligation-sources"
          :disabled="isBusy"
        >
          <legend>¿De dónde salen las obligaciones?</legend>
          <label
            v-for="(label, key) in sourceLabels"
            :key="key"
            class="check-field"
          ><input
            v-model="source"
            type="radio"
            name="obligation-source"
            :value="key"
          > {{ label }}</label>
        </fieldset>
        <div
          v-if="source === 'certificate'"
          class="obligation-source-detail"
        >
          <p class="field-help">
            La constancia de situación fiscal trae las obligaciones del cliente con su vencimiento. Usa la que ya está en
            el expediente del cliente o elige un PDF de este equipo; no se guarda una copia.
          </p>
          <div class="obligation-certificate-actions">
            <ActionButton
              variant="primary"
              :is-loading="isReading"
              :disabled="isReading || isBusy"
              data-testid="obligation-stored-certificate"
              @click="readStoredCertificate"
            >
              <FolderOpen
                :size="16"
                aria-hidden="true"
              /> Usar la constancia del expediente
            </ActionButton>
            <label
              class="obligation-file"
              :class="{ 'is-disabled': isReading || isBusy }"
            >
              <FileUp
                :size="16"
                aria-hidden="true"
              />
              <span>Elegir PDF de este equipo</span>
              <input
                type="file"
                accept="application/pdf,.pdf"
                data-testid="obligation-certificate-input"
                :disabled="isReading || isBusy"
                @change="readCertificate"
              >
            </label>
          </div>
          <p
            v-if="certificateSummary"
            class="field-help"
            data-testid="obligation-certificate-summary"
          >
            {{ certificateSummary }}
          </p>
        </div>
        <div
          v-else-if="source === 'regime'"
          class="obligation-source-detail"
        >
          <p
            v-if="!taxRegimes.length"
            class="field-help"
          >
            La ficha del cliente no tiene régimen fiscal. Captúralo en Clientes o usa la constancia.
          </p>
          <template v-else>
            <p class="field-help">
              Regímenes de la ficha (principal y adicionales). Las sugerencias siguen los vencimientos generales del SAT.
            </p>
            <label
              v-for="code in taxRegimes"
              :key="code"
              class="check-field"
            ><input
              v-model="selectedRegimes"
              type="checkbox"
              :value="code"
            > {{ describeTaxRegime(code) }}</label>
          </template>
        </div>
        <p
          v-else
          class="field-help"
        >
          En el siguiente paso escribe cada obligación con su periodicidad y vencimiento.
        </p>
      </template>
      <template #step-obligations>
        <ul
          class="obligation-rows"
          aria-label="Obligaciones a guardar"
        >
          <li
            v-for="item in rows"
            :key="item.key"
            :class="{ 'is-excluded': !item.isIncluded }"
          >
            <div class="obligation-row-head">
              <label class="check-field"><input
                v-model="item.isIncluded"
                type="checkbox"
              > Guardar</label>
              <small v-if="item.endedOn">El SAT la dio de baja el {{ item.endedOn }}</small>
              <small v-else-if="item.startsOn">Desde {{ item.startsOn }}</small>
              <button
                v-if="item.source === 'manual'"
                type="button"
                class="obligation-remove"
                :aria-label="'Quitar ' + (item.description || 'obligación')"
                @click="removeRow(item.key)"
              >
                <Trash2
                  :size="16"
                  aria-hidden="true"
                />
              </button>
            </div>
            <AutocompleteField
              :id="'obligation-description-' + item.key"
              v-model="item.description"
              label="Descripción"
              :options="knownDescriptions"
              :disabled="!item.isIncluded"
              @select="chooseKnownObligation(item, $event)"
            />
            <div class="obligation-rule">
              <SelectField
                :id="'obligation-periodicity-' + item.key"
                :model-value="item.periodicity"
                label="Periodicidad"
                :options="periodicityOptions"
                :disabled="!item.isIncluded"
                @update:model-value="changePeriodicity(item, $event)"
              />
              <SelectField
                :id="'obligation-due-month-' + item.key"
                v-model="item.dueMonthsAfter"
                label="Vence en"
                :options="dueMonthOptions(item.periodicity)"
                :disabled="!item.isIncluded || !item.periodicity"
              />
              <SelectField
                :id="'obligation-due-day-' + item.key"
                v-model="item.dueDay"
                label="Día"
                :options="dueDayOptions"
                :disabled="!item.isIncluded || !item.periodicity"
              />
            </div>
          </li>
        </ul>
        <ActionButton
          :disabled="isBusy"
          @click="addManualRow"
        >
          <Plus
            :size="16"
            aria-hidden="true"
          /> Agregar otra obligación
        </ActionButton>
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
.obligation-form { display: grid; gap: var(--spaceMedium); }
.obligation-sources { display: grid; gap: 4px; margin: 0; padding: 0; border: 0; }
.obligation-sources legend { padding: 0 0 6px; font-weight: 700; }
.obligation-source-detail { display: grid; gap: 6px; }
.obligation-source-detail .field-help { margin: 0; }
.obligation-certificate-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.obligation-file.is-disabled { opacity: .5; cursor: default; }
.obligation-file { position: relative; display: inline-flex; align-items: center; gap: 8px; justify-self: start; min-height: var(--controlHeight, 40px); padding: 0 14px; border: 2px solid var(--borderColor); background: var(--surfaceColor); box-shadow: var(--buttonShadow); font-weight: 700; cursor: pointer; }
.obligation-file:focus-within { outline: 3px solid var(--focusColor); outline-offset: 2px; }
.obligation-file input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.obligation-rows { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; max-height: min(55dvh, 520px); overflow-y: auto; }
.obligation-rows li { display: grid; gap: 8px; padding: 10px 12px; border: 2px solid var(--borderColor); background: var(--surfaceColor); }
.obligation-rows li.is-excluded { opacity: .6; border-style: dashed; }
.obligation-row-head { display: flex; align-items: center; gap: 12px; }
.obligation-row-head small { color: var(--mutedTextColor); font-family: var(--monoFontFamily); font-size: 11px; }
.obligation-remove { margin-left: auto; display: inline-grid; place-items: center; width: 32px; height: 32px; border: 2px solid var(--borderColor); background: var(--surfaceColor); color: var(--errorText); cursor: pointer; }
.obligation-rule { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 150px), 1fr)); gap: 8px; }
</style>
