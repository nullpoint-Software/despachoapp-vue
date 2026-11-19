<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Eye, EyeOff, FileSearch } from '@lucide/vue'
import type { AssignedClient, ClientRequest } from '../../../shared/contracts/clients'
import { ClientProfileError, emptyClientProfile, isFiscalPostalCode, isRegimeForRfc, normalizePhoneNumber, validateClientProfileForSave, type ClientProfile } from '../../../shared/contracts/clientProfile'
import { parseCiec, type ClientCredentialStatus } from '../../../shared/contracts/clientCredentials'
import { describeTaxRegime, findTaxRegime, isTaxRegimeCode } from '../../../shared/fiscal/taxRegimes'
import { hasUnsavedClientDraft } from './clientDraft'
import { formatPhoneNumber } from './clientPresentation'
import TextField from '../../shared/components/TextField.vue'
import RfcField from '../../shared/components/RfcField.vue'
import PhoneField from '../../shared/components/PhoneField.vue'
import EmailField from '../../shared/components/EmailField.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import CaptureSteps from '../../shared/components/CaptureSteps.vue'
import { describeRegime } from './clientPresentation'
import type { StepperStep } from '../../shared/vueBits/FormStepper.vue'
import TaxRegimePicker from './TaxRegimePicker.vue'
import AdditionalTaxRegimesPicker from './AdditionalTaxRegimesPicker.vue'
import TaxStatusAutofillDialog from './TaxStatusAutofillDialog.vue'
import ActionButton from '../../shared/components/ActionButton.vue'
import HoldButton from '../../shared/vueBits/HoldButton.vue'
import { useNotifications } from '../../shared/notifications/notificationStore'

/**
 * Ficha del cliente por pasos (rediseño de Clientes, ADR-032), dentro del modal de ClientsPage, para agregar y
 * para editar. Pasos, como en la ContaApp anterior:
 * 1. Identidad fiscal: nombre o razón social, RFC, régimen principal del catálogo y regímenes adicionales (2026-10-18,
 *    migración 120; `AdditionalTaxRegimesPicker`), CP fiscal (5 dígitos, opcional; migración
 *    092) y, al editar, si está activo.
 * 2. Contacto: teléfono de 10 dígitos y correo.
 * 3. Acceso SAT: CIEC que se guarda cifrada sólo en este equipo, y el estado de la e.firma de este equipo.
 * 4. Revisar (CaptureSteps, ADR-034): resumen antes de guardar.
 * Cada paso se valida al continuar; si el Host rechaza algo, el formulario vuelve al paso del campo con error.
 * `contactName` ya no se captura: se devuelve el valor que tuviera la ficha.
 *
 * "Autocompletar con la constancia (CSF)" (pedido del usuario, 2026-10-13, [[changes/CSF-FORM-AUTOFILL]]), en el paso de
 * identidad: abre `TaxStatusAutofillDialog`, que consulta el validador público del SAT con RFC + idCIF y devuelve el
 * borrador con nombre, régimen, CP fiscal y (sin RFC guardado) el RFC. Sólo cambia el borrador: se guarda con el paso
 * "Revisar" como cualquier captura. El RFC guardado de un cliente existente nunca cambia por el autocompletado.
 */
const props = defineProps<{ client: AssignedClient | null; profile: ClientProfile; isBusy: boolean }>()
const emit = defineEmits<{ save: [request: ClientRequest, ciec: string | null]; cancel: [] }>()
const steps: StepperStep[] = [
  { stepId: 'identity', title: 'Identidad fiscal' },
  { stepId: 'contact', title: 'Contacto' },
  { stepId: 'sat', title: 'Acceso SAT' }
]
const currentStep = ref(0)
const displayName = ref(''), isActive = ref(true), draft = ref(emptyClientProfile()), ciec = ref(''), isCiecVisible = ref(false)
const errors = ref<Record<string, string>>({})
const ciecStatus = ref<ClientCredentialStatus | null>(null)
const hasFiel = ref<boolean | null>(null)
let initial = ''
const serialize = () => JSON.stringify({ displayName: displayName.value, isActive: isActive.value, profile: draft.value, ciec: ciec.value })

watch(() => [props.client, props.profile], () => {
  displayName.value = props.client?.displayName ?? ''; isActive.value = props.client?.isActive ?? true
  draft.value = { ...props.profile, phoneNumber: formatPhoneNumber(props.profile.phoneNumber) }; ciec.value = ''
  initial = serialize(); hasUnsavedClientDraft.value = false; errors.value = {}; currentStep.value = 0; hasAutofilled.value = false
}, { immediate: true })
watch(serialize, value => { hasUnsavedClientDraft.value = value !== initial })
/** Autocompletar con la CSF: el modal devuelve el borrador nuevo y aquí sólo se reemplaza lo capturado. */
const isAutofillOpen = ref(false), hasAutofilled = ref(false)
function applyAutofill(next: { displayName: string; profile: ClientProfile }): void {
  displayName.value = next.displayName; draft.value = { ...next.profile }
  errors.value = {}; isAutofillOpen.value = false; hasAutofilled.value = true
}

