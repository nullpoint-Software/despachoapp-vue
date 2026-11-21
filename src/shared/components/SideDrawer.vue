<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import { useDialogMotion } from '../motion/dialogMotion'
import { X } from '@lucide/vue'
import { clampDrawerWidth, computeDrawerWidthBounds, drawerKeyboardLargeStepMultiplier, drawerKeyboardStepPixels, readStoredDrawerWidth, storeDrawerWidth } from './drawerWidth'

/**
 * Cajón lateral derecho (rediseño 2026-10-02), como el cajón "Reportes guardados" del original:
 * - `<dialog>` con `showModal()`: foco confinado, fondo inerte y Escape cierran igual que `FormModal`.
 * - Ancho por omisión `min(42rem, 100vw)` y alto completo; tarjeta con borde fino y esquinas izquierdas de 24 px.
 * - Entra desde la derecha (transitions.dev "Panel reveal": 400 ms al abrir, 350 ms al cerrar); con movimiento
 *   reducido aparece sin animación.
 * - Un clic en el fondo cierra (a diferencia del original, que sólo cerraba con × o Escape), pero sólo si el gesto
 *   empezó y terminó en el fondo lejos del borde: los 12 px del fondo pegados al borde izquierdo inician el
 *   redimensionado en vez de cerrar.
 * - **Redimensionable** (2026-10-10, pedido del usuario): el borde izquierdo es un separador (`role="separator"`) que se
 *   arrastra con el puntero o se mueve con ←/→ (Shift = paso largo, Inicio/Fin = mínimo/máximo); doble clic vuelve al
 *   ancho por omisión. Límites y memoria en `drawerWidth.ts`: el ancho se recuerda por cajón (`storageKey`, o `testId`)
 *   en este equipo. En ventanas angostas (≤ 760 px) el cajón ocupa todo el ancho y el separador se oculta.
 * El contenido se monta sólo mientras está abierto, para que cada apertura consulte datos vigentes.
 */
const props = defineProps<{ isOpen: boolean; title: string; testId?: string; storageKey?: string }>()
const emit = defineEmits<{ close: [] }>()
const dialog = ref<HTMLDialogElement | null>(null)
const titleId = useId()
const motion = useDialogMotion(dialog, '--durationMedium')

/** Clave de memoria del ancho; sin clave el ancho elegido dura mientras viva el componente. */
const drawerKey = computed(() => props.storageKey ?? props.testId ?? null)
/** Ancho elegido por la persona (`null` = ancho por omisión del CSS). */
const chosenWidth = ref<number | null>(drawerKey.value ? readStoredDrawerWidth(drawerKey.value) : null)
/** Ancho que se ve (medido al abrir y al redimensionar), para `aria-valuenow`. */
const renderedWidth = ref(0)
const viewportWidth = ref(window.innerWidth)
const bounds = computed(() => computeDrawerWidthBounds(viewportWidth.value))
const drawerStyle = computed(() => chosenWidth.value === null ? undefined : { '--drawerWidth': clampDrawerWidth(chosenWidth.value, viewportWidth.value) + 'px' })
const isResizing = ref(false)
const resizer = ref<HTMLElement | null>(null)
/**
 * Zona de agarre fuera del cajón (2026-10-10, corrección: "al hacer clic en el redimensionado del drawer se cierra").
 * El separador mide 10 px dentro del cajón; quien apunta a la línea del borde suele caer unos píxeles a la izquierda,
 * sobre el fondo, y ese clic cerraba el cajón. Ahora esos píxeles también inician el redimensionado.
 */
const outsideGrabPixels = 12
/**
 * El fondo sólo cierra si el gesto completo ocurrió en el fondo: `pointerdown` y `click` fuera del cajón y lejos del
 * borde. Así ni un arrastre que termina sobre el fondo ni un clic en el borde cierran el cajón.
 */
let hasPointerDownOnBackdrop = false
let resizeGesture: { pointerId: number; startX: number; startWidth: number } | null = null

function measureWidth(): void { renderedWidth.value = Math.round(dialog.value?.getBoundingClientRect().width ?? 0) }
function applyWidth(width: number): void {
  chosenWidth.value = clampDrawerWidth(width, viewportWidth.value)
  renderedWidth.value = chosenWidth.value
}
function rememberWidth(): void { if (drawerKey.value) storeDrawerWidth(drawerKey.value, chosenWidth.value) }

