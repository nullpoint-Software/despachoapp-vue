<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useEditor, EditorContent, type JSONContent } from '@tiptap/vue-3'
import { NodeSelection, TextSelection } from '@tiptap/pm/state'
import { Sparkles, Bold, Italic, Underline, Strikethrough, Heading2, Heading3, List, ListOrdered, Quote, AlignLeft, AlignCenter, AlignRight, Link, Unlink, Minus, ImagePlus, Undo2, Redo2, ArrowUp, ArrowDown, RemoveFormatting } from '@lucide/vue'
import RibbonButton from '../notes/ribbon/RibbonButton.vue'
import ActionButton from '../../shared/components/ActionButton.vue'
import { createMailEditorExtensions, placeholderDragHtml } from './mailEditorExtensions'
import { formatMailHtml } from './formatMailHtml'
import { fitsSimpleEditor, renderMailPreview } from './mailHtmlView'
import { sanitizeMailHtml } from '../../../shared/mail/sanitizeMailHtml'
import MailAiPromptDialog from './MailAiPromptDialog.vue'
import type { MailAiPurpose } from './buildMailAiPrompt'
import { mailFontSizes, mailPlaceholders, parseMailDocument, renderMailDocumentHtml, type MailDocument, type MailPlaceholder } from '../../../shared/mail/mailDocument'

/**
 * Editor HTML del cuerpo y la firma del correo ([[MAIL]]; referencia: el editor de Notas, TipTap). Barra compacta con
 * formato de texto, color y tamaño de letra, títulos, listas, cita, alineación, enlaces, línea, logo del despacho,
 * subir/bajar el bloque actual y deshacer (2026-10-19: color, tamaño y mover bloques, pedido del usuario).
 * - `v-model` es el `MailDocument` ya validado: cada cambio pasa por `parseMailDocument`; si un cambio lo vuelve
 *   inválido (por ejemplo, demasiado largo para una plantilla) se conserva el último válido y se avisa.
 * - `isTemplate` muestra la paleta de marcadores: chips (Cliente,
 *   Documento, Despacho) que se arrastran al texto o se insertan con clic (2026-10-18).
 * - **Vista HTML** (2026-10-18, pedido del usuario: "poder poner html y que se acomode solo, mostrando la vista previa"):
 *   código a la izquierda y vista previa a la derecha, 300 ms después de dejar de teclear. Si el código sólo usa lo que
 *   el editor sencillo representa, se lee con su esquema; si trae tablas, `div`, colores o estilos en línea
 *   (`fitsSimpleEditor`), se guarda completo como bloque «HTML con estilo», saneado por `sanitizeMailHtml`. Al salir del
 *   campo el código se vuelve a acomodar (`formatMailHtml`). La vista previa es el mismo HTML que arma el correo, con los
 *   estilos aplicados por CSSOM (`applyMailStyles`) porque la ventana bloquea `style` en línea.
 * - El HTML del correo no se arma aquí: lo arma Main desde el documento (estilos en línea y saneado por construcción).
 */
/** `purpose`: si es cuerpo o firma, para el «Prompt para IA» de la vista HTML. */
const props = withDefaults(defineProps<{ label: string; logoDataUrl?: string | null; isTemplate?: boolean; isDisabled?: boolean; purpose?: MailAiPurpose }>(), { logoDataUrl: null, isTemplate: false, isDisabled: false, purpose: 'body' })
const isAiPromptOpen = ref(false)
const model = defineModel<MailDocument>({ required: true })
const feedback = ref('')
const revision = ref(0)
let lastEmitted = JSON.stringify(model.value)

