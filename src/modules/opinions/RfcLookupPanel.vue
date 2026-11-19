<script setup lang="ts">
import { computed, ref } from 'vue'
import { Calculator, FileSearch, FileText, KeyRound, ShieldCheck } from '@lucide/vue'
import { emptyClientProfile } from '../../../shared/contracts/clientProfile'
import { rfcPattern } from '../../../shared/contracts/localXml'
import type { SatPortalRun } from '../../../shared/contracts/satPortal'
import ActionButton from '../../shared/components/ActionButton.vue'
import FormModal from '../../shared/components/FormModal.vue'
import HelpTip from '../../shared/components/HelpTip.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import RfcField from '../../shared/components/RfcField.vue'
import SatCaptchaPanel, { type SatCaptchaPanelPhase } from '../../shared/components/SatCaptchaPanel.vue'
import StatusBadge from '../../shared/components/StatusBadge.vue'
import TextField from '../../shared/components/TextField.vue'
import { readIpcErrorMessage } from '../../shared/ipcErrorMessage'
import { useNotifications } from '../../shared/notifications/notificationStore'
import { showPdf } from '../../shared/pdf/pdfViewerState'
import TaxStatusAutofillDialog from '../clients/TaxStatusAutofillDialog.vue'
import { useSatPortalRun } from '../clients/useSatPortalRun'
import RfcCalculator from './RfcCalculator.vue'

/**
 * Cumplimiento → Constancias → **No clientes** (2026-10-17, pedido del usuario: "personas que también no son clientes,
 * debemos poder obtener las csf y verificar si realmente existe ese rfc con una calculadora de rfc"; después: "la
 * calculadora será un modal y este mismo apartado será otro dentro de constancias"). [[SAT-PORTAL#RFC sin ficha]].
 *
 * Para alguien sin ficha, con el RFC escrito o calculado («Calcular RFC» abre `RfcCalculator` en un modal):
 * - **Verificar en el SAT:** «Validación de RFC» pública con el motor del portal; la persona escribe el captcha aquí
 *   (`SatCaptchaPanel`) y el resultado dice si el RFC está registrado.
 * - **Datos de la CSF:** la consulta pública con idCIF (`TaxStatusAutofillDialog` en modo `isLookupOnly`).
 * - **PDF con su CIEC:** la CIEC de esa persona se escribe aquí, viaja una vez a Main y se borra del campo; Main entra,
 *   genera la constancia y la conserva en memoria. «Abrir constancia» la muestra en el visor (Guardar e Imprimir).
 * Nada se guarda en el Host: ni RFC, ni CIEC, ni PDF. El Host sólo comprueba el permiso de consultar al SAT.
 */
const { notify } = useNotifications()
const rfc = ref(''), ciec = ref(''), hasTriedSubmit = ref(false), isLookupOpen = ref(false), isCalculatorOpen = ref(false), viewError = ref('')
const { run, error, isStarting, isActive, start, operate } = useSatPortalRun(finishRun)
const normalizedRfc = computed(() => rfc.value.trim().toUpperCase())
const isRfcValid = computed(() => rfcPattern.test(normalizedRfc.value))
const rfcError = computed(() => hasTriedSubmit.value && !isRfcValid.value ? 'Escribe un RFC válido: 12 caracteres (moral) o 13 (física).' : '')
const isCiecValid = computed(() => /^[\x21-\x7EÑñ]{8,32}$/.test(ciec.value))
const lookupProfile = computed(() => ({ ...emptyClientProfile(), rfc: normalizedRfc.value }))

