<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { FileSearch, FileText, ScanQrCode, WandSparkles } from '@lucide/vue'
import type { ClientProfile } from '../../../shared/contracts/clientProfile'
import { rfcPattern } from '../../../shared/contracts/localXml'
import { isValidIdCif, type ProvidedIdCifSource, type TaxStatusCertificate, type TaxStatusDetails, type TaxStatusOutcome, type TaxStatusResult } from '../../../shared/contracts/taxStatus'
import { describeTaxStatusName } from '../../../shared/fiscal/compareTaxStatusWithProfile'
import { parseTaxStatusQrText } from '../../../shared/fiscal/parseTaxStatusQrText'
import { planTaxStatusAutofill } from '../../../shared/fiscal/planTaxStatusProfileUpdate'
import { describeTaxRegime } from '../../../shared/fiscal/taxRegimes'
import ActionButton from '../../shared/components/ActionButton.vue'
import FormModal from '../../shared/components/FormModal.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import QrScanner from '../../shared/components/QrScanner.vue'
import RfcField from '../../shared/components/RfcField.vue'
import StatusBadge from '../../shared/components/StatusBadge.vue'
import TextField from '../../shared/components/TextField.vue'
import { readIpcErrorMessage } from '../../shared/ipcErrorMessage'
import { readCertificatePdf } from './readCertificatePdf'
import { describeTaxpayerStatusTone, describeTaxStatusOutcome, describeTaxStatusQrRejection, listAddressFacts, type NoticeTone } from './taxStatusPresentation'

/**
 * "Autocompletar con la constancia (CSF)" de la ficha del cliente (pedido del usuario, 2026-10-13,
 * [[changes/CSF-FORM-AUTOFILL]]): "lo del idCIF de la CSF sólo sirve para comparar datos ... sería mejor en editar o
 * crear cliente como autocompletado". Reemplaza al cajón de la CSF de la lista de Clientes.
 *
 * Flujo:
 * 1. La persona da el RFC (prellenado de la ficha; bloqueado si el cliente ya lo tiene guardado) y el idCIF: escrito,
 *    leído del código QR (cámara o imagen, `QrScanner`) o del PDF de la constancia (`readCertificatePdf`: texto y, si
 *    no, su QR). Al editar puede tomarlo también de la constancia en Documentos (el Host lee el PDF).
 * 2. "Consultar al SAT" inicia la consulta en el Host y la vista sondea cada 1.5 s hasta que termina:
 *    - **Alta, o ficha sin RFC guardado:** consulta sin cliente (`lookup` / `readLookup`); no se guarda nada.
 *    - **Edición con RFC guardado:** la consulta del cliente (`query` / `read`), que guarda el último resultado útil
 *      (`clientTaxStatus`) y exige asignación `readWrite`.
 * 3. Con datos, `planTaxStatusAutofill` muestra qué cambiaría (nombre, régimen con elección si hay varios, CP fiscal y,
 *    sin RFC guardado, el RFC). "Usar estos datos" emite `apply` con el borrador nuevo; no guarda: la persona revisa y
 *    guarda con el paso "Revisar" de la ficha. Nunca cambia un RFC ya guardado.
 * El Host verifica permisos en cada petición; los PDF, imágenes y cuadros de la cámara no salen de esta ventana.
 */
/** `isLookupOnly` (2026-10-17, Constancias → No clientes): sólo muestra los datos del SAT, sin ficha que llenar. */
const props = defineProps<{ isOpen: boolean; clientId: string | null; savedRfc: string; displayName: string; profile: ClientProfile; isLookupOnly?: boolean }>()
const emit = defineEmits<{ close: []; apply: [next: { displayName: string; profile: ClientProfile }] }>()

