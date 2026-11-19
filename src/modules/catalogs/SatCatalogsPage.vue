<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { gsap } from 'gsap'
import { Download, RefreshCw, Trash2 } from '@lucide/vue'
import { findSatCatalogDefinition, satCatalogDefinitions, type SatCatalogEntry, type SatCatalogId, type SatCatalogStatus } from '../../../shared/contracts/satCatalogs'
import ActionButton from '../../shared/components/ActionButton.vue'
import ListToolbar from '../../shared/components/ListToolbar.vue'
import SideDrawer from '../../shared/components/SideDrawer.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import StatusBadge from '../../shared/components/StatusBadge.vue'
import HoldButton from '../../shared/vueBits/HoldButton.vue'
import { useNotifications } from '../../shared/notifications/notificationStore'
import { refreshSatCodeCatalogs } from './satCodeLookup'
import HelpTip from '../../shared/components/HelpTip.vue'

/**
 * Catálogos SAT (ADR-032). La persona decide qué catálogos descargar en ESTE equipo y busca códigos sin conexión.
 * - Primero la búsqueda por código o palabras en un catálogo descargado o incluido (la tarea más frecuente).
 * - Los catálogos agrupados por uso, con su tamaño y estado (incluido, descargado o sin descargar): descargar,
 *   actualizar y borrar (manteniendo presionado). Desde el 2026-10-17 viven en un cajón («Administrar catálogos»).
 * Los catálogos descargados también dan significado a los códigos en el detalle de los CFDI (satCodeLookup).
 */
const { notify } = useNotifications()
const statuses = ref<SatCatalogStatus[]>([])
const busyCatalogId = ref<SatCatalogId | null>(null), error = ref('')
const searchCatalogId = ref<SatCatalogId>('regimenFiscal'), searchText = ref(''), results = ref<SatCatalogEntry[]>([]), isSearching = ref(false), searchError = ref('')
const resultList = ref<HTMLElement | null>(null)
const isManagerOpen = ref(false)
const motion = gsap.context(() => {})
const canAnimate = () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches
let searchTimer: ReturnType<typeof setTimeout> | undefined
let searchVersion = 0

/** Grupos por uso, para no presentar 13 catálogos como una sola lista. */
const catalogGroups = [
  { title: 'Facturación', catalogIds: ['regimenFiscal', 'usoCfdi', 'formaPago', 'metodoPago', 'tipoComprobante', 'tipoRelacion', 'impuesto', 'moneda'] },
  { title: 'Conceptos y ubicación', catalogIds: ['claveProdServ', 'claveUnidad', 'codigoPostal'] },
  { title: 'Comercio exterior', catalogIds: ['pais', 'aduana'] }
].map(group => ({ title: group.title, definitions: satCatalogDefinitions.filter(definition => (group.catalogIds as string[]).includes(definition.catalogId)) }))
const usable = computed(() => statuses.value.filter(status => status.state !== 'available'))
function statusOf(catalogId: SatCatalogId): SatCatalogStatus | undefined { return statuses.value.find(status => status.catalogId === catalogId) }
function formatBytes(bytes: number): string { return bytes >= 1048576 ? (bytes / 1048576).toLocaleString('es-MX', { maximumFractionDigits: 1 }) + ' MB' : Math.max(1, Math.round(bytes / 1024)) + ' KB' }
function formatDate(value: string): string { return new Date(value).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) }
function readMessage(cause: unknown, fallback: string): string { return cause instanceof Error ? cause.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : fallback }