/**
 * Borrar la CIEC de ESTE equipo (2026-10-04: antes estaba en la ficha, que se retiró). Se confirma manteniendo
 * presionado; no toca la ficha del Host ni otros equipos.
 */
const { notify } = useNotifications()
const isCiecDeleting = ref(false), ciecDeleteError = ref('')
async function deleteCiec(): Promise<void> {
  if (!props.client) return
  isCiecDeleting.value = true; ciecDeleteError.value = ''
  try { ciecStatus.value = await window.contapp.manageClientCredentials({ action: 'delete', clientId: props.client.clientId }); notify('CIEC borrada', 'Se quitó de este equipo.', 'success') }
  catch { ciecDeleteError.value = 'No se pudo borrar la CIEC. Revisa tu acceso a este cliente.' }
  finally { isCiecDeleting.value = false }
}

/** Estado de la CIEC y la e.firma en ESTE equipo; nunca su valor. */
onMounted(async () => {
  if (!props.client) return
  try { ciecStatus.value = await window.contapp.manageClientCredentials({ action: 'read', clientId: props.client.clientId }) } catch { ciecStatus.value = null }
  try { hasFiel.value = Boolean(await window.contapp.readSatCredential(props.client.clientId)) } catch { hasFiel.value = null }
})

function validateStep(index: number): boolean {
  const next: Record<string, string> = {}
  if (index === 0) {
    const name = displayName.value.trim()
    if (!name || name.length > 100) next.displayName = 'Escribe el nombre o la razón social (hasta 100 caracteres).'
    const rfc = draft.value.rfc.trim()
    if (rfc && !/^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/.test(rfc)) next.rfc = 'El RFC no tiene el formato del SAT: 12 caracteres (moral) o 13 (física).'
    const regime = draft.value.taxRegime
    if (regime && !isTaxRegimeCode(regime)) next.taxRegime = 'Elige el régimen del catálogo.'
    else if (regime && rfc.length >= 12) {
      const found = findTaxRegime(regime)!
      if (rfc.length === 12 ? !found.isForCompanies : !found.isForIndividuals) next.taxRegime = 'Ese régimen no aplica a una persona ' + (rfc.length === 12 ? 'moral' : 'física') + '.'
    }
    // Adicionales (2026-10-18): sin principal no se guardan; cada uno del catálogo, del tipo de persona y distinto del principal.
    const additional = regime ? draft.value.additionalTaxRegimes : []
    if (additional.some(code => code === regime || !isTaxRegimeCode(code) || (rfc.length >= 12 && !isRegimeForRfc(code, rfc)))) next.additionalTaxRegimes = 'Quita los regímenes adicionales que no aplican a este RFC o repiten el principal.'
    const postalCode = draft.value.fiscalPostalCode.trim()
    if (postalCode && !isFiscalPostalCode(postalCode)) next.fiscalPostalCode = 'El CP fiscal tiene 5 dígitos.'
  }
  if (index === 1) {
    try { normalizePhoneNumber(draft.value.phoneNumber) } catch { next.phoneNumber = 'El teléfono debe tener 10 dígitos.' }
    const email = draft.value.emailAddress.trim()
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.emailAddress = 'Revisa el correo electrónico.'
  }
  if (index === 2 && ciec.value) { try { parseCiec(ciec.value) } catch { next.ciec = 'La CIEC tiene de 8 a 32 caracteres, sin espacios.' } }
  errors.value = next
  return !Object.keys(next).length
}
/** Paso final "Revisar" (ADR-034): lo que se guardará; la CIEC nunca se muestra. */
const reviewItems = computed(() => {
  const regime = describeRegime(draft.value.taxRegime)
  return [
    { label: 'Nombre o razón social', value: displayName.value.trim() },
    { label: 'RFC', value: draft.value.rfc.trim() },
    { label: 'Régimen fiscal', value: regime ? (regime.code ? regime.code + ' · ' : '') + regime.name : '' },
    ...(draft.value.taxRegime && draft.value.additionalTaxRegimes.length ? [{ label: 'Regímenes adicionales', value: draft.value.additionalTaxRegimes.map(describeTaxRegime).join(' / ') }] : []),
    { label: 'CP fiscal', value: draft.value.fiscalPostalCode.trim() },
    { label: 'Teléfono', value: draft.value.phoneNumber.trim() },
    { label: 'Correo electrónico', value: draft.value.emailAddress.trim() },
    { label: 'CIEC', value: ciec.value ? 'Se guardará en este equipo' : ciecStatus.value?.isCiecSaved ? 'Se conserva la guardada' : 'Sin capturar' },
    ...(props.client ? [{ label: 'Estado', value: isActive.value ? 'Activo' : 'Inactivo' }] : [])
  ]
})
const stepByField: Record<string, number> = { rfc: 0, taxRegime: 0, fiscalPostalCode: 0, phoneNumber: 1, emailAddress: 1 }

