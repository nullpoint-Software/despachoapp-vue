<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import LinkFilePanel from './LinkFilePanel.vue'
import HostDiscoveryPanel from './HostDiscoveryPanel.vue'
import HostTrustPanel from './HostTrustPanel.vue'
import DevicePairingPanel from './DevicePairingPanel.vue'
/** `setup`: vincular con la clave USB. `settings`: diagnóstico y vinculación manual con sesión iniciada. */
const props = withDefaults(defineProps<{ context?: 'setup' | 'settings' }>(), { context: 'setup' })
const isPaired = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
let isDisposed = false
/** Lee estado LOCAL; no envía solicitudes repetidas al Host mientras se prepara el archivo USB. */
async function refresh(): Promise<void> {
  try { const status = await window.contapp.managePairing('status'); if (!isDisposed) isPaired.value = status.state === 'paired' } catch { /* Las alternativas manuales permiten diagnosticar. */ }
  if (!isDisposed) timer = setTimeout(refresh, 2000)
}
onMounted(refresh)
onBeforeUnmount(() => { isDisposed = true; clearTimeout(timer) })
</script>
<template>
  <section class="reference-section">
    <h2>{{ props.context === 'settings' ? 'Conexión con el Host' : isPaired ? 'Equipo vinculado' : 'Conecta este equipo' }}</h2>
    <LinkFilePanel
      v-if="!isPaired && props.context === 'setup'"
      mode="client"
      @linked="isPaired = true"
    />
    <p v-if="isPaired && props.context === 'setup'">
      Este equipo está vinculado al Host del despacho.
    </p>
    <p v-if="props.context === 'settings'">
      {{ isPaired ? 'Este equipo está vinculado al Host del despacho.' : 'Este equipo no está vinculado. Vuelve a vincularlo con una clave USB nueva.' }}
    </p>
    <details :open="props.context === 'settings'">
      <summary>Vinculación manual y diagnóstico de conexión</summary>
      <HostDiscoveryPanel />
      <HostTrustPanel mode="client" />
      <DevicePairingPanel />
    </details>
  </section>
</template>
