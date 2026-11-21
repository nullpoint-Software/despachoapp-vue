<script setup lang="ts">
import HoldButton from '../../shared/vueBits/HoldButton.vue'
import LatticeLoader from '../../shared/vueBits/LatticeLoader.vue'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { KeyRound, RefreshCw, Trash2, X } from '@lucide/vue'
import { getOfficeToday } from '../../../shared/contracts/movements'
import type { SatCredentialDevice, SatCredentialInfo, SatDirection, SatDownloadRequest, SatDownloadState } from '../../../shared/contracts/satDownloads'
import ActionButton from '../../shared/components/ActionButton.vue'
import CheckField from '../../shared/components/CheckField.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import SearchSelectField from '../../shared/components/SearchSelectField.vue'
import DateField from '../../shared/components/DateField.vue'
import StatusBadge from '../../shared/components/StatusBadge.vue'
import TextField from '../../shared/components/TextField.vue'
import { useNotifications } from '../../shared/notifications/notificationStore'
import { readIpcErrorMessage } from '../../shared/ipcErrorMessage'
import { formatBusinessDate } from '../../../shared/presentation/movementLabels'
import SatAutomationSection from './SatAutomationSection.vue'

/**
 * Descarga masiva del SAT (6.3), en el modal de captura de Fiscal, como el original:
 * - **e.firma de este equipo:** se elige el .cer y el .key (diálogo nativo) y se escribe la contraseña.
 *   Main la valida contra el RFC del cliente y la sella en este equipo; aquí sólo se ven RFC y vigencia.
 * - **Solicitud:** emitidas y/o recibidas de un periodo de hasta 31 días. La ejecuta este equipo en
 *   segundo plano mientras Fiscenix esté abierto con sesión, y los XML entran a su biblioteca.
 * - **Automático** (2026-10-11, `SatAutomationSection`): programación por cliente con cobertura continua y recuperación
 *   cuando el SAT falla. La solicitud manual sigue igual.
 * - **Historial compartido** del cliente (todos los equipos, manuales y automáticas), que se actualiza cada 20 segundos.
 * - **Pestañas** (2026-10-12, pedido del usuario): e.firma, Automático, RFC y CIEC (sólo si quien lo usa pasa el slot `portal`)
 *   e Historial, con las mismas `segmented-tabs` de los demás modales. Con `v-show` cada pestaña conserva lo capturado y
 *   sus sondeos; al solicitar una descarga se pasa a Historial para verla avanzar.
 */
/**
 * `initialTab` (2026-10-17): un aviso de recuperación pendiente abre el modal directo en «RFC y CIEC».
 * `portalHistory`: arriba del Historial, las recuperaciones pendientes del portal (`SatPortalRecoveryList`).
 */
const props = defineProps<{ clients: Array<{ clientId: string; clientName: string }>; initialTab?: 'portal' }>()
const slots = defineSlots<{ portal?: () => unknown; portalHistory?: () => unknown }>()
const tab = ref<'eFirma' | 'automatic' | 'portal' | 'history'>(props.initialTab ?? 'eFirma')
watch(() => props.initialTab, value => { if (value) tab.value = value })
const { notify } = useNotifications()
const clientId = ref(props.clients[0]?.clientId ?? '')
const credential = ref<SatCredentialInfo | null>(null), devices = ref<SatCredentialDevice[]>([]), requests = ref<SatDownloadRequest[]>([])
const password = ref(''), isSaving = ref(false), isRequesting = ref(false), error = ref('')
const today = getOfficeToday()
const fromDate = ref(today.slice(0, 8) + '01'), toDate = ref(today)
const wantsIssued = ref(true), wantsReceived = ref(true)
const clientOptions = computed(() => props.clients.map(client => ({ value: client.clientId, label: client.clientName })))
const otherDevices = computed(() => devices.value.filter(device => !device.isThisDevice))
let timer: ReturnType<typeof setInterval> | undefined, isMounted = true

const stateLabels: Record<SatDownloadState, string> = { pending: 'En espera', requested: 'Solicitud enviada', processing: 'Preparando paquetes', downloading: 'Importando XML', completed: 'Importación terminada', noData: 'Sin CFDI', failed: 'Requiere atención', cancelled: 'Cancelada' }
const stateTones: Record<SatDownloadState, 'neutral' | 'info' | 'success' | 'warning' | 'error'> = { pending: 'neutral', requested: 'info', processing: 'info', downloading: 'info', completed: 'success', noData: 'neutral', failed: 'error', cancelled: 'warning' }
const isActive = (request: SatDownloadRequest) => ['pending', 'requested', 'processing', 'downloading'].includes(request.state)