const editor = useEditor({
  injectCSS: false, editable: !props.isDisabled, content: model.value as JSONContent,
  extensions: createMailEditorExtensions(() => props.logoDataUrl),
  editorProps: { attributes: { role: 'textbox', 'aria-label': props.label, 'aria-multiline': 'true', class: 'mail-editor-content' } },
  onTransaction: () => { revision.value++ },
  onUpdate: ({ editor: current }) => {
    try {
      const document = parseMailDocument(current.getJSON())
      feedback.value = ''
      lastEmitted = JSON.stringify(document)
      model.value = document
    } catch { feedback.value = 'El contenido es demasiado grande o no se puede enviar así. Deshaz el último cambio.' }
  }
})
// Un documento que llega de fuera (plantilla, otro cliente) reemplaza el contenido sin volver a emitirlo.
watch(model, value => { const serialized = JSON.stringify(value); if (serialized !== lastEmitted) { lastEmitted = serialized; editor.value?.commands.setContent(value as JSONContent, { emitUpdate: false }) } })
watch(() => props.isDisabled, value => editor.value?.setEditable(!value, false))
// Volver a dibujar el logo cuando llega la identidad del despacho.
watch(() => props.logoDataUrl, () => { const current = editor.value; if (current) current.commands.setContent(current.getJSON(), { emitUpdate: false }) })

const isActive = (name: string, attributes?: Record<string, unknown>) => { void revision.value; return editor.value?.isActive(name, attributes) ?? false }
const chain = () => editor.value!.chain().focus()
const marks = [
  { label: 'Negrita', icon: Bold, name: 'bold', shortcut: 'Ctrl+B', run: () => chain().toggleBold().run() },
  { label: 'Cursiva', icon: Italic, name: 'italic', shortcut: 'Ctrl+I', run: () => chain().toggleItalic().run() },
  { label: 'Subrayado', icon: Underline, name: 'underline', shortcut: 'Ctrl+U', run: () => chain().toggleUnderline().run() },
  { label: 'Tachado', icon: Strikethrough, name: 'strike', shortcut: '', run: () => chain().toggleStrike().run() }
]
const blocks = [
  { label: 'Título', icon: Heading2, name: 'heading', attributes: { level: 2 }, run: () => chain().toggleHeading({ level: 2 }).run() },
  { label: 'Subtítulo', icon: Heading3, name: 'heading', attributes: { level: 3 }, run: () => chain().toggleHeading({ level: 3 }).run() },
  { label: 'Viñetas', icon: List, name: 'bulletList', attributes: undefined, run: () => chain().toggleBulletList().run() },
  { label: 'Numeración', icon: ListOrdered, name: 'orderedList', attributes: undefined, run: () => chain().toggleOrderedList().run() },
  { label: 'Cita', icon: Quote, name: 'blockquote', attributes: undefined, run: () => chain().toggleBlockquote().run() }
]
const alignments = [{ key: 'left', label: 'Alinear a la izquierda', icon: AlignLeft }, { key: 'center', label: 'Centrar', icon: AlignCenter }, { key: 'right', label: 'Alinear a la derecha', icon: AlignRight }]

/** Enlace: se escribe en una fila bajo la barra; sólo https o correo (mailto), como acepta el contrato. */
const isLinkOpen = ref(false), linkDraft = ref('')
function openLink(): void { linkDraft.value = String(editor.value?.getAttributes('link').href ?? ''); isLinkOpen.value = true }
function applyLink(): void {
  let href = linkDraft.value.trim()
  if (href && !/^(https?:\/\/|mailto:)/i.test(href)) href = href.includes('@') ? 'mailto:' + href : 'https://' + href
  if (!href) chain().extendMarkRange('link').unsetLink().run()
  else if (!/^(https?:\/\/[^\s<>"]+|mailto:[^\s<>"]+)$/i.test(href)) { feedback.value = 'Escribe una dirección web (https://…) o un correo.'; return }
  else chain().extendMarkRange('link').setLink({ href }).run()
  isLinkOpen.value = false; feedback.value = ''
}
/**
 * Color y tamaño de letra (2026-10-19) sobre la selección: marca `textStyle`. Se combinan con lo que ya tenga la
 * selección; sin color ni tamaño se quita la marca. `null` en un campo lo quita.
 */
