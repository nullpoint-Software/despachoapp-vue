<script setup lang="ts">
import { onMounted, ref } from 'vue'
import HostEventsPanel from './HostEventsPanel.vue'
import type { PairingStatus } from '../../../shared/contracts/pairing'
import ActionButton from '../../shared/components/ActionButton.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
const status = ref<PairingStatus | null>(null)
const isBusy = ref(false)
const error = ref('')
/** Consultar guarda sólo estado público. La entrega y protección de credenciales se resuelve en Main. */
async function run(action: 'status' | 'request' | 'refresh'): Promise<void> {
  if (isBusy.value) return
  isBusy.value = true; error.value = ''
  try { status.value = await window.contapp.managePairing(action) }
  catch { error.value = 'No se pudo completar. Revisa la confianza y la conexión con el Host. La solicitud o credencial guardada se conserva; vuelve a comprobar su estado.' }
  finally { isBusy.value = false }
}
onMounted(() => run('status'))
</script>
<template>
  <section class="surface-panel">
    <h3>Autorización de este equipo</h3>
    <p>Solicita autorización y comunica al administrador el código mostrado aquí. El administrador debe compararlo y aprobar el equipo en el Host.</p>
    <InlineNotice
      title="Emparejamiento"
      :tone="error ? 'error' : status?.state === 'paired' ? 'success' : 'info'"
    >
      <p
        data-testid="pairing-status"
        :data-state="status?.state"
      >
        {{ error || status?.message || 'Leyendo estado...' }}
      </p>
    </InlineNotice>
    <p v-if="status?.code">
      Código de comparación: <strong data-testid="pairing-code">{{ status.code }}</strong>
    </p>
    <p v-if="status?.expiresAt">
      Vence: {{ new Date(status.expiresAt).toLocaleString('es-MX') }}
    </p>
    <div class="pairing-actions">
      <ActionButton
        :is-loading="isBusy"
        :disabled="status?.state === 'paired'"
        @click="run('request')"
      >
        Solicitar autorización
      </ActionButton>
      <ActionButton
        :disabled="isBusy"
        @click="run('refresh')"
      >
        Comprobar autorización
      </ActionButton>
    </div>
    <p class="field-help">
      Autorizar el equipo no inicia una sesión de usuario ni da acceso por sí solo a información del despacho.
    </p>
  </section>
  <HostEventsPanel />
</template>
<style scoped>
.pairing-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }
</style>
