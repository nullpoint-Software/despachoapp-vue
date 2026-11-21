<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, type CSSProperties } from 'vue'
import { buildTicketGeometry, type TicketPoint } from './tearTicketGeometry'

/**
 * Tear Ticket de Vue Bits (MIT + Commons Clause), adaptado a Fiscenix (2026-10-13, pedido del usuario; criterio de ADR-025):
 * - Boleto con cuerpo y talón separados por una perforación (agujeros + muescas). El talón se toma con el puntero y se
 *   arranca girándolo sobre el extremo de la perforación más lejano al punto tomado: los puentes de papel se estiran como
 *   fibras y se rompen uno a uno; al soltarlo suelto cae con gravedad y se desvanece. Si se suelta antes, vuelve con un
 *   resorte. Enter o Espacio sobre el talón lo arrancan de inmediato.
 * - Sin Tailwind ni motion-v: CSS propio con los tokens brutalistas (papel, tinta, borde de 2 px, esquinas rectas).
 * - Se retiró la inclinación 3D que seguía al puntero en toda la ventana (escuchaba `pointermove` global y medía con
 *   `getBoundingClientRect` en cada movimiento) y el paralaje de la imagen: costo por movimiento sin aporte en Configuración.
 *   La caja del escenario se mide UNA vez al tomar el talón, no en cada movimiento.
 * - Movimiento reducido: sin fibras ni caída; arrastrar más de 28 px o Enter lo arranca al instante.
 * - Una vez arrancado queda así (`data-used`); quien lo usa lo reinicia cambiando su `key`. Emite `tear`.
 * La simulación escribe estilos a mano en cada cuadro (no provoca renders de Vue).
 */
export type TearTicketOrientation = 'horizontal' | 'vertical'
const props = withDefaults(defineProps<{
  orientation?: TearTicketOrientation; width?: number; height?: number; stubSize?: number; radius?: number
  holeCount?: number; holeSize?: number; notch?: number; roughness?: number
  /** Ángulo (grados) al que se rompen todos los puentes. */
  tearAngle?: number
  /** Pixeles que se estira una fibra antes de romperse. */
  stretch?: number
  /** 0..0.95: cuánto frena el papel intacto al giro. */
  resistance?: number
  rotateDegrees?: number; hasBorder?: boolean; shouldRecenter?: boolean; isDisabled?: boolean; ariaLabel?: string
}>(), { orientation: 'horizontal', width: 460, height: 220, stubSize: 140, radius: 0, holeCount: 12, holeSize: 6, notch: 9, roughness: 0.6, tearAngle: 30, stretch: 30, resistance: 0.45, rotateDegrees: 0, hasBorder: true, shouldRecenter: true, isDisabled: false, ariaLabel: 'Arrancar el talón' })
const emit = defineEmits<{ tear: [] }>()

type TearPhase = 'idle' | 'held' | 'free' | 'drop' | 'return'
const gravity = 2400, fibreRetractSeconds = 0.17

const clamp = (value: number, minimum: number, maximum: number): number => Math.min(maximum, Math.max(minimum, value))
const toRadians = (degrees: number): number => (degrees * Math.PI) / 180
const wrapAngle = (angle: number): number => Math.atan2(Math.sin(angle), Math.cos(angle))
const formatNumber = (value: number): string => value.toFixed(2)

const isUsed = ref(false), isGrabbing = ref(false), isInstant = ref(false), fitScale = ref(1), isReducedMotion = ref(false)
const rootElement = ref<HTMLDivElement | null>(null), stageElement = ref<HTMLDivElement | null>(null)
const bodyElement = ref<HTMLDivElement | null>(null), stubElement = ref<HTMLDivElement | null>(null)
const fibreElements: Array<SVGPathElement | null> = []
function setFibre(index: number, element: unknown): void { fibreElements[index] = element as SVGPathElement | null }
const isVertical = computed(() => props.orientation === 'vertical')
const geometry = computed(() => buildTicketGeometry({ width: props.width, height: props.height, stubSize: props.stubSize, radius: props.radius, holeCount: props.holeCount, holeSize: props.holeSize, notch: props.notch, roughness: props.roughness, isVertical: isVertical.value }))

