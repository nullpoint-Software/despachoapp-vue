import { Node, mergeAttributes } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import Image from '@tiptap/extension-image'
import TaskItem from '@tiptap/extension-task-item'
import { Table, TableView } from '@tiptap/extension-table'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import TaskItemView from './TaskItemView.vue'
import NoteImageView from './NoteImageView.vue'
import { noteImageAlignments, noteImageWraps, parseImageAlignment, parseImageWidth, parseImageWrap, type NoteImageAlignment, type NoteImageWrap } from './noteImageLayout'

/** Tarea como tarjeta con Spring Check (pulido 2026-10-03). Se guarda igual que antes (`checked`). */
export const NoteTaskItem = TaskItem.extend({
  addNodeView() { return VueNodeViewRenderer(TaskItemView) }
}).configure({ nested: true })

/**
 * Imagen LOCAL de una nota (pulido 2026-10-03):
 * - sólo se aceptan imágenes incrustadas (`data:` PNG, JPEG, WebP o GIF); nunca se cargan URLs remotas al
 *   abrir la nota: las de internet se descargan una vez por Main (`fetchNoteImage`);
 * - `alt` es la descripción visible bajo la imagen;
 * - `sourceUrl` conserva la dirección original para reintentar si la descarga falló (entonces `src` está vacío
 *   y se ve el marcador "Imagen no disponible").
 * - Tamaño y acomodo (2026-10-10, `noteImageLayout.ts`): `width` en píxeles de la hoja, `align` (izquierda, centro,
 *   derecha) y `wrap` (en su renglón o con texto alrededor). Por omisión son `null`: una nota anterior conserva su
 *   aspecto (centrada, en su renglón, tamaño natural) y su JSON no cambia hasta que se acomoda la imagen. Al leer HTML
 *   (pegar) se validan; un valor desconocido se descarta.
 */
const embeddedImagePattern = /^data:image\/(png|jpeg|webp|gif);base64,/
export const NoteImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      sourceUrl: { default: null, parseHTML: element => element.getAttribute('data-source-url'), renderHTML: attributes => attributes.sourceUrl ? { 'data-source-url': attributes.sourceUrl } : {} },
      width: { default: null, parseHTML: element => parseImageWidth(element.getAttribute('width')), renderHTML: attributes => { const width = parseImageWidth(attributes.width); return width ? { width } : {} } },
      align: {
        default: null,
        parseHTML: element => noteImageAlignments.includes(element.getAttribute('data-align') as NoteImageAlignment) ? element.getAttribute('data-align') : null,
        renderHTML: attributes => attributes.align ? { 'data-align': parseImageAlignment(attributes.align) } : {}
      },
      wrap: {
        default: null,
        parseHTML: element => noteImageWraps.includes(element.getAttribute('data-wrap') as NoteImageWrap) ? element.getAttribute('data-wrap') : null,
        renderHTML: attributes => attributes.wrap ? { 'data-wrap': parseImageWrap(attributes.wrap) } : {}
      }
    }
  },
  parseHTML() { return [{ tag: 'img[src]', getAttrs: element => embeddedImagePattern.test(element.getAttribute('src') ?? '') ? null : false }] },
  addNodeView() { return VueNodeViewRenderer(NoteImageView) }
}).configure({ allowBase64: true })

/** Estilos de encabezado de tabla (pulido 2026-10-03): sombreado (como antes), oscuro o sin relleno. */
export const tableHeaderStyles = ['shaded', 'dark', 'plain'] as const
export type TableHeaderStyle = typeof tableHeaderStyles[number]
/** La vista de tabla de TipTap no vuelve a aplicar atributos al actualizar: el estilo de encabezado se refresca aquí. */
class NoteTableView extends TableView {
  override update(node: ProseMirrorNode): boolean {
    const isUpdated = super.update(node)
    if (isUpdated) this.table.setAttribute('data-header-style', String(node.attrs.headerStyle ?? 'shaded'))
    return isUpdated
  }
}
export const NoteTable = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      headerStyle: {
        default: 'shaded',
        parseHTML: element => tableHeaderStyles.includes(element.getAttribute('data-header-style') as TableHeaderStyle) ? element.getAttribute('data-header-style') : 'shaded',
        renderHTML: attributes => ({ 'data-header-style': attributes.headerStyle })
      }
    }
  }
}).configure({ resizable: false, View: NoteTableView })

/**
 * Salto de página (pulido 2026-10-03): bloque vacío que `PageLayout` usa para empezar el siguiente bloque en una
 * hoja nueva, como Ctrl+Intro en Word.
 */
export const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: true,
  parseHTML() { return [{ tag: 'div[data-page-break]' }] },
  // Ctrl+Intro lo atiende NoteEditor en captura: el salto de línea de StarterKit usa el mismo atajo.
  renderHTML({ HTMLAttributes }) { return ['div', mergeAttributes(HTMLAttributes, { 'data-page-break': 'true', class: 'note-page-break', contenteditable: 'false' })] }
})
