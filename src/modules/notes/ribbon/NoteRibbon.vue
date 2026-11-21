<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import type { Editor, JSONContent } from '@tiptap/vue-3'
import { NodeSelection } from '@tiptap/pm/state'
import {
  Bold, Italic, Underline, Strikethrough, Highlighter, Eraser, List, ListOrdered, ListChecks, Quote, AlignLeft, AlignCenter, AlignRight, AlignJustify, Undo2, Redo2,
  Table, ImagePlus, Globe, Link, Sigma, Code, Minus, SeparatorHorizontal, BetweenHorizontalStart, BetweenHorizontalEnd, BetweenVerticalStart, BetweenVerticalEnd,
  TableCellsMerge, TableCellsSplit, PanelTop, PanelLeft, Rows3, Columns3, Trash2, Search, Replace, ReplaceAll, ZoomIn, ZoomOut, FileText, StretchHorizontal, Scaling, TextSelect
} from '@lucide/vue'
import RibbonButton from './RibbonButton.vue'
import ActionButton from '../../../shared/components/ActionButton.vue'
import FormModal from '../../../shared/components/FormModal.vue'
import HoldButton from '../../../shared/vueBits/HoldButton.vue'
import { previewTableRemoval, removeFromTable, type TableRemoval, type TableRemovalPreview } from '../extensions/tableDeletion'
import { tableHeaderStyles, type TableHeaderStyle } from '../extensions/noteNodes'
import { maximumNoteImageBytes } from '../../../../shared/contracts/noteImages'

/**
 * Cinta del editor de notas al estilo de Microsoft Office (pulido 2026-10-03):
 * - **Acceso rápido** (Deshacer, Rehacer) a la izquierda de las pestañas.
 * - **Inicio:** Fuente (estilo, tamaño, negrita…, resaltado, quitar formato) y Párrafo (listas, alineación,
 *   interlineado, cita).
 * - **Insertar:** Tablas, Ilustraciones (imagen del equipo o de internet con descripción), Vínculos, Símbolos y
 *   Páginas (salto de página, separador, código).
 * - **Tabla** (contextual, sólo con el cursor en una tabla): filas y columnas, celdas, encabezados (fila, columna
 *   y estilo) y eliminar, que pregunta qué hacer con el contenido.
 * - **Revisar:** buscar, reemplazar y reemplazar todo. **Vista:** modo, zoom y ajuste de página.
 * Cada botón tiene su nombre en un Warm Tooltip. `revision` cambia con cada transacción del editor para refrescar
 * los botones activos.
 */
const props = defineProps<{ editor: Editor | undefined; revision: number; mode: string; zoom: string; isLocked: boolean }>()
const emit = defineEmits<{ 'update:mode': [value: string]; 'update:zoom': [value: string]; fitPage: []; fitWidth: []; feedback: [message: string] }>()
/**
 * Una sola cinta (2026-10-05, pedido del usuario: sin pestañas y sin espacios vacíos): todos los grupos (Fuente,
 * Párrafo, Estilos, Insertar, Buscar, Vista) en un panel que se acomoda en filas; los grupos de Tabla aparecen sólo con
 * el cursor dentro de una tabla, resaltados como contextuales.
 */
const isInTable = computed(() => { void props.revision; return props.editor?.isActive('table') ?? false })
/**
 * Dos vistas (2026-10-06, pedido del usuario: "divide esto en 2 vistas para no sobresaturar"):
 * - **Formato:** Fuente, Párrafo y Estilos.
 * - **Insertar y revisar:** Insertar, los grupos de Tabla (sólo con el cursor en una tabla), Buscar y Vista.
 * Deshacer y Rehacer quedan siempre visibles a la izquierda. Con el cursor en una tabla, la pestaña "Insertar y
 * revisar" muestra la marca "Tabla" para avisar dónde están sus herramientas (no cambia de vista sola, para no
 * interrumpir a quien da formato dentro de una celda). El cambio de vista se anima (fundido y desplazamiento corto).
 */