async function loadClient(): Promise<void> {
  if (!clientId.value) return
  error.value = ''
  try {
    const [information, deviceResult, listResult] = await Promise.all([window.contapp.readSatCredential(clientId.value),
      window.contapp.manageSatDownloads({ action: 'listCredentialDevices', clientId: clientId.value }), window.contapp.manageSatDownloads({ action: 'list', clientId: clientId.value })])
    if (!isMounted) return
    credential.value = information
    devices.value = deviceResult.status === 'credentialDevices' ? deviceResult.devices : []
    requests.value = listResult.status === 'listed' ? listResult.requests : []
  } catch (caught) { error.value = readIpcErrorMessage(caught, 'No se pudo consultar la e.firma ni el historial del cliente.') }
}
async function refreshHistory(): Promise<void> {
  if (!clientId.value) return
  try { const result = await window.contapp.manageSatDownloads({ action: 'list', clientId: clientId.value }); if (result.status === 'listed' && isMounted) requests.value = result.requests } catch { /* Se reintenta en el siguiente ciclo. */ }
}
async function saveCredential(): Promise<void> {
  if (!password.value || isSaving.value) return
  isSaving.value = true; error.value = ''
  try {
    if (await window.contapp.saveSatCredential(clientId.value, password.value) === 'saved') { notify('e.firma guardada', 'Quedó sellada en este equipo; no se envía al Host ni a otros equipos.', 'success'); await loadClient() }
  } catch (caught) { error.value = readIpcErrorMessage(caught, 'No se guardó la e.firma.') }
  finally { password.value = ''; isSaving.value = false }
}
async function deleteCredential(): Promise<void> {
  try { await window.contapp.deleteSatCredential(clientId.value); notify('e.firma borrada', 'Se eliminó de este equipo.', 'success'); await loadClient() }
  catch (caught) { error.value = readIpcErrorMessage(caught, 'No se borró la e.firma.') }
}
async function requestDownload(): Promise<void> {
  const directions: SatDirection[] = [...(wantsIssued.value ? ['issued' as const] : []), ...(wantsReceived.value ? ['received' as const] : [])]
  if (!directions.length || isRequesting.value) return
  isRequesting.value = true; error.value = ''
  try {
    for (const direction of directions) await window.contapp.requestSatDownload({ clientId: clientId.value, direction, fromDate: fromDate.value, toDate: toDate.value })
    notify('Descarga solicitada', 'Puedes cerrar esta ventana; este equipo continuará mientras Fiscenix esté abierto con sesión.', 'success')
    await refreshHistory(); tab.value = 'history'
  } catch (caught) { error.value = readIpcErrorMessage(caught, 'No se solicitó la descarga. El periodo debe ser de hasta 31 días y sin fechas futuras.') }
  finally { isRequesting.value = false }
}
async function cancel(request: SatDownloadRequest): Promise<void> {
  try { await window.contapp.manageSatDownloads({ action: 'cancel', requestId: request.requestId, revision: request.revision }); await refreshHistory() }
  catch (caught) { error.value = readIpcErrorMessage(caught, 'No se canceló; actualiza el historial.'); await refreshHistory() }
}
function describeProgress(request: SatDownloadRequest): string {
  const parts = [request.satMessage]
  if (request.packageCount) parts.push(request.downloadedPackageCount + ' de ' + request.packageCount + ' paquete(s)')
  if (request.importedCount || request.duplicateCount || request.rejectedCount) parts.push(request.importedCount + ' nuevo(s), ' + request.duplicateCount + ' ya existían, ' + request.rejectedCount + ' rechazado(s)')
  if (request.nextAttemptAt && isActive(request)) parts.push('siguiente revisión ' + new Date(request.nextAttemptAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }))
  return parts.filter(Boolean).join(' · ')
}

