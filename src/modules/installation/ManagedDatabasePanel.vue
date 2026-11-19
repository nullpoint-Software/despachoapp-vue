<script setup lang="ts">
import DockerRuntimePanel from './DockerRuntimePanel.vue'
import { onMounted, onBeforeUnmount, ref } from 'vue'
import type { ManagedDatabaseStatus } from '../../../shared/contracts/managedDatabase'
import ActionButton from '../../shared/components/ActionButton.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
const status = ref<ManagedDatabaseStatus>({ state: 'idle', message: 'Crea un servidor MySQL para este Host sin configurar cuentas manualmente.' })
let timer: ReturnType<typeof setInterval> | undefined
async function refresh(): Promise<void> {
  try { status.value = await window.contapp.getManagedDatabaseStatus() } catch { status.value = { state: 'failed', message: 'Esta operación requiere el equipo Host activo.' } }
}
async function start(): Promise<void> {
  try { status.value = await window.contapp.startManagedDatabase() } catch { status.value = { state: 'failed', message: 'No se pudo solicitar el arranque del servidor.' } }
}
onMounted(() => { void refresh(); timer = setInterval(() => { void refresh() }, 1500) })
onBeforeUnmount(() => clearInterval(timer))
</script>
<template>
  <section class="surface-panel managed-database-panel">
    <h3>Servidor automático — recomendado</h3><p>Fiscenix prepara y conecta la base de datos con Docker. No necesitas introducir usuarios ni contraseñas de MySQL. Después se inicia al abrir este Host.</p>
    <DockerRuntimePanel />
    <InlineNotice
      :tone="status.state === 'ready' ? 'success' : ['failed','unavailable'].includes(status.state) ? 'error' : 'info'"
      title="MySQL administrado"
    >
      <p
        data-testid="managed-database-status"
        :data-state="status.state"
      >
        {{ status.message }}
      </p>
    </InlineNotice>
    <ActionButton
      :is-loading="status.state === 'starting'"
      :disabled="status.state === 'ready'"
      @click="start"
    >
      {{ status.state === 'idle' ? 'Crear servidor administrado' : 'Reintentar servidor' }}
    </ActionButton>
    <p class="field-help">
      Activarlo selecciona el contenedor como base de este Host. No importa ni elimina datos de una conexión manual anterior.
    </p>
  </section>
</template>