const rfc = ref(''), idCif = ref(''), idCifSource = ref<ProvidedIdCifSource>('manual')
const isScanning = ref(false), rejectionMessage = ref(''), isReadingPdf = ref(false), hasTriedSubmit = ref(false)
const sourceNotice = ref<{ title: string; text: string; tone: NoticeTone } | null>(null)
const certificate = ref<TaxStatusCertificate | null>(null)
const isStarting = ref(false), isRunning = ref(false), error = ref('')
const outcome = ref<TaxStatusOutcome | null>(null), result = ref<{ details: TaxStatusDetails; queriedRfc: string } | null>(null)
const selectedRegimeCode = ref<string | null>(null)
const pdfInput = ref<HTMLInputElement | null>(null)

/** Intervalo de sondeo y límite (≈ 2 min): el SAT corta a los 20 s, así que llegar al límite indica otro problema. */
const pollingIntervalMilliseconds = 1500, maximumPollCount = 80
let pollTimer: ReturnType<typeof setTimeout> | undefined
let pollCount = 0
/** Versión de la consulta: una respuesta de una consulta anterior (o de antes de cerrar) se descarta. */
let queryVersion = 0
let lookupAttemptId: string | null = null
/** Último idCIF puesto por código: si el campo cambia a otro valor, lo escribió la persona (origen `manual`). */
let programmaticIdCif: string | null = null

const isRfcLocked = computed(() => Boolean(props.savedRfc))
/** Con RFC guardado se usa la consulta del cliente (y su resultado se guarda); si no, la consulta sin cliente. */
const usesClientQuery = computed(() => Boolean(props.clientId && props.savedRfc))
const isWorking = computed(() => isStarting.value || isRunning.value)
const rfcError = computed(() => hasTriedSubmit.value && !rfcPattern.test(rfc.value.trim().toUpperCase()) ? 'Escribe un RFC válido: 12 caracteres (moral) o 13 (física).' : '')
const idCifError = computed(() => hasTriedSubmit.value && !isValidIdCif(idCif.value) ? 'Escribe los 11 dígitos del idCIF.' : '')
const outcomeNotice = computed(() => outcome.value && outcome.value !== 'found' ? describeTaxStatusOutcome(outcome.value) : null)
const autofill = computed(() => result.value ? planTaxStatusAutofill({ details: result.value.details, queriedRfc: result.value.queriedRfc, savedRfc: props.savedRfc,
  displayName: props.displayName, profile: props.profile, selectedRegimeCode: selectedRegimeCode.value }) : null)
/** Al dar de alta (o sin RFC guardado) el RFC consultado también entra a la ficha. */
const rfcChange = computed(() => result.value && !props.savedRfc && props.profile.rfc.trim().toUpperCase() !== result.value.queriedRfc ? { from: props.profile.rfc.trim(), to: result.value.queriedRfc } : null)
const isRegimeChoiceVisible = computed(() => Boolean(autofill.value && autofill.value.plan.regimeOptions.length > 1 && !autofill.value.plan.regimeOptions.includes(props.profile.taxRegime)))
const canApply = computed(() => Boolean(autofill.value && !autofill.value.plan.isStale && !autofill.value.plan.needsRegimeChoice && (autofill.value.plan.changes.length || rfcChange.value)))

watch(idCif, value => { if (value !== programmaticIdCif) idCifSource.value = 'manual' })
function setIdCif(value: string, source: ProvidedIdCifSource): void { programmaticIdCif = value; idCif.value = value; idCifSource.value = source }

function stopPolling(): void { clearTimeout(pollTimer); pollTimer = undefined }

/** Cada apertura empieza limpia con el RFC de la ficha; al editar se lee lo que el Host ya tiene del cliente. */
watch(() => props.isOpen, isOpen => {
  queryVersion++; stopPolling()
  rfc.value = (props.savedRfc || props.profile.rfc).trim().toUpperCase(); setIdCif('', 'manual')
  isScanning.value = false; rejectionMessage.value = ''; sourceNotice.value = null; certificate.value = null; hasTriedSubmit.value = false
  isStarting.value = false; isRunning.value = false; error.value = ''; outcome.value = null; result.value = null; selectedRegimeCode.value = null; lookupAttemptId = null
  if (isOpen && usesClientQuery.value) void loadClientOverview(queryVersion)
})
onBeforeUnmount(() => { queryVersion++; stopPolling() })

