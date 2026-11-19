<script setup lang="ts" generic="Item">
import { defineComponent, h, nextTick, onMounted, ref, watch } from 'vue'
import { motion, useInView } from 'motion-v'

/**
 * "Animated List" de Vue Bits (MIT + Commons Clause), adaptado para listas de registros (Pagos, Clientes):
 * - Cada renglón entra al verse (escala .96 → 1 y opacidad, 200 ms) en lugar de la escala .7 del original.
 * - El contenido de cada renglón lo da el slot `item`; la lista no conoce el negocio.
 * - Teclado: flechas, Inicio y Fin mueven el foco entre renglones **sólo con la lista enfocada**
 *   (el original escuchaba la ventana completa y robaba Tab).
 * - Degradados arriba y abajo en el color del lienzo indican que hay más contenido al desplazar.
 * - Con movimiento reducido, motion-v no anima la entrada.
 */
const props = withDefaults(defineProps<{ items: Item[]; itemKey: (item: Item) => string; label: string; maximumHeight?: string }>(), { maximumHeight: '62vh' })
const scroller = ref<HTMLElement | null>(null)
const topFade = ref(0), bottomFade = ref(0)

const AnimatedRow = defineComponent({
  name: 'AnimatedRow',
  props: { index: { type: Number, required: true } },
  setup(rowProps, { slots }) {
    const element = ref<HTMLElement | null>(null)
    const isInView = useInView(element, { amount: .3, once: true })
    return () => h(motion.li, { ref: element, class: 'animated-row', 'data-index': rowProps.index, initial: { scale: .96, opacity: 0 },
      animate: isInView.value ? { scale: 1, opacity: 1 } : { scale: .96, opacity: 0 }, transition: { duration: .2, delay: Math.min(rowProps.index, 8) * .03 } }, slots.default?.())
  }
})

function updateFades(): void {
  const element = scroller.value
  if (!element) return
  topFade.value = Math.min(element.scrollTop / 50, 1)
  const remaining = element.scrollHeight - element.scrollTop - element.clientHeight
  bottomFade.value = element.scrollHeight <= element.clientHeight ? 0 : Math.min(remaining / 50, 1)
}
/** Mueve el foco al primer elemento enfocable del renglón vecino. */
function onKeyDown(event: KeyboardEvent): void {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) || !scroller.value) return
  const rows = Array.from(scroller.value.querySelectorAll('.animated-row')) as HTMLElement[]
  const currentIndex = rows.findIndex(row => row.contains(document.activeElement))
  const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? rows.length - 1 : Math.max(0, Math.min(rows.length - 1, currentIndex + (event.key === 'ArrowDown' ? 1 : -1)))
  const target = rows[nextIndex]?.querySelector('[data-row-focus], button, a, [tabindex="0"]') as HTMLElement | null | undefined
  if (!target) return
  event.preventDefault()
  target.focus()
  target.scrollIntoView({ block: 'nearest' })
}
onMounted(updateFades)
watch(() => props.items.length, () => { void nextTick(updateFades) })
</script>
<template>
  <div class="animated-list">
    <ul
      ref="scroller"
      class="animated-list-scroller"
      :aria-label="label"
      :style="{ maxHeight: maximumHeight }"
      @scroll="updateFades"
      @keydown="onKeyDown"
    >
      <AnimatedRow
        v-for="(item, position) in props.items"
        :key="props.itemKey(item)"
        :index="position"
      >
        <slot
          name="item"
          :item="item"
          :position="position"
        />
      </AnimatedRow>
      <slot name="empty" />
    </ul>
    <span
      class="animated-list-fade is-top"
      :style="{ opacity: topFade }"
      aria-hidden="true"
    />
    <span
      class="animated-list-fade is-bottom"
      :style="{ opacity: bottomFade }"
      aria-hidden="true"
    />
  </div>
</template>
<style scoped>
.animated-list { position: relative; min-width: 0; }
.animated-list-scroller { list-style: none; margin: 0; padding: 12px; display: grid; gap: 8px; overflow-y: auto; scrollbar-width: thin; overscroll-behavior: contain; }
.animated-list-scroller :deep(.animated-row) { list-style: none; min-width: 0; }
.animated-list-fade { position: absolute; left: 0; right: 0; pointer-events: none; transition: opacity .3s ease; }
.animated-list-fade.is-top { top: 0; height: 32px; background: linear-gradient(to bottom, var(--surfaceColor), transparent); }
.animated-list-fade.is-bottom { bottom: 0; height: 56px; background: linear-gradient(to top, var(--surfaceColor), transparent); }
</style>
