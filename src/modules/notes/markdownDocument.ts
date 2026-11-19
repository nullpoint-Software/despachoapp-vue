import { Editor } from '@tiptap/vue-3'
import { createEditorExtensions } from './editorExtensions'

/**
 * Markdown → documento del editor con las mismas extensiones de `NoteEditor`, en un editor sin
 * montar que se destruye al terminar. Las imágenes remotas no pasan: `LocalImage` sólo acepta data:.
 */
export function markdownToDocument(markdown: string): Record<string, unknown> {
  const editor = new Editor({ extensions: createEditorExtensions({ hasPages: false }), content: markdown || '', contentType: 'markdown' })
  try { return editor.getJSON() as Record<string, unknown> } finally { editor.destroy() }
}
