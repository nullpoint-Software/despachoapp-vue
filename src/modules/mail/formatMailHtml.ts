/**
 * Acomoda el HTML del editor para leerlo y editarlo a mano (2026-10-18, pedido del usuario: "poder poner html y que se
 * acomode solo"): cada bloque (párrafo, título, lista, elemento, cita, línea, imagen, tabla, fila, celda y `div`) en su
 * renglón, y los contenedores (listas, citas, tablas, filas, celdas y `div`) sangrados dos espacios por nivel.
 * Quita el `src` del logo del despacho (el editor lo vuelve a poner con el logo vigente) para no llenar el código con la
 * imagen, y la clase interna de los chips de marcador. Otras imágenes conservan su `src`. Sólo cambia espacios entre
 * bloques: el contenido y el texto en línea quedan iguales.
 */
const containers = 'ul|ol|li|blockquote|table|thead|tbody|tfoot|tr|td|th|div'
const blockBreak = new RegExp('(?=<(?:p|h[1-3]|hr|img|' + containers + ')\\b|</(?:' + containers + ')>)')
const compactBeforeBlock = new RegExp('>\\s+(?=</?(?:p|h[1-3]|hr|img|' + containers + ')\\b)', 'g')
const opensLevel = new RegExp('^<(?:' + containers + ')\\b')
const closesLevel = new RegExp('^</(?:' + containers + ')>')
const closesOnSameLine = new RegExp('</(?:' + containers + ')>$')

export function formatMailHtml(html: string): string {
  const compact = html.replace(compactBeforeBlock, '>')
    .replace(/<img\b[^>]*\bdata-office-logo\b[^>]*>/g, tag => tag.replace(/ src="data:[^"]*"/, ''))
    .replace(/ class="mail-placeholder-chip"/g, '').trim()
  let depth = 0
  const lines: string[] = []
  for (const token of compact.split(blockBreak)) {
    const text = token.trim()
    if (!text) continue
    if (closesLevel.test(text)) depth = Math.max(0, depth - 1)
    lines.push('  '.repeat(depth) + text)
    // Un contenedor que abre y cierra en el mismo renglón (`<li>…</li>`) no agrega nivel.
    if (opensLevel.test(text) && !closesOnSameLine.test(text)) depth++
  }
  return lines.join('\n')
}