type RibbonView = 'format' | 'insert'
const view = ref<RibbonView>('format')
/** Ctrl+F (NoteEditor): abre la vista con Buscar y enfoca el campo. */
async function focusSearch(): Promise<void> {
  view.value = 'insert'
  await nextTick()
  document.querySelector<HTMLInputElement>('input[aria-label="Buscar en la nota"]')?.focus()
}
/**
 * "Imagen del equipo" desde el menú contextual del editor (2026-10-10): abre la vista Insertar (donde vive el campo de
 * archivo) y lo abre, así la validación y la inserción son las mismas del botón de la cinta. Se llama dentro del clic
 * de la persona, de modo que el selector de archivos conserva la activación de usuario.
 */
async function chooseLocalImage(): Promise<void> {
  view.value = 'insert'
  await nextTick()
  imageInput.value?.click()
}
defineExpose({ focusSearch, chooseLocalImage })
const isActive = (name: string, attributes?: Record<string, unknown>) => { void props.revision; return props.editor?.isActive(name, attributes) ?? false }
const chain = () => props.editor!.chain().focus()
/**
 * Inserta bloques (imagen, salto de página) con un párrafo vacío después para seguir escribiendo. Si hay un bloque
 * seleccionado (por ejemplo, la imagen recién insertada), se inserta después de él en lugar de reemplazarlo.
 */
function insertBlocks(blocks: JSONContent[]): void {
  const selection = props.editor!.state.selection
  const content = [...blocks, { type: 'paragraph' }]
  if (selection instanceof NodeSelection) chain().insertContentAt(selection.to, content).run()
  else chain().insertContent(content).run()
}

// Inicio
const fontSizes = [12, 14, 16, 18, 24, 32]
const marks = [
  { label: 'Negrita', icon: Bold, name: 'bold', shortcut: 'Ctrl+B', run: () => chain().toggleBold().run() },
  { label: 'Cursiva', icon: Italic, name: 'italic', shortcut: 'Ctrl+I', run: () => chain().toggleItalic().run() },
  { label: 'Subrayado', icon: Underline, name: 'underline', shortcut: 'Ctrl+U', run: () => chain().toggleUnderline().run() },
  { label: 'Tachado', icon: Strikethrough, name: 'strike', shortcut: '', run: () => chain().toggleStrike().run() },
  { label: 'Resaltado', icon: Highlighter, name: 'highlight', shortcut: '', run: () => chain().toggleHighlight().run() }
]
const lists = [
  { label: 'Viñetas', icon: List, name: 'bulletList', run: () => chain().toggleBulletList().run() },
  { label: 'Numeración', icon: ListOrdered, name: 'orderedList', run: () => chain().toggleOrderedList().run() },
  { label: 'Lista de tareas', icon: ListChecks, name: 'taskList', run: () => chain().toggleTaskList().run() }
]
const alignments = [
  { key: 'left', label: 'Alinear a la izquierda', icon: AlignLeft }, { key: 'center', label: 'Centrar', icon: AlignCenter },
  { key: 'right', label: 'Alinear a la derecha', icon: AlignRight }, { key: 'justify', label: 'Justificar', icon: AlignJustify }
]
const paragraphStyle = computed(() => { void props.revision; for (const level of [1, 2, 3]) if (props.editor?.isActive('heading', { level })) return String(level); return '0' })
/**
 * Galería de estilos de Inicio (2026-10-04, como Word): cada tarjeta muestra el estilo y lo aplica al párrafo; ocupa el
 * ancho libre de la cinta.
 */
const styleGallery = [{ value: '0', label: 'Normal', sample: 'Texto normal' }, { value: '1', label: 'Título principal', sample: 'Título' }, { value: '2', label: 'Título de sección', sample: 'Sección' }, { value: '3', label: 'Subtítulo', sample: 'Subtítulo' }]
function applyParagraphStyle(value: string): void {
  const level = Number(value)
  if (level === 0) chain().setParagraph().run()
  else chain().setHeading({ level: level as 1 | 2 | 3 }).run()
}

