<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import { ImageOff, RefreshCw, TextCursorInput } from '@lucide/vue'
import HoldButton from '../../../shared/vueBits/HoldButton.vue'
import { computeResizedWidth, maximumImageWidthPixels, readImageLayout } from './noteImageLayout'
import { noteImageActions, noteImageGroupLabels, type NoteImageAction, type NoteImageActionGroup } from './noteImageActions'

/**
 * Imagen de una nota (pulido 2026-10-03; tamaño y acomodo 2026-10-10):
 * - **Descripción** debajo de la imagen, editable; se guarda también como texto alternativo (`alt`).
 * - **Marcador** "Imagen no disponible" con la descripción si no hay imagen (descarga fallida) o si no carga.
 *   Si vino de una URL, "Reintentar" vuelve a descargarla.
 * - **Barra de imagen** (toolbar flotante, marco de 2 px y sombra dura): aparece con la imagen seleccionada o con el
 *   foco dentro de la figura. Tamaño (25/50/75/100 % del ancho útil de la hoja), posición (izquierda, centro,
 *   derecha), ajuste del texto (en su renglón o con texto alrededor a un lado), editar descripción y quitar (se
 *   confirma manteniendo presionado). Las acciones vienen de `noteImageActions`, las mismas del menú contextual.
 * - **Redimensionar con el ratón:** dos esquinas inferiores con la imagen seleccionada. Se conserva la proporción
 *   (sólo se guarda `width`), entre 80 px y el ancho útil de la hoja. Mientras se arrastra el ancho es un borrador
 *   local y se guarda una sola vez al soltar, así deshacer revierte el arrastre completo. Con teclado se usan los
 *   tamaños de la barra o del menú contextual.
 * Los botones de la barra no toman el foco al hacer clic (mousedown.prevent): la imagen sigue seleccionada en el editor.
 */
const props = defineProps(nodeViewProps)
const hasFailed = ref(false), isRetrying = ref(false), retryMessage = ref(''), hasFocusWithin = ref(false)
const imageElement = ref<HTMLImageElement | null>(null)
const descriptionInput = ref<HTMLInputElement | null>(null)
const source = computed(() => String(props.node.attrs.src ?? ''))
const description = computed(() => String(props.node.attrs.alt ?? ''))
const sourceUrl = computed(() => String(props.node.attrs.sourceUrl ?? ''))
const isPlaceholder = computed(() => !source.value || hasFailed.value)
const layout = computed(() => readImageLayout(props.node.attrs))
/** Ancho en curso mientras se arrastra una esquina; null fuera del arrastre. */
const draftWidth = ref<number | null>(null)
const displayWidth = computed(() => draftWidth.value ?? layout.value.width)
const isEditable = computed(() => { void props.selected; return props.editor.isEditable })
const isToolbarVisible = computed(() => isEditable.value && (props.selected || hasFocusWithin.value || draftWidth.value !== null))
const toolbarGroups = computed(() => {
  const groups: Array<{ group: NoteImageActionGroup; actions: NoteImageAction[] }> = []
  for (const action of noteImageActions) {
    const last = groups[groups.length - 1]
    if (last?.group === action.group) last.actions.push(action); else groups.push({ group: action.group, actions: [action] })
  }
  return groups
})
watch(source, () => { hasFailed.value = false })
function updateDescription(event: Event): void { props.updateAttributes({ alt: (event.target as HTMLInputElement).value.slice(0, 300) }) }
/** Aplica la acción y vuelve a seleccionar la imagen, para encadenar tamaño, posición y ajuste sin otro clic. */
function applyAction(action: NoteImageAction): void {
  props.updateAttributes(action.change(layout.value))
  const position = props.getPos()
  if (typeof position === 'number') props.editor.commands.setNodeSelection(position)
}
function focusDescription(): void { descriptionInput.value?.focus(); descriptionInput.value?.select() }
/** El foco sigue "dentro" mientras pase entre la barra, el campo de descripción y los botones de la figura. */
function leaveFocus(event: FocusEvent): void {
  const figure = event.currentTarget as HTMLElement
  if (!(event.relatedTarget instanceof Node) || !figure.contains(event.relatedTarget)) hasFocusWithin.value = false
}
async function retry(): Promise<void> {
  if (!sourceUrl.value || isRetrying.value) return
  isRetrying.value = true; retryMessage.value = ''
  try {
    const result = await window.contapp.fetchNoteImage(sourceUrl.value)
    if (result.status === 'downloaded') props.updateAttributes({ src: result.dataUrl })
    else retryMessage.value = result.reason === 'tooLarge' ? 'La imagen pesa más de 2 MB.' : result.reason === 'unsupported' ? 'No es PNG, JPEG, WebP ni GIF.' : 'No se pudo descargar.'
  } catch { retryMessage.value = 'No se pudo descargar.' }
  finally { isRetrying.value = false }
}

/**
 * Arrastre de una esquina. Se captura el puntero para seguirlo fuera de la imagen; se mide en pantalla y
 * `computeResizedWidth` lo convierte a píxeles de la hoja, de modo que el zoom de la hoja no altera el resultado.
 */
