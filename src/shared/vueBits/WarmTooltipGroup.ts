import { animate, motionValue, useReducedMotion } from 'motion-v'
import { defineComponent, h, onBeforeUnmount, onMounted, provide, ref, shallowRef, Teleport, useId, watch, type InjectionKey } from 'vue'

/**
 * Grupo de "Warm Tooltip" de Vue Bits (MIT + Commons Clause), adaptado. Comportamiento conservado:
 * - **Frío:** el primer tooltip del grupo espera `delay` (400 ms) y aparece con un "pop" (escala + desenfoque).
 * - **Tibio:** mientras uno está abierto, o durante `warmWindow` (300 ms) tras cerrarse, el siguiente abre
 *   sin espera y la etiqueta **se desliza** de un botón al otro con un resorte.
 * - **Teclado:** el foco visible abre al instante; Escape y perder el foco cierran.
 * Cambios: sin Tailwind (clases `.warm-tooltip*` en base.css con tokens: tinta sobre papel invertido),
 * sin inclinación ni atajos, y una sola etiqueta compartida en `body` con `role="tooltip"`.
 */
export type TooltipSide = 'top' | 'bottom' | 'left' | 'right'
export interface TooltipPayload { tooltipId: string; trigger: HTMLElement; content: string; side: TooltipSide }
export interface TooltipGroupApi { groupId: string; delay: number; isWarm: () => boolean; activeId: () => string | null; show: (payload: TooltipPayload, mode: 'cold' | 'warm' | 'instant') => void; hide: (tooltipId: string, isInstant?: boolean) => void }
export const tooltipGroupKey: InjectionKey<TooltipGroupApi> = Symbol('warm-tooltip-group')

const gap = 8, viewportMargin = 8, graceMilliseconds = 80, popMilliseconds = 160
const isHorizontal = (side: TooltipSide) => side === 'top' || side === 'bottom'
function anchorOf(rect: DOMRect, side: TooltipSide): [number, number] {
  if (side === 'top') return [rect.left + rect.width / 2, rect.top - gap]
  if (side === 'bottom') return [rect.left + rect.width / 2, rect.bottom + gap]
  if (side === 'left') return [rect.left - gap, rect.top + rect.height / 2]
  return [rect.right + gap, rect.top + rect.height / 2]
}
const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value))