// Insertar
const imageInput = ref<HTMLInputElement | null>(null)
const isImageUrlOpen = ref(false), imageUrl = ref(''), imageDescription = ref(''), isFetchingImage = ref(false)
const link = ref(''), formula = ref('')
function insertLocalImage(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) || file.size > maximumNoteImageBytes) { emit('feedback', 'Elige una imagen PNG, JPEG, WebP o GIF de hasta 2 MB.'); input.value = ''; return }
  const reader = new FileReader()
  reader.onload = () => { if (typeof reader.result === 'string') insertBlocks([{ type: 'image', attrs: { src: reader.result, alt: '' } }]); input.value = '' }
  reader.onerror = () => emit('feedback', 'No se pudo leer la imagen.')
  reader.readAsDataURL(file)
}
/** Descarga por Main e incrusta; si falla, inserta el marcador con la descripción y la dirección para reintentar. */
async function insertImageFromUrl(): Promise<void> {
  if (isFetchingImage.value || !imageUrl.value.trim()) return
  isFetchingImage.value = true
  const url = imageUrl.value.trim(), description = imageDescription.value.trim().slice(0, 300)
  try {
    const result = await window.contapp.fetchNoteImage(url)
    if (result.status === 'downloaded') { insertBlocks([{ type: 'image', attrs: { src: result.dataUrl, alt: description, sourceUrl: url } }]); emit('feedback', 'Imagen descargada e incrustada en la nota.') }
    else {
      insertBlocks([{ type: 'image', attrs: { src: '', alt: description, sourceUrl: url } }])
      emit('feedback', result.reason === 'tooLarge' ? 'La imagen pesa más de 2 MB; quedó el marcador para reintentar.' : result.reason === 'unsupported' ? 'La dirección no es una imagen PNG, JPEG, WebP o GIF; quedó el marcador.' : 'No se pudo descargar la imagen; quedó el marcador para reintentar.')
    }
    imageUrl.value = ''; imageDescription.value = ''; isImageUrlOpen.value = false
  } catch { emit('feedback', 'Escribe una dirección HTTPS válida.') }
  finally { isFetchingImage.value = false }
}
function insertLink(): void {
  if (!/^(https:\/\/[^\s]+|mailto:[^\s@]+@[^\s@]+)$/.test(link.value)) { emit('feedback', 'Escribe un enlace HTTPS o un correo mailto válido.'); return }
  chain().insertContent({ type: 'text', text: link.value, marks: [{ type: 'link', attrs: { href: link.value } }] }).run()
  link.value = ''
}
function insertFormula(): void { if (formula.value.trim()) { chain().insertBlockMath({ latex: formula.value }).run(); formula.value = '' } }

// Tabla
const headerStyleLabels: Record<TableHeaderStyle, string> = { shaded: 'Sombreado', dark: 'Oscuro', plain: 'Sin relleno' }
const headerStyle = computed(() => { void props.revision; return (props.editor?.getAttributes('table').headerStyle as TableHeaderStyle | undefined) ?? 'shaded' })
const pendingRemoval = ref<TableRemovalPreview | null>(null)
const removalLabels: Record<TableRemoval, string> = { row: 'la fila', column: 'la columna', table: 'la tabla' }
/** Vacía: se quita directo. Con contenido: se pregunta si eliminarlo o conservarlo como texto. */
function requestRemoval(removal: TableRemoval): void {
  if (!props.editor) return
  const preview = previewTableRemoval(props.editor, removal)
  if (!preview) return
  if (!preview.filledCellCount) { removeFromTable(props.editor, preview, false); return }
  pendingRemoval.value = preview
}
function confirmRemoval(shouldKeepText: boolean): void {
  if (props.editor && pendingRemoval.value) removeFromTable(props.editor, pendingRemoval.value, shouldKeepText)
  emit('feedback', shouldKeepText ? 'El contenido quedó como texto debajo de la tabla.' : 'Se eliminó con su contenido. Puedes deshacer con Ctrl+Z.')
  pendingRemoval.value = null
}

