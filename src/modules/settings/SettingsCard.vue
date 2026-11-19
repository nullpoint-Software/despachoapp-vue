<script setup lang="ts">
import { useId, type Component } from 'vue'
import HelpTip from '../../shared/components/HelpTip.vue'

/**
 * Tarjeta de ajuste de Configuración (2026-10-10). Todas las tarjetas leen igual:
 * icono + título (+ "?" opcional) → una línea que explica para qué sirve → los controles.
 * - `actions` (opcional): botones del encabezado, a la derecha del título (p. ej. Actualizar).
 * - `headingLevel`: 2 suelta en la sección; 3 cuando va dentro de un `SettingsGroup`.
 * El `id`, las clases y el `data-testid` que reciba pasan a la raíz (herencia de atributos de Vue), así los
 * mosaicos (bento) y las pruebas siguen apuntando a la tarjeta.
 */
const props = withDefaults(defineProps<{ title: string; description?: string; icon?: Component; helpTitle?: string; helpText?: string; headingLevel?: 2 | 3 }>(), { description: undefined, icon: undefined, helpTitle: undefined, helpText: undefined, headingLevel: 2 })
const headingId = useId()
</script>

<template>
  <section
    class="surface-panel settings-card"
    :aria-labelledby="headingId"
  >
    <div class="settings-card-header">
      <div class="settings-card-heading">
        <div class="help-title-row">
          <component
            :is="'h' + props.headingLevel"
            :id="headingId"
            class="settings-card-title"
          >
            <component
              :is="props.icon"
              v-if="props.icon"
              :size="18"
              aria-hidden="true"
            /> {{ props.title }}
          </component>
          <HelpTip
            v-if="props.helpTitle && props.helpText"
            :title="props.helpTitle"
            :text="props.helpText"
          />
        </div>
        <p
          v-if="props.description"
          class="field-help settings-card-description"
        >
          {{ props.description }}
        </p>
      </div>
      <div
        v-if="$slots.actions"
        class="actions settings-card-actions"
      >
        <slot name="actions" />
      </div>
    </div>
    <slot />
  </section>
</template>

<style scoped>
.settings-card { display: grid; align-content: start; gap: var(--spaceMedium); min-width: 0; margin: 0; }
.settings-card-header { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: var(--spaceSmall) var(--spaceMedium); min-width: 0; }
.settings-card-heading { display: grid; gap: 4px; min-width: 0; flex: 1 1 260px; }
.settings-card-heading .help-title-row { margin: 0; }
.settings-card-title { display: inline-flex; align-items: center; gap: 10px; font-size: 18px; line-height: 1.3; }
.settings-card-description { font-size: 13px; max-width: 70ch; }
</style>
