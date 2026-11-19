<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { FlaskConical, History, RotateCcw, Undo2 } from '@lucide/vue'
import type { BackupRestoreRecord, BackupRestoreResult } from '../../../shared/contracts/backupRestore'
import ActionButton from '../../shared/components/ActionButton.vue'
import FormModal from '../../shared/components/FormModal.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import StatusBadge from '../../shared/components/StatusBadge.vue'
import { withSensitiveConfirmation } from '../../shared/security/confirmSensitive'
import { useNotifications } from '../../shared/notifications/notificationStore'
import { readIpcErrorMessage } from '../../shared/ipcErrorMessage'
import RestoreBackupForm from './RestoreBackupForm.vue'
import { evaluatePhase } from '../workspace/sessionState'

/**
 * Restauración en Respaldos (7.3), con `backups.restore`:
 * - **Probar un respaldo:** ensayo en una base temporal; el resultado queda en el historial.
 * - **Restaurar un respaldo:** base nueva, cambio y reinicio. Al terminar, la ventana se recarga y pide iniciar sesión.
 * - **Volver a la base anterior:** disponible después de una restauración; también reinicia el Host.
 */
defineProps<{ restores: BackupRestoreRecord[] }>()
const emit = defineEmits<{ changed: [] }>()
const { notify } = useNotifications()
const mode = ref<'trial' | 'restore' | null>(null)
const canRevert = ref(false), isReverting = ref(false), revertError = ref(''), isRevertOpen = ref(false)
const modeLabels: Record<BackupRestoreRecord['mode'], string> = { trial: 'Ensayo', restore: 'Restauración' }
const formatInstant = (value: string) => new Date(value).toLocaleString('es-MX', { timeZone: 'America/Mexico_City', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

onMounted(async () => {
  try { const result = await window.contapp.restoreBackup({ action: 'getOptions' }); if (result.status === 'options') canRevert.value = result.options.canRevert } catch { canRevert.value = false }
})
/**
 * El Host se reinicia con otra base y la sesión terminó: se espera a que vuelva a estar listo (hasta 90 s) y la
 * aplicación regresa al inicio de sesión. La ventana no se recarga (la política de navegación lo impide).
 */
async function restartWorkspace(): Promise<void> {
  for (let attempt = 0; attempt < 90; attempt++) {
    try { if ((await window.contapp.getHostStatus()).state === 'pairingRequired') break } catch { /* El Host se está reiniciando. */ }
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  await evaluatePhase()
}
function handleCompleted(result: BackupRestoreResult): void {
  mode.value = null
  if (result.status === 'tried') {
    const summary = result.summary
    notify(summary.canSignIn === false ? 'Ensayo con observaciones' : 'Ensayo correcto',
      summary.tableCount + ' tablas, ' + summary.rowCount.toLocaleString('es-MX') + ' filas y ' + summary.documentCount + ' documentos.' + (summary.canSignIn === false ? ' Tu usuario no podría iniciar sesión con ese respaldo.' : ' Podrías iniciar sesión con él.'),
      summary.canSignIn === false ? 'warning' : 'success')
    emit('changed')
  } else if (result.status === 'restored') {
    notify('Respaldo restaurado', 'Fiscenix se reinició con los datos del respaldo. Vuelve a iniciar sesión.', 'success')
    void restartWorkspace()
  }
}
/** Volver a la base anterior es zona crítica (ADR-038): el diálogo único pide la contraseña siempre. */
async function revert(): Promise<void> {
  if (isReverting.value) return
  isReverting.value = true; revertError.value = ''
  try {
    const result = await withSensitiveConfirmation({ operation: 'backups.restore', title: 'Confirmar volver a la base anterior' }, proof => window.contapp.restoreBackup({ action: 'revert' }, proof))
    if (!result) return
    isRevertOpen.value = false
    notify('Base anterior en uso', 'Fiscenix se reinició con los datos que había antes de restaurar. Vuelve a iniciar sesión.', 'success')
    void restartWorkspace()
  } catch (caught) { revertError.value = readIpcErrorMessage(caught, 'No se pudo volver a la base anterior.') }
  finally { isReverting.value = false }
}
</script>

<template>
  <section
    class="surface-panel restore-card"
    aria-labelledby="restore-title"
    data-testid="backup-restore"
  >
    <div class="restore-heading">
      <div>
        <h2 id="restore-title">
          <History
            :size="18"
            aria-hidden="true"
          /> Restaurar
        </h2>
        <p class="field-help">
          Prueba un respaldo sin tocar los datos, o restáuralo en una base nueva. La base actual se conserva.
        </p>
      </div>
      <div class="actions">
        <ActionButton @click="mode = 'trial'">
          <FlaskConical
            :size="16"
            aria-hidden="true"
          /> Probar un respaldo
        </ActionButton>
        <ActionButton
          variant="danger"
          @click="mode = 'restore'"
        >
          <RotateCcw
            :size="16"
            aria-hidden="true"
          /> Restaurar un respaldo
        </ActionButton>
        <ActionButton
          v-if="canRevert"
          @click="isRevertOpen = true"
        >
          <Undo2
            :size="16"
            aria-hidden="true"
          /> Volver a la base anterior
        </ActionButton>
      </div>
    </div>
    <ul
      v-if="restores.length"
      class="restore-history"
      aria-label="Restauraciones y ensayos"
    >
      <li
        v-for="item in restores"
        :key="item.restoreId"
        :data-state="item.state"
      >
        <StatusBadge :tone="item.state === 'success' ? 'success' : 'error'">
          {{ modeLabels[item.mode] }}
        </StatusBadge>
        <span>{{ formatInstant(item.requestedAt) }} · {{ item.requestedByName }}<template v-if="item.sourceCreatedAt"> · respaldo del {{ formatInstant(item.sourceCreatedAt) }}</template></span>
        <span class="field-help">{{ item.message }}<template v-if="item.state === 'success'"> {{ item.tableCount }} tablas, {{ item.rowCount.toLocaleString('es-MX') }} filas, {{ item.documentCount }} documentos.</template></span>
      </li>
    </ul>

    <FormModal
      :is-open="mode !== null"
      :title="mode === 'restore' ? 'Restaurar un respaldo' : 'Probar un respaldo'"
      :description="mode === 'restore' ? 'Los datos del respaldo reemplazarán a los actuales en este Host.' : 'Se restaura en una base temporal, se comprueba y se borra. No cambia nada.'"
      test-id="restore-modal"
      @close="mode = null"
    >
      <RestoreBackupForm
        v-if="mode"
        :key="mode"
        :mode="mode"
        @completed="handleCompleted"
        @cancel="mode = null"
      />
    </FormModal>
    <FormModal
      :is-open="isRevertOpen"
      title="Volver a la base anterior"
      description="Fiscenix volverá a usar los datos que tenía antes de la última restauración y se reiniciará."
      :is-busy="isReverting"
      test-id="revert-modal"
      @close="isRevertOpen = false"
    >
      <form
        class="restore-revert"
        @submit.prevent="revert"
      >
        <InlineNotice
          v-if="revertError"
          title="No se completó"
          tone="error"
        >
          <p>{{ revertError }}</p>
        </InlineNotice>
        <div class="actions form-footer">
          <ActionButton
            variant="primary"
            type="submit"
            :is-loading="isReverting"
          >
            Volver y reiniciar
          </ActionButton>
          <ActionButton
            :disabled="isReverting"
            @click="isRevertOpen = false"
          >
            Cancelar
          </ActionButton>
        </div>
      </form>
    </FormModal>
  </section>
</template>

<style scoped>
.restore-card { display: grid; gap: var(--spaceMedium); }
.restore-heading { display: flex; flex-wrap: wrap; justify-content: space-between; gap: var(--spaceMedium); align-items: flex-start; }
.restore-heading h2 { display: inline-flex; align-items: center; gap: 8px; margin: 0 0 4px; }
.restore-history { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
/* Misma rejilla que el historial de respaldos (2026-10-10): columna fija para el sello y renglones separados. */
.restore-history li { display: grid; grid-template-columns: 7.5rem minmax(0, 1fr); gap: 2px 12px; align-items: center; padding-bottom: 10px; border-bottom: 1px solid var(--hairlineColor); }
.restore-history li:last-child { padding-bottom: 0; border-bottom: 0; }
.restore-history li > :first-child { justify-self: start; }
.restore-history li .field-help { grid-column: 2; }
.restore-revert { display: grid; gap: var(--spaceMedium); }
</style>