/** Estado de la simulación (no reactivo): ángulo y desplazamiento del talón, rebote del cuerpo y fibras rotas. */
const simulation = {
  frameRequest: 0, lastTime: 0, phase: 'idle' as TearPhase, pointerId: null as number | null, sign: 1,
  hinge: { x: 0, y: 0 } as TicketPoint, hingeAcross: 0, grab: { x: 0, y: 0 } as TicketPoint, start: { x: 0, y: 0 } as TicketPoint, pointer: { x: 0, y: 0 } as TicketPoint,
  startAngle: 0, angle: 0, angularVelocity: 0, stubX: 0, stubY: 0, velocityX: 0, velocityY: 0, spin: 0,
  pointerVelocityX: 0, pointerVelocityY: 0, pointerTime: 0, opacity: 1, dropAge: 0, bodyOffset: 0, bodyVelocity: 0,
  snappedBridges: [] as boolean[], snapTimes: [] as number[], bridgeSpans: [] as number[],
  /** Caja del escenario medida al tomar el talón: los movimientos no vuelven a medir. */
  stageBox: { left: 0, top: 0, scale: 1 }
}

function measure(): void { const element = rootElement.value; if (element) fitScale.value = Math.min(1, element.clientWidth / props.width) || 1 }

/** Escribe el cuadro: talón, rebote del cuerpo y fibras. Devuelve true mientras alguna fibra rota sigue retrayéndose. */
function paint(now: number): boolean {
  const state = simulation, shape = geometry.value
  if (stubElement.value) {
    stubElement.value.style.transform = `translate(${state.stubX.toFixed(2)}px, ${state.stubY.toFixed(2)}px) rotate(${((state.angle * state.sign * 180) / Math.PI).toFixed(3)}deg)`
    stubElement.value.style.opacity = state.opacity.toFixed(3)
  }
  const isUp = shape.isVertical
  if (bodyElement.value) bodyElement.value.style.transform = `translate${isUp ? 'Y' : 'X'}(${state.bodyOffset.toFixed(2)}px)`
  const cosine = Math.cos(state.angle * state.sign), sine = Math.sin(state.angle * state.sign)
  const offsetX = isUp ? 1.6 : 0, offsetY = isUp ? 0 : 1.6
  let isBusy = false
  shape.bridges.forEach((bridge, index) => {
    const deltaX = bridge.x - state.hinge.x, deltaY = bridge.y - state.hinge.y
    const targetX = state.hinge.x + deltaX * cosine - deltaY * sine + state.stubX
    const targetY = state.hinge.y + deltaX * sine + deltaY * cosine + state.stubY
    const originX = bridge.x + (isUp ? 0 : state.bodyOffset), originY = bridge.y + (isUp ? state.bodyOffset : 0)
    const gapX = targetX - originX, gapY = targetY - originY, gap = Math.hypot(gapX, gapY)
    const near = fibreElements[index * 2], far = fibreElements[index * 2 + 1]
    if (!near || !far) return
    const isLive = state.phase !== 'idle' && !isReducedMotion.value
    if (!state.snappedBridges[index]) {
      if (!isLive || gap < 0.35) { near.style.opacity = '0'; far.style.opacity = '0'; return }
      // Fibra intacta: dos curvas que se adelgazan al estirarse y cuelgan un poco.
      const tension = clamp(gap / props.stretch, 0, 1), sag = gap * 0.18, strokeWidth = (1.7 - 1.15 * tension).toFixed(2)
      const controlX = (isUp ? sag : 0) + gapX / 2, controlY = (isUp ? 0 : sag) + gapY / 2
      near.setAttribute('d', `M${formatNumber(originX - offsetX)},${formatNumber(originY - offsetY)}Q${formatNumber(originX - offsetX + controlX)},${formatNumber(originY - offsetY + controlY)} ${formatNumber(targetX - offsetX)},${formatNumber(targetY - offsetY)}`)
      far.setAttribute('d', `M${formatNumber(originX + offsetX)},${formatNumber(originY + offsetY)}Q${formatNumber(originX + offsetX + gapX - controlX)},${formatNumber(originY + offsetY + gapY - controlY)} ${formatNumber(targetX + offsetX)},${formatNumber(targetY + offsetY)}`)
      near.style.strokeWidth = strokeWidth; far.style.strokeWidth = strokeWidth
      near.style.opacity = '1'; far.style.opacity = '1'
      state.bridgeSpans[index] = gap
      return
    }
    // Fibra rota: cada mitad se retrae hacia su lado en `fibreRetractSeconds`.
    const progress = (now - state.snapTimes[index]!) / 1000 / fibreRetractSeconds
    if (!isLive || progress >= 1 || !state.snapTimes[index]) { near.style.opacity = '0'; far.style.opacity = '0'; return }
    isBusy = true
    const remaining = (1 - progress) * (1 - progress)
    const length = (state.bridgeSpans[index] || props.stretch) * 0.5 * remaining
    const unitX = gap > 0.01 ? gapX / gap : 1, unitY = gap > 0.01 ? gapY / gap : 0
    near.setAttribute('d', `M${formatNumber(originX)},${formatNumber(originY)}L${formatNumber(originX + unitX * length)},${formatNumber(originY + unitY * length)}`)
    far.setAttribute('d', `M${formatNumber(targetX)},${formatNumber(targetY)}L${formatNumber(targetX - unitX * length)},${formatNumber(targetY - unitY * length)}`)
    near.style.strokeWidth = '0.9'; far.style.strokeWidth = '0.9'
    near.style.opacity = remaining.toFixed(2); far.style.opacity = remaining.toFixed(2)
  })
  return isBusy
}