const helpText = 'Para personas que no son clientes. «Verificar en el SAT» usa la Validación de RFC pública del SAT: Fiscenix la abre en segundo plano y tú escribes aquí el texto de la imagen. «Datos de la CSF» consulta el validador público con el idCIF. «Obtener PDF con su CIEC» entra al SAT con la CIEC que escribas (no se guarda) y abre la constancia en el visor, desde donde la guardas o imprimes. Nada de esto se guarda en el Host.'
const phases: Readonly<Record<SatPortalRun['state'], SatCaptchaPanelPhase>> = { authorizing: 'preparing', preparing: 'preparing', waitingForCaptcha: 'captcha', signingIn: 'signingIn', working: 'working', saving: 'working', saved: 'done', ready: 'done', cancelled: 'cancelled', failed: 'error' }
const stepLabels = computed(() => run.value?.service === 'rfcValidation'
  ? ['Preparando navegador', 'Captcha', 'Enviando', 'Revisando', 'Listo'] as const
  : ['Preparando navegador', 'Captcha', 'Entrando', 'Generando', 'Lista'] as const)

function finishRun(finished: SatPortalRun): void {
  if (finished.state === 'failed') notify('Portal del SAT', finished.message, 'warning')
  else if (finished.rfcStatus) notify('Validación de RFC', finished.message, finished.rfcStatus === 'registered' ? 'success' : 'warning')
  // Sin ficha la CSF no está en el Host: «Abrir» la muestra en el visor, desde donde se guarda (2026-10-17).
  else if (finished.hasPdf) notify('Constancia lista', finished.message, 'success', { action: { label: 'Abrir para guardar', run: openCertificate } })
}

function useCalculatedRfc(value: string): void {
  rfc.value = value; hasTriedSubmit.value = false; isCalculatorOpen.value = false
}

async function verifyRfc(): Promise<void> {
  hasTriedSubmit.value = true
  if (!isRfcValid.value) return
  await start({ action: 'startThirdParty', service: 'rfcValidation', rfc: normalizedRfc.value })
}

/** La CIEC sale del campo en cuanto se envía: la vista no la conserva. */
async function obtainCertificate(): Promise<void> {
  hasTriedSubmit.value = true
  if (!isRfcValid.value || !isCiecValid.value) return
  const typedCiec = ciec.value
  ciec.value = ''
  await start({ action: 'startThirdParty', service: 'taxStatusCertificate', rfc: normalizedRfc.value, ciec: typedCiec })
}

/** «Reintentar»: la validación se repite sola; la CSF necesita la CIEC otra vez (la vista no la guardó). */
function retryRun(): void {
  if (run.value?.service === 'rfcValidation') void verifyRfc()
  else document.getElementById('rfc-lookup-ciec')?.focus()
}

async function openCertificate(): Promise<void> {
  viewError.value = ''
  try {
    const result = await window.contapp.manageSatPortal({ action: 'viewPdf' })
    if (result.pdfView) showPdf(result.pdfView)
  } catch (failure) { viewError.value = readIpcErrorMessage(failure, 'No se pudo abrir la constancia. Vuelve a obtenerla.') }
}
</script>

