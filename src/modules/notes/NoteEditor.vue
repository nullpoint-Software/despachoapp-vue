<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import type { JSONContent } from '@tiptap/vue-3'
import { createEditorExtensions } from './editorExtensions'
import { isPageLayoutTransaction, letterPage } from './extensions/pageLayout'
import NoteRibbon from './ribbon/NoteRibbon.vue'
import ActionButton from '../../shared/components/ActionButton.vue'
import ContextMenu, { type ContextMenuItem } from '../../shared/components/ContextMenu.vue'
import { NodeSelection } from '@tiptap/pm/state'
import { buildEditorContextItems, findImagePosition } from './noteEditorContextMenu'
import 'katex/dist/katex.min.css'
import './noteEditor.css'

/**
 * Editor de notas LOCAL (pulido 2026-10-03), con aspecto de Word:
 * - **Cinta** tipo Office (`NoteRibbon`) con Warm Tooltips.
 * - **Hojas Carta** separadas con márgenes de 2.5 cm (`PageLayout`); el zoom escala las hojas.
 * - **Vistas:** diseño de impresión, Markdown, dividida y lectura. La fuente Markdown se aplica de forma explícita:
 *   cambiar de vista sin editarla no degrada el documento enriquecido.
 * - **Menú contextual** (2026-10-10, `noteEditorContextMenu.ts`): clic derecho, Shift+F10 o la tecla de menú sobre la
 *   hoja abren formato, insertar, cortar/copiar y, sobre una imagen, sus opciones de tamaño y acomodo.
 * Atajos: Ctrl+S guarda, Ctrl+F abre Revisar → Buscar, Ctrl+Intro inserta un salto de página, Ctrl+rueda hace zoom.
 */
const props = defineProps<{ content: Record<string, unknown> }>()
const emit = defineEmits<{ update: [content: Record<string, unknown>]; save: []; dirty: [] }>()
const mode = ref('visual')
const markdown = ref('')
const isMarkdownDirty = ref(false)
const feedback = ref('')
const zoom = ref('100')
const ribbon = ref<InstanceType<typeof NoteRibbon> | null>(null)
const revision = ref(0)
const viewport = ref<HTMLElement | null>(null)
// Vaciar la fuente antes de que useEditor destruya la instancia mantiene el borrador al navegar.
onBeforeUnmount(() => { applyPendingMarkdown(); resizeObserver?.disconnect() })
/**
 * Zoom automático: mientras la hoja no quepa a lo ancho y la persona no haya elegido un zoom, se ajusta al ancho
 * disponible (como Word en ventanas angostas). Elegir un zoom en la cinta o con Ctrl+rueda lo desactiva.
 */
const isAutoZoom = ref(true)
let resizeObserver: ResizeObserver | null = null
function applyAutoZoom(): void {
  if (!isAutoZoom.value || !viewport.value?.clientWidth) return
  const fitted = Math.max(25, Math.min(100, Math.floor((viewport.value.clientWidth - 32) / letterPage.widthPixels * 100)))
  // Se ignoran diferencias de un punto: redondeos del ancho no deben provocar otro ajuste.
  if (Math.abs(fitted - Number(zoom.value)) > 1 || fitted === 100) zoom.value = String(fitted)
}
onMounted(() => { applyAutoZoom(); if (viewport.value) { resizeObserver = new ResizeObserver(applyAutoZoom); resizeObserver.observe(viewport.value) } })
function chooseZoom(value: string): void { isAutoZoom.value = false; zoom.value = value }
const editor = useEditor({
  injectCSS: false, extensions: createEditorExtensions(), content: props.content as JSONContent,
  editorProps: { attributes: { role: 'textbox', 'aria-label': 'Contenido de la nota', 'aria-multiline': 'true' } },
  onTransaction: () => { revision.value++ },
  // Las normalizaciones que siguen a un redibujo de hojas no son cambios de la persona: no marcan la nota.
  onUpdate: ({ editor: current, transaction }) => {
    if (isPageLayoutTransaction(transaction)) return
    emit('update', current.getJSON())
    if (mode.value !== 'markdown' && !isMarkdownDirty.value) markdown.value = current.getMarkdown()
  }
})
const wordCount = computed(() => { void revision.value; return editor.value?.getText().trim().split(/\s+/).filter(Boolean).length ?? 0 })
const characterCount = computed(() => { void revision.value; return editor.value?.getText().length ?? 0 })
// Hojas = espaciadores de PageLayout + 1. Antes de montar el editor no hay vista que medir.
const pageCount = computed(() => { void revision.value; try { return (editor.value?.view.dom.querySelectorAll(':scope > .note-page-gap').length ?? 0) + 1 } catch { return 1 } })
const isLocked = computed(() => mode.value === 'preview' || isMarkdownDirty.value)
watch(mode, value => {
  applyPendingMarkdown()
  if (value === 'markdown' || value === 'split') markdown.value = editor.value?.getMarkdown() ?? ''
  editor.value?.setEditable(value !== 'preview', false)
})
watch(isMarkdownDirty, isDirty => editor.value?.setEditable(mode.value !== 'preview' && !isDirty, false))
watch(feedback, value => { if (value) setTimeout(() => { if (feedback.value === value) feedback.value = '' }, 6000) })

