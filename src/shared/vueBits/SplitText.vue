<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { gsap } from 'gsap'
import { SplitText as GsapSplitText } from 'gsap/SplitText'

gsap.registerPlugin(GsapSplitText)

/**
 * "Split Text" de Vue Bits (MIT + Commons Clause), adaptado:
 * - Se anima al montarse (no hay desplazamiento que observar): sin ScrollTrigger.
 * - Espera a que Geist esté cargada para medir bien los caracteres.
 * - Con `prefers-reduced-motion: reduce` el texto aparece completo y emite `complete` de inmediato.
 * - GSAP SplitText conserva el texto completo para lectores de pantalla (`aria: 'auto'`).
 */
const props = withDefaults(defineProps<{ text: string; tag?: 'h1' | 'h2' | 'p' | 'span'; splitType?: 'chars' | 'words'; staggerSeconds?: number; durationSeconds?: number; delaySeconds?: number }>(),
  { tag: 'p', splitType: 'chars', staggerSeconds: .04, durationSeconds: .6, delaySeconds: 0 })
const emit = defineEmits<{ complete: [] }>()
const element = ref<HTMLElement | null>(null)
let split: GsapSplitText | null = null
let media: gsap.MatchMedia | undefined

onMounted(async () => {
  await document.fonts.ready
  if (!element.value) return
  let hasAnimated = false
  media = gsap.matchMedia()
  media.add('(prefers-reduced-motion: no-preference)', () => {
    hasAnimated = true
    split = new GsapSplitText(element.value!, { type: props.splitType, aria: 'auto' })
    const targets = props.splitType === 'chars' ? split.chars : split.words
    gsap.from(targets, { yPercent: 60, opacity: 0, duration: props.durationSeconds, delay: props.delaySeconds, ease: 'power3.out', stagger: props.staggerSeconds,
      onComplete: () => { split?.revert(); split = null; emit('complete') } })
  })
  if (!hasAnimated) emit('complete')
})
onBeforeUnmount(() => { media?.revert(); split?.revert() })
</script>
<template>
  <component
    :is="tag"
    ref="element"
    class="split-text"
  >
    {{ text }}
  </component>
</template>
<style scoped>
.split-text { overflow: hidden; }
</style>
