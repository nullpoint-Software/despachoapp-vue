import StarterKit from '@tiptap/starter-kit'
import { TableKit } from '@tiptap/extension-table'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle, FontSize, LineHeight } from '@tiptap/extension-text-style'
import Highlight from '@tiptap/extension-highlight'
import Mathematics from '@tiptap/extension-mathematics'
import TaskList from '@tiptap/extension-task-list'
import { Markdown } from '@tiptap/markdown'
import { NoteImage, NoteTable, NoteTaskItem, PageBreak } from './extensions/noteNodes'
import { PageLayout } from './extensions/pageLayout'

/**
 * Extensiones del editor de notas. Pulido 2026-10-03:
 * - tareas como tarjetas con Spring Check, imágenes con descripción y marcador, tablas con estilo de encabezado,
 *   salto de página y hojas Carta (`PageLayout`; sólo con `hasPages`, la vista de edición);
 * - las imágenes siguen siendo LOCAL e incrustadas; las de internet se descargan una vez (`fetchNoteImage`).
 */
export function createEditorExtensions(options: { hasPages?: boolean } = {}) {
  return [
    StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: false, autolink: false, protocols: ['https', 'mailto'] } }),
    TableKit.configure({ table: false }), NoteTable, TextAlign.configure({ types: ['heading', 'paragraph'] }),
    TextStyle, FontSize, LineHeight, Highlight, NoteImage,
    Mathematics.configure({ katexOptions: { throwOnError: false, trust: false, strict: 'ignore' } }),
    TaskList, NoteTaskItem, PageBreak, Markdown,
    ...(options.hasPages === false ? [] : [PageLayout])
  ]
}
