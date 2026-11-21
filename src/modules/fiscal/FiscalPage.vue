<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { ArrowLeftRight, ClipboardCheck, Library } from '@lucide/vue'
import XmlPage from '../xml/XmlPage.vue'
import TaxObligationsReport from './TaxObligationsReport.vue'
import ClientFiscalWorkspace from './ClientFiscalWorkspace.vue'
import ActionButton from '../../shared/components/ActionButton.vue'
import SideDrawer from '../../shared/components/SideDrawer.vue'
import SearchSelectField from '../../shared/components/SearchSelectField.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import ListPager from '../../shared/components/ListPager.vue'
import HelpTip from '../../shared/components/HelpTip.vue'
import { workspaceAccess } from '../workspace/sessionState'
import { readIpcErrorMessage } from '../../shared/ipcErrorMessage'
import { loadFiscalClients, type FiscalClient } from './fiscalClients'
import { useNavigationRequest, type NavigationRequest } from '../../shared/navigation/navigationRequests'

/**
 * Fiscal por cliente (rediseño 2026-10-04, pedido del usuario siguiendo la ContaApp anterior): los reportes son de cada
 * cliente, así que al entrar se pide el cliente (selector con búsqueda por nombre o RFC) y después se muestra su
 * espacio de trabajo (ClientFiscalWorkspace): XML del periodo, resumen, tabla de datos, reportes mensuales y anuales,
 * y PDF. "Cambiar cliente" vuelve a elegir.
 * La **Biblioteca XML de este equipo** (todos los XML, sin cliente y papelera) sigue disponible en un cajón lateral.
 * **Obligaciones de clientes** (2026-10-18) abre en otro cajón el reporte del periodo de todos los clientes asignados:
 * pendientes, vencidas y cumplidas, con PDF (TaxObligationsReport, [[modules/TAX-OBLIGATIONS]]).
 * El cliente elegido sólo vive en memoria de la vista; no se guarda.
 */
const clients = ref<FiscalClient[]>([]), selectedClientId = ref(''), isLibraryOpen = ref(false), isObligationReportOpen = ref(false)
const isLoading = ref(true), error = ref('')
const options = computed(() => clients.value.map(client => ({ value: client.clientId, label: client.displayName, detail: client.rfc || 'Sin RFC: captúralo en Clientes' })))
const client = computed(() => clients.value.find(item => item.clientId === selectedClientId.value) ?? null)
const missingRfc = computed(() => client.value && !client.value.rfc)
/** Tarjetas de clientes bajo el buscador (2026-10-04): elegir con un clic, 12 por página. */
const tilesPerPage = 12
const tilePage = ref(0)
const tilePageCount = computed(() => Math.max(1, Math.ceil(clients.value.length / tilesPerPage)))
const pagedTiles = computed(() => clients.value.slice(tilePage.value * tilesPerPage, (tilePage.value + 1) * tilesPerPage))
/**
 * Avisos que llevan a Fiscal (2026-10-10): `view: 'library'` abre la Biblioteca XML; `itemId` elige ese cliente en
 * cuanto la lista de clientes está cargada y la solicitud pasa a ClientFiscalWorkspace (por ejemplo, para abrir
 * "Reportes guardados" en el reporte `nestedItemId`). Un cliente fuera de la lista abandona la solicitud.
 */