function finishTear(): void {
  // Oculto y sin su último desplazamiento: un talón escondido lejos seguiría agrandando el área con barras (2026-10-17).
  if (stubElement.value) { stubElement.value.style.visibility = 'hidden'; stubElement.value.style.transform = '' }
  isUsed.value = true
  emit('tear')
}

/** Un paso de la simulación según la fase: tomado (gira y rompe puentes), suelto (cuelga del puntero), cayendo o volviendo. */
function step(now: number): void {
  const state = simulation, shape = geometry.value
  const deltaSeconds = clamp((now - state.lastTime) / 1000, 0.001, 0.034)
  state.lastTime = now
  const limit = toRadians(props.tearAngle)
  if (state.phase === 'held') {
    const bridgeCount = shape.bridges.length
    const intactCount = shape.bridges.filter((_, index) => !state.snappedBridges[index]).length
    const follow = 0.92 * (1 - clamp(props.resistance, 0, 0.95) * (bridgeCount ? intactCount / bridgeCount : 0))
    const pointerAngle = Math.atan2(state.pointer.y - state.hinge.y, state.pointer.x - state.hinge.x)
    const wantedAngle = clamp(wrapAngle(pointerAngle - state.startAngle) * state.sign * follow, 0, limit + 0.1)
    state.angle += (wantedAngle - state.angle) * (1 - Math.exp(-deltaSeconds / 0.035))
    const isUp = shape.isVertical
    const away = clamp(((isUp ? state.pointer.y - state.start.y : state.pointer.x - state.start.x) || 0) * 0.05, -2, 4)
    const side = clamp(((isUp ? state.pointer.x - state.start.x : state.pointer.y - state.start.y) || 0) * 0.05, -3, 3)
    state.stubX += ((isUp ? side : away) - state.stubX) * (1 - Math.exp(-deltaSeconds / 0.05))
    state.stubY += ((isUp ? away : side) - state.stubY) * (1 - Math.exp(-deltaSeconds / 0.05))
    const slack = Math.hypot(state.stubX, state.stubY)
    let remainingCount = 0
    shape.bridges.forEach((bridge, index) => {
      if (state.snappedBridges[index]) return
      const distance = Math.abs(bridge.middle - state.hingeAcross)
      if (2 * distance * Math.sin(state.angle / 2) + slack > props.stretch || state.angle >= limit) {
        state.snappedBridges[index] = true; state.snapTimes[index] = now; state.bodyVelocity -= 560 / bridgeCount
      } else remainingCount += 1
    })
    if (remainingCount === 0) { state.phase = 'free'; state.bodyVelocity -= 150 }
  } else if (state.phase === 'free') {
    const cosine = Math.cos(state.angle * state.sign), sine = Math.sin(state.angle * state.sign)
    const grabX = state.grab.x - state.hinge.x, grabY = state.grab.y - state.hinge.y
    const wantedX = state.pointer.x - state.hinge.x - (grabX * cosine - grabY * sine)
    const wantedY = state.pointer.y - state.hinge.y - (grabX * sine + grabY * cosine)
    state.stubX += (wantedX - state.stubX) * (1 - Math.exp(-deltaSeconds / 0.045))
    state.stubY += (wantedY - state.stubY) * (1 - Math.exp(-deltaSeconds / 0.045))
    const hangAngle = limit * 0.55 + clamp(state.pointerVelocityX * 0.0009 * state.sign, -0.3, 0.3)
    state.angle += (hangAngle - state.angle) * (1 - Math.exp(-deltaSeconds / 0.12))
  } else if (state.phase === 'drop') {
    state.dropAge += deltaSeconds
    state.velocityY += gravity * deltaSeconds
    state.stubX += state.velocityX * deltaSeconds; state.stubY += state.velocityY * deltaSeconds
    state.angle += state.spin * deltaSeconds
    if (state.dropAge > 0.16) state.opacity = clamp(1 - (state.dropAge - 0.16) / 0.42, 0, 1)
    if (state.opacity <= 0) { state.phase = 'idle'; finishTear() }
  } else if (state.phase === 'return') {
    state.angularVelocity += (-300 * state.angle - 24 * state.angularVelocity) * deltaSeconds
    state.angle += state.angularVelocity * deltaSeconds
    state.stubX += (0 - state.stubX) * (1 - Math.exp(-deltaSeconds / 0.07))
    state.stubY += (0 - state.stubY) * (1 - Math.exp(-deltaSeconds / 0.07))
    if (Math.abs(state.angle) < 0.0008 && Math.abs(state.angularVelocity) < 0.01 && Math.hypot(state.stubX, state.stubY) < 0.05) {
      Object.assign(state, { angle: 0, angularVelocity: 0, stubX: 0, stubY: 0, phase: 'idle' })
    }
  }
  // Rebote del cuerpo cuando se rompen los puentes.
  state.bodyVelocity += (-520 * state.bodyOffset - 30 * state.bodyVelocity) * deltaSeconds
  state.bodyOffset += state.bodyVelocity * deltaSeconds
  const isBusy = paint(now)
  const isBodyMoving = Math.abs(state.bodyOffset) > 0.02 || Math.abs(state.bodyVelocity) > 0.5
  if (state.phase !== 'idle' || isBodyMoving || isBusy) state.frameRequest = requestAnimationFrame(step)
  else { state.bodyOffset = 0; state.bodyVelocity = 0; paint(now); state.frameRequest = 0 }
}
function runSimulation(): void {
  if (simulation.frameRequest) return
  simulation.lastTime = performance.now()
  simulation.frameRequest = requestAnimationFrame(step)
}
function resetSimulation(): void {
  cancelAnimationFrame(simulation.frameRequest)
  Object.assign(simulation, { frameRequest: 0, phase: 'idle', pointerId: null, angle: 0, angularVelocity: 0, stubX: 0, stubY: 0, opacity: 1, dropAge: 0, bodyOffset: 0, bodyVelocity: 0, snappedBridges: [], snapTimes: [], bridgeSpans: [] })
  if (stubElement.value) stubElement.value.style.visibility = ''
  paint(performance.now())
}

