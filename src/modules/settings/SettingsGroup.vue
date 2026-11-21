<script setup lang="ts">
import { useId, type Component } from 'vue'

/**
 * Grupo de tarjetas dentro de una sección de Configuración (2026-10-10). Separa con una línea de tinta y un
 * título lo que va junto, en un orden fijo: estado y lo más usado arriba; "Avanzado" y "Zona de riesgo" al final.
 * - `tone="danger"`: zona de riesgo (restaurar, borrar, cambiar bases); la línea y el título van en rojo y se
 *   acompañan de texto, nunca sólo de color.
 * - Recibe el `id` al que apuntan las fichas de "En esta sección"; `tabindex="-1"` permite pasarle el foco al saltar.
 */
const props = withDefaults(defineProps<{ title: string; description?: string; icon?: Component; tone?: 'default' | 'advanced' | 'danger' }>(), { description: undefined, icon: undefined, tone: 'default' })
const headingId = useId()
</script>

<template>
  <section
    class="settings-group"
    :class="'is-' + props.tone"
    :aria-labelledby="headingId"
    tabindex="-1"
  >
    <header class="settings-group-header">
      <h2
        :id="headingId"
        class="settings-group-title"
      >
        <component
          :is="props.icon"
          v-if="props.icon"
          :size="18"
          aria-hidden="true"
        /> {{ props.title }}
      </h2>
      <p
        v-if="props.description"
        class="field-help"
      >
        {{ props.description }}
      </p>
    </header>
    <slot />
  </section>
</template>

<style scoped>
/* Línea de tinta de 2 px arriba del grupo: separa visualmente sin otra tarjeta alrededor. */
.settings-group { display: grid; gap: var(--spaceMedium); min-width: 0; margin: var(--spaceLarge) 0 0; padding-top: var(--spaceMedium); border-top: 2px solid var(--borderColor); scroll-margin-top: var(--spaceMedium); }
.settings-group:focus { outline: none; }
.settings-group:focus-visible { outline: 3px solid var(--focusColor); outline-offset: 4px; }
.settings-group-header { display: grid; gap: 4px; }
.settings-group-title { display: inline-flex; align-items: center; gap: 10px; margin: 0; font-size: 20px; }
.settings-group.is-advanced { border-top-style: dashed; }
.settings-group.is-danger { border-top-color: var(--errorColor); }
.settings-group.is-danger .settings-group-title { color: var(--errorText); }
</style>