function submit(): void {
  if (![0, 1, 2].every(index => { const isValid = validateStep(index); if (!isValid) currentStep.value = index; return isValid })) return
  try {
    // Sin régimen principal los adicionales no se muestran ni se envían.
    const profile = validateClientProfileForSave({ ...draft.value, additionalTaxRegimes: draft.value.taxRegime ? draft.value.additionalTaxRegimes : [], fiscalPostalCode: draft.value.fiscalPostalCode.trim() })
    const request: ClientRequest = props.client
      ? { action: 'update', clientId: props.client.clientId, revision: props.client.revision, displayName: displayName.value.trim(), isActive: isActive.value, profile }
      : { action: 'create', displayName: displayName.value.trim(), profile }
    emit('save', request, ciec.value || null)
  } catch (error) {
    const field = error instanceof ClientProfileError ? error.field : 'rfc'
    currentStep.value = stepByField[field] ?? 0
    errors.value = { [field]: 'Revisa este dato.' }
  }
}
onBeforeUnmount(() => { hasUnsavedClientDraft.value = false; ciec.value = '' })
</script>
<template>
  <form
    class="client-form"
    data-testid="client-profile-form"
    novalidate
    @submit.prevent="submit"
  >
    <InlineNotice
      v-if="client?.access === 'readOnly'"
      title="Solo lectura"
      tone="info"
    >
      <p>Puedes consultar la ficha, pero no cambiarla.</p>
    </InlineNotice>
    <CaptureSteps
      v-model="currentStep"
      :steps="steps"
      :review-items="reviewItems"
      :is-busy="isBusy"
      :validate="validateStep"
      :can-complete="client?.access !== 'readOnly'"
      :complete-label="client ? 'Guardar cambios' : 'Guardar cliente'"
      @complete="submit"
    >
      <template #step-identity>
        <fieldset
          
          class="client-step"
          :disabled="isBusy || client?.access === 'readOnly'"
        >
          <legend class="sr-only">
            Identidad fiscal
          </legend>
          <div class="autofill-entry">
            <ActionButton
              aria-haspopup="dialog"
              @click="isAutofillOpen = true"
            >
              <FileSearch
                :size="16"
                aria-hidden="true"
              /> Autocompletar con la constancia (CSF)
            </ActionButton>
            <p class="field-help">
              Con el RFC y el idCIF (escrito, del código QR o del PDF) Fiscenix trae del SAT el nombre, el régimen y el CP fiscal.
            </p>
          </div>
          <InlineNotice
            v-if="hasAutofilled"
            title="Datos de la constancia aplicados"
            tone="success"
            data-testid="client-autofill-applied"
          >
            <p>Revísalos y continúa; se guardan al confirmar en «Revisar».</p>
          </InlineNotice>
          <TextField
            id="client-name"
            v-model="displayName"
            label="Nombre o razón social"
            :error="errors.displayName"
          />
          <RfcField
            id="client-rfc"
            v-model="draft.rfc"
            label="RFC"
            :error="errors.rfc"
          />
          <TaxRegimePicker
            v-model="draft.taxRegime"
            :rfc="draft.rfc.trim()"
            :error="errors.taxRegime"
          />
          <AdditionalTaxRegimesPicker
            v-if="draft.taxRegime"
            v-model="draft.additionalTaxRegimes"
            :rfc="draft.rfc.trim()"
            :main-regime="draft.taxRegime"
            :error="errors.additionalTaxRegimes"
          />
          <TextField
            id="client-fiscal-postal-code"
            v-model="draft.fiscalPostalCode"
            label="CP fiscal"
            autocomplete="off"
            help="Opcional. 5 dígitos, el del domicilio fiscal de la constancia; lo pide el CFDI 4.0."
            :error="errors.fiscalPostalCode"
          />
          <label
            v-if="client"
            class="check-field"
          ><input
            v-model="isActive"
            type="checkbox"
          > Cliente activo</label>
        </fieldset>
      </template>
      <template #step-contact>
        <fieldset
          
          class="client-step client-step-pair"
          :disabled="isBusy || client?.access === 'readOnly'"
        >
          <legend class="sr-only">
            Contacto
          </legend>
          <PhoneField
            id="client-phone"
            v-model="draft.phoneNumber"
            label="Teléfono"
            :error="errors.phoneNumber"
          />
          <EmailField
            id="client-email"
            v-model="draft.emailAddress"
            label="Correo electrónico"
            :error="errors.emailAddress"
          />
        </fieldset>
      </template>
      <template #step-sat>
        <fieldset
          
          class="client-step"
          :disabled="isBusy || client?.access === 'readOnly'"
        >
          <legend class="sr-only">
            Acceso SAT
          </legend>
          <div class="field">
            <label for="client-ciec">{{ ciecStatus?.isCiecSaved ? 'Reemplazar CIEC' : 'CIEC' }}</label>
            <div class="secret-input">
              <input
                id="client-ciec"
                v-model="ciec"
                :type="isCiecVisible ? 'text' : 'password'"
                autocomplete="off"
                spellcheck="false"
                :aria-invalid="Boolean(errors.ciec)"
                aria-describedby="client-ciec-help"
              >
              <button
                type="button"
                class="secret-toggle"
                :aria-label="isCiecVisible ? 'Ocultar CIEC' : 'Mostrar CIEC'"
                :aria-pressed="isCiecVisible"
                @click="isCiecVisible = !isCiecVisible"
              >
                <EyeOff
                  v-if="isCiecVisible"
                  :size="16"
                  aria-hidden="true"
                /><Eye
                  v-else
                  :size="16"
                  aria-hidden="true"
                />
              </button>
            </div>
            <p
              id="client-ciec-help"
              class="field-help"
              :class="{ 'field-error': errors.ciec }"
            >
              {{ errors.ciec || (ciecStatus?.isCiecSaved ? 'Ya hay una CIEC guardada en este equipo. Déjalo vacío para conservarla.' : 'Opcional. Se guarda cifrada sólo en este equipo; no viaja al Host ni a otros equipos.') }}
            </p>
          </div>
          <div
            v-if="client && ciecStatus?.isCiecSaved"
            class="ciec-delete"
          >
            <HoldButton
              size="small"
              aria-label="Borrar la CIEC de este equipo"
              :is-disabled="isCiecDeleting"
              @hold="deleteCiec"
            >
              Borrar CIEC
            </HoldButton>
            <p
              v-if="ciecDeleteError"
              class="field-help field-error"
            >
              {{ ciecDeleteError }}
            </p>
          </div>
          <dl class="sat-summary">
            <div>
              <dt>e.firma en este equipo</dt>
              <dd>{{ !client ? 'Se captura en Fiscal → Descargas SAT después de guardar.' : hasFiel === null ? 'No se pudo consultar.' : hasFiel ? 'Guardada' : 'Sin capturar. Se captura en Fiscal → Descargas SAT.' }}</dd>
            </div>
          </dl>
        </fieldset>
      </template>
    </CaptureSteps>
  </form>
  <!-- Fuera del <form> y del <fieldset>: Enter en el modal no guarda la ficha y sus campos no heredan `disabled`. -->
  <TaxStatusAutofillDialog
    :is-open="isAutofillOpen"
    :client-id="client?.clientId ?? null"
    :saved-rfc="client ? profile.rfc : ''"
    :display-name="displayName"
    :profile="draft"
    @close="isAutofillOpen = false"
    @apply="applyAutofill"
  />
