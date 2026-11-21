<script setup lang="ts">
import { ref } from 'vue'
import { ArrowRightLeft, RotateCcw } from '@lucide/vue'
import ActionButton from '../../shared/components/ActionButton.vue'
import FormModal from '../../shared/components/FormModal.vue'
import { useNotifications } from '../../shared/notifications/notificationStore'
import LegacyEventsTable from './LegacyEventsTable.vue'
import LegacyMigrationWizard from './LegacyMigrationWizard.vue'
import { describeLegacyFailure } from './legacyMigrationErrors'
import { retryLegacyLocalStep } from './legacyLocalStep'

/**
 * Contenido de la tarjeta "Migrar desde la app anterior" en Respaldos (sólo equipo Host, con `migration.run`):
 * - "Migrar desde la app anterior" abre el asistente en el modal de captura; cada apertura empieza de cero (`key`).
 * - "Reintentar lo local" sirve también después de reiniciar Fiscenix: pide el mismo archivo y completa en este equipo
 *   las CIEC y notas que falten de la migración de ese archivo (Main pide al Host la correspondencia por su sha256).
 * - Debajo, los eventos heredados de sólo lectura.
 */
const emit = defineEmits<{ openAccess: []; openBackupSettings: [] }>()
const { notify } = useNotifications()
const isWizardOpen = ref(false), isWizardBusy = ref(false), wizardKey = ref(0), isRetrying = ref(false)

function openWizard(): void { wizardKey.value++; isWizardOpen.value = true }
function leaveWizard(target: 'openAccess' | 'openBackupSettings'): void { isWizardOpen.value = false; if (target === 'openAccess') emit('openAccess'); else emit('openBackupSettings') }
async function retryLocal(): Promise<void> {
  if (isRetrying.value) return
  isRetrying.value = true
  try {
    const retried = await retryLegacyLocalStep(null)
    if (!retried) return
    const { local, notesSummary, notesError } = retried.result
    notify(notesError || local.failedCiecCount ? 'Paso local con pendientes' : 'Paso local completado',
      'CIEC guardadas: ' + local.savedCiecCount + ', ya guardadas: ' + local.keptExistingCiecCount + ', con error: ' + local.failedCiecCount + (notesSummary ? '. Notas nuevas: ' + notesSummary.added + '.' : '. ' + notesError),
      notesError || local.failedCiecCount ? 'warning' : 'success')
  } catch (caught) { const failure = describeLegacyFailure(caught, 'No se completó el paso local'); notify(failure.title, failure.message, 'error') }
  finally { isRetrying.value = false }
}
</script>

<template>
  <div
    class="legacy-section"
    data-testid="legacy-migration"
  >
    <div class="actions">
      <ActionButton
        variant="primary"
        @click="openWizard"
      >
        <ArrowRightLeft
          :size="16"
          aria-hidden="true"
        /> Migrar desde la app anterior
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
    </div>
    <LegacyEventsTable />
    <FormModal
      :is-open="isWizardOpen"
      title="Migrar desde la app anterior"
      description="Analiza la exportación SQL, resuelve conflictos y migra con un respaldo previo. Nada se cambia hasta el último paso."
      :is-busy="isWizardBusy"
      test-id="legacy-migration-modal"
      @close="isWizardOpen = false"
    >
      <LegacyMigrationWizard
        v-if="isWizardOpen"
        :key="wizardKey"
        @busy-change="isWizardBusy = $event"
        @open-access="leaveWizard('openAccess')"
        @open-backup-settings="leaveWizard('openBackupSettings')"
      />
    </FormModal>
  </div>
</template>

<style scoped>
.legacy-section { display: grid; gap: var(--spaceMedium); }
</style>
