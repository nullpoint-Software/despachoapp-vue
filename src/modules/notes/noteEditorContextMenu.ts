import type { Editor } from '@tiptap/vue-3'
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Copy, ImageOff, ImagePlus, Italic, List, ListChecks, ListOrdered, Minus,
  Scissors, Strikethrough, Table, TextCursorInput, Underline
} from '@lucide/vue'
import type { ContextMenuItem } from '../../shared/components/ContextMenu.vue'
import { noteImageActions, noteImageGroupLabels } from './extensions/noteImageActions'
import { readImageLayout } from './extensions/noteImageLayout'

/**
 * Menú contextual del cuerpo de la nota (2026-10-10, pedido del usuario): clic derecho, Shift+F10 o la tecla de menú
 * abren `ContextMenu` en lugar del menú del navegador.
 *
 * Grupos:
 * - **Imagen** (sólo sobre una imagen): tamaño, posición, ajuste del texto, editar descripción y quitar; las mismas
 *   acciones de la barra de imagen (`noteImageActions`).
 * - **Texto:** negrita, cursiva, subrayado y tachado.
 * - **Párrafo:** alineación, lista, lista numerada y lista de tareas.
 * - **Insertar:** tabla, imagen del equipo (el selector de la cinta) y línea separadora.
 * - **Edición:** cortar y copiar con `document.execCommand`, que Electron permite dentro del clic de la persona.
 *   "Pegar" no se ofrece: leer el portapapeles desde la página exige un permiso que la ventana niega a propósito
 *   (`windowSecurity.ts` rechaza todos los permisos); se pega con Ctrl+V.
 *
 * Los comandos son las mismas cadenas TipTap de la cinta (`NoteRibbon`). Con el documento bloqueado (vista de lectura o
 * Markdown sin aplicar) sólo queda Copiar; lo demás aparece deshabilitado. Este archivo sólo arma la lista: no abre ni
 * cierra el menú.
 */
export interface EditorContextMenuOptions {
  editor: Editor
  isLocked: boolean
  /** Posición del nodo imagen bajo el puntero (o seleccionado), o null si el menú no es de una imagen. */
  imagePosition: number | null
  chooseLocalImage: () => void
  focusImageDescription: (imagePosition: number) => void
}

/** Busca la imagen que contiene `target` (la figura de su vista de nodo) y devuelve su posición en el documento. */
export function findImagePosition(editor: Editor, target: EventTarget | null): number | null {
  const figure = target instanceof Element ? target.closest('.note-figure') : null
  if (!figure || !editor.view.dom.contains(figure)) return null
  let foundPosition: number | null = null
  editor.state.doc.descendants((node, position) => {
    if (foundPosition !== null) return false
    if (node.type.name !== 'image') return true
    const element = editor.view.nodeDOM(position)
    if (element === figure || (element instanceof Node && element.contains(figure))) foundPosition = position
    return false
  })
  return foundPosition
}

/** Ejecuta cortar o copiar sobre la selección del editor, que recupera el foco primero. */
function runClipboardCommand(editor: Editor, command: 'cut' | 'copy'): void {
  editor.view.focus()
  // execCommand está marcado como obsoleto, pero es la única vía para escribir en el portapapeles sin pedir permisos.
  document.execCommand(command)
}

export function buildEditorContextItems(options: EditorContextMenuOptions): ContextMenuItem[] {
  const { editor, isLocked, imagePosition } = options
  const chain = () => editor.chain().focus()
  const hasSelection = !editor.state.selection.empty
  const items: ContextMenuItem[] = []
  const imageNode = imagePosition === null ? null : editor.state.doc.nodeAt(imagePosition)
  if (imagePosition !== null && imageNode?.type.name === 'image') {
    const layout = readImageLayout(imageNode.attrs)
    for (const action of noteImageActions) {
      items.push({
        itemId: 'image-' + action.actionId, label: action.label, icon: action.icon, group: noteImageGroupLabels[action.group], isDisabled: isLocked,
        onSelect: () => { chain().setNodeSelection(imagePosition).updateAttributes('image', action.change(layout)).setNodeSelection(imagePosition).run() }
      })
    }
    items.push(
      { itemId: 'image-description', label: 'Editar descripción de la imagen', icon: TextCursorInput, group: 'Imagen', isDisabled: isLocked, onSelect: () => options.focusImageDescription(imagePosition) },
      // Se puede deshacer con Ctrl+Z, igual que Suprimir con la imagen seleccionada.
      { itemId: 'image-remove', label: 'Quitar imagen', icon: ImageOff, tone: 'danger', group: 'Imagen', isDisabled: isLocked, onSelect: () => { chain().setNodeSelection(imagePosition).deleteSelection().run() } }
    )
  }
  const formatting: Array<Omit<ContextMenuItem, 'isDisabled'>> = [
    { itemId: 'bold', label: 'Negrita', icon: Bold, group: 'Texto', onSelect: () => { chain().toggleBold().run() } },
    { itemId: 'italic', label: 'Cursiva', icon: Italic, group: 'Texto', onSelect: () => { chain().toggleItalic().run() } },
    { itemId: 'underline', label: 'Subrayado', icon: Underline, group: 'Texto', onSelect: () => { chain().toggleUnderline().run() } },
    { itemId: 'strike', label: 'Tachado', icon: Strikethrough, group: 'Texto', onSelect: () => { chain().toggleStrike().run() } },
    { itemId: 'align-left', label: 'Alinear a la izquierda', icon: AlignLeft, group: 'Párrafo', onSelect: () => { chain().setTextAlign('left').run() } },
    { itemId: 'align-center', label: 'Centrar', icon: AlignCenter, group: 'Párrafo', onSelect: () => { chain().setTextAlign('center').run() } },
    { itemId: 'align-right', label: 'Alinear a la derecha', icon: AlignRight, group: 'Párrafo', onSelect: () => { chain().setTextAlign('right').run() } },
    { itemId: 'align-justify', label: 'Justificar', icon: AlignJustify, group: 'Párrafo', onSelect: () => { chain().setTextAlign('justify').run() } },
    { itemId: 'bullet-list', label: 'Lista', icon: List, group: 'Párrafo', onSelect: () => { chain().toggleBulletList().run() } },
    { itemId: 'ordered-list', label: 'Lista numerada', icon: ListOrdered, group: 'Párrafo', onSelect: () => { chain().toggleOrderedList().run() } },
    { itemId: 'task-list', label: 'Lista de tareas', icon: ListChecks, group: 'Párrafo', onSelect: () => { chain().toggleTaskList().run() } },
    { itemId: 'insert-table', label: 'Tabla', icon: Table, group: 'Insertar', onSelect: () => { chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() } },
    { itemId: 'insert-image', label: 'Imagen del equipo', icon: ImagePlus, group: 'Insertar', onSelect: options.chooseLocalImage },
    { itemId: 'insert-rule', label: 'Línea separadora', icon: Minus, group: 'Insertar', onSelect: () => { chain().setHorizontalRule().run() } }
  ]
  items.push(...formatting.map(item => ({ ...item, isDisabled: isLocked })))
  items.push(
    { itemId: 'cut', label: 'Cortar', icon: Scissors, group: 'Edición', isDisabled: isLocked || !hasSelection, onSelect: () => runClipboardCommand(editor, 'cut') },
    { itemId: 'copy', label: 'Copiar', icon: Copy, group: 'Edición', isDisabled: !hasSelection, onSelect: () => runClipboardCommand(editor, 'copy') }
  )
  return items
}