/** Edición: prellena el idCIF del último resultado guardado y ofrece la constancia de Documentos si se puede leer. */
async function loadClientOverview(version: number): Promise<void> {
  if (!props.clientId) return
  try {
    const response = await window.contapp.manageTaxStatus({ action: 'read', clientId: props.clientId })
    if (version !== queryVersion || response.status !== 'overview') return
    const overview = response.overview
    certificate.value = overview.canUseCertificate ? overview.certificate : null
    if (!idCif.value && overview.latest?.idCif) setIdCif(overview.latest.idCif, overview.latest.idCifSource === 'qr' ? 'qr' : 'manual')
  } catch { /* Sin lectura previa sólo se pierde el prellenado; consultar sigue disponible. */ }
}

/**
 * Comprueba que el RFC de la constancia (QR o PDF) sea el de la ficha. Sin RFC en el campo, toma el de la constancia.
 * Devuelve el motivo del rechazo, o `null` si llenó el idCIF.
 */
function acceptCertificateIdentity(identity: { idCif: string; rfc: string | null }, source: ProvidedIdCifSource): string | null {
  const expected = rfc.value.trim().toUpperCase()
  if (identity.rfc && expected && identity.rfc !== expected) return describeTaxStatusQrRejection({ status: 'rejected', reason: 'otherRfc', qrRfc: identity.rfc }, expected)
  if (identity.rfc && !expected) rfc.value = identity.rfc
  setIdCif(identity.idCif, source)
  return null
}

function handleDecoded(text: string): void {
  const reading = parseTaxStatusQrText(text)
  const rejection = reading.status === 'valid' ? acceptCertificateIdentity(reading, 'qr') : describeTaxStatusQrRejection({ status: 'rejected', reason: reading.reason, qrRfc: null }, rfc.value.trim())
  if (rejection) { rejectionMessage.value = rejection; return }
  rejectionMessage.value = ''; isScanning.value = false
  sourceNotice.value = { title: 'idCIF leído del código QR', text: 'Revisa que sea el de la constancia del cliente y consulta.', tone: 'success' }
}

/** PDF de la constancia elegido en este equipo: idCIF del texto o, si no, de su código QR. */
async function readPdf(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement, file = input.files?.[0]
  input.value = ''
  if (!file) return
  isReadingPdf.value = true; sourceNotice.value = null
  try {
    const identity = await readCertificatePdf(file)
    if (!identity) { sourceNotice.value = { title: 'El PDF no trae un idCIF legible', text: 'No se encontró el idCIF en el texto ni un código QR del SAT. Escanea el QR con la cámara o escribe los 11 dígitos.', tone: 'warning' }; return }
    const rejection = acceptCertificateIdentity(identity, identity.source === 'qr' ? 'qr' : 'manual')
    sourceNotice.value = rejection
      ? { title: 'La constancia es de otro RFC', text: rejection, tone: 'warning' }
      : { title: 'idCIF leído de la constancia', text: (identity.source === 'qr' ? 'Se tomó del código QR del PDF.' : 'Se tomó del texto del PDF.') + ' Revisa y consulta.', tone: 'success' }
  } catch {
    sourceNotice.value = { title: 'No se pudo leer el PDF', text: 'Elige el PDF de la constancia de situación fiscal (hasta 20 MB).', tone: 'warning' }
  } finally { isReadingPdf.value = false }
}

/** Inicia la consulta. `fromDocuments`: al editar, el Host toma el idCIF de la constancia del expediente. */
async function startQuery(fromDocuments = false): Promise<void> {
  if (isWorking.value) return
  hasTriedSubmit.value = true
  const queriedRfc = rfc.value.trim().toUpperCase(), typedIdCif = idCif.value.trim()
  if (!rfcPattern.test(queriedRfc) || (!fromDocuments && !isValidIdCif(typedIdCif))) return
  const version = ++queryVersion
  stopPolling(); pollCount = 0; lookupAttemptId = null
  isStarting.value = true; error.value = ''; outcome.value = null; result.value = null; selectedRegimeCode.value = null
  try {
    const response = usesClientQuery.value && props.clientId
      ? await window.contapp.manageTaxStatus(fromDocuments ? { action: 'query', clientId: props.clientId, manualIdCif: null } : { action: 'query', clientId: props.clientId, manualIdCif: typedIdCif, manualIdCifSource: idCifSource.value })
      : await window.contapp.manageTaxStatus({ action: 'lookup', rfc: queriedRfc, idCif: typedIdCif })
    handleResponse(response, version)
  } catch (failure) {
    if (version === queryVersion) error.value = readIpcErrorMessage(failure, 'No se inició la consulta.')
  } finally { if (version === queryVersion) isStarting.value = false }
}

