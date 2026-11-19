<script setup lang="ts">
import HelpTip from '../../shared/components/HelpTip.vue'

/**
 * Encabezado común de cada sección de Configuración (2026-10-10, pedido del usuario: "configuraciones mejor
 * estructuradas, para ser fáciles de leer y ver"). Siempre en el mismo orden:
 * 1. Título (h1) con su ayuda "?" opcional al lado (fuera del h1: su nombre accesible no cambia).
 * 2. Una línea de descripción (`.lede`).
 * 3. En secciones largas, "En esta sección": fichas que llevan a cada grupo de tarjetas. Son enlaces que desplazan
 *    el área principal y pasan el foco al grupo (que tiene `tabindex="-1"`); no cambian la URL de la ventana.
 */
const props = defineProps<{ title: string; description: string; helpTitle?: string; helpText?: string; links?: { targetId: string; label: string }[] }>()

/** Con movimiento reducido el salto es instantáneo, como en el visor de PDF. */
function jumpTo(targetId: string): void {
  const target = document.getElementById(targetId)
  if (!target) return
  const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  target.scrollIntoView({ behavior: isReducedMotion ? 'auto' : 'smooth', block: 'start' })
  target.focus({ preventScroll: true })
}
</script>

<template>
  <header class="settings-section-header">
    <div class="help-title-row">
      <h1>{{ props.title }}</h1>
      <HelpTip
        v-if="props.helpTitle && props.helpText"
        :title="props.helpTitle"
        :text="props.helpText"
      />
    </div>
    <p class="lede">
      {{ props.description }}
    </p>
    <nav
      v-if="props.links?.length"
      class="settings-section-index"
      aria-label="En esta sección"
    >
      <a
        v-for="link in props.links"
        :key="link.targetId"
        :href="'#' + link.targetId"
        class="settings-section-chip"
        @click.prevent="jumpTo(link.targetId)"
      >{{ link.label }}</a>
    </nav>
  </header>
</template>

<style scoped>
.settings-section-header { display: grid; gap: var(--spaceSmall); margin-bottom: var(--spaceLarge); }
.settings-section-header .help-title-row { margin: 0; }
.settings-section-header .lede { margin: 0; }
/* Índice: fichas con marco de 2 px y rótulo mono, como los filtros activos; el foco usa el anillo de toda la app. */
.settings-section-index { display: flex; flex-wrap: wrap; gap: var(--spaceSmall); margin-top: 4px; }
.settings-section-chip { display: inline-flex; align-items: center; min-height: 30px; padding: 2px 10px; border: 2px solid var(--borderColor); background: var(--surfaceColor); color: var(--textColor); box-shadow: 2px 2px 0 var(--shadowInk); font-family: var(--monoFontFamily); font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; text-decoration: none; transition-property: background-color, transform, box-shadow; transition-duration: var(--durationQuick); transition-timing-function: var(--easeSmoothOut); }
.settings-section-chip:hover { background: var(--hoverColor); }
.settings-section-chip:active { transform: translate(2px, 2px); box-shadow: none; }
</style>