</template>
<style scoped>
.client-form { display: grid; gap: 16px; }
.client-step { display: grid; gap: 18px; min-width: 0; margin: 0; padding: 2px; border: 0; }
.client-step-pair { grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); align-items: start; }
.field-error { color: var(--errorColor); }
.autofill-entry { display: grid; justify-items: start; gap: 6px; }
.autofill-entry .field-help { margin: 0; }
.ciec-delete { display: grid; justify-items: start; gap: 6px; }
.secret-input { position: relative; }
.secret-input input { padding-right: 44px; font-family: var(--monoFontFamily); letter-spacing: .04em; }
.secret-toggle { position: absolute; top: 50%; right: 6px; display: grid; place-items: center; width: 32px; height: 32px; border: 0; border-radius: 0; background: transparent; color: var(--mutedTextColor); cursor: pointer; transform: translateY(-50%); }
.secret-toggle:hover { background: var(--hoverColor); color: var(--textColor); }
.secret-toggle:focus-visible { outline: 2px solid var(--focusColor); outline-offset: 1px; }
.sat-summary { display: grid; gap: 8px; margin: 0; padding: 12px 14px; border-radius: var(--radiusNested); background: var(--subtleColor); }
.sat-summary div { display: grid; gap: 2px; }
.sat-summary dt { font-size: 12px; color: var(--mutedTextColor); }
.sat-summary dd { margin: 0; font-size: 14px; }
</style>