/** Lee el estado del intento (sin cliente o del cliente) y, si sigue en curso, programa otra lectura. */
function handleResponse(response: TaxStatusResult, version: number): void {
  if (version !== queryVersion) return
  let state: 'running' | 'completed', finished: { outcome: TaxStatusOutcome | null; details: TaxStatusDetails | null; queriedRfc: string }
  if (response.status === 'lookup') {
    lookupAttemptId = response.lookup.attemptId; state = response.lookup.state
    finished = { outcome: response.lookup.outcome, details: response.lookup.details, queriedRfc: response.lookup.rfc }
  } else {
    const attempt = response.overview.attempt, latest = response.overview.latest
    state = attempt?.state ?? 'completed'
    // Sólo `found` reemplaza el resultado guardado: con otro resultado, el guardado es de una consulta anterior.
    finished = { outcome: attempt?.outcome ?? null, details: attempt?.outcome === 'found' && latest ? latest.details : null, queriedRfc: latest?.queriedRfc ?? props.savedRfc }
  }
  isRunning.value = state === 'running'
  if (isRunning.value) {
    if (pollCount >= maximumPollCount) { isRunning.value = false; error.value = 'La consulta tarda más de lo esperado. Cierra y vuelve a intentar en un momento.'; return }
    pollTimer = setTimeout(() => { pollCount++; void poll(version) }, pollingIntervalMilliseconds)
    return
  }
  outcome.value = finished.outcome
  result.value = finished.details ? { details: finished.details, queriedRfc: finished.queriedRfc } : null
}

async function poll(version: number): Promise<void> {
  try {
    const response = usesClientQuery.value && props.clientId
      ? await window.contapp.manageTaxStatus({ action: 'read', clientId: props.clientId })
      : lookupAttemptId ? await window.contapp.manageTaxStatus({ action: 'readLookup', attemptId: lookupAttemptId }) : null
    if (response) handleResponse(response, version)
  } catch (failure) {
    if (version === queryVersion) { isRunning.value = false; error.value = readIpcErrorMessage(failure, 'No se pudo leer la consulta al SAT.') }
  }
}

function applyResult(): void {
  if (!autofill.value || !canApply.value) return
  emit('apply', autofill.value.next)
}
</script>