async function loadStatuses(): Promise<void> {
  try {
    const result = await window.contapp.manageSatCatalogs({ action: 'list' })
    if (result.action === 'list') statuses.value = result.catalogs
  } catch (cause) { error.value = readMessage(cause, 'No se pudieron leer los catálogos de este equipo.') }
}
async function download(catalogId: SatCatalogId): Promise<void> {
  busyCatalogId.value = catalogId; error.value = ''
  try {
    const result = await window.contapp.manageSatCatalogs({ action: 'download', catalogId })
    if (result.action === 'download') {
      await loadStatuses(); refreshSatCodeCatalogs()
      notify('Catálogo descargado', findSatCatalogDefinition(catalogId).title + ': ' + (result.catalog.entryCount ?? 0).toLocaleString('es-MX') + ' claves.', 'success')
      if (!searchText.value) searchCatalogId.value = catalogId
    }
  } catch (cause) { error.value = readMessage(cause, 'No se pudo descargar el catálogo.') }
  finally { busyCatalogId.value = null }
}
async function remove(catalogId: SatCatalogId): Promise<void> {
  busyCatalogId.value = catalogId; error.value = ''
  try {
    await window.contapp.manageSatCatalogs({ action: 'delete', catalogId })
    await loadStatuses(); refreshSatCodeCatalogs()
    if (searchCatalogId.value === catalogId) searchCatalogId.value = 'regimenFiscal'
  } catch (cause) { error.value = readMessage(cause, 'No se pudo borrar el catálogo.') }
  finally { busyCatalogId.value = null }
}

