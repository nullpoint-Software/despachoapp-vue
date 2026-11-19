<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RefreshCw, Printer, SunMoon, Sparkles, Server } from '@lucide/vue'
import { backgroundStyles, defaultPreferences, ticketWidths, type BackgroundStyle, type LocalPrinter, type ThemePreference, type TicketWidth } from '../../../shared/contracts/localPreferences'
import ActionButton from '../../shared/components/ActionButton.vue'
import FormModal from '../../shared/components/FormModal.vue'
import SelectField from '../../shared/components/SelectField.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import TicketPreviewDialog from '../../shared/components/TicketPreviewDialog.vue'
import { useTicketPrinting } from '../../shared/printing/useTicketPrinting'
import { effectiveTheme, isPreferencesSaveFailed, preferences, updatePreferences } from './localPreferencesState'
import { deviceMode } from '../workspace/sessionState'
import SettingsSectionHeader from './SettingsSectionHeader.vue'
import SettingsCard from './SettingsCard.vue'
import BackgroundPreview from './BackgroundPreview.vue'
import { deriveAccentPalette, isHexColor } from '../../shared/styles/accentPalette'

/**
 * Preferencias de este equipo (LOCAL): tema, fondo animado e impresora de tickets. La impresora se
 * elige de la lista que entrega el sistema; imprimir llega en 5.4. Nada de esto sale del equipo.
 * En el equipo Host (7.4): mantener el Host en segundo plano (inicio con Windows y bandeja).
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
const printers = ref<LocalPrinter[]>([]), isLoadingPrinters = ref(false), printerError = ref('')
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
const widthOptions = ticketWidths.map(width => ({ value: String(width), label: width + ' mm' }))
async function loadPrinters(): Promise<void> {
  isLoadingPrinters.value = true; printerError.value = ''
  try { printers.value = await window.contapp.listLocalPrinters() } catch { printerError.value = 'No se pudo consultar la lista de impresoras del sistema.' }
  finally { isLoadingPrinters.value = false }
}
function printerOptions() {
  const saved = preferences.value.printer.printerName
  const options = [{ value: '', label: 'Sin impresora elegida' }, ...printers.value.map(printer => ({ value: printer.name, label: printer.displayName }))]
  // Una impresora guardada que ya no está instalada se conserva visible para que el usuario la cambie.
  if (saved && !printers.value.some(printer => printer.name === saved)) options.push({ value: saved, label: saved + ' (no disponible)' })
  return options
}
/** Ticket de prueba (5.4): confirma impresora, ancho y columnas antes de imprimir recibos. */
const { preview: testPreview, isPreparing: isPreparingTest, openTicket, closeTicket } = useTicketPrinting()
function printTest(): void { void openTicket(() => window.contapp.prepareTestTicket()) }
function choosePrinter(value: string): void { void updatePreferences({ printer: { ...preferences.value.printer, printerName: value || null } }) }
function chooseWidth(value: string): void { void updatePreferences({ printer: { ...preferences.value.printer, ticketWidthMillimeters: Number(value) as TicketWidth } }) }
onMounted(() => { void loadPrinters() })
</script>
<template>
  <section data-testid="settings-page">
    <SettingsSectionHeader
      title="Preferencias"
      description="Se guardan sólo en este equipo y se recuerdan al volver a abrir Fiscenix. Se respeta la preferencia de movimiento reducido del sistema."
      help-title="Preferencias de este equipo"
      help-text="Son ajustes LOCALES: cada computadora del despacho tiene los suyos y no se envían al Host. Cambiar el tema o la impresora aquí no afecta a los demás equipos."
    />
    <InlineNotice
      v-if="isPreferencesSaveFailed"
      title="Preferencias no guardadas"
      tone="warning"
    >
      <p>El cambio se aplicó en esta sesión, pero no se pudo guardar en el equipo.</p>
    </InlineNotice>
    <div
      class="settings-bento"
      :class="{ 'has-host': deviceMode === 'host' }"
    >
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
      <SettingsCard
        v-if="deviceMode === 'host'"
        class="settings-panel settings-host"
        data-testid="settings-background-host"
        title="Host en segundo plano"
        :icon="Server"
        description="Inicia con Windows y, al cerrar la ventana, sigue en la bandeja atendiendo a los Clientes, respaldos y programaciones. Sólo aplica en la copia instalada."
        help-title="Host en segundo plano"
        help-text="Los demás equipos sólo trabajan mientras el Host está encendido. Con esta opción, cerrar la ventana no detiene el servicio: Fiscenix queda junto al reloj de Windows y los respaldos de las 02:00 y las consultas programadas siguen corriendo."
      >
        <ActionButton
          :aria-pressed="preferences.shouldRunHostInBackground"
          @click="updatePreferences({ shouldRunHostInBackground: !preferences.shouldRunHostInBackground })"
        >
          {{ preferences.shouldRunHostInBackground ? 'Detener al cerrar la ventana' : 'Mantener en segundo plano' }}
        </ActionButton>
      </SettingsCard>
      <SettingsCard
        class="settings-panel settings-printer"
        title="Impresora de tickets"
        :icon="Printer"
        description="Imprime los tickets de pago y los cortes de caja de este equipo. Prueba la impresora después de elegirla."
      >
        <InlineNotice
          v-if="printerError"
          title="Impresoras no disponibles"
          tone="error"
        >
          <p>{{ printerError }}</p>
        </InlineNotice>
        <div class="settings-printer-fields">
          <SelectField
            id="settings-printer"
            :model-value="preferences.printer.printerName ?? ''"
            label="Impresora"
            :options="printerOptions()"
            :disabled="isLoadingPrinters"
            @update:model-value="choosePrinter"
          />
          <SelectField
            id="settings-ticket-width"
            :model-value="String(preferences.printer.ticketWidthMillimeters)"
            label="Ancho del ticket"
            :options="widthOptions"
            @update:model-value="chooseWidth"
          />
          <ActionButton
            :is-loading="isLoadingPrinters"
            @click="loadPrinters"
          >
            <RefreshCw
              :size="16"
              aria-hidden="true"
            /> Actualizar lista
          </ActionButton>
          <!-- Siempre disponible: sin impresora elegida, Main responde qué falta y no se envía nada. -->
          <ActionButton
            :is-loading="isPreparingTest"
            @click="printTest"
          >
            <Printer
              :size="16"
              aria-hidden="true"
            /> Imprimir prueba
          </ActionButton>
        </div>
        <p
          v-if="!isLoadingPrinters && !printers.length && !printerError"
          class="field-help"
        >
          El sistema no informó impresoras instaladas.
        </p>
      </SettingsCard>
    </div>
    <TicketPreviewDialog
      :preview="testPreview"
      @close="closeTicket"
    />
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
.settings-printer-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap: var(--spaceMedium); align-items: end; }
</style>