<template>
  <FormModal
    :is-open="isOpen"
    :title="isLookupOnly ? 'Datos de la constancia (CSF)' : 'Autocompletar con la constancia (CSF)'"
    :description="isLookupOnly ? 'Fiscenix consulta el validador público del SAT (el del código QR de la constancia) con el RFC y el idCIF, sin contraseña. Muestra nombre, situación, domicilio y regímenes; no guarda nada.' : 'Fiscenix consulta el validador público del SAT (el del código QR de la constancia) con el RFC y el idCIF. No descarga la constancia ni guarda la ficha: llena los campos y tú revisas y guardas.'"
    test-id="tax-status-autofill-modal"
    @close="emit('close')"
  >
    <form
      class="autofill"
      novalidate
      :aria-busy="isWorking"
      @submit.prevent="startQuery()"
    >
      <div class="autofill-fields">
        <RfcField
          id="tax-status-autofill-rfc"
          v-model="rfc"
          label="RFC"
          :help="isRfcLocked ? 'Es el RFC guardado del cliente; el autocompletado no lo cambia.' : 'El de la constancia. Se llena solo al leer el QR o el PDF.'"
          :error="rfcError"
          :disabled="isRfcLocked || isWorking"
        />
        <TextField
          id="tax-status-autofill-id-cif"
          v-model="idCif"
          label="idCIF"
          autocomplete="off"
          help="11 dígitos. En la constancia aparece como «idCIF», junto al código QR."
          :error="idCifError"
          :disabled="isWorking"
        />
      </div>
      <div class="actions autofill-sources">
        <ActionButton
          :disabled="isWorking"
          :aria-pressed="isScanning"
          @click="isScanning = !isScanning; rejectionMessage = ''"
        >
          <ScanQrCode
            :size="16"
            aria-hidden="true"
          /> {{ isScanning ? 'Cerrar lector QR' : 'Escanear QR' }}
        </ActionButton>
        <ActionButton
          :is-loading="isReadingPdf"
          :disabled="isWorking || isReadingPdf"
          @click="pdfInput?.click()"
        >
          <FileText
            :size="16"
            aria-hidden="true"
          /> Elegir PDF de la constancia
        </ActionButton>
        <input
          ref="pdfInput"
          class="sr-only"
          type="file"
          accept="application/pdf"
          tabindex="-1"
          aria-label="PDF de la constancia"
          data-testid="tax-status-autofill-pdf"
          @change="readPdf"
        >
        <ActionButton
          v-if="certificate"
          :disabled="isWorking"
          data-testid="tax-status-autofill-documents"
          @click="startQuery(true)"
        >
          <FileSearch
            :size="16"
            aria-hidden="true"
          /> Usar la constancia de Documentos
        </ActionButton>
      </div>
      <QrScanner
        v-if="isScanning"
        :is-active="isOpen && isScanning"
        :sources="['camera', 'image']"
        :rejection-message="rejectionMessage"
        @decoded="handleDecoded"
        @retry="rejectionMessage = ''"
      />
      <InlineNotice
        v-if="sourceNotice"
        :title="sourceNotice.title"
        :tone="sourceNotice.tone"
        data-testid="tax-status-autofill-source"
      >
        <p>{{ sourceNotice.text }}</p>
      </InlineNotice>
      <div class="actions">
        <ActionButton
          type="submit"
          variant="primary"
          :is-loading="isWorking"
          :disabled="isWorking"
        >
          <FileSearch
            :size="16"
            aria-hidden="true"
          /> Consultar al SAT
        </ActionButton>
        <span
          v-if="isRunning"
          class="field-help"
          role="status"
        >Consultando al SAT… puede tardar hasta 20 segundos.</span>
      </div>
      <InlineNotice
        v-if="error"
        title="Algo salió mal"
        tone="error"
      >
        <p>{{ error }}</p>
      </InlineNotice>
      <InlineNotice
        v-if="outcomeNotice"
        :title="outcomeNotice.title"
        :tone="outcomeNotice.tone"
        data-testid="tax-status-autofill-outcome"
      >
        <p>{{ outcomeNotice.text }}</p>
      </InlineNotice>

      <section
        v-if="result && autofill"
        class="autofill-result"
        aria-labelledby="tax-status-autofill-result-title"
        data-testid="tax-status-autofill-result"
      >
        <div class="autofill-heading">
          <h3 id="tax-status-autofill-result-title">
            {{ describeTaxStatusName(result) || 'Datos del SAT' }}
          </h3>
          <StatusBadge :tone="describeTaxpayerStatusTone(result.details.taxpayerStatus)">
            {{ result.details.taxpayerStatus ?? 'Situación sin dato' }}
          </StatusBadge>
        </div>
        <p class="field-help">
          RFC {{ result.queriedRfc }}
        </p>
        <dl
          v-if="listAddressFacts(result.details).length"
          class="autofill-facts"
        >
          <div
            v-for="fact in listAddressFacts(result.details)"
            :key="fact.label"
          >
            <dt>{{ fact.label }}</dt><dd>{{ fact.value }}</dd>
          </div>
        </dl>
        <ul
          v-if="result.details.regimes.length"
          class="autofill-regimes"
        >
          <li
            v-for="(regime, index) in result.details.regimes"
            :key="index"
          >
            <strong>{{ regime.name }}</strong>
            <span class="field-help">{{ regime.registeredOn ? 'Alta ' + regime.registeredOn : 'Sin fecha de alta' }}</span>
          </li>
        </ul>
        <template v-if="!isLookupOnly">
          <fieldset
            v-if="isRegimeChoiceVisible"
            class="autofill-regime-choice"
          >
            <legend>El SAT registra varios regímenes; elige el que guarda la ficha</legend>
            <label
              v-for="code in autofill.plan.regimeOptions"
              :key="code"
              class="choice-card"
            >
              <input
                v-model="selectedRegimeCode"
                type="radio"
                name="tax-status-autofill-regime"
                :value="code"
              >
              <span>{{ describeTaxRegime(code) }}</span>
            </label>
          </fieldset>
          <ul
            v-if="rfcChange || autofill.plan.changes.length"
            class="autofill-changes"
            data-testid="tax-status-autofill-changes"
          >
            <li
              v-if="rfcChange"
              data-change="rfc"
            >
              <strong>RFC</strong>
              <span>{{ rfcChange.from || 'Sin dato' }} → {{ rfcChange.to }}</span>
            </li>
            <li
              v-for="change in autofill.plan.changes"
              :key="change.field"
              :data-change="change.field"
            >
              <strong>{{ change.label }}</strong>
              <span>{{ change.currentText || 'Sin dato' }} → {{ change.proposedText }}</span>
            </li>
          </ul>
          <p
            v-if="autofill.plan.needsRegimeChoice"
            class="field-help"
          >
            Elige un régimen para usar los datos.
          </p>
          <p
            v-else-if="!canApply"
            class="field-help"
          >
            La ficha ya tiene el nombre, el régimen y el CP fiscal del SAT.
          </p>
          <div class="actions">
            <ActionButton
              variant="primary"
              :disabled="!canApply"
              data-testid="tax-status-autofill-apply"
              @click="applyResult"
            >
              <WandSparkles
                :size="16"
                aria-hidden="true"
              /> Usar estos datos
            </ActionButton>
          </div>
        </template>
      </section>
    </form>
  </FormModal>
