<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { FileArchive } from '@lucide/vue'
import { restoreConfirmationWord, type BackupArchiveInfo, type BackupRestoreResult, type RestoreOptions } from '../../../shared/contracts/backupRestore'
import ActionButton from '../../shared/components/ActionButton.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import TextField from '../../shared/components/TextField.vue'
import LatticeLoader from '../../shared/vueBits/LatticeLoader.vue'
import { readIpcErrorMessage } from '../../shared/ipcErrorMessage'
import { withSensitiveConfirmation } from '../../shared/security/confirmSensitive'

/**
 * Formulario común de 7.3 para **probar**, **restaurar** (Host instalado) y **restaurar en la instalación**:
 * - Elegir el archivo con el diálogo nativo; se muestra su fecha y si es de este Host.
 * - Contraseña de respaldo; cuenta administradora de MySQL sólo con MySQL propio (no se guarda).
 * - Con sesión: la contraseña de Fiscenix en el diálogo único (zona crítica, ADR-038: siempre). Al restaurar, además escribir RESTAURAR.
 * Las contraseñas se borran al terminar, salga bien o mal; cancelar el diálogo conserva el formulario. Emite el resultado; quien lo usa decide qué hacer.
 */
const props = defineProps<{ mode: 'trial' | 'restore' | 'setup' }>()
const emit = defineEmits<{ completed: [result: BackupRestoreResult]; cancel: [] }>()
const archive = ref<BackupArchiveInfo | null>(null), options = ref<RestoreOptions | null>(null)
const backupPassword = ref(''), administratorUser = ref('root'), administratorPassword = ref(''), confirmation = ref('')
const error = ref(''), isBusy = ref(false)
const submitLabels = { trial: 'Probar respaldo', restore: 'Restaurar y reiniciar', setup: 'Restaurar este respaldo' } as const
const busyLabels = { trial: 'Probando el respaldo en una base temporal', restore: 'Respaldo previo, restauración y comprobación', setup: 'Restaurando el respaldo en este equipo' } as const
const formatInstant = (value: string) => new Date(value).toLocaleString('es-MX', { timeZone: 'America/Mexico_City', dateStyle: 'full', timeStyle: 'short' })
const isConfirmed = computed(() => props.mode !== 'restore' || confirmation.value === restoreConfirmationWord)

onMounted(async () => {
  try { const result = await window.contapp.restoreBackup({ action: 'getOptions' }); if (result.status === 'options') options.value = result.options }
  catch (caught) { error.value = readIpcErrorMessage(caught, 'No se pudieron consultar las opciones de restauración.') }
})
async function chooseArchive(): Promise<void> {
  error.value = ''
  try { const result = await window.contapp.restoreBackup({ action: 'chooseArchive' }); if (result.status === 'archive' && result.archive) archive.value = result.archive }
  catch (caught) { error.value = readIpcErrorMessage(caught, 'No se pudo abrir el respaldo.') }
}
async function submit(): Promise<void> {
  if (isBusy.value) return
  error.value = ''
  if (!archive.value) { error.value = 'Elige el archivo de respaldo.'; return }
  if (!backupPassword.value) { error.value = 'Escribe la contraseña de respaldo.'; return }
  if (options.value?.requiresDatabaseAdministrator && (!administratorUser.value || !administratorPassword.value)) { error.value = 'Escribe la cuenta administradora de MySQL.'; return }
  if (!isConfirmed.value) { error.value = 'Escribe ' + restoreConfirmationWord + ' para confirmar.'; return }
  isBusy.value = true
  const databaseAdministrator = options.value?.requiresDatabaseAdministrator ? { user: administratorUser.value, password: administratorPassword.value } : null
  const base = { archivePath: archive.value.path, backupPassword: backupPassword.value, databaseAdministrator }
  let isCancelled = false
  try {
    const title = props.mode === 'trial' ? 'Confirmar prueba del respaldo' : 'Confirmar restauración'
    const result = props.mode === 'setup' ? await window.contapp.restoreBackup({ action: 'restoreAtSetup', ...base })
      : await withSensitiveConfirmation({ operation: 'backups.restore', title }, proof => props.mode === 'trial' ? window.contapp.restoreBackup({ action: 'trial', ...base }, proof)
        : window.contapp.restoreBackup({ action: 'restore', ...base, confirmation: confirmation.value }, proof))
    if (!result) { isCancelled = true; return }
    emit('completed', result)
  } catch (caught) { error.value = readIpcErrorMessage(caught, 'No se pudo completar la restauración.') }
  finally { isBusy.value = false; if (!isCancelled) { backupPassword.value = ''; administratorPassword.value = '' } }
}
</script>

