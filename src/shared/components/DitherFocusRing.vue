<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { isCellLit, waveFor } from './ditherPattern'

/**
 * Anillos con **dithering procedural** (pedido del usuario, 2026-10-17: "el resaltado, una animación dithering
 * procedural"; después: "también va cuando se remarca algo, ya sea por los toast o por búsqueda"). Uno solo, montado en
 * `App.vue`, dibuja dos clases de anillo:
 * - **Foco:** campos de texto, listas y áreas de texto (`.field`) y el buscador (`.search-box`), que ya no dibujan su
 *   `outline` (ver base.css). Anillo de 4 px a 2 px del campo, con `--focusColor`.
 * - **Resaltado:** el elemento al que lleva un aviso (`.is-navigation-target`, `revealNavigationItem`) y la tarjeta
 *   elegida en el buscador de Tareas (`.kanban-card.is-highlighted`). Anillo de 6 px a 3 px, con `--accentColor`. Se
 *   detectan con un `MutationObserver` de la clase: el anillo aparece al ponerla y se va al quitarla.
 *
 * Cómo se dibuja (`ditherPattern.ts`): cada anillo es un `<canvas>` fijo, sin eventos de puntero, encima de todo. En
 * cada cuadro se mide otra vez el elemento (sigue a modales que se mueven y listas que se desplazan) y se encienden las
 * celdas de 2 px del anillo cuyo umbral de **Bayer 4×4** queda bajo la densidad de una onda que recorre el contorno:
 * sólo píxeles encendidos o apagados, sin degradados. Con `prefers-reduced-motion` el anillo queda quieto al 50 %.
 */
type RingKind = 'focus' | 'highlight'
interface Ring { kind: RingKind; canvas: HTMLCanvasElement }
const focusSelector = '.field input:not([type="checkbox"]):not([type="radio"]), .field select, .field textarea, .search-box input'
const highlightSelector = '.is-navigation-target, .kanban-card.is-highlighted'
const ringShapes: Readonly<Record<RingKind, { offset: number; thickness: number; colorProperty: string }>> = {
  focus: { offset: 2, thickness: 4, colorProperty: '--focusColor' },
  highlight: { offset: 3, thickness: 6, colorProperty: '--accentColor' }
}
const cellPixels = 2
const rings = new Map<HTMLElement, Ring>()
let focusTarget: HTMLElement | null = null
let frameId = 0
let observer: MutationObserver | null = null

function isReducedMotion(): boolean { return window.matchMedia('(prefers-reduced-motion: reduce)').matches }

function addRing(element: HTMLElement, kind: RingKind): void {
  if (rings.has(element)) return
  const canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  canvas.className = 'dither-ring'
  Object.assign(canvas.style, { position: 'fixed', top: '0', left: '0', zIndex: '2147483000', pointerEvents: 'none', imageRendering: 'pixelated' })
  document.body.appendChild(canvas)
  rings.set(element, { kind, canvas })
  if (!frameId) frameId = requestAnimationFrame(loop)
}
function removeRing(element: HTMLElement): void {
  rings.get(element)?.canvas.remove()
  rings.delete(element)
}

function drawRing(element: HTMLElement, ring: Ring, seconds: number): void {
  const shape = ringShapes[ring.kind], canvas = ring.canvas
  const rect = element.getBoundingClientRect()
  const margin = shape.offset + shape.thickness
  const width = Math.round(rect.width + margin * 2), height = Math.round(rect.height + margin * 2)
  const ratio = window.devicePixelRatio || 1
  canvas.style.transform = 'translate(' + Math.round(rect.left - margin) + 'px,' + Math.round(rect.top - margin) + 'px)'
  if (canvas.width !== width * ratio || canvas.height !== height * ratio) {
    canvas.width = width * ratio; canvas.height = height * ratio
    canvas.style.width = width + 'px'; canvas.style.height = height + 'px'
  }
  const context = canvas.getContext('2d')
  if (!context) return
  context.setTransform(ratio, 0, 0, ratio, 0, 0)
  context.clearRect(0, 0, width, height)
  context.fillStyle = getComputedStyle(element).getPropertyValue(shape.colorProperty).trim() || '#1F3BD6'
  const columns = Math.ceil(width / cellPixels), rows = Math.ceil(height / cellPixels), band = shape.thickness / cellPixels
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      // Sólo las celdas del anillo (las primeras `band` celdas de cada borde).
      if (row >= band && row < rows - band && column >= band && column < columns - band) continue
      const angle = Math.atan2(row - rows / 2, column - columns / 2) / (2 * Math.PI) + 0.5
      const density = isReducedMotion() ? 0.5 : waveFor(angle, seconds)
      if (isCellLit(row, column, density)) context.fillRect(column * cellPixels, row * cellPixels, cellPixels, cellPixels)
    }
  }
}

function drawAll(seconds: number): void {
  for (const [element, ring] of rings) {
    if (!element.isConnected) { removeRing(element); continue }
    drawRing(element, ring, seconds)
  }
}
function loop(time: number): void {
  drawAll(time / 1000)
  // Con movimiento reducido se dibuja una vez; desplazamientos y cambios de tamaño vuelven a dibujar (`onLayoutChange`).
  frameId = rings.size && !isReducedMotion() ? requestAnimationFrame(loop) : 0
}

function clearFocus(): void { if (focusTarget) removeRing(focusTarget); focusTarget = null }
function onFocusIn(event: FocusEvent): void {
  const element = event.target instanceof HTMLElement ? event.target : null
  clearFocus()
  if (!element?.matches(focusSelector)) return
  focusTarget = element.closest<HTMLElement>('.search-box') ?? element
  addRing(focusTarget, 'focus')
}
function onFocusOut(event: FocusEvent): void {
  // Pasar el foco a otro campo lo atiende `focusin`; aquí sólo se apaga si el foco sale del campo actual.
  if (focusTarget && !(event.relatedTarget instanceof Node && focusTarget.contains(event.relatedTarget))) clearFocus()
}
function onLayoutChange(): void { if (rings.size && isReducedMotion()) drawAll(0) }

/** Resaltados: aparece el anillo al poner la clase y se va al quitarla. */
function onClassChange(mutations: MutationRecord[]): void {
  for (const mutation of mutations) {
    const element = mutation.target
    if (!(element instanceof HTMLElement)) continue
    if (element.matches(highlightSelector)) addRing(element, 'highlight')
    else if (rings.get(element)?.kind === 'highlight') removeRing(element)
  }
}

onMounted(() => {
  document.addEventListener('focusin', onFocusIn)
  document.addEventListener('focusout', onFocusOut)
  window.addEventListener('scroll', onLayoutChange, true)
  window.addEventListener('resize', onLayoutChange)
  observer = new MutationObserver(onClassChange)
  observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] })
})
onBeforeUnmount(() => {
  cancelAnimationFrame(frameId); frameId = 0
  observer?.disconnect()
  for (const element of [...rings.keys()]) removeRing(element)
  document.removeEventListener('focusin', onFocusIn)
  document.removeEventListener('focusout', onFocusOut)
  window.removeEventListener('scroll', onLayoutChange, true)
  window.removeEventListener('resize', onLayoutChange)
})
</script>

<template>
  <!-- Los anillos son lienzos creados en `document.body` (ver `addRing`); el componente no pinta nada propio. -->
  <span
    hidden
    aria-hidden="true"
  />
</template>