</template>

<style scoped>
.autofill { display: grid; gap: 16px; min-width: 0; }
.autofill .inline-notice { margin: 0; }
.autofill .field-help { margin: 0; }
/* Filas de botones dentro del formulario: sin el margen ni la alineación a la derecha de `dialog .actions` (pie de diálogo). */
.autofill .actions { margin: 0; justify-content: flex-start; }
.autofill-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 16px; align-items: start; }
.autofill-sources { display: flex; flex-wrap: wrap; gap: 8px; }
.autofill-result { display: grid; gap: 12px; padding: 16px; background: var(--surfaceColor); border: var(--structureBorder) solid var(--borderColor); box-shadow: var(--cardShadow); min-width: 0; }
.autofill-result h3 { margin: 0; font-size: 16px; font-weight: 600; overflow-wrap: anywhere; }
.autofill-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.autofill-facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 160px), 1fr)); gap: 10px; margin: 0; }
.autofill-facts dt { font-family: var(--monoFontFamily); font-size: 11px; font-weight: 500; letter-spacing: .05em; text-transform: uppercase; color: var(--mutedTextColor); }
.autofill-facts dd { margin: 4px 0 0; overflow-wrap: anywhere; }
.autofill-regimes, .autofill-changes { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.autofill-regimes li { display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; padding: 8px 0; border-bottom: 1px solid var(--hairlineColor); }
.autofill-changes li { display: grid; gap: 2px; padding: 8px 0; border-bottom: 1px solid var(--hairlineColor); overflow-wrap: anywhere; }
.autofill-changes li span { font-family: var(--monoFontFamily); }
.autofill-regime-choice { display: grid; gap: 8px; margin: 0; padding: 0; border: 0; }
.autofill-regime-choice legend { margin-bottom: 8px; font-weight: 600; }
</style>
