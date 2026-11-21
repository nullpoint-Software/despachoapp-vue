<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { gsap } from 'gsap'
import { Building2 } from '@lucide/vue'
import SplitText from '../vueBits/SplitText.vue'

/**
 * Animación de arranque (rediseño 2026-10-02; el original no la tenía), una vez por arranque:
 * 1. el símbolo crece y se asienta (0.45 s, GSAP);
 * 2. "Fiscenix" entra letra por letra con **Split Text de Vue Bits** (desde 0.3 s);
 * 3. la leyenda y la línea de progreso aparecen; cuando Split Text termina se emite `done` y App la retira
 *    al terminar también la carga (lo que tarde más).
 * Con `prefers-reduced-motion: reduce` nada se anima: Split Text termina al instante y se emite `done`.
 * No depende de datos del despacho: el logo y el nombre aún no se conocen al arrancar.
 */
/** `status`: qué se está preparando (Docker, MySQL, base); se muestra bajo la línea de progreso. */
defineProps<{ status?: string }>()
const emit = defineEmits<{ done: [] }>()
const root = ref<HTMLElement | null>(null)
let media: gsap.MatchMedia | undefined
// Respaldo: si Split Text no llegara a terminar (fuente o WebGL lentos), el arranque nunca se queda detenido.
const fallbackMilliseconds = 2500
let fallbackTimer: ReturnType<typeof setTimeout> | undefined

onMounted(() => {
  fallbackTimer = setTimeout(() => emit('done'), fallbackMilliseconds)
  media = gsap.matchMedia()
  media.add('(prefers-reduced-motion: no-preference)', () => {
    gsap.timeline({ defaults: { ease: 'power3.out' } })
      .from('.splash-symbol', { scale: .6, opacity: 0, duration: .45, ease: 'back.out(1.6)' })
      .from('.splash-caption', { y: 6, opacity: 0, duration: .35 }, .55)
      .fromTo('.splash-progress', { scaleX: 0 }, { scaleX: 1, duration: .6, ease: 'power2.inOut' }, .6)
  }, root.value ?? undefined)
})
onBeforeUnmount(() => { clearTimeout(fallbackTimer); media?.revert() })
</script>
<template>
  <div
    ref="root"
    class="startup-splash"
    role="status"
    aria-label="Iniciando Fiscenix…"
  >
    <span class="splash-symbol"><Building2
      :size="34"
      aria-hidden="true"
    /></span>
    <SplitText
      class="splash-wordmark"
      tag="p"
      text="Fiscenix"
      :delay-seconds=".3"
      :stagger-seconds=".05"
      :duration-seconds=".5"
      @complete="emit('done')"
    />
    <p
      class="splash-caption"
      aria-hidden="true"
    >
      Administración del despacho
    </p>
    <span
      class="splash-progress"
      aria-hidden="true"
    />
    <p
      class="splash-status"
      aria-live="polite"
    >
      {{ status }}
    </p>
  </div>
</template>
<style scoped>
.startup-splash { position: fixed; inset: 0; z-index: 200; display: grid; place-content: center; justify-items: center; gap: 14px; background: var(--canvasColor); color: var(--textColor); }
.splash-symbol { display: grid; place-items: center; width: 72px; height: 72px; border-radius: var(--radiusCard); background: var(--primaryBackgroundColor); color: var(--primaryTextColor); box-shadow: var(--overlayShadow); }
.splash-wordmark { margin: 6px 0 0; font-size: 48px; line-height: 1.1; font-weight: 600; letter-spacing: -.05em; }
.splash-caption { margin: 0; font-family: var(--monoFontFamily); font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--mutedTextColor); }
.splash-status { min-height: 18px; margin: 4px 0 0; font-size: 13px; color: var(--mutedTextColor); }
.splash-progress { width: 120px; height: 2px; margin-top: 10px; border-radius: 0; background: var(--textColor); transform-origin: left; }
</style>