const textStyle = computed(() => { void revision.value; return (editor.value?.getAttributes('textStyle') ?? {}) as { color?: string | null; fontSize?: string | null } })
function applyTextStyle(change: { color?: string | null; fontSize?: string | null }): void {
  const next = { color: textStyle.value.color ?? null, fontSize: textStyle.value.fontSize ?? null, ...change }
  if (!next.color && !next.fontSize) chain().unsetMark('textStyle').run()
  else chain().setMark('textStyle', next).run()
}

/**
 * Mover el bloque donde está el cursor (párrafo, lista, logo, «HTML con estilo»…) una posición arriba o abajo
 * (2026-10-19, "mover componentes a voluntad"). Opera sobre los bloques de primer nivel de la hoja y deja seleccionado
 * lo movido. El logo y el bloque con estilo también se arrastran con el mouse.
 */
function moveBlock(direction: -1 | 1): void {
  const current = editor.value
  if (!current) return
  const { state } = current
  const index = state.selection.$from.index(0), target = index + direction
  if (target < 0 || target >= state.doc.childCount) return
  const node = state.doc.child(index), sibling = state.doc.child(target)
  let start = 0
  for (let position = 0; position < index; position++) start += state.doc.child(position).nodeSize
  const destination = direction < 0 ? start - sibling.nodeSize : start + sibling.nodeSize
  const transaction = state.tr.delete(start, start + node.nodeSize).insert(destination, node)
  transaction.setSelection(node.isAtom ? NodeSelection.create(transaction.doc, destination) : TextSelection.near(transaction.doc.resolve(destination + 1)))
  current.view.dispatch(transaction.scrollIntoView())
  current.commands.focus()
}
const blockPosition = computed(() => { void revision.value; const current = editor.value; return current ? { index: current.state.selection.$from.index(0), count: current.state.doc.childCount } : { index: 0, count: 0 } })

function insertLogo(): void { chain().insertContent([{ type: 'officeLogo' }, { type: 'paragraph' }]).run() }
function insertPlaceholder(key: MailPlaceholder): void { chain().insertContent({ type: 'placeholder', attrs: { name: key } }).run() }
/** Arrastre desde la paleta: ProseMirror lee este HTML al soltar y crea el chip donde cae. */
function dragPlaceholder(event: DragEvent, key: MailPlaceholder): void {
  event.dataTransfer?.setData('text/html', placeholderDragHtml(key))
  event.dataTransfer?.setData('text/plain', '{' + key + '}')
}

/** Vista HTML: código editable y vista previa del documento vigente. */
type EditorView = 'visual' | 'html'
const view = ref<EditorView>('visual')
const htmlSource = ref('')
let sourceTimer: ReturnType<typeof setTimeout> | undefined
/**
 * Con un bloque con estilo, el código es el HTML del correo (estilos incluidos); si no, el del editor sencillo. Se lee
 * el estado del editor, no `model`: tras cargar el código, el modelo del padre se actualiza en el siguiente ciclo.
 */
