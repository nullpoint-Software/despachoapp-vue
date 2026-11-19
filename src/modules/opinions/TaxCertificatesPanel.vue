<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Eye, FileText, RefreshCw } from '@lucide/vue'
import type { ClientDocument, DocumentListResult } from '../../../shared/contracts/documents'
import type { ClientOpinionSummary } from '../../../shared/contracts/complianceOpinions'
import ActionButton from '../../shared/components/ActionButton.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import SearchSelectField from '../../shared/components/SearchSelectField.vue'
import StatusBadge from '../../shared/components/StatusBadge.vue'
import { readIpcErrorMessage } from '../../shared/ipcErrorMessage'
import { showPdf } from '../../shared/pdf/pdfViewerState'
import SatPortalAction from '../clients/SatPortalAction.vue'
import RfcLookupPanel from './RfcLookupPanel.vue'

/**
 * Constancias de situación fiscal (CSF) del cliente (2026-10-17, pedido del usuario: "mover la CSF a su propia sección,
 * como Opinión"), en Cumplimiento → Constancias. [[TAX-STATUS-CERTIFICATE]], [[SAT-PORTAL#CSF]].
 *
 * - **Cliente:** se elige de los clientes de Cumplimiento (la misma lista de opiniones, que ya filtra por asignación).
 * - **Lista:** los documentos `taxStatusCertificate` del expediente del cliente (GLOBAL, Host), la más reciente
 *   primero, con fecha, quién la guardó y su estado. «Ver» la abre en el visor de Fiscenix (acción `view` del
 *   expediente, auditada).
 * - **Obtener:** `SatPortalAction` en línea (captcha en Fiscenix, pasos de avance); al guardar se recarga la lista.
 * - **No clientes** (2026-10-17): selector «Clientes / No clientes»; la segunda muestra `RfcLookupPanel` (calculadora
 *   en modal, Validación de RFC y CSF con su CIEC), que antes era la pestaña «Por RFC» de Cumplimiento.
 * Se leen hasta 5 páginas del expediente y se filtran aquí: las constancias de un cliente son pocas.
 * Estados vacío y de error explícitos; sin permiso de expediente el Host lo rechaza y se explica.
 */
const clients = ref<ClientOpinionSummary[]>([]), selectedClientId = ref(''), list = ref<DocumentListResult | null>(null), certificates = ref<ClientDocument[]>([])
const isLoading = ref(false), error = ref('')
/** Clientes (expediente) o No clientes (`RfcLookupPanel`); con `v-show` ninguna vista pierde su ejecución en curso. */
const audience = ref<'clients' | 'others'>('clients')
let isMounted = true
const selectedClient = computed(() => clients.value.find(client => client.clientId === selectedClientId.value) ?? null)
const clientOptions = computed(() => clients.value.map(client => ({ value: client.clientId, label: client.clientDisplayName, detail: client.rfc ?? 'Sin RFC', keywords: client.rfc ?? '' })))
const formatInstant = (value: string) => new Date(value).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })

async function loadClients(): Promise<void> {
  try {
    const result = await window.contapp.manageOpinions({ action: 'list' })
    if (result.status !== 'listed' || !isMounted) return
    clients.value = [...result.clients].sort((first, second) => first.clientDisplayName.localeCompare(second.clientDisplayName, 'es-MX'))
  } catch (caught) { if (isMounted) error.value = readIpcErrorMessage(caught, 'No se pudieron consultar los clientes.') }
}

/** Constancias del expediente del cliente elegido, la más reciente primero. */
async function loadCertificates(): Promise<void> {
  const clientId = selectedClientId.value
  if (!clientId) { list.value = null; certificates.value = []; return }
  isLoading.value = true; error.value = ''
  try {
    const found: ClientDocument[] = []
    let cursor: number | null = null, page = 0, lastList: DocumentListResult | null = null
    do {
      const result = await window.contapp.manageDocuments({ action: 'list', clientId, beforeCursor: cursor })
      if (result.status !== 'listed') break
      lastList = result.list
      found.push(...result.list.documents.filter(item => item.category === 'taxStatusCertificate'))
      cursor = result.list.nextCursor
    } while (cursor !== null && ++page < 5)
    if (!isMounted || clientId !== selectedClientId.value) return
    list.value = lastList
    certificates.value = found.sort((first, second) => second.createdAt.localeCompare(first.createdAt))
  } catch {
    if (isMounted) { list.value = null; certificates.value = []; error.value = 'No se pudo consultar el expediente del cliente. Revisa tu sesión, el permiso Consultar expediente y la asignación de este cliente.' }
  } finally { isLoading.value = false }
}

async function openCertificate(certificate: ClientDocument): Promise<void> {
  error.value = ''
  try {
    const result = await window.contapp.manageDocuments({ action: 'view', clientId: certificate.clientId, documentId: certificate.documentId })
    if (result.status === 'viewed' && isMounted) showPdf(result.view)
  } catch { if (isMounted) error.value = 'No se pudo abrir la constancia. Puede que perdieras acceso o que el archivo del Host requiera recuperación.' }
}

watch(selectedClientId, () => { void loadCertificates() })
onMounted(() => { void loadClients() })
onBeforeUnmount(() => { isMounted = false })
</script>