<template>
  <section
    class="rfc-lookup"
    data-testid="rfc-lookup"
    aria-labelledby="rfc-lookup-title"
  >
    <article
      class="rfc-lookup-card"
      :aria-busy="isActive"
    >
      <div class="help-title-row">
        <h3 id="rfc-lookup-title">
          Personas que no son clientes
        </h3>
        <HelpTip
          title="Constancias de no clientes"
          :text="helpText"
        />
      </div>
      <p class="field-help">
        Calcula su RFC, verifica que exista en el SAT y obtén su constancia. No se guarda nada.
      </p>
      <div class="rfc-lookup-rfc-row">
        <RfcField
          id="rfc-lookup-rfc"
          v-model="rfc"
          label="RFC a consultar"
          :error="rfcError"
          :disabled="isActive"
        />
        <ActionButton
          :disabled="isActive"
          data-testid="rfc-lookup-calculate"
          @click="isCalculatorOpen = true"
        >
          <Calculator
            :size="16"
            aria-hidden="true"
          /> Calcular RFC
        </ActionButton>
      </div>
      <div class="actions">
        <ActionButton
          variant="primary"
          :disabled="isActive || isStarting"
          data-testid="rfc-lookup-verify"
          @click="verifyRfc"
        >
          <ShieldCheck
            :size="16"
            aria-hidden="true"
          /> Verificar en el SAT
        </ActionButton>
        <ActionButton
          :disabled="isActive || !isRfcValid"
          @click="isLookupOpen = true"
        >
          <FileSearch
            :size="16"
            aria-hidden="true"
          /> Datos de la CSF (idCIF)
        </ActionButton>
      </div>
      <form
        class="rfc-lookup-ciec"
        autocomplete="off"
        @submit.prevent="obtainCertificate"
      >
        <TextField
          id="rfc-lookup-ciec"
          v-model="ciec"
          type="password"
          label="CIEC de esta persona"
          autocomplete="off"
          help="Sólo para entrar al SAT y generar su constancia. No se guarda."
          :disabled="isActive"
        />
        <ActionButton
          type="submit"
          :disabled="isActive || isStarting || !isCiecValid"
        >
          <KeyRound
            :size="16"
            aria-hidden="true"
          /> Obtener PDF con su CIEC
        </ActionButton>
      </form>
      <InlineNotice
        v-if="error || viewError"
        title="Portal del SAT"
        tone="error"
      >
        <p>{{ error || viewError }}</p>
      </InlineNotice>
      <SatCaptchaPanel
        v-if="run"
        id="rfc-lookup-status"
        :phase="phases[run.state]"
        :message="run.message"
        :captcha-image="run.captchaImage"
        :step-labels="stepLabels"
        :is-case-sensitive="run.service === 'rfcValidation'"
        @submit-captcha="captchaText => operate({ action: 'submitCaptcha', captchaText }, 'No se pudo enviar el captcha.')"
        @refresh-captcha="operate({ action: 'refreshCaptcha' }, 'No se pudo pedir otra imagen.')"
        @cancel="operate({ action: 'cancel' }, 'No se pudo cancelar.')"
        @retry="retryRun"
      >
        <div
          v-if="run.state === 'ready'"
          class="actions"
          data-testid="rfc-lookup-result"
        >
          <StatusBadge
            v-if="run.rfcStatus"
            :tone="run.rfcStatus === 'registered' ? 'success' : 'error'"
          >
            {{ run.rfcStatus === 'registered' ? 'Registrado en el SAT' : 'No registrado' }}
          </StatusBadge>
          <ActionButton
            v-if="run.hasPdf"
            variant="primary"
            @click="openCertificate"
          >
            <FileText
              :size="16"
              aria-hidden="true"
            /> Abrir constancia
          </ActionButton>
        </div>
      </SatCaptchaPanel>
    </article>
    <FormModal
      :is-open="isCalculatorOpen"
      title="Calculadora de RFC"
      description="Propone el RFC con el algoritmo del SAT mientras escribes. «Usar este RFC» lo pasa a la consulta."
      test-id="rfc-calculator-modal"
      @close="isCalculatorOpen = false"
    >
      <RfcCalculator @use="useCalculatedRfc" />
    </FormModal>
    <TaxStatusAutofillDialog
      :is-open="isLookupOpen"
      :client-id="null"
      saved-rfc=""
      display-name=""
      :profile="lookupProfile"
      is-lookup-only
      @close="isLookupOpen = false"
    />
  </section>
</template>

<style scoped>
.rfc-lookup { display: grid; gap: var(--spaceMedium); min-width: 0; }
.rfc-lookup h3 { margin: 0; font-size: 15px; }
.rfc-lookup .field-help { margin: 0; }
/* RFC y «Calcular RFC» en una fila; el botón baja si no cabe. */
.rfc-lookup-rfc-row { display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-start; }
.rfc-lookup-rfc-row > :first-child { flex: 1 1 240px; min-width: 0; }
.rfc-lookup-rfc-row > .action-button { margin-top: 26px; }
.rfc-lookup-card { display: grid; gap: 12px; padding: var(--spaceMedium); border: 2px solid var(--strongBorderColor); background: var(--surfaceColor); border-radius: var(--radiusNested); min-width: 0; }
.rfc-lookup-ciec { display: grid; gap: 10px; justify-items: start; padding-top: 12px; border-top: 2px solid var(--borderColor); }
.rfc-lookup-ciec > :first-child { width: 100%; }
</style>