function applyMarkdown(): void {
  editor.value?.commands.setContent(markdown.value, { contentType: 'markdown' })
  isMarkdownDirty.value = false
  feedback.value = 'Markdown aplicado al documento.'
}
/** Guardar o cambiar de vista incorpora la fuente editada; no guarda silenciosamente una versión anterior. */
function applyPendingMarkdown(): void { if (isMarkdownDirty.value) applyMarkdown() }
defineExpose({ applyPendingMarkdown })
function markMarkdownDirty(): void { isMarkdownDirty.value = true; emit('dirty') }

/** "Una página": que una hoja completa quepa en la altura visible. "Ancho de página": que la hoja llene el ancho. */
async function fitPage(): Promise<void> {
  await nextTick()
  if (viewport.value) chooseZoom(String(Math.max(25, Math.min(200, Math.floor((viewport.value.clientHeight - 48) / letterPage.heightPixels * 100)))))
}
async function fitWidth(): Promise<void> {
  await nextTick()
  if (viewport.value) chooseZoom(String(Math.max(25, Math.min(200, Math.floor((viewport.value.clientWidth - 32) / letterPage.widthPixels * 100)))))
}
function wheelZoom(event: WheelEvent): void {
  if (!event.ctrlKey) return
  event.preventDefault(); chooseZoom(String(Math.max(25, Math.min(200, Number(zoom.value) + (event.deltaY < 0 ? 10 : -10)))))
}
function shortcuts(event: KeyboardEvent): void {
  if (!(event.ctrlKey || event.metaKey)) return
  // Ctrl+Intro: salto de página. Se atiende en captura, antes del salto de línea de StarterKit que usa el mismo atajo.
  if (event.key === 'Enter' && !isLocked.value && editor.value?.view.dom.contains(event.target as Node)) { event.preventDefault(); event.stopPropagation(); editor.value.chain().focus().insertContent([{ type: 'pageBreak' }, { type: 'paragraph' }]).run(); return }
  if (event.key.toLowerCase() === 's') { event.preventDefault(); applyPendingMarkdown(); emit('save') }
  if (event.key.toLowerCase() === 'f') {
    event.preventDefault()
    // Enfoca la búsqueda de la cinta (siempre visible: la cinta es un solo panel), como Ctrl+B / Ctrl+F en Word.
    // Buscar está en la vista "Insertar y revisar" de la cinta: la cinta la abre y enfoca el campo.
    void ribbon.value?.focusSearch()
  }
}

/**
 * Menú contextual de la hoja. La lista se arma al abrir (foto del estado del editor en ese momento): sobre una imagen
 * primero se selecciona ese nodo para que sus acciones y Cortar/Copiar actúen sobre ella.
 * Al cerrar, `ContextMenu` devuelve el foco al editor; "Editar descripción" enfoca su campo después de eso.
 */
