<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { SunMoon, Sparkles } from '@lucide/vue'
import { backgroundStyles, defaultPreferences, type BackgroundStyle, type ThemePreference } from '../../../shared/contracts/localPreferences'
import ActionButton from '../../shared/components/ActionButton.vue'
import FormModal from '../../shared/components/FormModal.vue'
import SelectField from '../../shared/components/SelectField.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import { effectiveTheme, isPreferencesSaveFailed, preferences, updatePreferences } from './localPreferencesState'
import SettingsSectionHeader from './SettingsSectionHeader.vue'
import SettingsCard from './SettingsCard.vue'
import BackgroundPreview from './BackgroundPreview.vue'
import { deriveAccentPalette, isHexColor } from '../../shared/styles/accentPalette'

/**
 * Preferencias de este equipo (LOCAL): tema, color y fondo animado. Nada de esto sale del navegador.
 * Web demo: la impresora de tickets y el Host en segundo plano son de escritorio y se retiraron.
 *
 * Mosaico (adenda ADR-039, 2026-10-13): columnas CSS equilibradas por altura. Cada tarjeta mide lo que su contenido
 * (sin filas que la estiren) y el navegador reparte las tarjetas entre dos columnas de ≥ 340 px; si no caben, una sola.
 * Estructura común (2026-10-10): `SettingsSectionHeader` (título, "?", descripción) y cada ajuste en una
 * `SettingsCard` (icono + título + una línea + controles). Host en segundo plano lleva su ayuda "?".
 * Personalización (adenda ADR-039, 2026-10-13): una sola tarjeta con el fondo y un botón "Tema y color" que muestra el tema
 * y el color vigentes y abre UN FormModal con ambos controles (se aplican al momento; el modal sólo se cierra).
 * Apariencia (ADR-039): el fondo elige el patrón de la mesa con vistas previas y conserva la pausa (grupo de radio nativo
 * dibujado como tarjetas). "Color principal" acepta cualquier RGB (selector nativo o código hexadecimal); lo que se pinta
 * se deriva para cada tema en `accentPalette.ts` y, si difiere de lo elegido, se avisa "Ajustado para que se lea bien".
 */
