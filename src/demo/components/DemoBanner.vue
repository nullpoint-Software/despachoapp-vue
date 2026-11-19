<script setup lang="ts">
/**
 * Slim strip fixed at the top of every phase. It reserves its own height (global rules below) so the login screen
 * and the application shell, which fill 100dvh, shrink instead of sliding under it.
 */
</script>

<template>
  <div
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
.demo-banner { position: fixed; inset: 0 0 auto 0; z-index: 200; height: var(--demoBannerHeight); display: flex; align-items: center; justify-content: center; gap: var(--spaceMedium); padding: 0 var(--spaceMedium); font-size: 12px; font-weight: 600; white-space: nowrap; overflow: hidden; background: var(--primaryBackgroundColor); color: var(--primaryTextColor); }
.demo-banner a { color: inherit; text-decoration: underline; }
</style>
