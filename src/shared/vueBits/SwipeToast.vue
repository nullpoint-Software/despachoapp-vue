<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { gsap } from 'gsap'
import { X } from '@lucide/vue'

/**
 * Swipe Toast de Vue Bits, adaptado a Fiscenix (2026-10-04, pedido del usuario; criterio de ADR-025):
 * - Sin Tailwind, Hugeicons ni motion-v: CSS propio con los tokens brutalistas, iconos Lucide y GSAP para el resorte.
 * - Sube desde abajo al entrar; se descarta arrastrándolo hacia abajo (un tirón rápido siempre lo descarta, un arrastre
 *   lento debe pasar `swipeDistance`), con Escape o con ×. Hacia arriba ofrece resistencia (efecto liga).
 * - La "mecha" del borde inferior se consume durante `duration` con la Web Animations API y es el propio temporizador:
 *   se pausa con el puntero encima, con el foco dentro, mientras se arrastra y con la ventana oculta.
 *   `duration = 0` lo deja hasta que la persona lo cierre (los errores).
 * - `inline`: vive dentro de la pila de avisos (NotificationRegion) y, al salir, su fila se colapsa para que los
 *   demás bajen sin salto.
 * - `isActivatable` (2026-10-10, avisos que llevan a su elemento): un clic en la tarjeta o Enter con la tarjeta enfocada
 *   emite `activate` (desde el 2026-10-17 el botón emite `action` aparte, para que un aviso pueda llevar a su elemento
 *   con la tarjeta y descargar con la flecha). Un arrastre nunca activa: si el puntero se movió, el clic siguiente se
 *   ignora.
 * Emite `close` con el motivo después de terminar la salida.
 */
export type SwipeToastCloseReason = 'timeout' | 'swipe' | 'action' | 'close' | 'escape' | 'programmatic'
const props = withDefaults(defineProps<{
  title: string; description?: string; actionLabel?: string; open?: boolean; duration?: number; swipeDistance?: number
  slideMilliseconds?: number; closeButton?: boolean; closeLabel?: string; dismissible?: boolean; role?: 'status' | 'alert'; toastClass?: string
  /** Nombre accesible del botón de acción cuando el texto visible es corto ("Ver →"). */
  actionAccessibleName?: string; isActivatable?: boolean
}>(), { description: '', actionLabel: '', open: true, duration: 6500, swipeDistance: 40, slideMilliseconds: 400, closeButton: true, closeLabel: 'Cerrar', dismissible: true, role: 'status', toastClass: '', actionAccessibleName: undefined, isActivatable: false })
const emit = defineEmits<{ action: []; activate: []; close: [reason: SwipeToastCloseReason] }>()

const flickVelocity = 0.11, deadZonePixels = 3, resistPixels = 24
const root = ref<HTMLElement | null>(null), card = ref<HTMLElement | null>(null), fuse = ref<HTMLElement | null>(null)
const phase = ref<'open' | 'closing' | 'gone'>('open')
let fuseAnimation: Animation | null = null
const pauseFlags = { hover: false, interacting: false, focus: false, hidden: false }
let drag: { pointerId: number; startY: number; grabY: number | null; samples: Array<[number, number]> } | null = null
let offsetY = 0
/** El último gesto fue un arrastre: el `click` que el navegador emite al soltar no debe activar el aviso. */
let wasDragged = false
const isReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Resistencia al arrastrar hacia arriba: crece cada vez menos (liga). */
const rubberband = (over: number, dimension: number, constant = 0.55) => (over * dimension * constant) / (dimension + constant * Math.abs(over))
function velocityOf(samples: Array<[number, number]>): number {
  if (samples.length < 2) return 0
  const [firstTime, firstY] = samples[0]!, [lastTime, lastY] = samples[samples.length - 1]!
  return performance.now() - lastTime > 100 ? 0 : (lastY - firstY) / Math.max(1, lastTime - firstTime)
}
function setOffset(value: number): void { offsetY = value; if (card.value) gsap.set(card.value, { y: value }) }
function syncFuse(): void {
  if (!fuseAnimation) return
  if (pauseFlags.hover || pauseFlags.interacting || pauseFlags.focus || pauseFlags.hidden) fuseAnimation.pause()
  else if (fuseAnimation.playState === 'paused') fuseAnimation.play()
}
function startFuse(): void {
  fuseAnimation?.cancel(); fuseAnimation = null
  if (props.duration <= 0 || !fuse.value) return
  const animation = fuse.value.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration: props.duration, easing: 'linear', fill: 'forwards' })
  animation.onfinish = () => close('timeout')
  fuseAnimation = animation; syncFuse()
}
/** Salida: baja y se desvanece; en línea, además colapsa su fila. Después emite `close`. */
function close(reason: SwipeToastCloseReason, velocity = 0): void {
  if (phase.value !== 'open') return
  phase.value = 'closing'; fuseAnimation?.pause()
  const element = card.value, container = root.value
  const finish = () => { phase.value = 'gone'; emit('close', reason) }
  if (!element || !container || isReducedMotion() || reason === 'escape') { finish(); return }
  const seconds = props.slideMilliseconds / 1000
  gsap.timeline({ onComplete: finish })
    .to(element, { y: offsetY + element.offsetHeight + 24, opacity: 0, duration: seconds * (velocity > 0 ? 0.45 : 0.7), ease: 'power3.in' })
    .to(container, { height: 0, marginTop: 0, duration: 0.2, ease: 'power2.inOut' }, '>-0.05')
}
watch(() => props.open, isOpen => { if (!isOpen) close('programmatic') })
watch(() => props.duration, () => { if (phase.value === 'open') startFuse() })

