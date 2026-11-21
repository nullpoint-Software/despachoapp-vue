<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { KeyRound } from '@lucide/vue'
import type { SatPortalRun } from '../../../shared/contracts/satPortal'
import ActionButton from '../../shared/components/ActionButton.vue'
import HelpTip from '../../shared/components/HelpTip.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import SatCaptchaPanel, { type SatCaptchaPanelPhase } from '../../shared/components/SatCaptchaPanel.vue'
import { requestNavigation } from '../../shared/navigation/navigationRequests'
import { useNotifications } from '../../shared/notifications/notificationStore'
import { useSatPortalRun } from './useSatPortalRun'

/**
 * "Obtener CSF con RFC y CIEC" (2026-10-11, [[SAT-PORTAL#CSF]]): obtiene la constancia de situación fiscal del cliente
 * por el portal del SAT. Desde el 2026-10-17 vive en Cumplimiento → Constancias (`TaxCertificatesPanel`), ya no en
 * Documentos, y la opinión con CIEC se retiró.
 *
 * Flujo de la vista (motor de ADR-040):
 * 1. Al montarse lee si ESTE equipo tiene la CIEC del cliente (sólo si existe, nunca el valor). Sin CIEC muestra cómo
 *    guardarla y un botón que abre "Editar ficha" del cliente (navegación `clients` con `view: 'editCiec'`).
 * 2. «Obtener CSF con RFC y CIEC» pide `start` a Main; Main pide permiso al Host y abre el SAT en segundo plano.
 * 3. `SatCaptchaPanel` (en línea) muestra los pasos Preparando navegador → Captcha → Entrando → Generando → Guardado y
 *    la imagen del captcha; la persona escribe su texto (`submitCaptcha`) o pide «Otra imagen» (`refreshCaptcha`).
 *    Main entra, pulsa «Generar Constancia», toma el PDF de la ventana emergente y lo guarda en el expediente.
 * 4. Mientras la ejecución siga activa consulta `read` cada segundo (`useSatPortalRun`); al terminar avisa y emite
 *    `completed` para que el contenedor recargue la lista de constancias. Con error o cancelado, «Reintentar» inicia otra.
 * La vista nunca recibe RFC ni CIEC; el Host vuelve a verificar permisos y asignación en cada paso.
 */
const props = defineProps<{ clientId: string; clientDisplayName: string; canUse: boolean }>()
const emit = defineEmits<{ completed: [run: SatPortalRun] }>()
const { notify } = useNotifications()

const hasCiec = ref<boolean | null>(null)
let isMounted = true
/** Ejecución que inició este componente: sólo esa se muestra y se notifica (puede haber otra de otro cliente). */
const { run, error, isStarting, isActive, start: startRun, operate, reset } = useSatPortalRun(finishRun)

const helpText = 'Fiscenix abre el portal del SAT en segundo plano y te muestra aquí la imagen del captcha; escribe su texto (Fiscenix no lo resuelve). Fiscenix entra con el RFC del cliente y la CIEC guardada en este equipo, pulsa «Generar Constancia», toma el PDF y lo guarda en el expediente del cliente; de ahí sale el idCIF para la consulta pública. Todavía no se comprueba con el SAT real.'
/** Fase del panel para cada estado de Main. */
const phases: Readonly<Record<SatPortalRun['state'], SatCaptchaPanelPhase>> = { authorizing: 'preparing', preparing: 'preparing', waitingForCaptcha: 'captcha', signingIn: 'signingIn', working: 'working', saving: 'working', saved: 'done', ready: 'done', cancelled: 'cancelled', failed: 'error' }
const stepLabels = ['Preparando navegador', 'Captcha', 'Entrando', 'Generando', 'Guardado'] as const

/** Al terminar la ejecución propia avisa y emite `completed`. */
function finishRun(finished: SatPortalRun): void {
  // «Descargar» en el aviso (2026-10-17): guarda una copia de la constancia recién obtenida donde elija la persona.
  const { clientId } = props, documentId = finished.documentId
  if (finished.state === 'saved') notify('Constancia guardada', props.clientDisplayName + ': ' + finished.message, 'success', documentId ? { action: { label: 'Descargar', run: () => downloadDocument(clientId, documentId) } } : {})
  else if (finished.state === 'failed') notify('Portal del SAT', props.clientDisplayName + ': ' + finished.message, 'warning')
  emit('completed', finished)
}

