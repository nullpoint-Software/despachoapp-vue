<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Download, RotateCcw, ShieldCheck } from '@lucide/vue'
import type { LegacyDecision, LegacyMigrationPreview, LegacyRunSummary } from '../../../shared/contracts/legacyMigration'
import ActionButton from '../../shared/components/ActionButton.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import { useNotifications } from '../../shared/notifications/notificationStore'
import { describeLegacyFailure } from './legacyMigrationErrors'
import { retryLegacyLocalStep, type LegacyLocalStepResult } from './legacyLocalStep'
import { buildLegacyReportCsv } from './legacyMigrationReport'

/**
 * Resultado de la migración (fuera del stepper): qué creó, vinculó o actualizó el Host, el paso LOCAL (CIEC y notas de
 * este equipo) con "Reintentar lo local", los usuarios nuevos pendientes de contraseña (nacen inactivos; se activan en
 * Usuarios y accesos) y "Descargar reporte" (CSV sin secretos que Main guarda donde elija la persona).
 */
const props = defineProps<{ summary: LegacyRunSummary; preview: LegacyMigrationPreview; decisions: Map<string, LegacyDecision>; dumpPath: string; localStep: LegacyLocalStepResult }>()
const emit = defineEmits<{ openAccess: [] }>()
const { notify } = useNotifications()
const localStep = ref<LegacyLocalStepResult>(props.localStep)
const pendingUsers = ref<{ userId: string; label: string }[]>(props.summary.pendingPasswordUserIds.map(userId => ({ userId, label: userId })))
const isRetrying = ref(false), isSaving = ref(false), retryError = ref('')

const entityLabels: Record<string, string> = { usuarios: 'Usuarios', clientes: 'Clientes', tareas: 'Tareas', pagoconcepto: 'Movimientos (pagos por concepto)', pagomensual: 'Movimientos (honorarios)', events: 'Eventos', users: 'Usuarios', clients: 'Clientes', tasks: 'Tareas', movements: 'Movimientos' }
const describeRecord = (record: Record<string, number>) => Object.entries(record).filter(([, total]) => total > 0).map(([entity, total]) => (entityLabels[entity] ?? entity) + ': ' + total.toLocaleString('es-MX'))
const resultRows = [
  { label: 'Creado', items: describeRecord(props.summary.created) },
  { label: 'Vinculado', items: describeRecord(props.summary.linked) },
  { label: 'Actualizado', items: [...describeRecord(props.summary.updated), ...(props.summary.voided ? ['Movimientos anulados (corregidos en origen): ' + props.summary.voided] : [])] },
]

/** Nombres de los usuarios pendientes desde el panel de acceso; si no se puede consultar, quedan los identificadores. */
onMounted(async () => {
  if (!pendingUsers.value.length) return
  try {
    const access = await window.contapp.administerAccess({ action: 'list' })
    pendingUsers.value = pendingUsers.value.map(pending => { const user = access.users.find(item => item.userId === pending.userId); return user ? { userId: pending.userId, label: user.displayName + ' (' + user.username + ')' } : pending })
  } catch { /* Sin users.manage o sin conexión: se muestran los identificadores. */ }
})
async function retryLocal(): Promise<void> {
  if (isRetrying.value) return
  isRetrying.value = true; retryError.value = ''
  try {
    const retried = await retryLegacyLocalStep(props.dumpPath)
    if (retried) { localStep.value = retried.result; notify('Paso local repetido', 'Las CIEC y notas faltantes se guardaron en este equipo.', 'success') }
  } catch (caught) { retryError.value = describeLegacyFailure(caught, 'No se completó el paso local').message }
  finally { isRetrying.value = false }
}
async function saveReport(): Promise<void> {
  if (isSaving.value) return
  isSaving.value = true
  try {
    const csv = buildLegacyReportCsv({ summary: props.summary, preview: props.preview, decisions: props.decisions, local: localStep.value.local })
    const result = await window.contapp.runLegacyMigration({ action: 'saveReport', csv })
    if (result.status === 'reportSaved' && result.isSaved) notify('Reporte guardado', 'El CSV de la migración quedó en la carpeta que elegiste.', 'success')
  } catch { notify('No se guardó el reporte', 'Revisa la carpeta elegida y vuelve a intentarlo.', 'error') }
  finally { isSaving.value = false }
}
</script>