/** Puntero → coordenadas del boleto con la caja medida al tomar el talón (sin medir en cada movimiento). */
function toTicketPoint(event: PointerEvent): TicketPoint {
  const box = simulation.stageBox
  return { x: (event.clientX - box.left) / box.scale, y: (event.clientY - box.top) / box.scale }
}
function tearNow(): void {
  cancelAnimationFrame(simulation.frameRequest)
  simulation.frameRequest = 0; simulation.phase = 'idle'
  isInstant.value = true
  finishTear()
}
function onStubPointerDown(event: PointerEvent): void {
  const state = simulation
  if (props.isDisabled || isUsed.value || event.button !== 0 || state.pointerId !== null || state.phase === 'drop' || !stageElement.value) return
  const shape = geometry.value
  try { (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId) } catch { /* Sin captura: el arrastre sigue mientras el puntero esté encima. */ }
  const rectangle = stageElement.value.getBoundingClientRect()
  state.stageBox = { left: rectangle.left, top: rectangle.top, scale: rectangle.width / props.width || 1 }
  const point = toTicketPoint(event)
  Object.assign(state, { pointerId: event.pointerId, start: point, pointer: point, pointerTime: performance.now(), pointerVelocityX: 0, pointerVelocityY: 0 })
  if (state.angle < 0.01) {
    // La bisagra es el extremo de la perforación más lejano al punto tomado.
    const isFar = (shape.isVertical ? point.x : point.y) < shape.crossLength / 2
    const end = shape.ends[isFar ? 1 : 0]!
    state.sign = (isFar ? 1 : -1) * (shape.isVertical ? -1 : 1)
    state.hinge = { x: end.x, y: end.y }; state.hingeAcross = end.across
    if (stubElement.value) stubElement.value.style.transformOrigin = `${state.hinge.x}px ${state.hinge.y}px`
  }
  const cosine = Math.cos(-state.angle * state.sign), sine = Math.sin(-state.angle * state.sign)
  const localX = point.x - state.stubX - state.hinge.x, localY = point.y - state.stubY - state.hinge.y
  state.grab = { x: state.hinge.x + localX * cosine - localY * sine, y: state.hinge.y + localX * sine + localY * cosine }
  state.startAngle = Math.atan2(state.grab.y - state.hinge.y, state.grab.x - state.hinge.x) - (state.angle * state.sign) / 0.92
  state.phase = 'held'; state.angularVelocity = 0
  isGrabbing.value = true
  runSimulation()
}
/** Sólo guarda la posición y la velocidad: la simulación la lee en el siguiente cuadro. */
function onStubPointerMove(event: PointerEvent): void {
  const state = simulation
  if (state.pointerId !== event.pointerId) return
  const point = toTicketPoint(event), now = performance.now()
  const deltaSeconds = Math.max(0.004, (now - state.pointerTime) / 1000)
  state.pointerVelocityX += ((point.x - state.pointer.x) / deltaSeconds - state.pointerVelocityX) * 0.35
  state.pointerVelocityY += ((point.y - state.pointer.y) / deltaSeconds - state.pointerVelocityY) * 0.35
  state.pointerTime = now; state.pointer = point
  if (isReducedMotion.value && Math.hypot(point.x - state.start.x, point.y - state.start.y) > 28) { state.pointerId = null; isGrabbing.value = false; tearNow() }
}
function onStubPointerUp(event: PointerEvent): void {
  const state = simulation
  if (state.pointerId !== event.pointerId) return
  state.pointerId = null
  const element = event.currentTarget as HTMLElement
  try { if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId) } catch { /* Ya liberada. */ }
  isGrabbing.value = false
  if (state.phase === 'free') {
    const isStill = performance.now() - state.pointerTime > 80
    state.velocityX = isStill ? 0 : clamp(state.pointerVelocityX, -1600, 1600)
    state.velocityY = isStill ? 0 : clamp(state.pointerVelocityY, -1600, 1200)
    state.spin = clamp(state.velocityX * 0.004, -6, 6) + 1.2 * state.sign
    state.dropAge = 0; state.phase = 'drop'
  } else if (state.phase === 'held') state.phase = 'return'
  runSimulation()
}
function onStubKeydown(event: KeyboardEvent): void {
  if (props.isDisabled || isUsed.value || (event.key !== 'Enter' && event.key !== ' ')) return
  event.preventDefault()
  if (!event.repeat) tearNow()
}