async function downloadDocument(clientId: string, documentId: string): Promise<void> {
  try {
    const result = await window.contapp.manageDocuments({ action: 'saveCopy', clientId, documentId })
    if (result.status === 'saved') notify('Constancia descargada', 'La copia se guardó donde elegiste.', 'success')
  } catch { notify('Constancia', 'No se pudo descargar la constancia. Revisa el permiso para consultar el expediente del cliente.', 'error') }
}

async function readCiecStatus(clientId: string): Promise<void> {
  hasCiec.value = null
  try { const status = await window.contapp.manageClientCredentials({ action: 'read', clientId }); if (isMounted && clientId === props.clientId) hasCiec.value = status.isCiecSaved }
  catch { if (isMounted) hasCiec.value = false }
}

/** Inicia una ejecución (también «Reintentar» después de un error o de cancelar). */
async function start(): Promise<void> {
  if (!props.canUse || !hasCiec.value) return
  await startRun({ action: 'start', clientId: props.clientId, service: 'taxStatusCertificate' })
}

/** Lleva a "Editar ficha" del cliente, donde se captura la CIEC (paso Acceso SAT). */
function openCiecCapture(): void {
  requestNavigation({ section: 'clients', itemId: props.clientId, view: 'editCiec', label: 'la ficha de ' + props.clientDisplayName })
}

// Cambiar de cliente reinicia el componente: otra CIEC y ninguna ejecución propia a la vista.
watch(() => props.clientId, clientId => { reset(); void readCiecStatus(clientId) }, { immediate: true })
onBeforeUnmount(() => { isMounted = false })
</script>

<template>
  <section
    class="sat-portal-action"
    data-testid="sat-portal-taxStatusCertificate"
    :aria-busy="isActive"
  >
    <div class="help-title-row">
      <h4>Con RFC y CIEC</h4>
      <HelpTip
        title="Obtener la CSF con RFC y CIEC"
        :text="helpText"
      />
    </div>
    <InlineNotice
      v-if="error"
      title="Portal del SAT"
      tone="error"
    >
      <p>{{ error }}</p>
    </InlineNotice>
    <InlineNotice
      v-if="hasCiec === false"
      title="Este equipo no tiene la CIEC del cliente"
      tone="info"
    >
      <p>La CIEC se guarda cifrada sólo en este equipo. Captúrala en Editar ficha, paso «Acceso SAT», y vuelve aquí.</p>
      <ActionButton
        v-if="canUse"
        @click="openCiecCapture"
      >
        <KeyRound
          :size="15"
          aria-hidden="true"
        /> Guardar la CIEC
      </ActionButton>
    </InlineNotice>
    <p
      v-else-if="!canUse"
      class="field-help"
    >
      Para usar la CIEC necesitas permiso de editar clientes, consultar la constancia y cargar documentos, y el cliente asignado con lectura y escritura.
    </p>
    <div class="actions">
      <ActionButton
        variant="primary"
        :is-loading="isStarting || isActive"
        :disabled="!canUse || !hasCiec || isActive || isStarting"
        @click="start"
      >
        <KeyRound
          :size="16"
          aria-hidden="true"
        /> Obtener CSF con RFC y CIEC
      </ActionButton>
    </div>
    <SatCaptchaPanel
      v-if="run"
      id="sat-portal-status"
      :phase="phases[run.state]"
      :message="run.message"
      :captcha-image="run.captchaImage"
      :step-labels="stepLabels"
      @submit-captcha="captchaText => operate({ action: 'submitCaptcha', captchaText }, 'No se pudo enviar el captcha.')"
      @refresh-captcha="operate({ action: 'refreshCaptcha' }, 'No se pudo pedir otra imagen.')"
      @cancel="operate({ action: 'cancel' }, 'No se pudo cancelar.')"
      @retry="start"
    />
  </section>
</template>

<style scoped>
.sat-portal-action { display: grid; gap: 10px; min-width: 0; }
.sat-portal-action h4 { margin: 0; }
/* Dentro del modal, la fila de botones no lleva el margen ni la alineación a la derecha del pie (`dialog .actions`). */
.sat-portal-action .actions { margin: 0; justify-content: flex-start; }
</style>