<template>
  <section
    class="legacy-result"
    data-testid="legacy-migration-result"
    aria-live="polite"
  >
    <InlineNotice
      title="Migración terminada"
      tone="success"
    >
      <p>Antes de cambiar nada se hizo un respaldo verificado. Nada se borró en Fiscenix.</p>
    </InlineNotice>
    <dl class="legacy-result-facts">
      <div
        v-for="row in resultRows"
        :key="row.label"
      >
        <dt>{{ row.label }}</dt>
        <dd>{{ row.items.length ? row.items.join(' · ') : 'Nada' }}</dd>
      </div>
      <div>
        <dt>Este equipo</dt>
        <dd data-testid="legacy-local-outcome">
          CIEC guardadas: {{ localStep.local.savedCiecCount }} · ya guardadas: {{ localStep.local.keptExistingCiecCount }} · con error: {{ localStep.local.failedCiecCount }}<template v-if="localStep.notesSummary">
            · notas nuevas: {{ localStep.notesSummary.added }}
          </template>
        </dd>
      </div>
    </dl>
    <InlineNotice
      v-if="localStep.local.failedCiecCount || localStep.notesError || retryError"
      title="El paso local quedó incompleto"
      tone="warning"
    >
      <p>{{ retryError || localStep.notesError || 'Algunas CIEC no se guardaron en este equipo.' }} Los datos del Host ya quedaron migrados.</p>
    </InlineNotice>
    <section
      v-if="pendingUsers.length"
      class="legacy-pending-users"
      aria-labelledby="legacy-pending-title"
    >
      <h3 id="legacy-pending-title">
        Usuarios pendientes de contraseña
      </h3>
      <p class="field-help">
        Se crearon inactivos. Asígnales contraseña y actívalos en Usuarios y accesos.
      </p>
      <ul>
        <li
          v-for="user in pendingUsers"
          :key="user.userId"
        >
          {{ user.label }}
        </li>
      </ul>
    </section>
    <div class="actions">
      <ActionButton
        v-if="pendingUsers.length"
        @click="emit('openAccess')"
      >
        <ShieldCheck
          :size="16"
          aria-hidden="true"
        /> Abrir Usuarios y accesos
      </ActionButton>
      <ActionButton
        :is-loading="isRetrying"
        @click="retryLocal"
      >
        <RotateCcw
          :size="16"
          aria-hidden="true"
        /> Reintentar lo local
      </ActionButton>
      <ActionButton
        variant="primary"
        :is-loading="isSaving"
        @click="saveReport"
      >
        <Download
          :size="16"
          aria-hidden="true"
        /> Descargar reporte
      </ActionButton>
    </div>
  </section>
</template>

<style scoped>
.legacy-result { display: grid; gap: var(--spaceMedium); }
.legacy-result-facts { display: grid; margin: 0; border: 2px solid var(--borderColor); }
.legacy-result-facts div { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 3fr); gap: 12px; padding: 10px 14px; }
.legacy-result-facts div + div { border-top: 1px solid var(--hairlineColor); }
.legacy-result-facts dt { font-family: var(--monoFontFamily); font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--mutedTextColor); align-self: center; }
.legacy-result-facts dd { margin: 0; font-weight: 600; overflow-wrap: anywhere; }
.legacy-pending-users h3 { margin: 0 0 4px; font-size: 15px; font-weight: 600; }
.legacy-pending-users ul { margin: 8px 0 0; padding-left: 18px; }
</style>
