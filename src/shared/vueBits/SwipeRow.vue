<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId, type Component } from 'vue'
import { animate, motionValue, useReducedMotion } from 'motion-v'
import { Ellipsis } from '@lucide/vue'

/**
 * "Swipe Row" de Vue Bits (MIT + Commons Clause), adaptado para renglones de Pagos y Clientes:
 * - Arrastrar el renglón hacia la izquierda revela sus acciones; un "flick" decide abrir o cerrar con el
 *   resorte y la resistencia elástica del original (`rubber`).
 * - **Sin "borrar al deslizar completo"**: las acciones sólo se ejecutan con su botón, porque operaciones
 *   como Anular piden motivo y contraseña en su propio diálogo.
 * - **Botón ⋯ visible** (además del arrastre): abre y cierra con clic o teclado; flecha izquierda abre,
 *   derecha o Escape cierran. Las acciones ocultas son `inert` hasta que se revelan.
 * - Iconos Lucide, textos en español y estilos con tokens (sin Tailwind ni Hugeicons).
 * - `revealSide` (2026-10-13): 'end' (por omisión) revela a la derecha arrastrando a la izquierda; 'start' (sólo Fiscal)
 *   lo refleja: arrastrar a la derecha revela el panel a la izquierda, el ⋯ va al inicio y las flechas se invierten.
 *   Internamente se trabaja con la "exposición" (px revelados, siempre positiva) y `direction` da el signo del offset.
 */
/** `accessibleName` permite conservar nombres existentes ("Editar F-000001"); por omisión, etiqueta + renglón. */
export interface SwipeAction { actionId: string; label: string; icon: Component; tone?: 'neutral' | 'danger'; isDisabled?: boolean; accessibleName?: string; onSelect: () => void }
const props = withDefaults(defineProps<{ actions: SwipeAction[]; label: string; actionWidth?: number; revealSide?: 'end' | 'start' }>(), { actionWidth: 76, revealSide: 'end' })

const reduceMotion = useReducedMotion()
const railId = useId()
const root = ref<HTMLElement | null>(null), surface = ref<HTMLElement | null>(null), rail = ref<HTMLElement | null>(null)
const isOpen = ref(false)
const offset = motionValue(0)
const drawerWidth = computed(() => props.actions.length * props.actionWidth)
/** Signo del offset del renglón: -1 lo mueve a la izquierda (acciones al final), 1 a la derecha (acciones al inicio). */
const direction = computed(() => props.revealSide === 'start' ? 1 : -1)
const hysteresisPixels = 10, flickVelocity = 110, resistance = .55
let grip: { pointerId: number; startX: number; startY: number; grab: number | null; samples: Array<[number, number]> } | null = null
let rowWidth = 600, stopPainting: (() => void) | undefined, observer: ResizeObserver | null = null

/** Resistencia elástica del original al pasar de los límites. */
const rubber = (overshoot: number) => (overshoot * rowWidth * resistance) / (rowWidth + resistance * Math.abs(overshoot))
const mapExposure = (raw: number) => raw < 0 ? rubber(raw) : raw <= drawerWidth.value ? raw : drawerWidth.value + rubber(raw - drawerWidth.value)
function paint(): void {
  const exposed = offset.get() * direction.value
  if (surface.value) surface.value.style.transform = `translateX(${offset.get()}px)`
  // El panel entra desde su borde: oculto queda fuera por completo, del lado opuesto al renglón.
  if (rail.value) rail.value.style.transform = `translateX(${-direction.value * Math.max(0, drawerWidth.value - exposed)}px)`
}
function settle(isOpening: boolean, velocity = 0): void {
  isOpen.value = isOpening
  const target = isOpening ? direction.value * drawerWidth.value : 0
  if (reduceMotion.value) { animate(offset, target, { duration: .2, ease: [.23, 1, .32, 1] }); return }
  animate(offset, target, { type: 'spring', duration: .35, bounce: Math.abs(velocity) >= flickVelocity ? .2 : 0, velocity: direction.value * velocity })
}
function onPointerDown(event: PointerEvent): void {
  if (event.button !== 0 || !props.actions.length || (event.target as HTMLElement).closest('button')) return
  offset.stop()
  grip = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, grab: null, samples: [] }
  window.addEventListener('pointermove', onPointerMove); window.addEventListener('pointerup', onPointerUp); window.addEventListener('pointercancel', onPointerUp)
}
function onPointerMove(event: PointerEvent): void {
  if (!grip || grip.pointerId !== event.pointerId) return
  const deltaX = event.clientX - grip.startX, deltaY = event.clientY - grip.startY
  if (grip.grab === null) {
    // Sólo se engancha un arrastre horizontal claro: el desplazamiento vertical de la lista no se bloquea.
    if (Math.abs(deltaX) < hysteresisPixels || Math.abs(deltaX) < Math.abs(deltaY)) return
    // Desde aquí: exposición = exposición al enganchar + distancia recorrida hacia la izquierda.
    grip.grab = offset.get() * direction.value; grip.startX = event.clientX
    root.value?.setAttribute('data-dragging', '')
  }
  const exposed = mapExposure(grip.grab + (event.clientX - grip.startX) * direction.value)
  offset.set(direction.value * exposed)
  grip.samples.push([performance.now(), exposed]); if (grip.samples.length > 4) grip.samples.shift()
}
function onPointerUp(event: PointerEvent): void {
  if (!grip || grip.pointerId !== event.pointerId) return
  const samples = grip.samples, wasDragged = grip.grab !== null
  grip = null
  root.value?.removeAttribute('data-dragging')
  window.removeEventListener('pointermove', onPointerMove); window.removeEventListener('pointerup', onPointerUp); window.removeEventListener('pointercancel', onPointerUp)
  if (!wasDragged) return
  const first = samples[0], last = samples[samples.length - 1]
  const velocity = first && last ? (last[1] - first[1]) / Math.max(1, last[0] - first[0]) * 1000 : 0
  const exposed = offset.get() * direction.value
  settle(Math.abs(velocity) >= flickVelocity ? velocity > 0 : exposed > drawerWidth.value / 2, velocity)
}
/** La flecha hacia el lado del arrastre abre; la contraria o Escape cierran (reflejado con `revealSide: 'start'`). */
function onToggleKey(event: KeyboardEvent): void {
  const openKey = props.revealSide === 'start' ? 'ArrowRight' : 'ArrowLeft', closeKey = props.revealSide === 'start' ? 'ArrowLeft' : 'ArrowRight'
  if (event.key === openKey && !isOpen.value) { event.preventDefault(); settle(true) }
  else if ((event.key === closeKey || event.key === 'Escape') && isOpen.value) { event.preventDefault(); settle(false) }
}
function selectAction(action: SwipeAction): void { if (action.isDisabled) return; settle(false); action.onSelect() }