/** Búsqueda con espera de 200 ms al escribir; sólo se muestra la respuesta de la última consulta. */
async function runSearch(): Promise<void> {
  const version = ++searchVersion
  isSearching.value = true; searchError.value = ''
  try {
    const result = await window.contapp.manageSatCatalogs({ action: 'search', catalogId: searchCatalogId.value, text: searchText.value })
    if (version !== searchVersion || result.action !== 'search') return
    results.value = result.entries
    await nextTick()
    if (resultList.value && canAnimate()) motion.add(() => gsap.from(Array.from(resultList.value!.children).slice(0, 12), { y: 6, opacity: 0, duration: .2, stagger: .02, ease: 'power2.out', clearProps: 'transform,opacity' }))
  } catch (cause) { if (version === searchVersion) { results.value = []; searchError.value = readMessage(cause, 'No se pudo buscar.') } }
  finally { if (version === searchVersion) isSearching.value = false }
}
watch(searchText, () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { void runSearch() }, 200) })
watch(searchCatalogId, () => { void runSearch() })
onMounted(async () => { await loadStatuses(); void runSearch() })
onBeforeUnmount(() => { clearTimeout(searchTimer); motion.revert() })
</script>
<template>
  <section
    class="catalogs-page"
    data-testid="sat-catalogs-page"
  >
    <div class="section-heading page-heading">
      <div>
        <div class="help-title-row">
          <h1>Catálogos SAT</h1>
          <HelpTip
            title="Catálogos en este equipo"
            text="Cada catálogo se descarga una vez y se guarda sólo en esta computadora, así la búsqueda funciona sin internet. También explican códigos en el detalle de un CFDI (uso, moneda, claves de producto y unidad) y el régimen en Cumplimiento; sin descargarlos, sólo se ve el código."
          />
        </div>
        <p class="lede">
          Descarga los catálogos que uses y busca qué significa cada código. Se guardan sólo en este equipo y funcionan sin internet.
        </p>
      </div>
      <ActionButton
        data-testid="catalogs-manage"
        @click="isManagerOpen = true"
      >
        <Download
          :size="16"
          aria-hidden="true"
        /> Administrar catálogos
      </ActionButton>
    </div>
    <InlineNotice
      v-if="error"
      title="Operación no completada"
      tone="error"
    >
      <p>{{ error }}</p>
    </InlineNotice>
    <div class="catalogs-layout">
      <section
        class="catalogs-panel catalogs-search"
        aria-labelledby="catalogs-search-title"
      >
        <header class="catalogs-panel-header">
          <h2 id="catalogs-search-title">
            Buscar un código
          </h2>
        </header>
        <!-- Barra común (ListToolbar): el catálogo va al inicio y la búsqueda (en vivo, 200 ms) ocupa el resto. -->
        <ListToolbar
          v-model:search="searchText"
          search-id="catalog-search-text"
          search-label="Código o palabras"
          label="Buscar en el catálogo"
          placeholder="Por ejemplo 626, G03 o servicios contables"
          :filter-count="null"
        >
          <template #leading>
            <label
              class="sr-only"
              for="catalog-search-catalog"
            >Catálogo</label>
            <select
              id="catalog-search-catalog"
              v-model="searchCatalogId"
              class="toolbar-select"
            >
              <option
                v-for="status in usable"
                :key="status.catalogId"
                :value="status.catalogId"
              >
                {{ findSatCatalogDefinition(status.catalogId).title }}
              </option>
            </select>
          </template>
        </ListToolbar>
        <p
          v-if="searchError"
          class="field-help search-error"
        >
          {{ searchError }}
        </p>
        <p
          class="field-help"
          aria-live="polite"
        >
          {{ isSearching ? 'Buscando…' : results.length === 50 ? 'Primeras 50 coincidencias; escribe más para afinar.' : results.length + (results.length === 1 ? ' coincidencia' : ' coincidencias') }}
        </p>
        <ul
          ref="resultList"
          class="result-list"
          aria-label="Resultados"
        >
          <li
            v-for="entry in results"
            :key="entry.code"
            class="result-item"
          >
            <span class="result-code">{{ entry.code }}</span>
            <div class="result-copy">
              <strong>{{ entry.description || 'Sin descripción' }}</strong>
              <span
                v-if="entry.detail"
                class="field-help"
              >{{ entry.detail }}</span>
            </div>
            <StatusBadge
              v-if="entry.isRetired"
              tone="warning"
            >
              Sin vigencia
            </StatusBadge>
          </li>
        </ul>
      </section>
    </div>
    <!-- Descargar, actualizar y borrar catálogos en un cajón (2026-10-17, pedido del usuario). -->
    <SideDrawer
      :is-open="isManagerOpen"
      title="Catálogos de este equipo"
      test-id="catalogs-drawer"
      @close="isManagerOpen = false"
    >
      <section
        class="catalogs-manager"
        aria-labelledby="catalogs-available"
      >
        <!-- El error de una descarga se ve aquí: con el cajón abierto, el aviso de la página queda detrás. -->
        <InlineNotice
          v-if="error"
          title="Operación no completada"
          tone="error"
        >
          <p>{{ error }}</p>
        </InlineNotice>
        <header class="catalogs-panel-header">
          <h2 id="catalogs-available">
            Catálogos
          </h2>
          <p class="field-help">
            Fuente: catálogos del SAT para CFDI 4.0 convertidos a JSON por bambucode/catalogos_sat_JSON. Su última actualización es de marzo de 2023; puede no incluir cambios posteriores del SAT.
          </p>
        </header>
        <div
          v-for="group in catalogGroups"
          :key="group.title"
          class="catalog-group"
        >
          <h3>{{ group.title }}</h3>
          <ul
            class="catalog-list"
            :aria-label="group.title"
          >
            <li
              v-for="definition in group.definitions"
              :key="definition.catalogId"
              class="catalog-item"
              :data-testid="'catalog-' + definition.catalogId"
            >
              <div class="catalog-copy">
                <strong>{{ definition.title }}</strong>
                <span class="field-help">{{ definition.usage }}</span>
                <span class="catalog-meta">
                  {{ statusOf(definition.catalogId)?.state === 'available' ? formatBytes(definition.approximateBytes) + ' por descargar'
                    : (statusOf(definition.catalogId)?.entryCount ?? 0).toLocaleString('es-MX') + ' claves' + (statusOf(definition.catalogId)?.downloadedAt ? ' · ' + formatDate(statusOf(definition.catalogId)!.downloadedAt!) : '') }}
                </span>
              </div>
              <div class="catalog-actions">
                <StatusBadge
                  v-if="statusOf(definition.catalogId)?.state === 'bundled'"
                  tone="neutral"
                >
                  Incluido
                </StatusBadge>
                <template v-else-if="statusOf(definition.catalogId)?.state === 'downloaded'">
                  <StatusBadge tone="success">
                    Descargado
                  </StatusBadge>
                  <ActionButton
                    :is-loading="busyCatalogId === definition.catalogId"
                    :disabled="busyCatalogId !== null"
                    :aria-label="'Actualizar ' + definition.title"
                    @click="download(definition.catalogId)"
                  >
                    <RefreshCw
                      :size="16"
                      aria-hidden="true"
                    />
                  </ActionButton>
                  <HoldButton
                    size="small"
                    is-icon-only
                    :aria-label="'Borrar ' + definition.title + ' de este equipo'"
                    :is-disabled="busyCatalogId !== null"
                    @hold="remove(definition.catalogId)"
                  >
                    <template #icon>
                      <Trash2
                        :size="16"
                        aria-hidden="true"
                      />
                    </template>
                  </HoldButton>
                </template>
                <ActionButton
                  v-else
                  :is-loading="busyCatalogId === definition.catalogId"
                  :disabled="busyCatalogId !== null"
                  :aria-label="'Descargar ' + definition.title"
                  @click="download(definition.catalogId)"
                >
                  <Download
                    :size="16"
                    aria-hidden="true"
                  /> Descargar
                </ActionButton>
              </div>
            </li>
          </ul>
        </div>
      </section>
    </SideDrawer>
  </section>
