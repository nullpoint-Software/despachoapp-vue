<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import type { HostEventsStatus } from '../../../shared/contracts/hostEvents'
import ActionButton from '../../shared/components/ActionButton.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
const status = ref<HostEventsStatus>({ state: 'idle', attempt: 0 })
const labels = { idle: 'Desconectado', connecting: 'Comprobando conexión segura…', connected: 'Canal conectado', retrying: 'Esperando para reconectar…', offline: 'Host no disponible. Puedes volver a conectar.', unauthorized: 'Se requiere un equipo autorizado y una sesión de usuario vigente.' }
let timer: ReturnType<typeof setTimeout> | undefined
let isMounted = true
/** Un sondeo público secuencial; Main posee el socket. Desmontar elimina el sondeo, no la conexión. */
async function update(action: 'status' | 'start' | 'stop' = 'status'): Promise<void> {
  try { const next = await window.contapp.manageHostEvents(action); if (isMounted) status.value = next } catch { if (isMounted) status.value = { state: 'offline', attempt: 0 } }
}
async function poll(): Promise<void> { await update(); if (isMounted) timer = setTimeout(() => { void poll() }, 1000) }
onMounted(() => { void poll() })
onBeforeUnmount(() => { isMounted = false; clearTimeout(timer) })
</script>
<template>
  <section class="surface-panel">
    <h3>Conexión en tiempo real</h3>
    <InlineNotice
      title="Canal del Host"
      :tone="status.state === 'connected' ? 'success' : 'info'"
    >
      <p
        data-testid="host-events-status"
        :data-state="status.state"
      >
        {{ labels[status.state] }}
      </p>
      <p v-if="status.attempt">
        Intento {{ status.attempt }} de 4
      </p>
    </InlineNotice>
    <p>Requiere un equipo autorizado y una sesión vigente. El canal comprueba disponibilidad; los eventos de negocio siguen pendientes de sus permisos por recurso.</p>
    <div class="events-actions">
      <ActionButton
        :disabled="['connecting','connected','retrying'].includes(status.state)"
        @click="update('start')"
      >
        Conectar canal
      </ActionButton>
      <ActionButton
        :disabled="status.state === 'idle'"
        @click="update('stop')"
      >
        Desconectar canal
      </ActionButton>
    </div>
  </section>
</template>
<style scoped>
.events-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }
</style>