const themeOptions = [{ value: 'system', label: 'Seguir al sistema' }, { value: 'light', label: 'Claro' }, { value: 'dark', label: 'Oscuro' }]
const themeLabel = computed(() => themeOptions.find(option => option.value === preferences.value.theme)?.label ?? '')
const isAppearanceModalOpen = ref(false)
const backgroundLabels: Record<BackgroundStyle, string> = { dither: 'Tramado', dotGrid: 'Cuadrícula de puntos', squares: 'Cuadros', waves: 'Ondas', threads: 'Hilos', hyperspeed: 'Hiperespacio', gridDistortion: 'Retícula ondulada', ribbons: 'Listones', iridescence: 'Iridiscencia', none: 'Ninguno' }
/** Color principal: el borrador del campo hexadecimal se confirma con Enter o al salir del campo. */
const accentDraft = ref(preferences.value.accentColor), hasInvalidAccentDraft = ref(false)
watch(() => preferences.value.accentColor, value => { accentDraft.value = value; hasInvalidAccentDraft.value = false })
const accentPalette = computed(() => deriveAccentPalette(preferences.value.accentColor))
const shownAccent = computed(() => accentPalette.value[effectiveTheme.value].accentColor)
function chooseAccent(value: string): void {
  const normalized = ('#' + value.trim().replace(/^#/, '')).toUpperCase()
  hasInvalidAccentDraft.value = !isHexColor(normalized)
  if (!hasInvalidAccentDraft.value && normalized !== preferences.value.accentColor) void updatePreferences({ accentColor: normalized })
}
</script>
<template>
  <section data-testid="settings-page">
    <SettingsSectionHeader
      title="Preferencias"
      description="Se guardan sólo en este equipo y se recuerdan en este navegador. Se respeta la preferencia de movimiento reducido del sistema."
      help-title="Preferencias de este equipo"
      help-text="Son ajustes LOCALES: cada navegador tiene los suyos y no se envían a ningún servidor. Cambiar el tema o el fondo aquí no afecta a otros navegadores."
    />
    <InlineNotice
      v-if="isPreferencesSaveFailed"
      title="Preferencias no guardadas"
      tone="warning"
    >
      <p>El cambio se aplicó en esta sesión, pero no se pudo guardar en el equipo.</p>
    </InlineNotice>
    <div class="settings-bento">
      <SettingsCard
        class="settings-panel settings-background"
        data-testid="settings-personalization"
        title="Personalización"
        :icon="Sparkles"
        description="Tema, color principal y el patrón de la mesa detrás del contenido. El fondo se mueve despacio y se detiene con la ventana oculta."
      >
        <ActionButton
          class="appearance-button"
          data-testid="settings-appearance-button"
          @click="isAppearanceModalOpen = true"
        >
          <SunMoon
            :size="16"
            aria-hidden="true"
          /> Tema y color: {{ themeLabel }} ·
          <span
            class="accent-chip"
            :style="{ background: shownAccent }"
            aria-hidden="true"
          /><code>{{ preferences.accentColor }}</code>
        </ActionButton>
        <fieldset class="appearance-options background-options">
          <legend class="sr-only">
            Fondo de la mesa
          </legend>
          <label
            v-for="style in backgroundStyles"
            :key="style"
            class="appearance-option"
          >
            <input
              class="sr-only"
              type="radio"
              name="settings-background-style"
              :value="style"
              :checked="preferences.backgroundStyle === style"
              @change="updatePreferences({ backgroundStyle: style })"
            >
            <BackgroundPreview :background-style="style" />
            <span class="appearance-option-label">{{ backgroundLabels[style] }}</span>
          </label>
        </fieldset>
        <ActionButton
          v-if="preferences.backgroundStyle !== 'none'"
          :aria-pressed="preferences.isBackgroundPaused"
          @click="updatePreferences({ isBackgroundPaused: !preferences.isBackgroundPaused })"
        >
          {{ preferences.isBackgroundPaused ? 'Animar fondo' : 'Pausar fondo animado' }}
        </ActionButton>
        <!-- El modal vive dentro de la tarjeta: los cambios se aplican al momento y "Listo" sólo cierra. -->
        <FormModal
          :is-open="isAppearanceModalOpen"
          title="Tema y color"
          :description="'Tema en uso: ' + (effectiveTheme === 'dark' ? 'oscuro' : 'claro') + ' (Ctrl+Shift+L alterna). El color principal pinta el botón principal, la selección y el foco; se aclara u oscurece lo necesario para que se lea en cada tema.'"
          test-id="settings-appearance-modal"
          @close="isAppearanceModalOpen = false"
        >
          <div class="settings-modal-body">
            <SelectField
              id="settings-theme"
              :model-value="preferences.theme"
              label="Tema de la interfaz"
              :options="themeOptions"
              @update:model-value="updatePreferences({ theme: $event as ThemePreference })"
            />
            <div class="accent-fields">
              <div class="field">
                <label for="settings-accent-picker">Color</label>
                <!-- El selector nativo sólo guarda al cerrarse (change), no en cada movimiento: evita escribir en disco a cada paso. -->
                <input
                  id="settings-accent-picker"
                  class="accent-picker"
                  type="color"
                  :value="preferences.accentColor.toLowerCase()"
                  @change="chooseAccent(($event.target as HTMLInputElement).value)"
                >
              </div>
              <div class="field">
                <label for="settings-accent-hex">Código hexadecimal</label>
                <input
                  id="settings-accent-hex"
                  v-model="accentDraft"
                  type="text"
                  maxlength="7"
                  spellcheck="false"
                  autocomplete="off"
                  :aria-invalid="hasInvalidAccentDraft"
                  aria-describedby="settings-accent-hex-help"
                  @change="chooseAccent(accentDraft)"
                  @keydown.enter.prevent="chooseAccent(accentDraft)"
                >
                <p
                  id="settings-accent-hex-help"
                  class="field-help"
                  :class="{ 'is-error': hasInvalidAccentDraft }"
                >
                  {{ hasInvalidAccentDraft ? 'Escribe seis cifras hexadecimales, por ejemplo #1F3BD6.' : 'Seis cifras hexadecimales, con o sin #.' }}
                </p>
              </div>
            </div>
            <ul
              class="accent-results"
              aria-label="Color que se usa en cada tema"
            >
              <li>
                <span
                  class="accent-chip"
                  :style="{ background: accentPalette.light.accentColor }"
                  aria-hidden="true"
                />Claro <code>{{ accentPalette.light.accentColor }}</code>
              </li>
              <li>
                <span
                  class="accent-chip"
                  :style="{ background: accentPalette.dark.accentColor }"
                  aria-hidden="true"
                />Oscuro <code>{{ accentPalette.dark.accentColor }}</code>
              </li>
            </ul>
            <p
              v-if="shownAccent !== preferences.accentColor"
              class="field-help"
              data-testid="accent-adjusted"
              aria-live="polite"
            >
              Ajustado para que se lea bien: en el tema {{ effectiveTheme === 'dark' ? 'oscuro' : 'claro' }} se usa {{ shownAccent }} en lugar de {{ preferences.accentColor }}.
            </p>
            <ActionButton
              :disabled="preferences.accentColor === defaultPreferences.accentColor"
              @click="chooseAccent(defaultPreferences.accentColor)"
            >
              Restablecer azul sello
            </ActionButton>
            <div class="form-footer">
              <ActionButton
                variant="primary"
                @click="isAppearanceModalOpen = false"
              >
                Listo
              </ActionButton>
            </div>
          </div>
        </FormModal>
      </SettingsCard>
    </div>
  </section>
</template>
<style scoped>
/* Mosaico por columnas (adenda ADR-039): cada tarjeta mide su contenido y el navegador equilibra las dos columnas, así no
   quedan huecos dentro de las tarjetas. Bajo ~700 px de contenido cabe una sola columna (ancho mínimo de 340 px). */
.settings-bento { container-type: inline-size; columns: 2 340px; column-gap: var(--spaceMedium); }
.settings-bento > .settings-panel { display: grid; align-content: start; gap: var(--spaceMedium); min-width: 0; margin: 0 0 var(--spaceMedium); break-inside: avoid; }
/* Opciones de apariencia: radios nativos ocultos a la vista; la tarjeta marca la elección con el acento y el foco con su anillo. */
.appearance-options { display: grid; gap: var(--spaceSmall); margin: 0; padding: 0; border: 0; min-width: 0; }
.background-options { grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); }
.appearance-option { position: relative; display: grid; gap: 6px; padding: 6px; border: 2px solid var(--borderColor); background: var(--surfaceColor); cursor: pointer; min-width: 0; transition-property: box-shadow, border-color; transition-duration: var(--durationQuick); transition-timing-function: var(--easeSmoothOut); }
.appearance-option:hover { box-shadow: var(--buttonShadow); }
.appearance-option:has(input:checked) { border-color: var(--accentColor); box-shadow: 3px 3px 0 var(--accentColor); }
.appearance-option:has(input:focus-visible) { outline: 2px solid var(--focusColor); outline-offset: 2px; }
.appearance-option-label { font-size: 12px; font-weight: 600; overflow-wrap: anywhere; }
/* Señal que no depende del color (un acento tinta coincide con el borde): el nombre elegido va subrayado. */
.appearance-option:has(input:checked) .appearance-option-label { text-decoration: underline 2px; text-underline-offset: 3px; }
.appearance-button { justify-self: start; }
.appearance-button code { font-size: 12px; }
.settings-modal-body { display: grid; gap: var(--spaceMedium); }
.accent-fields { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: var(--spaceMedium); align-items: start; }
.accent-picker { width: 64px; height: var(--controlHeight); padding: 2px; border: 2px solid var(--borderColor); background: var(--surfaceColor); cursor: pointer; }
.field-help.is-error { color: var(--errorColor); }
.accent-results { display: flex; flex-wrap: wrap; gap: var(--spaceMedium); margin: 0; padding: 0; list-style: none; font-size: 12px; }
.accent-results li { display: inline-flex; align-items: center; gap: 6px; }
.accent-chip { width: 16px; height: 16px; border: 2px solid var(--borderColor); }
</style>