const contextMenu = ref<{ x: number; y: number; title: string; items: ContextMenuItem[] } | null>(null)
function openContextMenu(x: number, y: number, imagePosition: number | null): void {
  const current = editor.value
  if (!current) return
  if (imagePosition !== null) current.commands.setNodeSelection(imagePosition)
  contextMenu.value = {
    x, y, title: imagePosition !== null ? 'Imagen' : 'Formato',
    items: buildEditorContextItems({
      editor: current, isLocked: isLocked.value, imagePosition,
      chooseLocalImage: () => { void ribbon.value?.chooseLocalImage() },
      focusImageDescription: position => {
        // Después de que el menú devuelva el foco al editor (al cerrar), no antes.
        setTimeout(() => {
          const figure = current.view.nodeDOM(position)
          const input = figure instanceof HTMLElement ? figure.querySelector<HTMLInputElement>('.note-image-description') : null
          input?.focus(); input?.select()
        }, 0)
      }
    })
  }
}
function openContextMenuFromPointer(event: MouseEvent): void {
  const current = editor.value
  if (!current || !current.view.dom.contains(event.target as Node)) return
  event.preventDefault()
  // Un evento de teclado (Shift+F10) que ya abrió el menú no lo vuelve a abrir.
  if (contextMenu.value) return
  openContextMenu(event.clientX, event.clientY, findImagePosition(current, event.target))
}
/** Shift+F10 o la tecla de menú con el foco en la hoja: el menú aparece junto al cursor (o a la imagen seleccionada). */
function openContextMenuFromKeyboard(event: KeyboardEvent): void {
  const current = editor.value
  if (event.key !== 'ContextMenu' && !(event.key === 'F10' && event.shiftKey)) return
  if (!current || !current.view.dom.contains(event.target as Node)) return
  event.preventDefault()
  const selection = current.state.selection
  const isImageSelected = selection instanceof NodeSelection && selection.node.type.name === 'image'
  const coordinates = current.view.coordsAtPos(selection.from)
  openContextMenu(coordinates.left, coordinates.bottom + 4, isImageSelected ? selection.from : null)
}
</script>
<template>
  <section
    class="note-workbench"
    @keydown.capture="shortcuts"
  >
    <NoteRibbon
      ref="ribbon"
      :editor="editor"
      :revision="revision"
      :mode="mode"
      :zoom="zoom"
      :is-locked="isLocked"
      @update:mode="mode = $event"
      @update:zoom="chooseZoom"
      @fit-page="fitPage"
      @fit-width="fitWidth"
      @feedback="feedback = $event"
    />
    <p
      v-if="feedback"
      class="editor-feedback"
      role="status"
    >
      {{ feedback }}
    </p>
    <div
      class="editor-views"
      :class="{ 'split-view': mode === 'split' }"
    >
      <div
        v-if="mode === 'markdown' || mode === 'split'"
        class="markdown-panel"
      >
        <label for="note-markdown">Contenido en Markdown</label><textarea
          id="note-markdown"
          v-model="markdown"
          spellcheck="false"
          @input="markMarkdownDirty"
        /><p class="field-help">
          Markdown no representa todos los tamaños, alineaciones, colores, imágenes ni saltos de página del documento.
        </p><ActionButton @click="applyMarkdown">
          Aplicar Markdown
        </ActionButton>
      </div>
      <div
        v-show="mode !== 'markdown'"
        ref="viewport"
        class="note-viewport"
        :class="{ 'is-reading': mode === 'preview' }"
        @wheel="wheelZoom"
        @contextmenu="openContextMenuFromPointer"
        @keydown="openContextMenuFromKeyboard"
      >
        <EditorContent
          :editor="editor"
          class="note-paper"
          :style="{ zoom: Number(zoom) / 100 }"
        />
      </div>
    </div>
    <div class="note-status">
      <span>Página{{ pageCount === 1 ? '' : 's' }}: {{ pageCount }} · {{ wordCount }} palabras · {{ characterCount }} caracteres</span><span>Carta · {{ zoom }} % · Guardado local · Ctrl+S</span>
    </div>
    <ContextMenu
      :is-open="Boolean(contextMenu)"
      :x="contextMenu?.x ?? 0"
      :y="contextMenu?.y ?? 0"
      :title="contextMenu?.title ?? ''"
      :items="contextMenu?.items ?? []"
      @close="contextMenu = null"
    />
  </section>
</template>