// Revisar
const searchText = ref(''), replacement = ref('')
function findMatches(): Array<{ from: number; to: number }> {
  const current = props.editor, matches: Array<{ from: number; to: number }> = []
  if (!current || !searchText.value) return matches
  const needle = searchText.value.toLocaleLowerCase()
  current.state.doc.descendants((node, position) => {
    if (!node.isText || !node.text) return
    let offset = node.text.toLocaleLowerCase().indexOf(needle)
    while (offset >= 0) { matches.push({ from: position + offset, to: position + offset + needle.length }); offset = node.text.toLocaleLowerCase().indexOf(needle, offset + needle.length) }
  })
  return matches
}
function findNext(): void {
  const current = props.editor
  if (!current || !searchText.value) return
  const matches = findMatches()
  const match = matches.find(item => item.from >= current.state.selection.to) ?? matches[0]
  if (match) { current.chain().focus().setTextSelection(match).scrollIntoView().run(); emit('feedback', matches.length + ' coincidencias.') }
  else emit('feedback', 'Sin coincidencias.')
}
function replaceCurrent(): void {
  const current = props.editor
  if (!current || !searchText.value) return
  const selected = current.state.doc.textBetween(current.state.selection.from, current.state.selection.to)
  if (selected.toLocaleLowerCase() !== searchText.value.toLocaleLowerCase()) { findNext(); return }
  if (replacement.value) current.chain().focus().insertContent({ type: 'text', text: replacement.value }).run()
  else current.chain().focus().deleteSelection().run()
  findNext()
}
/** Reemplaza de atrás hacia adelante para que las posiciones anteriores sigan siendo válidas. */
function replaceAll(): void {
  const current = props.editor
  if (!current || !searchText.value) return
  const matches = findMatches().reverse()
  if (!matches.length) { emit('feedback', 'Sin coincidencias.'); return }
  let transaction = current.state.tr
  for (const match of matches) transaction = replacement.value ? transaction.insertText(replacement.value, match.from, match.to) : transaction.delete(match.from, match.to)
  current.view.dispatch(transaction)
  emit('feedback', matches.length + ' reemplazos.')
}

// Vista
const zoomLevels = [50, 75, 100, 125, 150, 200]
function stepZoom(delta: number): void { emit('update:zoom', String(Math.max(25, Math.min(200, Number(props.zoom) + delta)))) }
</script>