/** Inicia el arrastre; la captura va siempre al separador, aunque el gesto empiece en la zona de agarre del fondo. */
function onResizePointerDown(event: PointerEvent): void {
  if (event.button !== 0) return
  event.preventDefault()
  measureWidth()
  resizeGesture = { pointerId: event.pointerId, startX: event.clientX, startWidth: renderedWidth.value }
  isResizing.value = true
  try { resizer.value?.setPointerCapture(event.pointerId) } catch { /* Sin captura: el gesto sigue mientras el puntero esté encima. */ }
}
/** ¿El punto cae sobre el fondo (no sobre el cajón ni su zona de agarre)? */
function isFarFromDrawer(event: MouseEvent): boolean {
  const drawerRect = dialog.value?.getBoundingClientRect()
  return !!drawerRect && event.clientX < drawerRect.left - outsideGrabPixels
}
/** ¿El punto cae en la franja del fondo pegada al borde izquierdo (zona de agarre)? Sólo cuando el separador se ve. */
function isInOutsideGrabZone(event: MouseEvent): boolean {
  const drawerRect = dialog.value?.getBoundingClientRect()
  if (!drawerRect || !resizer.value || resizer.value.offsetWidth === 0) return false
  return event.clientX >= drawerRect.left - outsideGrabPixels && event.clientX < drawerRect.left
}
/** `pointerdown` en el `<dialog>`: el fondo pegado al borde inicia el arrastre; el fondo lejano marca un posible cierre. */
function onDialogPointerDown(event: PointerEvent): void {
  hasPointerDownOnBackdrop = false
  if (event.target !== dialog.value) return
  if (isInOutsideGrabZone(event)) { onResizePointerDown(event); return }
  hasPointerDownOnBackdrop = isFarFromDrawer(event)
}
/** Cursor de redimensionado sobre la zona de agarre del fondo. */
const isNearEdge = ref(false)
function onDialogPointerMove(event: PointerEvent): void {
  isNearEdge.value = !isResizing.value && event.target === dialog.value && isInOutsideGrabZone(event)
}
function onResizePointerMove(event: PointerEvent): void {
  if (!resizeGesture || resizeGesture.pointerId !== event.pointerId) return
  // El cajón está anclado a la derecha: mover el borde a la izquierda lo ensancha.
  applyWidth(resizeGesture.startWidth + (resizeGesture.startX - event.clientX))
}
function onResizePointerUp(event: PointerEvent): void {
  if (!resizeGesture || resizeGesture.pointerId !== event.pointerId) return
  const hasMoved = Math.abs(event.clientX - resizeGesture.startX) > 2
  resizeGesture = null; isResizing.value = false
  try { (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId) } catch { /* Ya liberada. */ }
  if (hasMoved) rememberWidth()
}
function onResizeKeyDown(event: KeyboardEvent): void {
  const step = drawerKeyboardStepPixels * (event.shiftKey ? drawerKeyboardLargeStepMultiplier : 1)
  measureWidth()
  const nextWidths: Record<string, number> = { ArrowLeft: renderedWidth.value + step, ArrowRight: renderedWidth.value - step, Home: bounds.value.minimumWidth, End: bounds.value.maximumWidth }
  const nextWidth = nextWidths[event.key]
  if (nextWidth === undefined) return
  event.preventDefault()
  applyWidth(nextWidth); rememberWidth()
}
/** Doble clic: olvida el ancho elegido y vuelve al de omisión. */
async function resetWidth(): Promise<void> {
  chosenWidth.value = null; rememberWidth()
  await nextTick(); measureWidth()
}
function onWindowResize(): void { viewportWidth.value = window.innerWidth; measureWidth() }

watch(() => props.isOpen, async isOpen => {
  await nextTick()
  if (isOpen !== props.isOpen || !dialog.value) return
  if (isOpen) { motion.open(); viewportWidth.value = window.innerWidth; measureWidth() }
  else motion.close()
}, { immediate: true })

function onCancel(event: Event): void { event.preventDefault(); emit('close') }
function onBackdropClick(event: MouseEvent): void {
  const shouldClose = hasPointerDownOnBackdrop && event.target === dialog.value && isFarFromDrawer(event)
  hasPointerDownOnBackdrop = false
  if (shouldClose) emit('close')
}
onMounted(() => window.addEventListener('resize', onWindowResize))
onBeforeUnmount(() => { window.removeEventListener('resize', onWindowResize); if (dialog.value?.open) dialog.value.close() })
</script>
<template>
  <dialog
    ref="dialog"
    class="side-drawer motion-drawer"
    :data-resizing="isResizing || undefined"
    :data-near-edge="isNearEdge || undefined"
    :style="drawerStyle"
    :aria-labelledby="titleId"
    :data-testid="testId"
    @cancel="onCancel"
    @pointerdown="onDialogPointerDown"
    @pointermove="onDialogPointerMove"
    @pointerleave="isNearEdge = false"
    @click="onBackdropClick"
  >
    <header class="side-drawer-header">
      <div>
        <h2 :id="titleId">
          <slot name="title">
            {{ title }}
          </slot>
        </h2>
      </div>
      <button
        type="button"
        class="icon-button"
        aria-label="Cerrar"
        @click="emit('close')"
      >
        <X
          :size="18"
          aria-hidden="true"
        />
      </button>
    </header>
    <div class="side-drawer-body">
      <slot v-if="isOpen || motion.isRendered.value" />
    </div>
    <!-- Al final del DOM (aunque se pinta a la izquierda): showModal() da el foco inicial al contenido, no al separador. -->
    <div
      ref="resizer"
      class="side-drawer-resizer"
      role="separator"
      aria-orientation="vertical"
      aria-label="Ancho del panel"
      :aria-valuenow="renderedWidth || undefined"
      :aria-valuemin="bounds.minimumWidth"
      :aria-valuemax="bounds.maximumWidth"
      :aria-valuetext="renderedWidth ? renderedWidth + ' píxeles' : undefined"
      tabindex="0"
      title="Arrastra para cambiar el ancho · doble clic restablece"
      @pointerdown="onResizePointerDown"
      @pointermove="onResizePointerMove"
      @pointerup="onResizePointerUp"
      @pointercancel="onResizePointerUp"
      @keydown="onResizeKeyDown"
      @dblclick="resetWidth"
    />
  </dialog>
