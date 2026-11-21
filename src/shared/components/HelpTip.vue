<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId } from 'vue'
import { placeHelpTip, type HelpTipPlacement } from './helpTipPlacement'

/**
 * Ayuda "?" (2026-10-10, pedido del usuario: "agrega ayudas o explicaciones a la app con el ícono de ?").
 *
 * Contrato:
 * - Un botón cuadrado con "?" (marco de 2 px, como los botones de icono) que abre un globo con un título corto y
 *   1–3 oraciones. El nombre accesible es "Ayuda: <título>" (o "Ayuda: <label>") y lleva `aria-expanded` y
 *   `aria-controls`; el globo es un diálogo no modal (`role="dialog"`) nombrado por su título.
 * - Se abre y se cierra con clic, Enter o Espacio (es un `<button>` nativo); nunca depende sólo del hover.
 *   Escape lo cierra y devuelve el foco al "?"; un clic fuera también lo cierra. El foco no se mueve al abrir:
 *   el lector de pantalla anuncia el estado expandido y el globo sigue en el orden de lectura tras el botón.
 * - El globo es un `popover="manual"` (capa superior, como el menú de SearchSelectField): se ve encima de tablas
 *   con desplazamiento y de modales sin recortarse. Su posición la calcula `placeHelpTip` para quedar dentro de la
 *   ventana, y se recalcula al desplazar o cambiar el tamaño.
 * - El contenido sólo se monta abierto: así el texto de ayuda no duplica textos de la página mientras está cerrado.
 *
 * No sustituye a `WarmTooltip` (etiqueta de una línea para botones de sólo icono): esto es una explicación.
 */
const props = defineProps<{ title: string; text: string; label?: string }>()
const popoverId = useId(), titleId = useId()
const root = ref<HTMLElement | null>(null), button = ref<HTMLButtonElement | null>(null), popover = ref<HTMLElement | null>(null)
const isOpen = ref(false)
const placement = ref<HelpTipPlacement>({ top: 0, left: 0, side: 'bottom' })

function position(): void {
  if (!button.value || !popover.value) return
  const anchor = button.value.getBoundingClientRect(), size = popover.value.getBoundingClientRect()
  placement.value = placeHelpTip({ top: anchor.top, left: anchor.left, width: anchor.width, height: anchor.height }, { width: size.width, height: size.height }, { width: window.innerWidth, height: window.innerHeight })
}
async function open(): Promise<void> {
  isOpen.value = true
  await nextTick()
  // Sin Popover API el globo queda en su lugar con posición fija; la ayuda sigue funcionando.
  try { popover.value?.showPopover() } catch { /* sin capa superior */ }
  position()
  document.addEventListener('pointerdown', closeOnOutsidePointer, true)
  document.addEventListener('keydown', closeOnEscape, true)
  window.addEventListener('resize', position)
  window.addEventListener('scroll', position, true)
}
function close(shouldRestoreFocus = false): void {
  if (!isOpen.value) return
  isOpen.value = false
  try { popover.value?.hidePopover() } catch { /* ya estaba cerrado */ }
  removeListeners()
  if (shouldRestoreFocus) button.value?.focus()
}
function toggle(): void { if (isOpen.value) close(); else void open() }
function closeOnOutsidePointer(event: PointerEvent): void {
  const target = event.target as Node | null
  if (target && (root.value?.contains(target) || popover.value?.contains(target))) return
  close()
}
/** Escape cierra sólo el globo: se detiene aquí para que no cierre también el modal que lo contiene. */
function closeOnEscape(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return
  event.preventDefault(); event.stopPropagation()
  close(true)
}
function removeListeners(): void {
  document.removeEventListener('pointerdown', closeOnOutsidePointer, true)
  document.removeEventListener('keydown', closeOnEscape, true)
  window.removeEventListener('resize', position)
  window.removeEventListener('scroll', position, true)
}
onBeforeUnmount(() => { removeListeners() })
</script>