function onPointerDown(event: PointerEvent): void {
  if (event.button !== 0 || !props.dismissible || phase.value !== 'open' || (event.target as HTMLElement).closest('button')) return
  try { card.value?.setPointerCapture(event.pointerId) } catch { /* Sin captura: el arrastre sigue con los eventos del elemento. */ }
  gsap.killTweensOf(card.value)
  wasDragged = false
  drag = { pointerId: event.pointerId, startY: event.clientY, grabY: null, samples: [[performance.now(), offsetY]] }
  pauseFlags.interacting = true; syncFuse()
}
function onPointerMove(event: PointerEvent): void {
  if (!drag || drag.pointerId !== event.pointerId) return
  if (drag.grabY === null) {
    if (Math.abs(event.clientY - drag.startY) < deadZonePixels) return
    drag.grabY = event.clientY - offsetY
    card.value?.setAttribute('data-swiping', '')
  }
  const raw = event.clientY - drag.grabY
  setOffset(raw >= 0 ? raw : rubberband(raw, resistPixels))
  drag.samples.push([performance.now(), offsetY]); if (drag.samples.length > 4) drag.samples.shift()
}
function onPointerUp(event: PointerEvent): void {
  if (!drag || drag.pointerId !== event.pointerId) return
  const samples = drag.samples, hasMoved = drag.grabY !== null
  wasDragged = hasMoved
  drag = null; card.value?.removeAttribute('data-swiping')
  try { card.value?.releasePointerCapture(event.pointerId) } catch { /* Ya liberado. */ }
  pauseFlags.interacting = false
  const velocity = velocityOf(samples)
  if (offsetY > 0 && (velocity > flickVelocity || (offsetY >= props.swipeDistance && velocity >= 0))) { close('swipe', velocity); return }
  // Arrastre abandonado: regresa con un pequeño rebote (sin rebote con movimiento reducido).
  if (hasMoved && card.value) gsap.to(card.value, { y: 0, duration: isReducedMotion() ? 0.2 : 0.5, ease: isReducedMotion() ? 'power2.out' : 'back.out(1.6)', onUpdate: () => { offsetY = Number(gsap.getProperty(card.value, 'y')) } })
  syncFuse()
}
function onKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && props.dismissible) { event.stopPropagation(); close('escape'); return }
  // Enter sólo sobre la tarjeta: en sus botones, Enter ya pulsa ese botón.
  if (event.key === 'Enter' && props.isActivatable && event.target === event.currentTarget) { event.preventDefault(); onActivate() }
}
/** Clic en cualquier parte de la tarjeta (salvo sus botones y tras un arrastre) cuando el aviso lleva a algún lugar. */
function onCardClick(event: MouseEvent): void {
  if (wasDragged) { wasDragged = false; return }
  if (!props.isActivatable || phase.value !== 'open' || (event.target as HTMLElement).closest('button')) return
  onActivate()
}
function onFocusOut(event: FocusEvent): void {
  if ((event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) return
  pauseFlags.focus = false; syncFuse()
}
function onVisibility(): void { pauseFlags.hidden = document.hidden; syncFuse() }
function onAction(): void { emit('action'); close('action') }
function onActivate(): void { emit('activate'); close('action') }

onMounted(() => {
  // GSAP escribe `transform`; se usa su propiedad `y` para que entrada, arrastre y salida compartan el valor.
  if (card.value && !isReducedMotion()) gsap.fromTo(card.value, { y: card.value.offsetHeight + 24, opacity: 0 }, { y: 0, opacity: 1, duration: props.slideMilliseconds / 1000, ease: 'expo.out', clearProps: 'opacity' })
  startFuse()
  document.addEventListener('visibilitychange', onVisibility)
})
onBeforeUnmount(() => { fuseAnimation?.cancel(); gsap.killTweensOf([card.value, root.value]); document.removeEventListener('visibilitychange', onVisibility) })
</script>
<template>
  <div
    ref="root"
    class="swipe-toast"
    :data-phase="phase"
  >
    <div
      ref="card"
      class="swipe-toast-card"
      :class="[toastClass, { 'is-activatable': isActivatable }]"
      :role="role"
      :aria-live="role === 'alert' ? 'assertive' : 'polite'"
      aria-atomic="true"
      tabindex="0"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @pointerenter="($event.pointerType === 'mouse') && (pauseFlags.hover = true, syncFuse())"
      @pointerleave="($event.pointerType === 'mouse') && (pauseFlags.hover = false, syncFuse())"
      @focusin="pauseFlags.focus = true; syncFuse()"
      @focusout="onFocusOut"
      @keydown="onKeyDown"
      @click="onCardClick"
    >
      <span
        v-if="$slots.icon"
        class="swipe-toast-icon"
        aria-hidden="true"
      ><slot name="icon" /></span>
      <span class="swipe-toast-text">
        <strong>{{ title }}</strong>
        <span v-if="description">{{ description }}</span>
        <slot name="caption" />
      </span>
      <!-- Con el slot `action` (sólo icono) el botón ocupa el hueco cuadrado de la ×; su nombre viene de `actionAccessibleName`. -->
      <button
        v-if="actionLabel || $slots.action"
        type="button"
        class="swipe-toast-action"
        :class="{ 'is-icon-only': $slots.action }"
        :aria-label="actionAccessibleName"
        :title="$slots.action ? actionAccessibleName : undefined"
        @click="onAction"
      >
        <slot name="action">
          {{ actionLabel }}
        </slot>
      </button>
      <button
        v-if="closeButton"
        type="button"
        class="swipe-toast-close"
        :aria-label="closeLabel"
        @click="close('close')"
      >
        <X
          :size="14"
          aria-hidden="true"
        />
      </button>
      <i
        ref="fuse"
        class="swipe-toast-fuse"
        :class="{ 'is-hidden': duration <= 0 }"
        aria-hidden="true"
      />
    </div>
  </div>
</template>
<style>
/* Sin "scoped": las clases de tono (`tone-success`…) llegan desde quien lo usa y fijan --toastTone. */
.swipe-toast { pointer-events: auto; overflow: visible; }
.swipe-toast + .swipe-toast { margin-top: 10px; }
.swipe-toast-card { --toastTone: var(--textColor); position: relative; display: flex; align-items: flex-start; gap: 12px; padding: 14px 14px 16px; border: 2px solid var(--borderColor); background: var(--surfaceColor); color: var(--textColor); box-shadow: var(--buttonShadow); cursor: grab; touch-action: none; user-select: none; -webkit-tap-highlight-color: transparent; overflow: hidden; outline: none; }
.swipe-toast-card[data-swiping] { cursor: grabbing; }
/* Aviso que lleva a su elemento: mano de enlace y el botón "Ver →" se adelanta al pasar el puntero. */
.swipe-toast-card.is-activatable { cursor: pointer; }
.swipe-toast-card.is-activatable:hover .swipe-toast-action { transform: translate(-1px, -1px); box-shadow: 3px 3px 0 var(--borderColor); }
.swipe-toast-card.is-activatable[data-swiping] { cursor: grabbing; }
.swipe-toast-card:focus-visible { outline: 3px solid var(--focusColor); outline-offset: 2px; }
.swipe-toast-icon { display: grid; place-items: center; flex: none; width: 32px; height: 32px; border: 2px solid currentColor; color: var(--toastTone); }
.swipe-toast-text { display: grid; gap: 4px; flex: 1; min-width: 0; }
.swipe-toast-text strong { font-size: 14px; font-weight: 800; line-height: 1.3; }
.swipe-toast-text > span { font-size: 13px; color: var(--mutedTextColor); overflow-wrap: anywhere; }
.swipe-toast-action { flex: none; align-self: center; min-height: 28px; padding: 0 10px; border: 2px solid var(--borderColor); background: var(--textColor); color: var(--surfaceColor); font: inherit; font-size: 12px; font-weight: 800; cursor: pointer; white-space: nowrap; transition: transform var(--durationQuick) ease-out, box-shadow var(--durationQuick) ease-out; }
/* Acción sólo con icono (la flecha de los avisos con destino): cuadrada como la ×, a la que reemplaza. */
.swipe-toast-action.is-icon-only { display: grid; place-items: center; width: 32px; min-height: 32px; height: 32px; padding: 0; }
.swipe-toast-action:focus-visible { outline: 3px solid var(--focusColor); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { .swipe-toast-action { transition: none; } }
.swipe-toast-close { display: grid; place-items: center; flex: none; width: 28px; height: 28px; border: 2px solid transparent; background: transparent; color: inherit; cursor: pointer; }
.swipe-toast-close:hover { border-color: var(--borderColor); }
.swipe-toast-fuse { position: absolute; inset: auto 0 0 0; height: 3px; background: var(--toastTone); transform-origin: left; pointer-events: none; }
.swipe-toast-fuse.is-hidden { opacity: 0; }
.swipe-toast-card.tone-success { --toastTone: var(--successColor); }
.swipe-toast-card.tone-info { --toastTone: var(--accentColor); }
.swipe-toast-card.tone-warning { --toastTone: var(--warningColor); }
.swipe-toast-card.tone-error { --toastTone: var(--errorColor); }
</style>