</template>
<style scoped>
.catalogs-page { container-type: inline-size; }
/* La búsqueda ocupa todo el ancho; la lista de catálogos vive en el cajón «Administrar catálogos» (2026-10-17). */
.catalogs-layout { display: grid; grid-template-columns: minmax(0, 1fr); gap: 20px; }
.catalogs-manager { display: grid; gap: 14px; min-width: 0; }
.catalogs-panel { display: grid; gap: 14px; padding: 20px; border: 0; border-radius: var(--radiusCard); background: var(--surfaceColor); box-shadow: var(--cardShadow); min-width: 0; }
.catalogs-panel-header { display: grid; gap: 6px; }
.catalogs-panel-header h2 { margin: 0; font-size: 16px; font-weight: 600; }
.catalog-list, .result-list { display: grid; margin: 0; padding: 0; list-style: none; }
.catalog-group { display: grid; gap: 2px; }
.catalog-group h3 { margin: 8px 0 4px; font-size: 12px; font-weight: 500; color: var(--mutedTextColor); }
.catalog-item { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 0; }
.catalog-item + .catalog-item { border-top: 1px solid var(--borderColor); }
.catalog-copy { display: grid; gap: 2px; min-width: 0; }
.catalog-copy strong { font-size: 14px; font-weight: 600; }
.catalog-meta { font-size: 12px; color: var(--mutedTextColor); font-variant-numeric: tabular-nums; }
.catalog-actions { display: flex; flex: none; align-items: center; gap: 6px; }
.search-error { color: var(--errorColor); }
.result-list { gap: 2px; max-height: min(60dvh, 560px); overflow-y: auto; overscroll-behavior: contain; }
.result-item { display: grid; grid-template-columns: 6.5em minmax(0, 1fr) auto; align-items: start; gap: 12px; padding: 10px 8px; border-radius: var(--radiusSmall); }
.result-item:hover { background: var(--hoverColor); }
.result-code { font-family: var(--monoFontFamily); font-size: 13px; font-variant-numeric: tabular-nums; padding-top: 1px; overflow-wrap: anywhere; }
.result-copy { display: grid; gap: 2px; min-width: 0; overflow-wrap: anywhere; }
.result-copy strong { font-size: 14px; font-weight: 500; }
</style>
