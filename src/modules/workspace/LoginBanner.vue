<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId } from 'vue'
import { computeMosaicGrid, createLoginMosaic, launchMosaicSeed, tileSize } from './loginMosaic'
import { useMeasuredSize } from '../home/useMeasuredSize'
import { preferences } from '../settings/localPreferencesState'

/**
 * Banner del acceso (ADR-039): mosaico geométrico procedural que llena todo el panel derecho, dibujado en SVG con los tokens del tema, así
 * se adapta a Light/Dark y al color principal elegido sin recursos externos. Es decorativo (`aria-hidden`).
 * - Llena el panel (2026-10-13): `ResizeObserver` (useMeasuredSize) mide el panel y `computeMosaicGrid` da columnas y filas
 *   enteras; el SVG se estira sin conservar proporción (`preserveAspectRatio="none"`) unos pocos puntos para que las
 *   baldosas, casi cuadradas, cubran el panel sin cortes. Agrandar la ventana sólo agrega baldosas al final.
 * - Cada baldosa: fondo fijo + figura de borde a borde que gira; un recorte (clipPath) del tamaño de la baldosa evita que,
 *   a mitad del giro, las esquinas invadan a las vecinas.
 * - Movimiento sutil: cada ~3 s una figura gira 90°. No gira con movimiento reducido, con "Pausar fondo animado" ni con la
 *   ventana oculta. El mosaico no cambia mientras la app esté abierta (`launchMosaicSeed`).
 */
const bannerElement = ref<HTMLElement | null>(null)
const { width, height } = useMeasuredSize(bannerElement, 540, 760)
const grid = computed(() => computeMosaicGrid(width.value, height.value))
const rotationIntervalMilliseconds = 3200
const tiles = computed(() => createLoginMosaic(launchMosaicSeed, grid.value.columnCount, grid.value.rowCount))
const clipId = useId() + '-tile'
/** Giros acumulados por baldosa: siempre +90°, para que la transición no dé la vuelta hacia atrás. */
const addedRotations = ref<Record<number, number>>({})
let rotationTimer: ReturnType<typeof setInterval> | undefined
let reducedMotionQuery: MediaQueryList | null = null

function rotateRandomTile(): void {
  if (reducedMotionQuery?.matches || preferences.value.isBackgroundPaused || document.hidden) return
  const tile = tiles.value[Math.floor(Math.random() * tiles.value.length)]
  if (tile) addedRotations.value = { ...addedRotations.value, [tile.tileId]: (addedRotations.value[tile.tileId] ?? 0) + 90 }
}
function tileTransform(tileId: number, rotationDegrees: number): string { return `rotate(${rotationDegrees + (addedRotations.value[tileId] ?? 0)}deg)` }
onMounted(() => {
  reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  rotationTimer = setInterval(rotateRandomTile, rotationIntervalMilliseconds)
})
onBeforeUnmount(() => clearInterval(rotationTimer))
</script>
<template>
  <div
    ref="bannerElement"
    class="login-banner"
    aria-hidden="true"
    data-testid="login-banner"
    :data-columns="grid.columnCount"
    :data-rows="grid.rowCount"
  >
    <svg
      class="login-mosaic"
      :viewBox="`0 0 ${grid.columnCount * tileSize} ${grid.rowCount * tileSize}`"
      preserveAspectRatio="none"
      focusable="false"
    >
      <defs>
        <clipPath :id="clipId">
          <rect
            :width="tileSize"
            :height="tileSize"
          />
        </clipPath>
      </defs>
      <g
        v-for="tile in tiles"
        :key="tile.tileId"
        :transform="`translate(${tile.column * tileSize} ${tile.row * tileSize})`"
        :clip-path="`url(#${clipId})`"
      >
        <rect
          :width="tileSize"
          :height="tileSize"
          :class="'tone-' + tile.backgroundTone"
        />
        <g
          class="mosaic-tile"
          :style="{ transform: tileTransform(tile.tileId, tile.rotationDegrees) }"
        >
          <!-- Marco invisible: fija la caja del grupo en 100×100 para que gire sobre el centro de la baldosa. -->
          <rect
            :width="tileSize"
            :height="tileSize"
            fill="none"
          />
          <path
            :d="tile.path"
            fill-rule="evenodd"
            :class="'tone-' + tile.shapeTone"
            :data-primitive="tile.primitive"
          />
        </g>
      </g>
    </svg>
  </div>
</template>
<style scoped>
/* El panel ES el mosaico (2026-10-13): sin marco ni margen. El SVG va absoluto para no aportar alto propio a la rejilla. */
.login-banner { position: relative; min-width: 0; min-height: 0; overflow: hidden; background: var(--canvasColor); border-left: var(--structureBorder) solid var(--borderColor); }
.login-mosaic { position: absolute; inset: 0; display: block; width: 100%; height: 100%; }
.mosaic-tile { transform-box: fill-box; transform-origin: 50% 50%; transition: transform 900ms var(--easeSmoothOut); }
.tone-ink { fill: var(--textColor); }
.tone-paper { fill: var(--surfaceColor); }
.tone-gray { fill: var(--hairlineColor); }
.tone-accent { fill: var(--accentColor); }
@media (prefers-reduced-motion: reduce) { .mosaic-tile { transition: none; } }
</style>