function readSource(): string {
  const current = editor.value
  if (!current) return ''
  const json = current.getJSON()
  if (!json.content?.some(node => node.type === 'html')) return formatMailHtml(current.getHTML())
  try { return formatMailHtml(renderMailDocumentHtml(parseMailDocument(json), { officeLogoSource: null, keepsLogoMarker: true })) } catch { return htmlSource.value }
}
/** Lleva el código al editor: tal cual si cabe en el editor sencillo; si no, como un bloque «HTML con estilo» saneado. */
function loadSource(pasted: string): void {
  const current = editor.value
  if (!current) return
  // Lo que devuelve una IA suele venir en un bloque de código Markdown (```html … ```): se quitan las marcas.
  const source = pasted.replace(/^\s*```[a-z]*\s*\n?/i, '').replace(/\n?\s*```\s*$/, '')
  if (fitsSimpleEditor(source)) { current.commands.setContent(source, { emitUpdate: true }); return }
  const html = sanitizeMailHtml(source)
  current.commands.setContent(html ? { type: 'doc', content: [{ type: 'html', attrs: { html } }] } : { type: 'doc', content: [{ type: 'paragraph' }] }, { emitUpdate: true })
}
function showView(value: EditorView): void { if (value === 'html') htmlSource.value = readSource(); view.value = value }
function applySource(): void { clearTimeout(sourceTimer); sourceTimer = setTimeout(() => loadSource(htmlSource.value), 300) }
function tidySource(): void { clearTimeout(sourceTimer); loadSource(htmlSource.value); htmlSource.value = readSource() }
onBeforeUnmount(() => clearTimeout(sourceTimer))
const previewHtml = computed(() => renderMailDocumentHtml(model.value, { officeLogoSource: props.logoDataUrl, hasInlineStyles: false }))
const preview = ref<HTMLElement | null>(null)
// La vista previa va en un shadow root (sin los estilos de la app); sus estilos se aplican por CSSOM.
watch([previewHtml, preview], () => { void nextTick(() => { if (preview.value) renderMailPreview(preview.value, previewHtml.value) }) }, { flush: 'post' })
</script>