let resizeSession: { pointerId: number; startX: number; startWidth: number; startVisualWidth: number; direction: 1 | -1; handle: HTMLElement } | null = null
function startResize(event: PointerEvent, direction: 1 | -1): void {
  const image = imageElement.value
  if (!image || !isEditable.value || event.button !== 0) return
  // Sin esto ProseMirror empezaría a arrastrar el nodo completo.
  event.preventDefault(); event.stopPropagation()
  const startVisualWidth = image.getBoundingClientRect().width
  const startWidth = layout.value.width ?? Math.min(image.naturalWidth || maximumImageWidthPixels, maximumImageWidthPixels)
  const handle = event.currentTarget as HTMLElement
  handle.setPointerCapture(event.pointerId)
  resizeSession = { pointerId: event.pointerId, startX: event.clientX, startWidth, startVisualWidth, direction, handle }
  draftWidth.value = startWidth
}
function moveResize(event: PointerEvent): void {
  if (!resizeSession || event.pointerId !== resizeSession.pointerId) return
  draftWidth.value = computeResizedWidth({
    startWidth: resizeSession.startWidth, startVisualWidth: resizeSession.startVisualWidth, deltaPixels: event.clientX - resizeSession.startX,
    direction: resizeSession.direction, isCentered: layout.value.wrap === 'block' && layout.value.alignment === 'center'
  })
}
function finishResize(event: PointerEvent): void {
  if (!resizeSession || event.pointerId !== resizeSession.pointerId) return
  if (resizeSession.handle.hasPointerCapture(event.pointerId)) resizeSession.handle.releasePointerCapture(event.pointerId)
  const width = draftWidth.value
  resizeSession = null; draftWidth.value = null
  if (width !== null && width !== layout.value.width) props.updateAttributes({ width, height: null })
}
onBeforeUnmount(() => { resizeSession = null })
</script>

<template>
  <NodeViewWrapper
    as="figure"
    class="note-figure"
    :class="['is-align-' + layout.alignment, 'is-' + layout.wrap, { 'is-selected': selected, 'is-resizing': draftWidth !== null }]"
    :data-placeholder="isPlaceholder ? 'true' : undefined"
    @focusin="hasFocusWithin = true"
    @focusout="leaveFocus"
  >
    <div
      v-if="isToolbarVisible"
      class="note-image-toolbar"
      role="toolbar"
      aria-label="Opciones de imagen"
      contenteditable="false"
      data-testid="note-image-toolbar"
    >
      <div
        v-for="block in toolbarGroups"
        :key="block.group"
        class="note-image-toolbar-group"
        role="group"
        :aria-label="noteImageGroupLabels[block.group]"
      >
        <button
          v-for="action in block.actions"
          :key="action.actionId"
          type="button"
          class="note-image-tool"
          :class="{ 'is-text': Boolean(action.shortLabel) }"
          :aria-label="action.label"
          :title="action.label"
          :aria-pressed="action.isActive(layout)"
          @mousedown.prevent
          @click="applyAction(action)"
        >
          <template v-if="action.shortLabel">
            {{ action.shortLabel }}
          </template>
          <component
            :is="action.icon"
            v-else
            :size="16"
            aria-hidden="true"
          />
        </button>
      </div>
      <div
        class="note-image-toolbar-group"
        role="group"
        aria-label="Imagen"
      >
        <button
          type="button"
          class="note-image-tool"
          aria-label="Editar descripción de la imagen"
          title="Editar descripción de la imagen"
          @mousedown.prevent
          @click="focusDescription"
        >
          <TextCursorInput
            :size="16"
            aria-hidden="true"
          />
        </button>
        <HoldButton
          is-icon-only
          size="small"
          aria-label="Quitar imagen"
          @hold="deleteNode()"
        >
          <template #icon>
            <ImageOff
              :size="14"
              aria-hidden="true"
            />
          </template>
        </HoldButton>
      </div>
    </div>
    <div
      class="note-image-frame"
      :style="displayWidth !== null ? { width: displayWidth + 'px' } : undefined"
    >
      <img
        v-if="source && !hasFailed"
        ref="imageElement"
        :src="source"
        :alt="description"
        draggable="false"
        @error="hasFailed = true"
      >
      <div
        v-else
        class="note-image-placeholder"
        role="img"
        :aria-label="'Imagen no disponible' + (description ? ': ' + description : '')"
      >
        <ImageOff
          :size="28"
          aria-hidden="true"
        />
        <strong>Imagen no disponible</strong>
        <span v-if="sourceUrl">{{ sourceUrl }}</span>
        <button
          v-if="sourceUrl && editor.isEditable"
          type="button"
          class="note-image-retry"
          contenteditable="false"
          :disabled="isRetrying"
          @click="retry"
        >
          <RefreshCw
            :size="14"
            aria-hidden="true"
          /> {{ isRetrying ? 'Descargando…' : 'Reintentar' }}
        </button>
        <span
          v-if="retryMessage"
          role="status"
        >{{ retryMessage }}</span>
      </div>
      <!-- Esquinas para redimensionar: sólo con ratón; el teclado usa los tamaños de la barra. -->
      <template v-if="isEditable && selected && !isPlaceholder">
        <span
          class="note-image-handle is-start"
          contenteditable="false"
          aria-hidden="true"
          data-testid="note-image-resize-start"
          @pointerdown="startResize($event, -1)"
          @pointermove="moveResize"
          @pointerup="finishResize"
          @pointercancel="finishResize"
        />
        <span
          class="note-image-handle is-end"
          contenteditable="false"
          aria-hidden="true"
          data-testid="note-image-resize-end"
          @pointerdown="startResize($event, 1)"
          @pointermove="moveResize"
          @pointerup="finishResize"
          @pointercancel="finishResize"
        />
      </template>
    </div>
    <figcaption contenteditable="false">
      <input
        v-if="editor.isEditable"
        ref="descriptionInput"
        class="note-image-description"
        :value="description"
        placeholder="Escribe una descripción de la imagen…"
        aria-label="Descripción de la imagen"
        maxlength="300"
        @input="updateDescription"
        @keydown.stop
      >
      <span v-else>{{ description }}</span>
    </figcaption>
  </NodeViewWrapper>
</template>
