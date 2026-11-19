<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * Strip fixed at the top of every phase. It wraps on narrow screens, so its real height is measured and published as
 * `--demoBannerHeight`; the login screen and the application shell, which fill 100dvh, shrink by exactly that amount
 * instead of sliding under it (no page scroll).
 */
const bannerElement = ref<HTMLElement | null>(null)
let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  const element = bannerElement.value
  if (!element) return
  resizeObserver = new ResizeObserver(() => document.documentElement.style.setProperty('--demoBannerHeight', `${element.offsetHeight}px`))
  resizeObserver.observe(element)
})
onBeforeUnmount(() => resizeObserver?.disconnect())
</script>

<template>
  <div
    ref="bannerElement"
    class="demo-banner"
    data-testid="demo-banner"
  >
    <span>Demo · los datos se borran al recargar · SAT y correo simulados</span>
    <a
      href="https://github.com/nullpoint-Software/despachoapp-vue"
      target="_blank"
      rel="noopener"
    >Código</a>
  </div>
</template>

<style>
:root { --demoBannerHeight: 28px; }
body { padding-top: var(--demoBannerHeight); }
body .application-shell { height: calc(100dvh - var(--demoBannerHeight)); }
.demo-banner { position: fixed; inset: 0 0 auto 0; z-index: 200; box-sizing: border-box; min-height: 28px; display: flex; flex-wrap: wrap; align-items: center; justify-content: center; column-gap: var(--spaceMedium); padding: 4px var(--spaceMedium); font-size: 12px; font-weight: 600; text-align: center; background: var(--primaryBackgroundColor); color: var(--primaryTextColor); }
.skip-link:focus { top: calc(var(--demoBannerHeight) + 12px); }
.demo-banner a { color: inherit; text-decoration: underline; }
</style>