onMounted(() => {
  if (root.value) { rowWidth = root.value.offsetWidth || rowWidth; observer = new ResizeObserver(entries => { rowWidth = entries[0]?.contentRect.width || rowWidth }); observer.observe(root.value) }
  stopPainting = offset.on('change', paint); paint()
})
onBeforeUnmount(() => { stopPainting?.(); observer?.disconnect(); offset.stop(); window.removeEventListener('pointermove', onPointerMove); window.removeEventListener('pointerup', onPointerUp); window.removeEventListener('pointercancel', onPointerUp) })
</script>
<template>
  <div
    ref="root"
    class="swipe-row"
    role="group"
    :aria-label="label"
    :data-open="isOpen ? '' : undefined"
    :data-reveal-side="revealSide"
    :style="{ '--swipeActionWidth': actionWidth + 'px' }"
  >
    <div
      :id="railId"
      ref="rail"
      class="swipe-rail"
      :inert="!isOpen || undefined"
      :aria-hidden="!isOpen"
    >
      <button
        v-for="action in actions"
        :key="action.actionId"
        type="button"
        class="swipe-action"
        :class="{ 'is-danger': action.tone === 'danger' }"
        :disabled="action.isDisabled"
        :aria-label="action.accessibleName ?? action.label + ' — ' + label"
        @click="selectAction(action)"
      >
        <component
          :is="action.icon"
          :size="17"
          aria-hidden="true"
        />
        <span>{{ action.label }}</span>
      </button>
    </div>
    <div
      ref="surface"
      class="swipe-surface"
      @pointerdown="onPointerDown"
    >
      <div class="swipe-content">
        <slot />
      </div>
      <button
        v-if="actions.length"
        type="button"
        class="icon-button swipe-toggle"
        data-row-focus
        :aria-label="(isOpen ? 'Ocultar acciones de ' : 'Acciones de ') + label"
        :aria-expanded="isOpen"
        :aria-controls="railId"
        @click="settle(!isOpen)"
        @keydown="onToggleKey"
      >
        <Ellipsis
          :size="18"
          aria-hidden="true"
        />
      </button>
    </div>
  </div>
</template>
<style scoped>
.swipe-row { position: relative; overflow: hidden; border: 2px solid var(--borderColor); border-radius: var(--radiusNested); background: var(--subtleColor); }
.swipe-rail { position: absolute; inset: 0 0 0 auto; display: flex; }
.swipe-action { display: grid; place-items: center; align-content: center; gap: 4px; width: var(--swipeActionWidth); height: 100%; padding: 0 4px; border: 0; border-left: 1px solid var(--borderColor); background: var(--subtleColor); color: var(--textColor); font: inherit; font-size: 11px; font-weight: 500; cursor: pointer; }
.swipe-action:hover:not(:disabled) { background: var(--hoverColor); }
.swipe-action.is-danger { background: var(--errorFill); color: var(--errorText); }
.swipe-action:disabled { opacity: .45; cursor: not-allowed; }
/* overflow: hidden: un contenido más ancho que el renglón nunca pinta encima de las acciones reveladas. */
.swipe-surface { position: relative; z-index: 1; overflow: hidden; display: flex; align-items: center; gap: 12px; padding: 12px 8px 12px 16px; background: var(--surfaceColor); touch-action: pan-y; cursor: grab; }
.swipe-row[data-dragging] .swipe-surface { cursor: grabbing; user-select: none; }
.swipe-content { flex: 1; min-width: 0; }
.swipe-toggle { flex-shrink: 0; }
.swipe-row[data-open] .swipe-toggle { background: var(--hoverColor); }
/* revealSide 'start': panel a la izquierda, filete a la derecha de cada acción y ⋯ al inicio (relleno reflejado). */
.swipe-row[data-reveal-side="start"] .swipe-rail { inset: 0 auto 0 0; }
.swipe-row[data-reveal-side="start"] .swipe-action { border-left: 0; border-right: 1px solid var(--borderColor); }
.swipe-row[data-reveal-side="start"] .swipe-surface { padding: 12px 16px 12px 8px; }
.swipe-row[data-reveal-side="start"] .swipe-toggle { order: -1; }
</style>
