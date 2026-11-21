<script setup lang="ts">
import colorLogoUrl from '../assets/brand/fiscenix-horizontal-color.svg'
import darkLogoUrl from '../assets/brand/fiscenix-horizontal-dark.svg'

/**
 * Logo horizontal de Fiscenix, la marca de la app (ADR-042), no la del despacho: el logo configurable del despacho
 * (branding GLOBAL) se sigue mostrando con `useOfficeBranding`. Copias de `design/fiscenix-logo/final/`; el tema
 * Dark usa su variante propia (cortes abiertos), por eso son dos imágenes y CSS elige una según `data-theme`.
 */
</script>

<template>
  <span
    class="application-logo"
    role="img"
    aria-label="Fiscenix"
  >
    <img
      class="application-logo-light"
      :src="colorLogoUrl"
      alt=""
    >
    <img
      class="application-logo-dark"
      :src="darkLogoUrl"
      alt=""
    >
  </span>
</template>

<style scoped>
/* 120 px de ancho es el mínimo en pantalla de la guía del logo. */
.application-logo { display: inline-block; width: 128px; flex-shrink: 0; line-height: 0; }
.application-logo img { width: 100%; height: auto; }
.application-logo-dark { display: none; }
:root[data-theme="dark"] .application-logo-light { display: none; }
:root[data-theme="dark"] .application-logo-dark { display: inline; }
</style>