<template>
  <div
    class="mail-editor"
    :class="{ 'is-disabled': isDisabled }"
  >
    <p
      class="mail-editor-title"
      aria-hidden="true"
    >
      {{ label }}
    </p>
    <div
      v-sliding-tabs
      class="segmented-tabs mail-editor-views"
      role="tablist"
      :aria-label="'Vista de ' + label.toLocaleLowerCase('es-MX')"
    >
      <button
        type="button"
        role="tab"
        :aria-selected="view === 'visual'"
        @click="showView('visual')"
      >
        Editor
      </button>
      <button
        type="button"
        role="tab"
        :aria-selected="view === 'html'"
        @click="showView('html')"
      >
        HTML y vista previa
      </button>
    </div>
    <div
      v-show="view === 'visual'"
      class="mail-editor-toolbar"
      role="toolbar"
      :aria-label="'Formato de ' + label.toLocaleLowerCase('es-MX')"
    >
      <RibbonButton
        label="Deshacer"
        :icon="Undo2"
        shortcut="Ctrl+Z"
        :is-disabled="isDisabled"
        @press="chain().undo().run()"
      />
      <RibbonButton
        label="Rehacer"
        :icon="Redo2"
        shortcut="Ctrl+Y"
        :is-disabled="isDisabled"
        @press="chain().redo().run()"
      />
      <span
        class="mail-editor-separator"
        aria-hidden="true"
      />
      <RibbonButton
        v-for="mark in marks"
        :key="mark.name"
        :label="mark.label"
        :icon="mark.icon"
        :shortcut="mark.shortcut"
        :is-active="isActive(mark.name)"
        :is-disabled="isDisabled"
        @press="mark.run"
      />
      <span class="mail-editor-color">
        <input
          type="color"
          title="Color del texto"
          aria-label="Color del texto"
          :value="textStyle.color ?? '#1a1a1a'"
          :disabled="isDisabled"
          @change="applyTextStyle({ color: ($event.target as HTMLInputElement).value })"
        >
      </span>
      <span class="mail-editor-size">
        <select
          title="Tamaño de letra"
          aria-label="Tamaño de letra"
          :value="textStyle.fontSize ?? ''"
          :disabled="isDisabled"
          @change="applyTextStyle({ fontSize: ($event.target as HTMLSelectElement).value || null })"
        >
          <option value="">
            Tamaño
          </option>
          <option
            v-for="size in mailFontSizes"
            :key="size"
            :value="size"
          >
            {{ size.replace('px', '') }}
          </option>
        </select>
      </span>
      <RibbonButton
        label="Quitar color y tamaño"
        :icon="RemoveFormatting"
        :is-disabled="isDisabled || (!textStyle.color && !textStyle.fontSize)"
        @press="chain().unsetMark('textStyle').run()"
      />
      <span
        class="mail-editor-separator"
        aria-hidden="true"
      />
      <RibbonButton
        v-for="block in blocks"
        :key="block.label"
        :label="block.label"
        :icon="block.icon"
        :is-active="isActive(block.name, block.attributes)"
        :is-disabled="isDisabled"
        @press="block.run"
      />
      <span
        class="mail-editor-separator"
        aria-hidden="true"
      />
      <RibbonButton
        v-for="alignment in alignments"
        :key="alignment.key"
        :label="alignment.label"
        :icon="alignment.icon"
        :is-active="isActive('paragraph', { textAlign: alignment.key }) || isActive('heading', { textAlign: alignment.key })"
        :is-disabled="isDisabled"
        @press="chain().setTextAlign(alignment.key).run()"
      />
      <span
        class="mail-editor-separator"
        aria-hidden="true"
      />
      <RibbonButton
        label="Enlace"
        :icon="Link"
        :is-active="isActive('link')"
        :is-disabled="isDisabled"
        @press="openLink"
      />
      <RibbonButton
        label="Quitar enlace"
        :icon="Unlink"
        :is-disabled="isDisabled || !isActive('link')"
        @press="chain().extendMarkRange('link').unsetLink().run()"
      />
      <RibbonButton
        label="Línea horizontal"
        :icon="Minus"
        :is-disabled="isDisabled"
        @press="chain().setHorizontalRule().run()"
      />
      <RibbonButton
        label="Logo del despacho"
        :icon="ImagePlus"
        :is-disabled="isDisabled"
        @press="insertLogo"
      />
      <span
        class="mail-editor-separator"
        aria-hidden="true"
      />
      <RibbonButton
        label="Subir bloque"
        :icon="ArrowUp"
        :is-disabled="isDisabled || blockPosition.index <= 0"
        @press="moveBlock(-1)"
      />
      <RibbonButton
        label="Bajar bloque"
        :icon="ArrowDown"
        :is-disabled="isDisabled || blockPosition.index >= blockPosition.count - 1"
        @press="moveBlock(1)"
      />
    </div>
    <div
      v-if="isTemplate && !isDisabled && view === 'visual'"
      class="mail-editor-placeholders"
    >
      <span>Arrastra al texto o haz clic:</span>
      <button
        v-for="(chipLabel, key) in mailPlaceholders"
        :key="key"
        type="button"
        class="mail-placeholder-chip is-palette"
        draggable="true"
        :aria-label="'Insertar marcador ' + chipLabel"
        @mousedown.prevent
        @click="insertPlaceholder(key)"
        @dragstart="dragPlaceholder($event, key)"
      >
        {{ chipLabel }}
      </button>
    </div>
    <form
      v-if="isLinkOpen && view === 'visual'"
      class="mail-editor-link"
      @submit.prevent="applyLink"
    >
      <label
        class="sr-only"
        :for="'mail-link-' + label"
      >Dirección del enlace</label>
      <input
        :id="'mail-link-' + label"
        v-model="linkDraft"
        type="text"
        placeholder="https://… o nombre@dominio.com"
        spellcheck="false"
      >
      <ActionButton
        type="submit"
        variant="primary"
      >
        Aplicar
      </ActionButton>
      <ActionButton @click="isLinkOpen = false">
        Cancelar
      </ActionButton>
    </form>
    <p
      v-if="feedback"
      class="field-help tone-error"
      role="status"
    >
      {{ feedback }}
    </p>
    <EditorContent
      v-show="view === 'visual'"
      :editor="editor"
      class="mail-editor-paper"
    />
    <div
      v-if="view === 'html' && !isDisabled"
      class="mail-editor-ai"
    >
      <ActionButton @click="isAiPromptOpen = true">
        <Sparkles
          :size="16"
          aria-hidden="true"
        /> Prompt para IA
      </ActionButton>
      <span class="field-help">Arma un prompt para que una IA diseñe {{ purpose === 'signature' ? 'la firma' : 'el cuerpo' }}; pega aquí el HTML que te devuelva.</span>
    </div>
    <MailAiPromptDialog
      :is-open="isAiPromptOpen"
      :purpose="purpose"
      @close="isAiPromptOpen = false"
    />
    <div
      v-if="view === 'html'"
      class="mail-editor-source"
    >
      <label
        class="sr-only"
        :for="'mail-html-' + label"
      >Código HTML de {{ label.toLocaleLowerCase('es-MX') }}</label>
      <textarea
        :id="'mail-html-' + label"
        v-model="htmlSource"
        spellcheck="false"
        :disabled="isDisabled"
        @input="applySource"
        @blur="tidySource"
      />
      <!-- Vista previa: HTML armado por renderMailDocumentHtml (escapado y del subconjunto validado), sin scripts; se dibuja en un shadow root. -->
      <div
        ref="preview"
        class="mail-editor-paper mail-editor-preview"
        :aria-label="'Vista previa de ' + label.toLocaleLowerCase('es-MX')"
        role="document"
        @click.prevent
      />
    </div>
  </div>