<template>
  <div class="note-ribbon">
    <div
      class="ribbon-layout"
      role="region"
      aria-label="Cinta de opciones"
    >
      <section
        class="ribbon-group ribbon-quick-access"
        aria-label="Acceso rápido"
      >
        <div class="ribbon-row">
          <RibbonButton
            label="Deshacer"
            shortcut="Ctrl+Z"
            :icon="Undo2"
            :is-disabled="isLocked || (void revision, !editor?.can().undo())"
            @press="chain().undo().run()"
          />
          <RibbonButton
            label="Rehacer"
            shortcut="Ctrl+Y"
            :icon="Redo2"
            :is-disabled="isLocked || (void revision, !editor?.can().redo())"
            @press="chain().redo().run()"
          />
        </div>
        <span class="ribbon-group-label">Deshacer</span>
      </section>
      <div class="ribbon-main">
        <!-- Barra de pestañas a todo el ancho con su línea inferior: separa las pestañas de los grupos. -->
        <div class="ribbon-views-bar">
          <div
            v-sliding-tabs
            class="ribbon-views segmented-tabs"
            role="tablist"
            aria-label="Vistas de la cinta"
          >
            <button
              id="ribbon-tab-format"
              type="button"
              role="tab"
              :aria-selected="view === 'format'"
              aria-controls="ribbon-view-panel"
              @click="view = 'format'"
            >
              Formato
            </button>
            <button
              id="ribbon-tab-insert"
              type="button"
              role="tab"
              :aria-selected="view === 'insert'"
              aria-controls="ribbon-view-panel"
              @click="view = 'insert'"
            >
              Insertar y revisar<span
                v-if="isInTable"
                class="ribbon-view-badge"
              >Tabla</span>
            </button>
          </div>
        </div>
        <Transition
          name="ribbon-view"
          mode="out-in"
        >
          <div
            v-if="view === 'format'"
            id="ribbon-view-panel"
            key="format"
            class="ribbon-panel"
            role="tabpanel"
            aria-labelledby="ribbon-tab-format"
          >
            <section
              class="ribbon-group"
              aria-label="Fuente"
            >
              <div class="ribbon-row">
                <select
                  class="ribbon-select ribbon-select-wide"
                  aria-label="Estilo de párrafo"
                  :value="paragraphStyle"
                  :disabled="isLocked"
                  @change="applyParagraphStyle(($event.target as HTMLSelectElement).value)"
                >
                  <option value="0">
                    Texto normal
                  </option><option value="1">
                    Título principal
                  </option><option value="2">
                    Título de sección
                  </option><option value="3">
                    Subtítulo
                  </option>
                </select>
                <select
                  class="ribbon-select"
                  aria-label="Tamaño de texto"
                  :disabled="isLocked"
                  @change="chain().setFontSize(($event.target as HTMLSelectElement).value).run()"
                >
                  <option
                    v-for="size in fontSizes"
                    :key="size"
                    :value="size + 'px'"
                  >
                    {{ size }}
                  </option>
                </select>
              </div>
              <div class="ribbon-row">
                <RibbonButton
                  v-for="item in marks"
                  :key="item.name"
                  :label="item.label"
                  :shortcut="item.shortcut"
                  :icon="item.icon"
                  :is-active="isActive(item.name)"
                  :is-disabled="isLocked"
                  @press="item.run"
                />
                <RibbonButton
                  label="Quitar formato"
                  :icon="Eraser"
                  :is-disabled="isLocked"
                  @press="chain().unsetAllMarks().clearNodes().run()"
                />
              </div>
              <span class="ribbon-group-label">Fuente</span>
            </section>
            <section
              class="ribbon-group"
              aria-label="Párrafo"
            >
              <div class="ribbon-row">
                <RibbonButton
                  v-for="item in lists"
                  :key="item.name"
                  :label="item.label"
                  :icon="item.icon"
                  :is-active="isActive(item.name)"
                  :is-disabled="isLocked"
                  @press="item.run"
                />
                <RibbonButton
                  label="Cita"
                  :icon="Quote"
                  :is-active="isActive('blockquote')"
                  :is-disabled="isLocked"
                  @press="chain().toggleBlockquote().run()"
                />
              </div>
              <div class="ribbon-row">
                <RibbonButton
                  v-for="item in alignments"
                  :key="item.key"
                  :label="item.label"
                  :icon="item.icon"
                  :is-active="isActive('paragraph', { textAlign: item.key }) || isActive('heading', { textAlign: item.key })"
                  :is-disabled="isLocked"
                  @press="chain().setTextAlign(item.key).run()"
                />
                <select
                  class="ribbon-select"
                  aria-label="Interlineado"
                  :disabled="isLocked"
                  @change="chain().setLineHeight(($event.target as HTMLSelectElement).value).run()"
                >
                  <option
                    v-for="spacing in ['1', '1.15', '1.5', '2']"
                    :key="spacing"
                    :value="spacing"
                  >
                    {{ spacing }}
                  </option>
                </select>
              </div>
              <span class="ribbon-group-label">Párrafo</span>
            </section>
            <section
              class="ribbon-group ribbon-styles"
              aria-label="Estilos"
            >
              <div
                class="ribbon-style-gallery"
                role="group"
                aria-label="Estilos de párrafo"
              >
                <button
                  v-for="style in styleGallery"
                  :key="style.value"
                  type="button"
                  class="ribbon-style"
                  :class="'style-level-' + style.value"
                  :aria-pressed="paragraphStyle === style.value"
                  :aria-label="'Estilo ' + style.label"
                  :disabled="isLocked"
                  @click="applyParagraphStyle(style.value)"
                >
                  <span class="ribbon-style-sample">{{ style.sample }}</span>
                  <span class="ribbon-style-name">{{ style.label }}</span>
                </button>
              </div>
              <span class="ribbon-group-label">Estilos</span>
            </section>
          </div>
          <div
            v-else
            id="ribbon-view-panel"
            key="insert"
            class="ribbon-panel"
            role="tabpanel"
            aria-labelledby="ribbon-tab-insert"
          >
            <!-- Insertar en un solo grupo de dos renglones (2026-10-05): botones compactos arriba y los campos de enlace y
           fórmula abajo, para que la cinta de un solo panel no crezca en altura. -->
            <section
              class="ribbon-group"
              aria-label="Insertar"
            >
              <div class="ribbon-row">
                <RibbonButton
                  label="Tabla"
                  :icon="Table"
                  :is-disabled="isLocked"
                  @press="chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()"
                />
                <RibbonButton
                  label="Imagen del equipo"
                  :icon="ImagePlus"
                  :is-disabled="isLocked"
                  @press="imageInput?.click()"
                />
                <RibbonButton
                  label="Imagen de internet"
                  :icon="Globe"
                  :is-active="isImageUrlOpen"
                  :is-disabled="isLocked"
                  @press="isImageUrlOpen = !isImageUrlOpen"
                />
                <input
                  ref="imageInput"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  class="sr-only"
                  aria-label="Elegir imagen del equipo"
                  @change="insertLocalImage"
                >
                <RibbonButton
                  label="Salto de página"
                  shortcut="Ctrl+Intro"
                  :icon="SeparatorHorizontal"
                  :is-disabled="isLocked"
                  @press="insertBlocks([{ type: 'pageBreak' }])"
                />
                <RibbonButton
                  label="Línea separadora"
                  :icon="Minus"
                  :is-disabled="isLocked"
                  @press="chain().setHorizontalRule().run()"
                />
                <RibbonButton
                  label="Bloque de código"
                  :icon="Code"
                  :is-active="isActive('codeBlock')"
                  :is-disabled="isLocked"
                  @press="chain().toggleCodeBlock().run()"
                />
              </div>
              <div class="ribbon-row">
                <input
                  v-model="link"
                  class="ribbon-input ribbon-input-compact"
                  aria-label="Dirección del enlace"
                  placeholder="https://"
                  :disabled="isLocked"
                  @keydown.enter.prevent="insertLink"
                >
                <RibbonButton
                  label="Insertar enlace"
                  :icon="Link"
                  :is-disabled="isLocked || !link"
                  @press="insertLink"
                />
                <input
                  v-model="formula"
                  class="ribbon-input ribbon-input-compact"
                  aria-label="Fórmula LaTeX"
                  placeholder="Fórmula LaTeX"
                  :disabled="isLocked"
                  @keydown.enter.prevent="insertFormula"
                >
                <RibbonButton
                  label="Insertar fórmula"
                  :icon="Sigma"
                  :is-disabled="isLocked || !formula.trim()"
                  @press="insertFormula"
                />
              </div>
              <span class="ribbon-group-label">Insertar</span>
            </section>

            <template v-if="isInTable">
              <section
                class="ribbon-group is-contextual"
                aria-label="Filas y columnas"
              >
                <div class="ribbon-row">
                  <RibbonButton
                    label="Insertar fila arriba"
                    :icon="BetweenHorizontalStart"
                    @press="chain().addRowBefore().run()"
                  />
                  <RibbonButton
                    label="Insertar fila abajo"
                    :icon="BetweenHorizontalEnd"
                    @press="chain().addRowAfter().run()"
                  />
                  <RibbonButton
                    label="Insertar columna a la izquierda"
                    :icon="BetweenVerticalStart"
                    @press="chain().addColumnBefore().run()"
                  />
                  <RibbonButton
                    label="Insertar columna a la derecha"
                    :icon="BetweenVerticalEnd"
                    @press="chain().addColumnAfter().run()"
                  />
                </div>
                <span class="ribbon-group-label">Filas y columnas</span>
              </section>
              <section
                class="ribbon-group is-contextual"
                aria-label="Celdas"
              >
                <div class="ribbon-row">
                  <RibbonButton
                    label="Combinar celdas"
                    :icon="TableCellsMerge"
                    @press="chain().mergeCells().run()"
                  />
                  <RibbonButton
                    label="Dividir celda"
                    :icon="TableCellsSplit"
                    @press="chain().splitCell().run()"
                  />
                </div>
                <span class="ribbon-group-label">Celdas</span>
              </section>
              <section
                class="ribbon-group is-contextual"
                aria-label="Encabezados"
              >
                <div class="ribbon-row">
                  <RibbonButton
                    label="Fila de encabezado"
                    :icon="PanelTop"
                    @press="chain().toggleHeaderRow().run()"
                  />
                  <RibbonButton
                    label="Columna de encabezado"
                    :icon="PanelLeft"
                    @press="chain().toggleHeaderColumn().run()"
                  />
                  <select
                    class="ribbon-select"
                    aria-label="Estilo de encabezado"
                    :value="headerStyle"
                    @change="chain().updateAttributes('table', { headerStyle: ($event.target as HTMLSelectElement).value }).run()"
                  >
                    <option
                      v-for="style in tableHeaderStyles"
                      :key="style"
                      :value="style"
                    >
                      {{ headerStyleLabels[style] }}
                    </option>
                  </select>
                </div>
                <span class="ribbon-group-label">Encabezados</span>
              </section>
              <section
                class="ribbon-group is-contextual"
                aria-label="Eliminar"
              >
                <div class="ribbon-row">
                  <RibbonButton
                    label="Quitar fila"
                    :icon="Rows3"
                    @press="requestRemoval('row')"
                  />
                  <RibbonButton
                    label="Quitar columna"
                    :icon="Columns3"
                    @press="requestRemoval('column')"
                  />
                  <RibbonButton
                    label="Quitar tabla"
                    :icon="Trash2"
                    @press="requestRemoval('table')"
                  />
                </div>
                <span class="ribbon-group-label">Eliminar</span>
              </section>
            </template>

            <section
              class="ribbon-group"
              aria-label="Buscar y reemplazar"
            >
              <div class="ribbon-row">
                <input
                  v-model="searchText"
                  class="ribbon-input"
                  aria-label="Buscar en la nota"
                  placeholder="Buscar"
                  @keydown.enter.prevent="findNext"
                >
                <RibbonButton
                  label="Siguiente coincidencia"
                  shortcut="Intro"
                  :icon="Search"
                  :is-disabled="!searchText"
                  @press="findNext"
                />
              </div>
              <div class="ribbon-row">
                <input
                  v-model="replacement"
                  class="ribbon-input"
                  aria-label="Texto de reemplazo"
                  placeholder="Reemplazar con"
                  :disabled="isLocked"
                >
                <RibbonButton
                  label="Reemplazar"
                  :icon="Replace"
                  :is-disabled="isLocked || !searchText"
                  @press="replaceCurrent"
                />
                <RibbonButton
                  label="Reemplazar todo"
                  :icon="ReplaceAll"
                  :is-disabled="isLocked || !searchText"
                  @press="replaceAll"
                />
                <RibbonButton
                  label="Seleccionar todo"
                  :icon="TextSelect"
                  @press="chain().selectAll().run()"
                />
              </div>
              <span class="ribbon-group-label">Buscar</span>
            </section>

            <section
              class="ribbon-group"
              aria-label="Vista"
            >
              <div class="ribbon-row">
                <select
                  class="ribbon-select ribbon-select-wide"
                  aria-label="Vista del documento"
                  :value="mode"
                  @change="emit('update:mode', ($event.target as HTMLSelectElement).value)"
                >
                  <option value="visual">
                    Diseño de impresión
                  </option><option value="markdown">
                    Markdown
                  </option><option value="split">
                    Vista dividida
                  </option><option value="preview">
                    Vista de lectura
                  </option>
                </select>
              </div>
              <div class="ribbon-row">
                <RibbonButton
                  label="Alejar"
                  :icon="ZoomOut"
                  @press="stepZoom(-10)"
                />
                <select
                  class="ribbon-select"
                  aria-label="Zoom del documento"
                  :value="zoom"
                  @change="emit('update:zoom', ($event.target as HTMLSelectElement).value)"
                >
                  <option
                    v-if="!zoomLevels.includes(Number(zoom))"
                    :value="zoom"
                  >
                    {{ zoom }}%
                  </option>
                  <option
                    v-for="level in zoomLevels"
                    :key="level"
                    :value="String(level)"
                  >
                    {{ level }}%
                  </option>
                </select>
                <RibbonButton
                  label="Acercar"
                  :icon="ZoomIn"
                  @press="stepZoom(10)"
                />
                <RibbonButton
                  label="Una página"
                  :icon="FileText"
                  @press="emit('fitPage')"
                />
                <RibbonButton
                  label="Ancho de página"
                  :icon="StretchHorizontal"
                  @press="emit('fitWidth')"
                />
                <RibbonButton
                  label="100 %"
                  :icon="Scaling"
                  @press="emit('update:zoom', '100')"
                />
              </div>
              <span class="ribbon-group-label">Vista</span>
            </section>
          </div>
        </Transition>
      </div>
    </div>

    <form
      v-if="isImageUrlOpen"
      class="ribbon-drawer"
      aria-label="Imagen de internet"
      @submit.prevent="insertImageFromUrl"
    >
      <input
        v-model="imageUrl"
        class="ribbon-input ribbon-input-wide"
        aria-label="Dirección de la imagen"
        placeholder="https://…/imagen.png"
        inputmode="url"
      >
      <input
        v-model="imageDescription"
        class="ribbon-input ribbon-input-wide"
        aria-label="Descripción de la imagen de internet"
        placeholder="Descripción (se muestra debajo y si la imagen no carga)"
        maxlength="300"
      >
      <ActionButton
        type="submit"
        variant="primary"
        :is-loading="isFetchingImage"
        :disabled="!imageUrl.trim()"
      >
        Descargar e insertar
      </ActionButton>
      <span class="field-help">Sólo HTTPS; PNG, JPEG, WebP o GIF de hasta 2 MB. Se guarda dentro de la nota.</span>
    </form>

    <FormModal
      :is-open="pendingRemoval !== null"
      :title="pendingRemoval ? 'Quitar ' + removalLabels[pendingRemoval.removal] : 'Quitar'"
      :description="pendingRemoval ? pendingRemoval.filledCellCount + ' celda(s) tienen contenido. ¿Qué hacemos con él?' : ''"
      test-id="table-removal-modal"
      @close="pendingRemoval = null"
    >
      <div class="table-removal">
        <blockquote
          v-if="pendingRemoval"
          class="table-removal-preview"
        >
          <p
            v-for="(line, index) in pendingRemoval.lines.slice(0, 5)"
            :key="index"
          >
            {{ line }}
          </p>
          <p v-if="pendingRemoval.lines.length > 5">
            … y {{ pendingRemoval.lines.length - 5 }} renglón(es) más
          </p>
        </blockquote>
        <div class="actions form-footer">
          <ActionButton
            variant="primary"
            @click="confirmRemoval(true)"
          >
            Conservar como texto y quitar
          </ActionButton>
          <HoldButton
            done-label="Eliminado"
            @hold="confirmRemoval(false)"
          >
            Eliminar con su contenido
          </HoldButton>
          <ActionButton @click="pendingRemoval = null">
            Cancelar
          </ActionButton>
        </div>
      </div>
    </FormModal>
  </div>
</template>