watch(clientId, () => { credential.value = null; void loadClient() })
onMounted(() => { void loadClient(); timer = setInterval(() => { void refreshHistory() }, 20000) })
onBeforeUnmount(() => { isMounted = false; clearInterval(timer); password.value = '' })
</script>
<template>
  <div
    class="sat-panel"
    data-testid="sat-panel"
  >
    <InlineNotice
      v-if="!clients.length"
      title="Sin clientes disponibles"
      tone="warning"
    >
      <p>Se necesita un cliente asignado con lectura y escritura y con RFC capturado.</p>
    </InlineNotice>
    <template v-else>
      <InlineNotice
        v-if="error"
        title="Operación no completada"
        tone="error"
      >
        <p>{{ error }}</p>
      </InlineNotice>
      <!-- Con un solo cliente (Fiscal) el modal ya lo nombra en su descripción. -->
      <SearchSelectField
        v-if="clients.length > 1"
        id="sat-client"
        v-model="clientId"
        placeholder="Nombre del cliente"
        label="Cliente"
        :options="clientOptions"
      />
      <div
        v-sliding-tabs
        class="segmented-tabs"
        role="tablist"
        aria-label="Forma de descarga"
      >
        <button
          type="button"
          role="tab"
          :aria-selected="tab === 'eFirma'"
          @click="tab = 'eFirma'"
        >
          e.firma
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="tab === 'automatic'"
          @click="tab = 'automatic'"
        >
          Automático
        </button>
        <button
          v-if="slots.portal"
          type="button"
          role="tab"
          :aria-selected="tab === 'portal'"
          @click="tab = 'portal'"
        >
          RFC y CIEC
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="tab === 'history'"
          @click="tab = 'history'"
        >
          Historial
        </button>
      </div>

      <section
        v-show="tab === 'eFirma'"
        class="sat-section"
        aria-labelledby="sat-credential-title"
      >
        <h3 id="sat-credential-title">
          e.firma en este equipo
        </h3>
        <div
          v-if="credential"
          class="sat-credential"
          data-testid="sat-credential"
        >
          <KeyRound
            :size="18"
            aria-hidden="true"
          />
          <span>{{ credential.rfc }} · vigente hasta {{ formatBusinessDate(credential.validUntil.slice(0, 10)) }}</span>
          <StatusBadge :tone="credential.isExpired ? 'error' : 'success'">
            {{ credential.isExpired ? 'Vencida' : 'Lista' }}
          </StatusBadge>
          <!-- Antes bastaba un clic; ahora se mantiene presionado (pulido 2026-10-03). -->
          <HoldButton
            size="small"
            aria-label="Borrar la e.firma de este equipo"
            done-label="Borrada"
            @hold="deleteCredential"
          >
            <template #icon>
              <Trash2
                :size="15"
                aria-hidden="true"
              />
            </template>
            Borrar
          </HoldButton>
        </div>
        <form
          v-else
          class="sat-credential-form"
          @submit.prevent="saveCredential"
        >
          <TextField
            id="sat-credential-password"
            v-model="password"
            type="password"
            autocomplete="off"
            label="Contraseña de la llave privada"
            help="Al continuar eliges juntos el .cer y el .key. Se valida que sea la e.firma vigente del RFC del cliente y se sella en este equipo."
            :disabled="isSaving"
          />
          <ActionButton
            type="submit"
            variant="primary"
            :is-loading="isSaving"
            :disabled="!password"
          >
            Elegir .cer y .key
          </ActionButton>
        </form>
        <p
          v-if="otherDevices.length"
          class="field-help"
        >
          También la tienen: {{ otherDevices.map(device => device.deviceAlias).join(', ') }}. Cada equipo descarga con su propia copia.
        </p>
      </section>

      <section
        v-show="tab === 'eFirma'"
        class="sat-section sat-section-divided"
        aria-labelledby="sat-request-title"
      >
        <h3 id="sat-request-title">
          Solicitud
        </h3>
        <div class="sat-request-grid">
          <DateField
            id="sat-from"
            v-model="fromDate"
            label="Desde"
            :max="toDate || today"
          />
          <DateField
            id="sat-to"
            v-model="toDate"
            label="Hasta"
            :min="fromDate || undefined"
            :max="today"
          />
          <CheckField
            id="sat-issued"
            v-model="wantsIssued"
            label="Emitidas"
          />
          <CheckField
            id="sat-received"
            v-model="wantsReceived"
            label="Recibidas (sólo vigentes)"
          />
        </div>
        <div class="actions">
          <ActionButton
            variant="primary"
            :is-loading="isRequesting"
            :disabled="!credential || credential.isExpired || (!wantsIssued && !wantsReceived)"
            @click="requestDownload"
          >
            Solicitar descarga
          </ActionButton>
        </div>
        <p class="field-help">
          Hasta 31 días por solicitud. El SAT tarda de minutos a horas en preparar los paquetes; este equipo revisa cada 2 minutos y los XML entran a su biblioteca.
        </p>
      </section>

      <SatAutomationSection
        v-show="tab === 'automatic'"
        :client-id="clientId"
        :devices="devices"
      />

      <div
        v-if="slots.portal"
        v-show="tab === 'portal'"
      >
        <slot name="portal" />
      </div>

      <section
        v-show="tab === 'history'"
        class="sat-section"
        aria-labelledby="sat-history-title"
      >
        <div class="section-heading">
          <h3 id="sat-history-title">
            Historial del cliente
          </h3>
          <ActionButton @click="refreshHistory">
            <RefreshCw
              :size="15"
              aria-hidden="true"
            /> Actualizar
          </ActionButton>
        </div>
        <slot name="portalHistory" />
        <ul
          class="sat-history"
          aria-label="Solicitudes al SAT"
        >
          <li
            v-for="request in requests"
            :key="request.requestId"
            class="sat-history-row"
          >
            <div>
              <strong>{{ request.direction === 'issued' ? 'Emitidas' : 'Recibidas' }} · {{ formatBusinessDate(request.fromDate) }} – {{ formatBusinessDate(request.toDate) }}<template v-if="request.method === 'portal'"> · con RFC y CIEC</template></strong>
              <span class="field-help">{{ describeProgress(request) }}</span>
              <!-- Automática (migración 098, ADR-037): la ejecutó el equipo, sin sesión, por cuenta de quien guardó la programación. -->
              <span
                v-if="request.origin === 'scheduled'"
                class="field-help sat-history-origin"
                data-testid="sat-history-scheduled"
              >
                <StatusBadge tone="info">Automática</StatusBadge>
                <span>{{ request.isThisDevice ? 'este equipo' : request.executorDeviceAlias }} por cuenta de {{ request.requestedByDisplayName }}</span>
              </span>
              <span
                v-else
                class="field-help"
              >{{ request.requestedByDisplayName }} · {{ request.isThisDevice ? 'este equipo' : request.executorDeviceAlias }}</span>
            </div>
            <LatticeLoader
              v-if="isActive(request)"
              :label="stateLabels[request.state]"
              :show-timer="false"
            />
            <StatusBadge
              v-else
              :tone="stateTones[request.state]"
            >
              {{ stateLabels[request.state] }}
            </StatusBadge>
            <ActionButton
              v-if="isActive(request)"
              :aria-label="'Cancelar solicitud ' + request.folio"
              @click="cancel(request)"
            >
              <X
                :size="15"
                aria-hidden="true"
              />
            </ActionButton>
          </li>
          <li
            v-if="!requests.length"
            class="field-help"
          >
            Este cliente no tiene solicitudes al SAT.
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
<style scoped>
.sat-panel { display: grid; gap: var(--spaceLarge); }
.sat-panel > .segmented-tabs { justify-self: center; }
/* Las pestañas ya separan: sin línea arriba de cada sección (ni la global de .section-heading); sólo la solicitud, que comparte pestaña con la e.firma, conserva su divisor. */
.sat-section { display: grid; gap: var(--spaceMedium); }
.sat-section .section-heading { border-top: none; padding-top: 0; }
.sat-section-divided { padding-top: var(--spaceMedium); border-top: 1px solid var(--borderColor); }
.sat-section h3 { margin: 0; font-size: 13px; letter-spacing: .05em; text-transform: uppercase; }
.sat-credential { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.sat-credential-form { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: var(--spaceMedium); align-items: end; }
.sat-request-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 170px), 1fr)); gap: var(--spaceMedium); align-items: end; }
.sat-history { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.sat-history-row { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 10px; align-items: center; padding: 10px 12px; border: 2px solid var(--borderColor); background: var(--surfaceColor); border-radius: var(--radiusNested); }
.sat-history-row > div { display: grid; gap: 2px; min-width: 0; overflow-wrap: anywhere; }
.sat-history-origin { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
@container (max-width: 520px) { .sat-credential-form { grid-template-columns: minmax(0, 1fr); } }
</style>
