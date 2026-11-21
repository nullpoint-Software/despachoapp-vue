<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import type { BackgroundStyle } from '../../../shared/contracts/localPreferences'
import { drawBackgroundPattern } from '../../shared/components/backgroundPatterns'
import { readColorToken } from '../../shared/components/backgroundMotion'
import { effectiveTheme, preferences } from './localPreferencesState'

/**
 * Vista previa fija de un fondo en Configuración (ADR-039): un cuadro del mismo dibujo que usa la mesa, sin animación
 * (no suma ciclos de CPU a la página). Se redibuja al cambiar de tema o de color principal para tomar la tinta y el acento vigentes. "Ninguno" queda en papel liso.
 */
const props = defineProps<{ backgroundStyle: BackgroundStyle }>()
const canvasElement = ref<HTMLCanvasElement | null>(null)
const previewWidth = 120, previewHeight = 72
/** La miniatura muestra el patrón a media escala (más celdas) y con más tinta, para que se distinga a ese tamaño. */
const patternScale = 0.5, previewOpacityScale = 2.5

function drawPreview(): void {
  const context = canvasElement.value?.getContext('2d')
  if (!context) return
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
  context.canvas.width = previewWidth * pixelRatio; context.canvas.height = previewHeight * pixelRatio
  context.setTransform(pixelRatio * patternScale, 0, 0, pixelRatio * patternScale, 0, 0)
  context.clearRect(0, 0, previewWidth / patternScale, previewHeight / patternScale)
  if (props.backgroundStyle === 'none') return
  // Tiempo fijo distinto de 0 para que las ondas y los hilos no salgan alineados.
  drawBackgroundPattern(context, props.backgroundStyle, { width: previewWidth / patternScale, height: previewHeight / patternScale, timeSeconds: 4, inkColor: readColorToken('--textColor', '#0B0B0B'), accentColor: readColorToken('--accentColor', '#1F3BD6'), opacityScale: previewOpacityScale })
}
onMounted(drawPreview)
// App.vue cambia `data-theme` en el mismo ciclo: se espera a que el DOM lo tenga antes de leer la tinta.
watch([effectiveTheme, () => preferences.value.accentColor], () => { void nextTick(drawPreview) })
</script>
<template>
  <canvas
    ref="canvasElement"
    class="background-preview"
    aria-hidden="true"
  />
</template>
<style scoped>
.background-preview { display: block; width: 100%; aspect-ratio: 5 / 3; background: var(--canvasColor); }
</style>