const pendingRequest = ref<NavigationRequest | null>(null), workspaceRequest = ref<NavigationRequest | null>(null)
useNavigationRequest('fiscal', request => {
  if (request.view === 'library') isLibraryOpen.value = true
  if (request.itemId) pendingRequest.value = request
})
watch([pendingRequest, isLoading], () => {
  const request = pendingRequest.value
  if (!request || isLoading.value) return
  pendingRequest.value = null
  if (!clients.value.some(item => item.clientId === request.itemId)) return
  selectedClientId.value = request.itemId ?? ''
  workspaceRequest.value = request
  // Se entrega una sola vez: al montarse (o en caliente) el espacio la aplica; después se retira para que volver a
  // elegir el mismo cliente no reabra el cajón.
  void nextTick().then(() => nextTick()).then(() => { if (workspaceRequest.value?.requestId === request.requestId) workspaceRequest.value = null })
}, { immediate: true })
onMounted(async () => {
  if (!workspaceAccess.value.canReadClients) { isLoading.value = false; return }
  try { clients.value = await loadFiscalClients() } catch (caught) { error.value = readIpcErrorMessage(caught, 'No se pudieron consultar los clientes.') }
  finally { isLoading.value = false }
})
</script>
<template>
  <div
    class="fiscal-page"
    data-testid="fiscal-page"
  >
    <div class="section-heading page-heading">
      <div>
        <div class="help-title-row">
          <h1>Fiscal</h1>
          <HelpTip
            title="Cómo trabaja Fiscal"
            text="Elige un cliente y un periodo. La tabla se calcula con los XML guardados en este equipo, que nunca salen de él; los reportes que guardes sí van al Host y los ven los demás equipos con permiso."
          />
        </div>
        <p
          v-if="client"
          class="lede fiscal-client-line"
        >
          <strong>{{ client.displayName }}</strong> <span class="fiscal-rfc">{{ client.rfc || 'Sin RFC' }}</span>
        </p>
      </div>
      <div class="actions">
        <ActionButton
          v-if="client"
          @click="selectedClientId = ''"
        >
          <ArrowLeftRight
            :size="16"
            aria-hidden="true"
          /> Cambiar cliente
        </ActionButton>
        <ActionButton
          v-if="workspaceAccess.canReadReports"
          data-testid="fiscal-obligation-report-open"
          @click="isObligationReportOpen = true"
        >
          <ClipboardCheck
            :size="16"
            aria-hidden="true"
          /> Obligaciones de clientes
        </ActionButton>
        <ActionButton @click="isLibraryOpen = true">
          <Library
            :size="16"
            aria-hidden="true"
          /> Biblioteca XML
        </ActionButton>
      </div>
    </div>
    <InlineNotice
      v-if="error"
      title="Sin clientes"
      tone="error"
    >
      <p>{{ error }}</p>
    </InlineNotice>

    <!-- 1. Primero el cliente: todo lo demás es suyo. -->
    <section
      v-if="!client || missingRfc"
      class="surface-panel fiscal-gate"
      aria-labelledby="fiscal-gate-title"
      data-testid="fiscal-client-gate"
    >
      <h2 id="fiscal-gate-title">
        ¿De qué cliente?
      </h2>
      <p class="field-help">
        Los XML, la tabla de datos, los reportes mensuales y anuales y sus PDF son de cada cliente. Escribe su nombre o RFC.
      </p>
      <div class="fiscal-gate-search">
        <SearchSelectField
          id="fiscal-client"
          v-model="selectedClientId"
          label="Cliente"
          placeholder="Nombre o RFC del cliente"
          :options="options"
          :disabled="isLoading || !clients.length"
          :error="missingRfc ? 'Este cliente no tiene RFC: captúralo en Clientes para encontrar sus XML.' : ''"
          :help="isLoading ? 'Consultando clientes…' : !clients.length && !error ? 'No tienes clientes asignados.' : undefined"
        />
      </div>
      <p
        v-if="clients.length"
        class="fiscal-gate-subtitle"
      >
        O elige de tus clientes
      </p>
      <ul
        v-if="clients.length"
        class="fiscal-client-tiles"
        aria-label="Clientes"
      >
        <li
          v-for="item in pagedTiles"
          :key="item.clientId"
        >
          <button
            type="button"
            class="fiscal-client-tile"
            :class="{ 'is-selected': item.clientId === selectedClientId }"
            :disabled="!item.rfc"
            :aria-label="'Elegir ' + item.displayName"
            @click="selectedClientId = item.clientId"
          >
            <strong>{{ item.displayName }}</strong>
            <span class="fiscal-rfc">{{ item.rfc || 'Sin RFC: captúralo en Clientes' }}</span>
            <span
              v-if="item.access === 'readOnly'"
              class="fiscal-tile-chip"
            >Solo lectura</span>
          </button>
        </li>
      </ul>
      <ListPager
        v-model:page="tilePage"
        :page-count="tilePageCount"
        :total-count="clients.length"
        :page-size="tilesPerPage"
        label="clientes"
      />
    </section>
    <ClientFiscalWorkspace
      v-else
      :key="client.clientId"
      :client="client"
      :navigation-request="workspaceRequest"
    />

    <SideDrawer
      :is-open="isLibraryOpen"
      title="Biblioteca XML de este equipo"
      test-id="xml-library-drawer"
      @close="isLibraryOpen = false"
    >
      <XmlPage v-if="isLibraryOpen" />
    </SideDrawer>
    <SideDrawer
      :is-open="isObligationReportOpen"
      title="Obligaciones fiscales de clientes"
      test-id="fiscal-obligation-report-drawer"
      @close="isObligationReportOpen = false"
    >
      <TaxObligationsReport v-if="isObligationReportOpen" />
    </SideDrawer>
  </div>
</template>
<style scoped>
.fiscal-page { display: grid; gap: var(--spaceMedium); }
.fiscal-client-line { display: flex; flex-wrap: wrap; gap: 10px; align-items: baseline; }
.fiscal-rfc { font-family: var(--monoFontFamily); }
.fiscal-gate { display: grid; gap: 12px; }
.fiscal-gate h2 { margin: 0; }
.fiscal-gate-search { max-width: 720px; }
.fiscal-gate-subtitle { margin: 8px 0 0; padding-top: 12px; border-top: 2px solid var(--borderColor); font-family: var(--monoFontFamily); font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--mutedTextColor); }
.fiscal-client-tiles { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr)); gap: 10px; }
.fiscal-client-tile { display: grid; gap: 4px; align-content: start; width: 100%; min-height: 76px; padding: 12px 14px; border: 2px solid var(--borderColor); background: var(--surfaceColor); color: var(--textColor); font: inherit; text-align: left; cursor: pointer; box-shadow: var(--buttonShadow); transition-property: transform, box-shadow, background-color; transition-duration: var(--durationQuick, 150ms); }
.fiscal-client-tile:hover:not(:disabled) { background: var(--hoverColor); }
.fiscal-client-tile:active:not(:disabled) { transform: translate(3px, 3px); box-shadow: none; }
.fiscal-client-tile:focus-visible { outline: 3px solid var(--focusColor); outline-offset: 2px; }
.fiscal-client-tile:disabled { opacity: .55; cursor: not-allowed; box-shadow: none; }
.fiscal-client-tile.is-selected { border-color: var(--accentColor); }
.fiscal-client-tile strong { font-weight: 800; overflow-wrap: anywhere; }
.fiscal-tile-chip { justify-self: start; padding: 0 6px; border: 2px solid var(--hairlineColor); font-family: var(--monoFontFamily); font-size: 11px; font-weight: 700; }
</style>
