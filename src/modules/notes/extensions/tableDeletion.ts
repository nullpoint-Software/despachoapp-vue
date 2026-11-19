import type { Editor, JSONContent } from '@tiptap/core'
import { selectedRect } from '@tiptap/pm/tables'

/**
 * Qué hacer con los datos al quitar algo de una tabla (pulido 2026-10-03, decisión del usuario):
 * si la fila, la columna o la tabla tienen contenido, la vista pregunta "Eliminar con su contenido" o
 * "Conservar el contenido como texto debajo de la tabla". Si están vacías, se quitan directamente.
 */
export type TableRemoval = 'row' | 'column' | 'table'
export interface TableRemovalPreview { removal: TableRemoval; filledCellCount: number; lines: string[] }

/** Textos de las celdas afectadas, agrupados en renglones (una línea por fila, celdas separadas por " · "). */
export function previewTableRemoval(editor: Editor, removal: TableRemoval): TableRemovalPreview | null {
  let rect
  try { rect = selectedRect(editor.state) } catch { return null }
  const { map, table } = rect
  const rows = removal === 'row' ? [rect.top, rect.bottom] : [0, map.height]
  const columns = removal === 'column' ? [rect.left, rect.right] : [0, map.width]
  const lines: string[] = []
  let filledCellCount = 0
  for (let row = rows[0]!; row < rows[1]!; row++) {
    const seen = new Set<number>(), texts: string[] = []
    for (let column = columns[0]!; column < columns[1]!; column++) {
      const cellPosition = map.map[row * map.width + column]!
      if (seen.has(cellPosition)) continue
      seen.add(cellPosition)
      const text = table.nodeAt(cellPosition)?.textContent.trim() ?? ''
      if (text) { texts.push(text); filledCellCount++ }
    }
    if (texts.length) lines.push(texts.join(' · '))
  }
  return { removal, filledCellCount, lines }
}

/** Quita la fila, columna o tabla; con `shouldKeepText` antes inserta sus textos como párrafos después de la tabla. */
export function removeFromTable(editor: Editor, preview: TableRemovalPreview, shouldKeepText: boolean): void {
  let chain = editor.chain().focus()
  if (shouldKeepText && preview.lines.length) {
    const rect = selectedRect(editor.state)
    const tableEnd = rect.tableStart - 1 + rect.table.nodeSize
    const paragraphs: JSONContent[] = preview.lines.map(line => ({ type: 'paragraph', content: [{ type: 'text', text: line }] }))
    // Sin mover la selección: debe seguir dentro de la tabla para quitar la fila o columna.
    chain = chain.insertContentAt(tableEnd, paragraphs, { updateSelection: false })
  }
  if (preview.removal === 'row') chain.deleteRow().run()
  else if (preview.removal === 'column') chain.deleteColumn().run()
  else chain.deleteTable().run()
}
