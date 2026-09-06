<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { AGNES_DOWNLOAD_URL, detectAgnes, type AgnesDetection } from '@/utils/agnesDetection'
import { getPrinterPreferences } from '@/utils/printerSettings'
const props = withDefaults(defineProps<{ refreshKey?: number }>(), { refreshKey: 0 })
const status = ref<AgnesDetection | 'checking'>('checking')
let generation = 0
async function check() {
  const current = ++generation
  status.value = 'checking'
  const result = await detectAgnes(getPrinterPreferences().token)
  if (generation === current) status.value = result
}
onMounted(check)
watch(() => props.refreshKey, check)
onUnmounted(() => {
  generation++
})
</script>

<template>
  <aside v-if="status !== 'ready'" class="agnes-connection" aria-label="Conexión con Agnes">
    <p v-if="status === 'checking'" role="status">Comprobando Agnes…</p>
    <template v-else>
      <p role="status">
        <template v-if="status === 'pairing'"
          >Agnes está disponible. Revisa la clave de vinculación en Configuración y autoriza esta
          app en Agnes.</template
        >
        <template v-else-if="status === 'incompatible'"
          >La versión detectada no es compatible. Descarga la versión actual de Agnes.</template
        >
        <template v-else
          >No se pudo conectar con Agnes. Si ya lo tienes, ábrelo, agrega esta app a la lista
          autorizada y permite el acceso local del navegador.</template
        >
      </p>
      <div class="agnes-connection-actions">
        <a
          v-if="status === 'unavailable' || status === 'incompatible'"
          :href="AGNES_DOWNLOAD_URL"
          download="AgnesPrinterPlugin-1.2.zip"
          >Descargar Agnes Printer Plugin 1.2</a
        >
        <button type="button" @click="check">Volver a detectar</button>
      </div>
      <p v-if="status === 'unavailable' || status === 'incompatible'">
        Extrae el ZIP, abre AgnesPrinterPlugin.exe y vincúlalo en Configuración → Impresora de este
        equipo.
      </p>
    </template>
  </aside>
</template>

<style scoped>
.agnes-connection {
  margin: 12px 0;
  padding: 12px;
  border: 1px solid currentColor;
  border-radius: 8px;
  font-size: 14px;
}
.agnes-connection p {
  margin: 0 0 8px;
}
.agnes-connection p:last-child {
  margin-bottom: 0;
}
.agnes-connection-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin: 8px 0;
}
.agnes-connection-actions a {
  color: inherit;
  text-decoration: underline;
  font-weight: 600;
}
.agnes-connection-actions button {
  padding: 6px 10px;
  color: inherit;
  background: transparent;
  border: 1px solid currentColor;
  border-radius: 6px;
  cursor: pointer;
}
</style>
