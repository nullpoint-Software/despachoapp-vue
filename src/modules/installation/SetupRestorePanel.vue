<script setup lang="ts">
import { ref } from 'vue'
import type { BackupRestoreResult } from '../../../shared/contracts/backupRestore'
import ActionButton from '../../shared/components/ActionButton.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import RestoreBackupForm from '../backups/RestoreBackupForm.vue'

/**
 * Instalación de un Host nuevo con los datos de un respaldo (7.3), en lugar de crear el primer administrador.
 * Basta el archivo y la contraseña de respaldo. Si el respaldo trae la identidad del Host, los Clientes ya
 * vinculados se reconectan solos; si no, el paso siguiente prepara una conexión segura nueva.
 * Al terminar, el Host se reinicia con la base restaurada y la pantalla de instalación sigue sola.
 */
const isOpen = ref(false), outcome = ref<Extract<BackupRestoreResult, { status: 'restored' }> | null>(null)
function handleCompleted(result: BackupRestoreResult): void { if (result.status === 'restored') { outcome.value = result; isOpen.value = false } }
</script>

<template>
  <section
    class="configuration-form"
    aria-labelledby="setup-restore-title"
    data-testid="setup-restore"
  >
    <h3 id="setup-restore-title">
      ¿Ya usabas Fiscenix?
    </h3>
    <InlineNotice
      v-if="outcome"
      title="Respaldo restaurado"
      tone="success"
    >
      <p>
        Se restauraron {{ outcome.summary.tableCount }} tablas y {{ outcome.summary.documentCount }} documentos. Inicia sesión con tu usuario de siempre.
        <template v-if="outcome.identity === 'kept'">
          Los equipos ya vinculados se reconectarán solos.
        </template>
        <template v-else>
          El respaldo no traía la identidad del Host: prepara la conexión segura y vuelve a vincular los equipos.
        </template>
      </p>
    </InlineNotice>
    <template v-else>
      <p>Si este equipo reemplaza a un Host anterior, restaura su respaldo en lugar de crear un administrador nuevo.</p>
      <ActionButton
        v-if="!isOpen"
        @click="isOpen = true"
      >
        Restaurar desde un respaldo
      </ActionButton>
      <RestoreBackupForm
        v-else
        mode="setup"
        @completed="handleCompleted"
        @cancel="isOpen = false"
      />
    </template>
  </section>
</template>