</template>

<style scoped>
.mail-editor { display: grid; border: 2px solid var(--borderColor); background: var(--surfaceColor); min-width: 0; }
.mail-editor-title { margin: 0; padding: 6px 10px; border-bottom: 1px solid var(--hairlineColor); font-family: var(--monoFontFamily); font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--mutedTextColor); }
.mail-editor-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 2px; padding: 4px; border-bottom: 1px solid var(--hairlineColor); }
.mail-editor-separator { width: 1px; height: 22px; margin: 0 4px; background: var(--hairlineColor); }
.mail-editor-color, .mail-editor-size { display: inline-flex; align-items: center; height: 32px; }
.mail-editor-color input { width: 32px; height: 28px; padding: 2px; border: 1px solid var(--hairlineColor); background: transparent; cursor: pointer; }
.mail-editor-size select { height: 28px; padding: 0 6px; border: 1px solid var(--hairlineColor); background: var(--inputColor); color: var(--textColor); font-size: 12px; }
.mail-editor-color input:focus-visible, .mail-editor-size select:focus-visible { outline: 2px solid var(--focusColor); outline-offset: 1px; }
.mail-editor-color input:disabled, .mail-editor-size select:disabled { opacity: .4; cursor: default; }
/* Los botones de la cinta de Notas, sin depender de que el editor de notas haya cargado su hoja de estilos. */
.mail-editor-toolbar :deep(.ribbon-button) { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border: 1px solid transparent; border-radius: 0; background: transparent; color: var(--textColor); cursor: pointer; }
.mail-editor-toolbar :deep(.ribbon-button:hover:not(:disabled)) { background: var(--hoverColor); }
.mail-editor-toolbar :deep(.ribbon-button[aria-pressed="true"]) { background: var(--hoverColor); border-color: var(--strongBorderColor); }
.mail-editor-toolbar :deep(.ribbon-button:focus-visible) { outline: 2px solid var(--focusColor); outline-offset: 1px; }
.mail-editor-toolbar :deep(.ribbon-button:disabled) { opacity: .4; cursor: default; }
.mail-editor-placeholders { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 6px 8px; border-bottom: 1px solid var(--hairlineColor); font-size: 12px; color: var(--mutedTextColor); }
.mail-editor-views { margin: 6px 8px; justify-self: start; }
.mail-editor-ai { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; padding: 0 8px 8px; }
/* Chip de marcador: el mismo aspecto en la paleta y dentro de la hoja; se agarra para arrastrarlo. */
.mail-placeholder-chip, .mail-editor-paper :deep(.mail-placeholder-chip) { display: inline-block; padding: 0 6px; border: 1px solid #9A9A9A; background: #F1F1F1; color: #1A1A1A; font-family: var(--monoFontFamily); font-size: 12px; line-height: 1.6; cursor: grab; user-select: none; }
.mail-placeholder-chip.is-palette { padding: 2px 8px; border-width: 2px; font-size: 12px; }
.mail-placeholder-chip.is-palette:hover { border-color: var(--borderColor); }
.mail-placeholder-chip.is-palette:focus-visible { outline: 2px solid var(--focusColor); outline-offset: 1px; }
.mail-editor-source { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap: 1px; background: var(--hairlineColor); }
.mail-editor-source textarea { min-height: 260px; max-height: 420px; resize: vertical; border: 0; border-radius: 0; padding: 12px; background: var(--surfaceColor); color: var(--textColor); font-family: var(--monoFontFamily); font-size: 12px; line-height: 1.5; white-space: pre-wrap; overflow-wrap: anywhere; overflow-y: auto; }
.mail-editor-source textarea:focus-visible { outline: none; }
.mail-editor-preview { font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.5; }
/* Bloque «HTML con estilo» dentro de la hoja: se ve como saldrá y una línea fina indica dónde editarlo. */
.mail-editor-paper :deep(.mail-html-block) { margin: 0 0 12px; padding: 4px; border: 1px dashed #C4C4C4; }
.mail-editor-paper :deep(.mail-html-caption) { margin: 6px 0 0; font-family: var(--monoFontFamily); font-size: 11px; color: #6B6B6B; }
.mail-editor-link { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 8px; padding: 8px; border-bottom: 1px solid var(--hairlineColor); }
.mail-editor-link input { height: var(--controlHeight); }
.mail-editor > .field-help { margin: 6px 8px 0; }
/* Hoja de vista previa con la tipografía que llevará el correo (Arial, 14 px); papel blanco en ambos temas, como el correo. */
.mail-editor-paper { min-height: 180px; max-height: 420px; overflow-y: auto; padding: 16px 20px; background: #FFFFFF; color: #1A1A1A; }
.mail-editor-paper :deep(.mail-editor-content) { min-height: 150px; outline: none; font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.5; }
/* Sin recuadro ni resaltado azul dentro de la hoja (2026-10-18, pedido del usuario): la selección es gris, como en papel. */
.mail-editor-paper :deep(::selection) { background: #D6D6D6; color: inherit; }
.mail-editor-paper :deep(p) { margin: 0 0 12px; }
.mail-editor-paper :deep(h1) { margin: 0 0 12px; font-size: 22px; font-weight: 700; }
.mail-editor-paper :deep(h2) { margin: 0 0 10px; font-size: 18px; font-weight: 700; }
.mail-editor-paper :deep(h3) { margin: 0 0 8px; font-size: 16px; font-weight: 700; }
.mail-editor-paper :deep(ul), .mail-editor-paper :deep(ol) { margin: 0 0 12px; padding-left: 24px; }
.mail-editor-paper :deep(li p) { margin: 0; }
.mail-editor-paper :deep(blockquote) { margin: 0 0 12px; padding-left: 12px; border-left: 3px solid #CFCFCF; color: #4A4A4A; }
.mail-editor-paper :deep(hr) { border: 0; border-top: 1px solid #D4D4D4; margin: 16px 0; }
.mail-editor-paper :deep(a) { color: #1F3BD6; text-decoration: underline; }
.mail-editor-paper :deep(.mail-office-logo) { display: block; max-width: 180px; height: auto; margin: 0 0 8px; }
.mail-editor-paper :deep(.mail-office-logo.is-missing) { padding: 8px 12px; border: 2px dashed #9A9A9A; font-size: 12px; color: #4A4A4A; }
.mail-editor-paper :deep(.ProseMirror-selectednode) { outline: 2px solid #9A9A9A; }
.mail-editor.is-disabled .mail-editor-paper { opacity: .8; }
</style>