<template>
  <form
    class="restore-form"
    data-testid="restore-form"
    @submit.prevent="submit"
  >
    <InlineNotice
      v-if="error"
      title="No se completó"
      tone="error"
    >
      <p>{{ error }}</p>
    </InlineNotice>
    <InlineNotice
      v-if="mode === 'restore'"
      title="Fiscenix se reiniciará con los datos del respaldo"
      tone="warning"
    >
      <p>Primero se hace un respaldo de lo actual. Los datos se restauran en una base nueva y la actual se conserva intacta: podrás volver a ella. Todas las sesiones se cerrarán.</p>
    </InlineNotice>
    <div class="field">
      <span class="field-label">Archivo de respaldo</span>
      <div class="restore-archive-row">
        <span
          class="restore-archive"
          data-testid="restore-archive"
        >
          <template v-if="archive">{{ archive.path.split(/[\\/]/).at(-1) }}</template>
          <template v-else>Sin elegir</template>
        </span>
        <ActionButton
          :disabled="isBusy"
          @click="chooseArchive"
        >
          <FileArchive
            :size="16"
            aria-hidden="true"
          /> Elegir respaldo
        </ActionButton>
      </div>
      <p
        v-if="archive"
        class="field-help"
        data-testid="restore-archive-details"
      >
        Hecho el {{ formatInstant(archive.createdAt) }} ·
        <template v-if="archive.isFromThisHost === true">
          de este Host
        </template>
        <template v-else-if="archive.isFromThisHost === false">
          de otro Host
        </template>
        <template v-else>
          Host de origen {{ archive.hostId.slice(0, 8) }}
        </template>
      </p>
      <p
        v-if="archive?.isFromThisHost === false && mode !== 'setup'"
        class="field-help"
      >
        Un respaldo de otro Host sólo se puede restaurar al instalar un Host nuevo.
      </p>
    </div>
    <TextField
      id="restore-backup-password"
      v-model="backupPassword"
      type="password"
      autocomplete="off"
      label="Contraseña de respaldo"
      :disabled="isBusy"
    />
    <template v-if="options?.requiresDatabaseAdministrator">
      <TextField
        id="restore-database-user"
        v-model="administratorUser"
        autocomplete="off"
        label="Usuario administrador de MySQL"
        help="Debe poder crear bases de datos y otorgar permisos. No se guarda."
        :disabled="isBusy"
      />
      <TextField
        id="restore-database-password"
        v-model="administratorPassword"
        type="password"
        autocomplete="off"
        label="Contraseña del administrador de MySQL"
        :disabled="isBusy"
      />
    </template>
    <TextField
      v-if="mode === 'restore'"
      id="restore-confirmation"
      v-model="confirmation"
      autocomplete="off"
      :label="'Escribe ' + restoreConfirmationWord + ' para confirmar'"
      :disabled="isBusy"
    />
    <LatticeLoader
      v-if="isBusy"
      :label="busyLabels[mode]"
      show-timer
    />
    <div class="actions form-footer">
      <ActionButton
        :variant="mode === 'restore' ? 'danger' : 'primary'"
        type="submit"
        :is-loading="isBusy"
        :disabled="!isConfirmed"
      >
        {{ submitLabels[mode] }}
      </ActionButton>
      <ActionButton
        :disabled="isBusy"
        @click="emit('cancel')"
      >
        Cancelar
      </ActionButton>
    </div>
  </form>
</template>

<style scoped>
.restore-form { display: grid; gap: var(--spaceMedium); }
.restore-archive-row { display: flex; flex-wrap: wrap; gap: var(--spaceSmall); align-items: center; justify-content: space-between; padding: 10px 12px; border: 2px solid var(--borderColor); border-radius: var(--radiusNested); }
.restore-archive { font-family: var(--monoFontFamily); font-size: 13px; overflow-wrap: anywhere; }
</style>