<template>
  <span
    ref="root"
    class="help-tip"
  >
    <button
      ref="button"
      type="button"
      class="help-tip-button"
      :aria-label="'Ayuda: ' + (props.label ?? props.title)"
      :aria-expanded="isOpen"
      :aria-controls="popoverId"
      @click="toggle"
    >
      <span
        class="help-tip-glyph"
        aria-hidden="true"
      />
    </button>
    <div
      :id="popoverId"
      ref="popover"
      popover="manual"
      role="dialog"
      :aria-labelledby="titleId"
      class="help-tip-popover"
      :class="{ 'is-open': isOpen }"
      :data-side="placement.side"
      :style="{ top: placement.top + 'px', left: placement.left + 'px' }"
    >
      <template v-if="isOpen">
        <strong :id="titleId">{{ props.title }}</strong>
        <p>{{ props.text }}</p>
      </template>
    </div>
  </span>
</template>

<style scoped>
.help-tip { display: inline-flex; align-items: center; vertical-align: middle; flex: none; }
/* Botón "?": cuadrado de 24 px con marco de tinta y sombra dura corta; abierto se marca con el acento. */
.help-tip-button { display: inline-grid; place-items: center; width: 24px; height: 24px; padding: 0; border: 2px solid var(--borderColor); border-radius: 0; background: var(--surfaceColor); color: var(--textColor); box-shadow: 2px 2px 0 var(--shadowInk, var(--borderColor)); cursor: pointer; transition-property: background-color, color, transform, box-shadow; transition-duration: var(--durationQuick); transition-timing-function: var(--easeSmoothOut); }
.help-tip-button:hover { background: var(--hoverColor); }
.help-tip-button:active { transform: translate(2px, 2px); box-shadow: none; }
.help-tip-button[aria-expanded="true"] { background: var(--primaryBackgroundColor); color: var(--primaryTextColor); }
/* El signo va en CSS: no aporta texto a la página (getByText, copiar y pegar) y el nombre accesible ya lo dice. */
.help-tip-glyph::before { content: "?"; font-family: var(--monoFontFamily); font-size: 13px; font-weight: 800; line-height: 1; }
/* Globo: papel con marco de 2 px y sombra dura; tipografía propia para no heredar la de un título vecino. */
.help-tip-popover { position: fixed; inset: auto; margin: 0; width: min(320px, calc(100vw - 16px)); max-height: calc(100vh - 16px); overflow-y: auto; padding: 12px 14px; border: 2px solid var(--borderColor); border-radius: 0; background: var(--surfaceColor); color: var(--textColor); box-shadow: var(--cardShadow); font-family: inherit; font-size: 14px; font-weight: 400; line-height: 1.45; letter-spacing: normal; text-transform: none; text-align: left; white-space: normal; transition-property: opacity, transform; transition-duration: var(--durationQuick); transition-timing-function: var(--easeSmoothOut); }
.help-tip-popover:not(.is-open) { display: none; }
/* Entrada breve desde el lado del botón (150 ms); con movimiento reducido base.css anula la transición. */
@starting-style {
  .help-tip-popover.is-open { opacity: 0; transform: translateY(-4px); }
  .help-tip-popover.is-open[data-side="top"] { transform: translateY(4px); }
}
.help-tip-popover strong { display: block; font-size: 14px; font-weight: 800; letter-spacing: -.01em; }
.help-tip-popover p { margin: 6px 0 0; font-size: 13px; color: var(--textColor); text-wrap: pretty; }
</style>

<style>
/*
 * Fila de título con ayuda: el "?" va inmediatamente después del título, sin entrar en él (el nombre accesible
 * del título no cambia). Se usa así: <div class="help-title-row"><h1>Tareas</h1><HelpTip … /></div>.
 */
.help-title-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; min-width: 0; margin: 0 0 8px; }
.help-title-row > :is(h1, h2, h3, h4) { margin: 0; min-width: 0; }
</style>