let resizeObserver: ResizeObserver | null = null
let reducedMotionQuery: MediaQueryList | null = null
function syncReducedMotion(): void { isReducedMotion.value = Boolean(reducedMotionQuery?.matches) }
watch(geometry, resetSimulation, { flush: 'post' })
watch(() => props.width, measure)
onMounted(() => {
  reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  reducedMotionQuery.addEventListener('change', syncReducedMotion)
  syncReducedMotion()
  measure()
  if (rootElement.value && typeof ResizeObserver !== 'undefined') { resizeObserver = new ResizeObserver(measure); resizeObserver.observe(rootElement.value) }
  resetSimulation()
})
onBeforeUnmount(() => {
  cancelAnimationFrame(simulation.frameRequest)
  resizeObserver?.disconnect()
  reducedMotionQuery?.removeEventListener('change', syncReducedMotion)
})

const rootStyle = computed(() => ({
  '--ticketWidth': `${props.width}px`, '--ticketHeight': `${props.height}px`, '--ticketStub': `${props.stubSize}px`,
  '--ticketBodyWidth': `${isVertical.value ? props.width : props.width - props.stubSize}px`,
  '--ticketBodyHeight': `${isVertical.value ? props.height - props.stubSize : props.height}px`,
  '--ticketFit': fitScale.value, '--ticketRotate': `${props.rotateDegrees}deg`,
  height: `${props.height * fitScale.value}px`
}) as CSSProperties)
</script>

