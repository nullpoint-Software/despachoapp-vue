<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Download, SlidersHorizontal } from '@lucide/vue'
import type { DiotResult, DiotSupplier } from '../../../shared/contracts/fiscalReports'
import ActionButton from '../../shared/components/ActionButton.vue'
import FormModal from '../../shared/components/FormModal.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import { useNotifications } from '../../shared/notifications/notificationStore'
import { readIpcErrorMessage } from '../../shared/ipcErrorMessage'
import { diotIssueLabels, operationTypeLabels, thirdPartyTypeLabels } from './reportLabels'
import SupplierSettingsForm from './SupplierSettingsForm.vue'

/**
 * DIOT del reporte mensual de recibidas (6.2): las líneas que calcula el Host con el layout 2025 del SAT,
 * sus avisos y los ajustes de cada proveedor. "Exportar TXT" lo hace Main con los datos del Host; con
 * avisos bloqueantes el botón se desactiva. Las columnas visibles son las más usadas; el TXT lleva las 54.
 */
const props = defineProps<{ reportId: string; clientId: string }>()
const { notify } = useNotifications()
const diot = ref<DiotResult | null>(null), isLoading = ref(false), error = ref(''), editing = ref<DiotSupplier | null>(null)
const blockingIssues = computed(() => diot.value?.issues.filter(issue => issue.isBlocking) ?? [])
const warnings = computed(() => diot.value?.issues.filter(issue => !issue.isBlocking) ?? [])
/** Columnas del TXT que se muestran: 16 % (valor, devoluciones, IVA acreditable), 0 %, exento y retenido. */
const visibleColumns = [{ label: 'Actos 16 %', position: 11 }, { label: 'Devoluciones 16 %', position: 12 }, { label: 'IVA acreditable 16 %', position: 21 }, { label: 'Región norte', position: 7 },
  { label: 'Tasa 0 %', position: 50 }, { label: 'Exentos', position: 49 }, { label: 'IVA retenido', position: 47 }]

async function load(): Promise<void> {
  isLoading.value = true; error.value = ''
  try { const result = await window.contapp.manageFiscalReports({ action: 'diot', reportId: props.reportId }); if (result.status === 'diot') diot.value = result.diot }
  catch (caught) { error.value = readIpcErrorMessage(caught, 'No se pudo calcular la DIOT.') }
  finally { isLoading.value = false }
}
async function exportFile(): Promise<void> {
  try { if (await window.contapp.exportDiotFile(props.reportId) === 'saved') notify('DIOT exportada', 'El archivo de carga masiva se guardó donde elegiste.', 'success') }
  catch (caught) { error.value = readIpcErrorMessage(caught, 'No se exportó la DIOT.') }
}
function supplierName(rfc: string): string { return diot.value?.suppliers.find(supplier => supplier.rfc === rfc)?.displayName || rfc }
async function finishEditing(): Promise<void> { editing.value = null; notify('Ajustes guardados', 'La DIOT se recalculó con los nuevos ajustes.', 'success'); await load() }
onMounted(() => { void load() })
</script>
<template>
  <section
    class="diot-panel"
    data-testid="diot-panel"
  >
    <InlineNotice
      v-if="error"
      title="DIOT no disponible"
      tone="error"
    >
      <p>{{ error }}</p>
    </InlineNotice>
    <template v-if="diot">
      <div class="section-heading">
        <p class="field-help">
          {{ diot.rows.length }} línea(s) para {{ diot.fileName }}. Importes en pesos enteros (artículo 20 del CFF). Revisa la carga en la plataforma del SAT antes de presentarla.
        </p>
        <ActionButton
          variant="primary"
          :disabled="!diot.canExport"
          @click="exportFile"
        >
          <Download
            :size="16"
            aria-hidden="true"
          /> Exportar TXT
        </ActionButton>
      </div>
      <InlineNotice
        v-if="blockingIssues.length"
        title="Corrige antes de exportar"
        tone="error"
      >
        <ul class="diot-issues">
          <li
            v-for="issue in blockingIssues"
            :key="issue.code + issue.rfc"
          >
            <strong>{{ supplierName(issue.rfc) }}:</strong> {{ diotIssueLabels[issue.code] }}
          </li>
        </ul>
      </InlineNotice>
      <InlineNotice
        v-if="warnings.length"
        title="Avisos"
        tone="warning"
      >
        <ul class="diot-issues">
          <li
            v-for="issue in warnings"
            :key="issue.code + issue.rfc"
          >
            <strong>{{ supplierName(issue.rfc) }}:</strong> {{ diotIssueLabels[issue.code] }}
          </li>
        </ul>
      </InlineNotice>
      <div
        class="table-region"
        tabindex="0"
        aria-label="Líneas de la DIOT"
      >
        <table aria-label="DIOT">
          <thead>
            <tr>
              <th>Proveedor</th><th>Tercero / operación</th><th
                v-for="column in visibleColumns"
                :key="column.position"
              >
                {{ column.label }}
              </th><th>CFDI</th><th class="actions-column">
                Ajustes
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in diot.rows"
              :key="row.key"
            >
              <td>
                <strong>{{ row.displayName }}</strong><span class="field-help diot-rfc">{{ row.fields[2] || row.fields[3] }}</span>
              </td>
              <td>{{ row.fields[0] }} / {{ row.fields[1] }}</td>
              <td
                v-for="column in visibleColumns"
                :key="column.position"
                class="numeric"
              >
                {{ row.fields[column.position] }}
              </td>
              <td class="numeric">
                {{ row.documentCount }}
              </td>
              <td class="actions-column">
                <ActionButton
                  v-if="diot.canManage"
                  :aria-label="'Ajustes DIOT de ' + row.displayName"
                  @click="editing = diot.suppliers.find(supplier => supplier.rfc === row.supplierRfc) ?? null"
                >
                  <SlidersHorizontal
                    :size="15"
                    aria-hidden="true"
                  />
                </ActionButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
    <p
      v-else-if="isLoading"
      class="field-help"
    >
      Calculando la DIOT…
    </p>
    <FormModal
      :is-open="editing !== null"
      :title="editing?.displayName || 'Proveedor'"
      :description="editing ? thirdPartyTypeLabels[editing.thirdPartyType] + ' · ' + operationTypeLabels[editing.operationType] : ''"
      test-id="supplier-modal"
      @close="editing = null"
    >
      <SupplierSettingsForm
        v-if="editing"
        :key="editing.rfc"
        :client-id="clientId"
        :supplier="editing"
        @saved="finishEditing"
        @cancel="editing = null"
      />
    </FormModal>
  </section>
</template>
<style scoped>
.diot-panel { display: grid; gap: var(--spaceMedium); min-width: 0; }
.diot-panel .section-heading { align-items: center; gap: var(--spaceMedium); flex-wrap: wrap; }
.diot-issues { margin: 0; padding-left: 18px; display: grid; gap: 4px; }
.diot-rfc { display: block; font-family: var(--monoFontFamily); font-size: 11px; }
/* Tablas de reportes con la rejilla interior visible (2026-10-06, pedido del usuario). */
table { border: 2px solid var(--borderColor); }
th, td { border: 1px solid var(--borderColor); }
th { border-bottom-width: 2px; }
</style>
