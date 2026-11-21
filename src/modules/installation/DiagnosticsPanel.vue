<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Download, RefreshCw, Stethoscope } from '@lucide/vue'
import type { DiagnosticState, DiagnosticsReport } from '../../../shared/contracts/diagnostics'
import ActionButton from '../../shared/components/ActionButton.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import StatusBadge from '../../shared/components/StatusBadge.vue'
import { useNotifications } from '../../shared/notifications/notificationStore'
import { readIpcErrorMessage } from '../../shared/ipcErrorMessage'

/**
 * Diagnóstico de este equipo (7.4): comprobaciones con qué revisar (servicio Host, certificado, autoridad,
 * segundo plano, confianza, red y disco), datos de versión y red, y "Exportar diagnóstico" para soporte.
 * No necesita sesión ni muestra secretos: Main arma el reporte sólo con estados.
 */
const { notify } = useNotifications()
const report = ref<DiagnosticsReport | null>(null), error = ref(''), isExporting = ref(false)
const stateTones: Record<DiagnosticState, 'success' | 'warning' | 'error'> = { ok: 'success', warning: 'warning', error: 'error' }
const stateLabels: Record<DiagnosticState, string> = { ok: 'Bien', warning: 'Revisar', error: 'Falla' }
const formatDate = (value: string | null) => value ? new Date(value).toLocaleDateString('es-MX', { dateStyle: 'long' }) : '—'
const formatGigabytes = (value: number | null) => value === null ? '—' : (value / 1024 ** 3).toLocaleString('es-MX', { maximumFractionDigits: 1 }) + ' GB'
async function load(): Promise<void> {
  error.value = ''
  try { const result = await window.contapp.readDiagnostics('read'); if (result.status === 'report') report.value = result.report }
  catch (caught) { error.value = readIpcErrorMessage(caught, 'No se pudo leer el diagnóstico.') }
}
async function exportReport(): Promise<void> {
  isExporting.value = true
  try { if ((await window.contapp.readDiagnostics('export')).status === 'exported') notify('Diagnóstico exportado', 'Mándalo a soporte junto con la descripción del problema.', 'success') }
  catch (caught) { error.value = readIpcErrorMessage(caught, 'No se pudo exportar el diagnóstico.') }
  finally { isExporting.value = false }
}
onMounted(() => { void load() })
</script>

<template>
  <section
    class="surface-panel diagnostics-panel"
    aria-labelledby="diagnostics-title"
    data-testid="diagnostics-panel"
  >
    <div class="diagnostics-heading">
      <div>
        <h3 id="diagnostics-title">
          <Stethoscope
            :size="18"
            aria-hidden="true"
          /> Diagnóstico de este equipo
        </h3>
        <p class="field-help">
          Comprueba lo básico y exporta un reporte sin contraseñas ni datos del despacho para soporte.
        </p>
      </div>
      <div class="actions">
        <ActionButton
          aria-label="Actualizar diagnóstico"
          @click="load"
        >
          <RefreshCw
            :size="16"
            aria-hidden="true"
          />
        </ActionButton>
        <ActionButton
          :is-loading="isExporting"
          @click="exportReport"
        >
          <Download
            :size="16"
            aria-hidden="true"
          /> Exportar diagnóstico
        </ActionButton>
      </div>
    </div>
    <InlineNotice
      v-if="error"
      title="Diagnóstico no disponible"
      tone="error"
    >
      <p>{{ error }}</p>
    </InlineNotice>
    <template v-if="report">
      <ul
        class="diagnostics-checks"
        aria-label="Comprobaciones"
      >
        <li
          v-for="check in report.checks"
          :key="check.name"
          :data-state="check.state"
        >
          <StatusBadge :tone="stateTones[check.state]">
            {{ stateLabels[check.state] }}
          </StatusBadge>
          <strong>{{ check.name }}</strong>
          <span class="field-help">{{ check.detail }}</span>
        </li>
      </ul>
      <dl class="diagnostics-facts">
        <div>
          <dt>Versión</dt>
          <dd>{{ report.application.version }} · {{ report.application.isInstalled ? 'instalada' : 'sin instalar' }}</dd>
        </div>
        <div>
          <dt>Función</dt>
          <dd>{{ report.device.mode === 'host' ? 'Host' : report.device.mode === 'client' ? 'Cliente' : 'Sin elegir' }} · {{ report.device.computerName }}</dd>
        </div>
        <div>
          <dt>Direcciones de red</dt>
          <dd>{{ report.network.addresses.join(', ') || '—' }}</dd>
        </div>
        <div>
          <dt>Espacio libre</dt>
          <dd>{{ formatGigabytes(report.storage.freeBytes) }} de {{ formatGigabytes(report.storage.totalBytes) }}</dd>
        </div>
        <div v-if="report.host">
          <dt>Certificado del Host</dt>
          <dd>Vence el {{ formatDate(report.host.certificateExpiresAt) }}</dd>
        </div>
        <div v-if="report.client">
          <dt>Host</dt>
          <dd>{{ report.client.selectedAddress ? report.client.selectedAddress + ':' + report.client.selectedPort : '—' }}</dd>
        </div>
      </dl>
    </template>
  </section>
</template>

<style scoped>
.diagnostics-panel { display: grid; gap: var(--spaceMedium); margin-top: var(--spaceMedium); }
.diagnostics-heading { display: flex; flex-wrap: wrap; justify-content: space-between; gap: var(--spaceMedium); align-items: flex-start; }
.diagnostics-heading h3 { display: inline-flex; align-items: center; gap: 8px; margin: 0 0 4px; }
.diagnostics-checks { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.diagnostics-checks li { display: grid; grid-template-columns: auto auto minmax(0, 1fr); gap: 4px 10px; align-items: center; }
.diagnostics-checks li .field-help { grid-column: 2 / -1; }
.diagnostics-facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: var(--spaceMedium); margin: 0; }
.diagnostics-facts dt { font-family: var(--monoFontFamily); font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--mutedTextColor); }
.diagnostics-facts dd { margin: 4px 0 0; overflow-wrap: anywhere; }
</style>
