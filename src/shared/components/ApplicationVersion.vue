<script setup lang="ts">
import { onMounted, ref } from 'vue'
/** Versión del ejecutable, visible en instalación, acceso y espacio de trabajo. */
const version = ref('')
onMounted(async () => {
  try { version.value = (await window.contapp.getApplicationInformation()).version }
  catch { version.value = 'no disponible' }
})
</script>
<template>
  <span data-testid="application-version">{{ version ? 'Versión ' + version : 'Iniciando aplicación…' }}</span>
</template>
