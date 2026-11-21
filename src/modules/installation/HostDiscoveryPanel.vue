<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import type { DiscoveryStatus } from '../../../shared/contracts/discovery'
import ActionButton from '../../shared/components/ActionButton.vue'
import TextField from '../../shared/components/TextField.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
const desktopApi = window.contapp
const status = ref<DiscoveryStatus | null>(null)
// Un equipo puede anunciar Ethernet, Wi-Fi y WSL; identidad única con alternativas conservadas en Main.
const hosts = computed(() => {
  const identities = new Set<string>()
  return (status.value?.candidates ?? []).filter(candidate => {
    if (identities.has(candidate.hostId)) return false
    identities.add(candidate.hostId); return true
  })
})
const address = ref('')
const port = ref('3210')
const error = ref('')
let timer: ReturnType<typeof setTimeout> | undefined
let isDisposed = false
const isBusy = ref(false)
/** Sondeo secuencial únicamente durante la búsqueda; navegar fuera libera el temporizador de UI. */
async function readStatus(): Promise<void> {
  try {
    const result = await desktopApi.getDiscoveryStatus()
    if (isDisposed) return
    status.value = result
    if (result.state === 'searching') timer = setTimeout(readStatus, 500)
  } catch { if (!isDisposed) error.value = 'No se pudo leer la selección del Host. Los datos existentes se conservan.' }
}
async function run(operation: () => Promise<DiscoveryStatus>): Promise<void> {
  if (isBusy.value) return
  isBusy.value = true
  error.value = ''
  clearTimeout(timer)
  try { status.value = await operation(); if (!isDisposed && status.value.state === 'searching') timer = setTimeout(readStatus, 500) }
  catch { error.value = 'No se pudo completar la operación. Revisa la dirección y el puerto o vuelve a buscar.' }
  finally { isBusy.value = false }
}
onMounted(readStatus)
onBeforeUnmount(() => { isDisposed = true; clearTimeout(timer) })
</script>
<template>
  <section aria-labelledby="host-discovery-title">
    <h2 id="host-discovery-title">
      Host del despacho
    </h2>
    <p>Busca un Host en tu red o guarda su dirección. Después será necesario verificar su identidad y autorizar este equipo.</p>
    <InlineNotice
      v-if="error"
      title="No se pudo completar"
      tone="error"
    >
      {{ error }}
    </InlineNotice>
    <InlineNotice
      v-if="status?.selectedHost"
      title="Host seleccionado"
      tone="info"
    >
      <p>{{ status.selectedHost.name }} · {{ status.selectedHost.address }}:{{ status.selectedHost.port }}</p>
      <p>La dirección seleccionada no concede confianza. Comprueba la conexión segura en el panel inferior; el acceso a los datos requiere emparejar este equipo.</p>
      <ActionButton
        :disabled="isBusy"
        @click="run(() => desktopApi.selectDiscoveredHost(null))"
      >
        Quitar selección
      </ActionButton>
    </InlineNotice>
    <div class="actions">
      <ActionButton
        :disabled="isBusy || status?.state === 'searching'"
        @click="run(() => desktopApi.findHosts())"
      >
        Buscar Hosts
      </ActionButton>
      <p role="status">
        {{ status?.state === 'searching' ? 'Buscando en la red…' : status?.state === 'unavailable' ? 'Búsqueda no disponible. Puedes indicar la dirección manualmente.' : status?.state === 'complete' && !status.candidates.length ? 'No se encontraron Hosts. Comprueba que estén preparados y en la misma red.' : '' }}
      </p>
    </div>
    <ul
      v-if="status?.candidates.length"
      aria-label="Hosts encontrados"
    >
      <li
        v-for="candidate in hosts"
        :key="candidate.hostId"
      >
        <p>{{ candidate.name }} · {{ candidate.address }}:{{ candidate.port }}</p>
        <ActionButton
          :disabled="isBusy"
          @click="run(() => desktopApi.selectDiscoveredHost(candidate.candidateId))"
        >
          Seleccionar {{ candidate.name }}
        </ActionButton>
      </li>
    </ul>
    <details>
      <summary>Indicar dirección manualmente</summary>
      <form
        class="configuration-form"
        @submit.prevent="run(() => desktopApi.setManualHost({ address, port: Number(port) }))"
      >
        <h3>Dirección manual</h3>
        <TextField
          id="manual-host-address"
          v-model="address"
          label="Dirección del Host"
          help="Nombre de equipo o IPv4, sin https:// ni rutas."
        />
        <TextField
          id="manual-host-port"
          v-model="port"
          label="Puerto del Host"
          type="text"
        />
        <ActionButton
          type="submit"
          :disabled="isBusy"
        >
          Guardar dirección del Host
        </ActionButton>
      </form>
    </details>
  </section>
</template>