<template>
  <section
    class="tax-certificates"
    data-testid="tax-certificates"
    aria-labelledby="tax-certificates-title"
  >
    <div class="tax-certificates-heading">
      <div class="tax-certificates-title">
        <h2 id="tax-certificates-title">
          Constancias de situación fiscal
        </h2>
        <div
          v-sliding-tabs
          class="segmented-tabs"
          role="tablist"
          aria-label="Constancias de"
        >
          <button
            type="button"
            role="tab"
            :aria-selected="audience === 'clients'"
            @click="audience = 'clients'"
          >
            Clientes
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="audience === 'others'"
            @click="audience = 'others'"
          >
            No clientes
          </button>
        </div>
      </div>
      <SearchSelectField
        v-show="audience === 'clients'"
        id="tax-certificates-client"
        v-model="selectedClientId"
        label="Cliente"
        placeholder="Nombre o RFC"
        :options="clientOptions"
      />
    </div>
    <RfcLookupPanel v-show="audience === 'others'" />
    <InlineNotice
      v-if="error && audience === 'clients'"
      title="Constancias"
      tone="error"
    >
      <p>{{ error }}</p>
    </InlineNotice>
    <div
      v-show="audience === 'clients'"
      class="tax-certificates-clients"
    >
      <p
        v-if="!selectedClient"
        class="field-help tax-certificates-empty"
      >
        Elige un cliente para ver sus constancias y obtener una nueva con RFC y CIEC.
      </p>
      <div
        v-else
        class="tax-certificates-grid"
      >
        <article
          class="tax-certificates-card"
          aria-labelledby="tax-certificates-list-title"
        >
          <div class="tax-certificates-card-heading">
            <h3 id="tax-certificates-list-title">
              {{ selectedClient.clientDisplayName }}
            </h3>
            <ActionButton
              :is-loading="isLoading"
              :aria-label="'Actualizar las constancias de ' + selectedClient.clientDisplayName"
              @click="loadCertificates"
            >
              <RefreshCw
                :size="15"
                aria-hidden="true"
              />
            </ActionButton>
          </div>
          <ul
            v-if="certificates.length"
            class="tax-certificates-list"
            aria-label="Constancias guardadas"
          >
            <li
              v-for="(certificate, index) in certificates"
              :key="certificate.documentId"
              class="tax-certificate-row"
            >
              <FileText
                :size="18"
                aria-hidden="true"
              />
              <div>
                <strong>{{ formatInstant(certificate.createdAt) }}</strong>
                <span class="field-help">{{ certificate.displayName }} · {{ certificate.createdByDisplayName }}</span>
              </div>
              <StatusBadge :tone="!certificate.hasStoredFile ? 'error' : index === 0 ? 'success' : 'neutral'">
                {{ !certificate.hasStoredFile ? 'Archivo no disponible' : index === 0 ? 'Más reciente' : 'Anterior' }}
              </StatusBadge>
              <ActionButton
                :disabled="!certificate.hasStoredFile"
                :aria-label="'Ver constancia del ' + formatInstant(certificate.createdAt)"
                @click="openCertificate(certificate)"
              >
                <Eye
                  :size="15"
                  aria-hidden="true"
                /> Ver
              </ActionButton>
            </li>
          </ul>
          <p
            v-else-if="!isLoading && list"
            class="field-help tax-certificates-empty"
          >
            Todavía no hay constancias de este cliente. Obtén la primera con RFC y CIEC.
          </p>
        </article>
        <article class="tax-certificates-card">
          <SatPortalAction
            :client-id="selectedClient.clientId"
            :client-display-name="selectedClient.clientDisplayName"
            :can-use="Boolean(list?.availability === 'ready' && list.canUpload)"
            @completed="loadCertificates"
          />
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
.tax-certificates { display: grid; gap: var(--spaceMedium); min-width: 0; }
.tax-certificates-heading { display: grid; grid-template-columns: minmax(0, 1fr) minmax(min(100%, 280px), 360px); gap: var(--spaceMedium); align-items: end; }
.tax-certificates-heading h2 { margin: 0; }
.tax-certificates-title { display: grid; gap: 10px; justify-items: start; min-width: 0; }
.tax-certificates-clients { display: grid; gap: var(--spaceMedium); min-width: 0; }
.tax-certificates-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr)); gap: var(--spaceMedium); align-items: start; }
.tax-certificates-card { display: grid; gap: 12px; padding: var(--spaceMedium); border: 2px solid var(--strongBorderColor); background: var(--surfaceColor); border-radius: var(--radiusNested); min-width: 0; }
.tax-certificates-card-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.tax-certificates-card-heading h3 { margin: 0; font-size: 15px; overflow-wrap: anywhere; }
.tax-certificates-list { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
.tax-certificate-row { display: grid; grid-template-columns: auto minmax(0, 1fr) auto auto; gap: 10px; align-items: center; padding: 10px 12px; border: 2px solid var(--borderColor); border-radius: var(--radiusNested); }
.tax-certificate-row > div { display: grid; gap: 2px; min-width: 0; overflow-wrap: anywhere; }
.tax-certificates-empty { margin: 0; padding: var(--spaceMedium); border: 2px dashed var(--borderColor); border-radius: var(--radiusNested); }
@media (max-width: 640px) {
  .tax-certificates-heading { grid-template-columns: 1fr; }
  .tax-certificate-row { grid-template-columns: auto minmax(0, 1fr); }
}
</style>