<template>
  <div
    ref="rootElement"
    class="tear-ticket"
    :data-used="isUsed ? '' : undefined"
    :data-orientation="orientation"
    :data-shift="isUsed && shouldRecenter ? (isVertical ? 'y' : 'x') : undefined"
    :data-instant="isInstant ? '' : undefined"
    :data-grabbing="isGrabbing ? '' : undefined"
    :data-disabled="isDisabled ? '' : undefined"
    :style="rootStyle"
  >
    <div
      ref="stageElement"
      class="tear-ticket-stage"
    >
      <div class="tear-ticket-plane">
        <div
          ref="bodyElement"
          class="tear-ticket-body"
        >
          <div
            class="tear-ticket-body-fill"
            :style="{ clipPath: `path('${geometry.bodyPath}')` }"
          >
            <div class="tear-ticket-content">
              <slot />
            </div>
          </div>
          <svg
            v-if="hasBorder"
            class="tear-ticket-outline"
            :viewBox="`0 0 ${width} ${height}`"
            aria-hidden="true"
          >
            <path :d="geometry.bodyOutline" />
          </svg>
        </div>
        <svg
          class="tear-ticket-fibres"
          aria-hidden="true"
        >
          <g
            v-for="(bridge, index) in geometry.bridges"
            :key="index"
          >
            <path :ref="element => setFibre(index * 2, element)" />
            <path :ref="element => setFibre(index * 2 + 1, element)" />
          </g>
        </svg>
        <div
          ref="stubElement"
          class="tear-ticket-stub"
          role="button"
          :tabindex="isDisabled || isUsed ? -1 : 0"
          :aria-label="ariaLabel"
          :aria-hidden="isUsed || undefined"
          :aria-disabled="isDisabled || undefined"
          @pointerdown="onStubPointerDown"
          @pointermove="onStubPointerMove"
          @pointerup="onStubPointerUp"
          @pointercancel="onStubPointerUp"
          @lostpointercapture="onStubPointerUp"
          @keydown="onStubKeydown"
          @dragstart.prevent
        >
          <div
            class="tear-ticket-stub-fill"
            :style="{ clipPath: `path('${geometry.stubPath}')` }"
          >
            <div class="tear-ticket-stub-content">
              <slot name="stub" />
            </div>
          </div>
          <svg
            v-if="hasBorder"
            class="tear-ticket-outline"
            :viewBox="`0 0 ${width} ${height}`"
            aria-hidden="true"
          >
            <path :d="geometry.stubOutline" />
          </svg>
        </div>
      </div>
    </div>
    <span
      class="sr-only"
      role="status"
    >{{ isUsed ? 'Talón arrancado' : '' }}</span>
  </div>