export const WarmTooltipGroup = defineComponent({
  name: 'WarmTooltipGroup',
  props: { delay: { type: Number, default: 400 }, warmWindow: { type: Number, default: 300 }, travelMilliseconds: { type: Number, default: 320 } },
  setup(props, { slots }) {
    const reduceMotion = useReducedMotion()
    const groupId = useId()
    const current = shallowRef<TooltipPayload | null>(null)
    const phase = ref<'closed' | 'open' | 'closing'>('closed')
    const outer = ref<HTMLElement | null>(null), pop = ref<HTMLElement | null>(null), text = ref<HTMLElement | null>(null)
    const anchorX = motionValue(0), anchorY = motionValue(0), width = motionValue(0), height = motionValue(0), presence = motionValue(0)
    let mode: 'cold' | 'warm' | 'instant' | 'move' = 'cold'
    let warmUntil = -Infinity
    let closeTimer: ReturnType<typeof setTimeout> | undefined, leaveTimer: ReturnType<typeof setTimeout> | undefined

    // Posición y "pop" se escriben a mano para que el deslizamiento no espere un render de Vue.
    const paintPlace = () => {
      const element = outer.value, payload = current.value
      if (!element || !payload) return
      const boxWidth = width.get(), boxHeight = height.get(), x = anchorX.get(), y = anchorY.get()
      let left: number, top: number
      if (isHorizontal(payload.side)) { left = clamp(x - boxWidth / 2, viewportMargin, Math.max(viewportMargin, window.innerWidth - viewportMargin - boxWidth)); top = payload.side === 'top' ? y - boxHeight : y }
      else { top = clamp(y - boxHeight / 2, viewportMargin, Math.max(viewportMargin, window.innerHeight - viewportMargin - boxHeight)); left = payload.side === 'left' ? x - boxWidth : x }
      element.style.transform = `translate(${left}px, ${top}px)`; element.style.width = boxWidth + 'px'; element.style.height = boxHeight + 'px'
    }
    const paintPop = () => {
      const element = pop.value
      if (!element) return
      const value = presence.get()
      element.style.opacity = String(value)
      element.style.transform = reduceMotion.value ? 'none' : `scale(${.94 + .06 * value})`
      element.style.filter = reduceMotion.value ? 'none' : `blur(${4 * (1 - value)}px)`
    }
    const unsubscribers: Array<() => void> = []
    onMounted(() => { unsubscribers.push(anchorX.on('change', paintPlace), anchorY.on('change', paintPlace), width.on('change', paintPlace), height.on('change', paintPlace), presence.on('change', paintPop)) })

    const isWarm = () => phase.value !== 'closed' || performance.now() < warmUntil
    const finishClose = () => { phase.value = 'closed'; current.value = null }
    const show = (payload: TooltipPayload, requested: 'cold' | 'warm' | 'instant') => {
      clearTimeout(closeTimer); clearTimeout(leaveTimer)
      mode = phase.value === 'closed' ? requested : requested === 'instant' ? 'instant' : 'move'
      current.value = payload; phase.value = 'open'
    }
    const beginClose = (isInstant: boolean) => {
      if (!current.value || phase.value !== 'open') return
      phase.value = 'closing'; warmUntil = performance.now() + props.warmWindow
      if (isInstant) { presence.jump(0); finishClose(); return }
      animate(presence, 0, { duration: popMilliseconds * .8 / 1000, ease: [.23, 1, .32, 1] })
      closeTimer = setTimeout(finishClose, popMilliseconds * .8)
    }
    const hide = (tooltipId: string, isInstant = false) => {
      if (current.value?.tooltipId !== tooltipId || phase.value !== 'open') return
      clearTimeout(leaveTimer)
      if (isInstant || mode === 'instant') { beginClose(true); return }
      leaveTimer = setTimeout(() => beginClose(false), graceMilliseconds)
    }
    provide(tooltipGroupKey, { groupId, get delay() { return props.delay }, isWarm, activeId: () => current.value?.tooltipId ?? null, show, hide })

    // Al abrir o cambiar de botón: medir la etiqueta y colocarla (deslizar si ya estaba abierta).
    watch([current, phase], () => {
      const payload = current.value
      if (payload && text.value && phase.value === 'open') {
        const [x, y] = anchorOf(payload.trigger.getBoundingClientRect(), payload.side)
        const boxWidth = text.value.offsetWidth + 20, boxHeight = text.value.offsetHeight + 12
        if (mode === 'move' && !reduceMotion.value) {
          const spring = { type: 'spring' as const, duration: props.travelMilliseconds / 1000, bounce: .1 }
          animate(anchorX, x, spring); animate(anchorY, y, spring); animate(width, boxWidth, spring); animate(height, boxHeight, spring)
          animate(presence, 1, { duration: .12 })
        } else {
          anchorX.jump(x); anchorY.jump(y); width.jump(boxWidth); height.jump(boxHeight)
          if (mode === 'cold' && !reduceMotion.value) { presence.jump(0); animate(presence, 1, { duration: popMilliseconds / 1000, ease: [.23, 1, .32, 1] }) } else presence.jump(1)
        }
      }
      paintPlace(); paintPop()
    }, { flush: 'post' })
    // Mientras está abierto sigue al botón al desplazar o redimensionar; se cierra si la ventana se oculta.
    watch(phase, (value, previous, onCleanup) => {
      if (value === 'closed') return
      const follow = () => { const payload = current.value; if (!payload) return; const [x, y] = anchorOf(payload.trigger.getBoundingClientRect(), payload.side); anchorX.jump(x); anchorY.jump(y) }
      const onHidden = () => { if (document.hidden && current.value) hide(current.value.tooltipId, true) }
      window.addEventListener('scroll', follow, { capture: true, passive: true }); window.addEventListener('resize', follow); document.addEventListener('visibilitychange', onHidden)
      onCleanup(() => { window.removeEventListener('scroll', follow, { capture: true }); window.removeEventListener('resize', follow); document.removeEventListener('visibilitychange', onHidden) })
    })
    onBeforeUnmount(() => { clearTimeout(closeTimer); clearTimeout(leaveTimer); unsubscribers.forEach(unsubscribe => unsubscribe()); [anchorX, anchorY, width, height, presence].forEach(value => value.stop()) })

    return () => {
      const payload = current.value
      const tooltip = phase.value !== 'closed' && payload
        ? h('span', { id: groupId, ref: outer, role: 'tooltip', class: 'warm-tooltip', 'data-side': payload.side },
          h('span', { ref: pop, class: 'warm-tooltip-pop' }, h('span', { ref: text, class: 'warm-tooltip-text' }, payload.content)))
        : null
      return [slots.default?.(), h(Teleport, { to: 'body' }, tooltip ? [tooltip] : [])]
    }
  }
})
