/**
 * Texto plano de un documento del editor (esquema JSON de Tiptap) para el directorio de notas: vista
 * previa de cada fila, búsqueda y conteo de palabras. No interpreta marcas ni HTML: sólo recorre los
 * nodos `text`, separa bloques con espacios y descarta fórmulas e imágenes, que no tienen texto legible.
 */
const maximumNodeDepth = 64

function collectText(node: unknown, parts: string[], depth: number): void {
  if (!node || typeof node !== 'object' || depth > maximumNodeDepth) return
  const value = node as { type?: unknown; text?: unknown; content?: unknown }
  if (value.type === 'text' && typeof value.text === 'string') { parts.push(value.text); return }
  if (!Array.isArray(value.content)) return
  for (const child of value.content) collectText(child, parts, depth + 1)
  // Cada bloque termina en espacio para que dos párrafos no se peguen en la vista previa.
  parts.push(' ')
}

/** Texto continuo del documento, con espacios normalizados. */
export function extractNoteText(content: Record<string, unknown>): string {
  const parts: string[] = []
  collectText(content, parts, 0)
  return parts.join('').replace(/\s+/g, ' ').trim()
}

/** Vista previa de una fila: hasta `maximumLength` caracteres, con elipsis si se corta. */
export function previewNoteText(content: Record<string, unknown>, maximumLength = 95): string {
  const text = extractNoteText(content)
  return text.length > maximumLength ? text.slice(0, maximumLength - 1).trimEnd() + '…' : text
}

/** Palabras y caracteres del texto visible, como la franja de ruta del editor original. */
export function countNoteText(content: Record<string, unknown>): { wordCount: number; characterCount: number } {
  const text = extractNoteText(content)
  return { wordCount: text ? text.split(' ').length : 0, characterCount: text.length }
}