</template>
<style scoped>
.side-drawer { position: fixed; inset: 0 0 0 auto; margin: 0; width: var(--drawerWidth, min(42rem, 100vw)); max-width: 100vw; height: 100dvh; max-height: 100dvh; padding: 0; border: 0; border-radius: var(--radiusCard) 0 0 var(--radiusCard); box-shadow: var(--overlayShadow); background: var(--surfaceColor); color: var(--textColor); overflow: hidden; }
.side-drawer[open] { display: flex; flex-direction: column; }
/*
 * Estados como atributos `data-*`, no clases: useDialogMotion pone `is-open`/`is-closing` a mano en la clase y un
 * `:class` de Vue reescribe la clase completa al cambiar, borrando `is-open` y deslizando el cajón fuera de la
 * pantalla (parecía que se cerraba al tocar el separador; corrección 2026-10-10).
 */
/* Mientras se arrastra no se selecciona texto y el cursor no parpadea al pasar sobre el contenido. */
.side-drawer[data-resizing] { user-select: none; cursor: ew-resize; }
/* Zona de agarre sobre el fondo, pegada al borde: el fondo pertenece al `<dialog>`, así que su cursor es el del fondo. */
.side-drawer[data-near-edge], .side-drawer[data-near-edge]::backdrop, .side-drawer[data-resizing]::backdrop { cursor: ew-resize; }
/* Fondo plano en tinta, sin desenfoque (ADR-034). */
.side-drawer::backdrop { background: rgb(11 11 11 / 55%); }
/*
 * Separador del borde izquierdo: franja de 10 px (zona cómoda para el puntero) con una línea de tinta que se vuelve azul
 * tinta y gruesa al pasar el puntero, con el foco o al arrastrar; una muesca central indica que se puede tomar.
 */
.side-drawer-resizer { position: absolute; inset: 0 auto 0 0; z-index: 2; width: 10px; cursor: ew-resize; touch-action: none; outline: none; }
.side-drawer-resizer::before { content: ""; position: absolute; inset: 0 auto 0 0; width: 2px; background: var(--borderColor); transition: width var(--durationQuick) var(--easeSmoothOut), background-color var(--durationQuick) var(--easeSmoothOut); }
.side-drawer-resizer::after { content: ""; position: absolute; top: 50%; left: 3px; width: 4px; height: 40px; transform: translateY(-50%); border-inline: 2px solid var(--borderColor); opacity: .55; }
.side-drawer-resizer:hover::before, .side-drawer-resizer:focus-visible::before, .side-drawer[data-resizing] .side-drawer-resizer::before { width: 4px; background: var(--accentColor); }
.side-drawer-resizer:hover::after, .side-drawer-resizer:focus-visible::after, .side-drawer[data-resizing] .side-drawer-resizer::after { border-color: var(--accentColor); opacity: 1; }
.side-drawer-resizer:focus-visible { box-shadow: inset 0 0 0 3px var(--focusColor); }
.side-drawer-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 20px 20px 16px 24px; border-bottom: 1px solid var(--borderColor); flex-shrink: 0; }
.side-drawer-header h2 { margin: 0; font-size: 24px; line-height: 1.33; letter-spacing: -.025em; display: flex; align-items: center; gap: 10px; }
.side-drawer-body { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 20px 24px 24px; container-type: inline-size; }
@media (max-width: 760px) { .side-drawer { width: 100vw; border-radius: 0; } .side-drawer-resizer { display: none; } .side-drawer-body { padding: 16px; } }
@media (prefers-reduced-motion: reduce) { .side-drawer-resizer::before { transition: none; } }
</style>