</template>

<style scoped>
/* Papel del lienzo, tinta del tema y borde de 2 px: el contorno va ENCIMA del relleno, sin el lado perforado. */
.tear-ticket { position: relative; width: min(var(--ticketWidth), 100%); color: var(--textColor); user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent; }
.tear-ticket[data-disabled] { opacity: .6; }
.tear-ticket-stage { position: absolute; top: 0; left: 0; width: var(--ticketWidth); height: var(--ticketHeight); transform-origin: top left; transform: scale(var(--ticketFit)); transition: transform 650ms cubic-bezier(.22, 1, .36, 1); }
/* Arrancado el talón, el cuerpo se centra donde estaba el boleto completo. */
.tear-ticket[data-shift='x'] .tear-ticket-stage { transform: translateX(calc(var(--ticketStub) * var(--ticketFit) / 2)) scale(var(--ticketFit)); }
.tear-ticket[data-shift='y'] .tear-ticket-stage { transform: translateY(calc(var(--ticketStub) * var(--ticketFit) / 2)) scale(var(--ticketFit)); }
.tear-ticket[data-instant] .tear-ticket-stage { transition-duration: 0ms; }
.tear-ticket-plane { position: absolute; inset: 0; transform: rotate(var(--ticketRotate)); }
.tear-ticket-body { position: absolute; inset: 0; pointer-events: none; }
.tear-ticket-body-fill, .tear-ticket-stub-fill { position: absolute; inset: 0; background: var(--canvasColor); }
.tear-ticket-body-fill { pointer-events: auto; }
.tear-ticket-content { position: absolute; top: 0; bottom: 0; left: 0; width: var(--ticketBodyWidth); height: var(--ticketBodyHeight); transition: opacity 500ms ease; }
.tear-ticket[data-used] .tear-ticket-content { opacity: .55; }
.tear-ticket[data-instant] .tear-ticket-content { transition-duration: 0ms; }
.tear-ticket-outline { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
.tear-ticket-outline path { fill: none; stroke: var(--borderColor); stroke-width: 2; }
.tear-ticket-fibres { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
.tear-ticket-fibres path { opacity: 0; fill: none; stroke: var(--canvasColor); stroke-linecap: round; }
.tear-ticket-stub { position: absolute; inset: 0; outline: none; pointer-events: none; will-change: transform; }
.tear-ticket-stub:focus-visible .tear-ticket-stub-fill { outline: 2px solid var(--focusColor); outline-offset: -6px; }
.tear-ticket-stub-fill { touch-action: none; cursor: grab; pointer-events: auto; background: var(--subtleColor); }
.tear-ticket[data-grabbing] .tear-ticket-stub-fill { cursor: grabbing; }
.tear-ticket[data-disabled] .tear-ticket-stub-fill { cursor: default; }
.tear-ticket-stub-content { position: absolute; top: 0; right: 0; bottom: 0; width: var(--ticketStub); }
.tear-ticket[data-orientation='vertical'] .tear-ticket-content { bottom: auto; width: 100%; }
.tear-ticket[data-orientation='vertical'] .tear-ticket-stub-content { top: auto; left: 0; width: auto; height: var(--ticketStub); }
@media (prefers-reduced-motion: reduce) { .tear-ticket-stage, .tear-ticket-content { transition: none; } }
</style>
