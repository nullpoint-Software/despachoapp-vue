/**
 * Saneador del HTML con estilo de correos (2026-10-18, pedido del usuario: firmas y cuerpos "con estilo" en tablas, con
 * colores y estilos en línea; [[MAIL]]). Corre igual en Preload, Main, Host y la vista: TypeScript puro, sin DOM.
 *
 * Saneado por reconstrucción: lee etiquetas, atributos y texto, y emite SÓLO lo que está en las listas permitidas, con
 * cada valor vuelto a escapar. Lo ambiguo se descarta. Así una rareza del HTML de entrada no puede colarse a la salida:
 * - etiquetas de formato y de tabla que los clientes de correo muestran; `script`, `style`, `iframe`, `svg`, formularios
 *   y similares se quitan CON su contenido; otras (html, body, font desconocidas) se quitan conservando su texto;
 * - atributos de presentación (`style`, `align`, `width`, `bgcolor`, `cellpadding`…), nunca eventos (`on*`) ni `class`;
 * - `href` sólo `http(s):`, `mailto:` o `tel:`; `src` de imagen sólo `data:image/png|jpeg|gif` (sin imágenes remotas que
 *   rastreen la apertura);
 * - `style`: sólo propiedades de texto, color, caja y tabla, sin `url(`, `expression`, `javascript:`, `@import`,
 *   comentarios ni barras invertidas;
 * - comentarios y declaraciones (`<!-- -->`, `<!doctype>`) fuera; las etiquetas que quedan abiertas se cierran al final.
 */
const allowedTags = new Set(['a', 'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'span', 'div', 'p', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'blockquote', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'img', 'font', 'small', 'sup', 'sub', 'center', 'pre', 'code'])
const voidTags = new Set(['br', 'hr', 'img'])
/** Se descartan junto con todo lo que contienen. */
const droppedWithContent = new Set(['script', 'style', 'iframe', 'object', 'embed', 'noscript', 'template', 'head', 'title', 'svg', 'math', 'textarea', 'select', 'button', 'form', 'video', 'audio', 'canvas'])
const presentationAttributes = new Set(['style', 'align', 'valign', 'width', 'height', 'bgcolor', 'color', 'face', 'size', 'border', 'cellpadding', 'cellspacing', 'colspan', 'rowspan', 'title', 'alt', 'dir'])
const markerAttributes = new Set(['data-mail-placeholder'])
const allowedStyleProperties = new Set(['color', 'background', 'background-color', 'font', 'font-family', 'font-size', 'font-weight', 'font-style', 'font-variant',
  'letter-spacing', 'line-height', 'text-align', 'text-decoration', 'text-transform', 'text-indent', 'vertical-align', 'white-space', 'word-break', 'overflow-wrap',
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'border', 'border-top', 'border-right', 'border-bottom', 'border-left', 'border-color', 'border-style', 'border-width', 'border-radius', 'border-collapse', 'border-spacing',
  'width', 'min-width', 'max-width', 'height', 'min-height', 'max-height', 'display', 'table-layout', 'list-style', 'list-style-type'])
const unsafeStyleValue = /url\s*\(|expression|javascript:|vbscript:|@import|behavior|-moz-binding|[<>\\]|\/\*/i
const simpleAttributeValue = /^[\w#%.,\- ]{0,120}$/
const hrefPattern = /^(https?:\/\/[^\s<>"]+|mailto:[^\s<>"]+|tel:[+\d\s().-]{3,40})$/i
const imageSourcePattern = /^data:image\/(png|jpeg|gif);base64,[A-Za-z0-9+/]+={0,2}$/

const namedEntities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0', '#39': "'" }
/** Decodifica entidades para VALIDAR valores (`javascript&#58;` no debe pasar como si fuera texto inocente). */
function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);?/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const code = entity[1] === 'x' || entity[1] === 'X' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10)
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : ''
    }
    return namedEntities[entity.toLowerCase()] ?? match
  })
}
function escapeAttribute(value: string): string { return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }
/** Texto: `<` y `>` siempre escapados; un `&` que no inicia una entidad válida también. */
function escapeText(value: string): string { return value.replace(/&(?!(#x[0-9a-f]+|#\d+|[a-z]+);)/gi, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }

function sanitizeStyle(value: string): string {
  return decodeEntities(value).split(';').flatMap(declaration => {
    const separator = declaration.indexOf(':')
    if (separator < 0) return []
    const property = declaration.slice(0, separator).trim().toLowerCase(), propertyValue = declaration.slice(separator + 1).trim()
    if (!allowedStyleProperties.has(property) || !propertyValue || propertyValue.length > 200 || unsafeStyleValue.test(propertyValue)) return []
    return [property + ':' + propertyValue]
  }).join(';')
}

function sanitizeAttribute(tag: string, name: string, rawValue: string): string | null {
  const value = decodeEntities(rawValue).trim()
  if (name === 'href') return tag === 'a' && hrefPattern.test(value) ? value : null
  if (name === 'src') return tag === 'img' && imageSourcePattern.test(value) ? value : null
  if (name === 'style') { const style = sanitizeStyle(rawValue); return style || null }
  if (markerAttributes.has(name)) return /^[a-z]{1,20}$/.test(value) ? value : null
  if (name === 'title' || name === 'alt') return value.slice(0, 200)
  if (presentationAttributes.has(name)) return simpleAttributeValue.test(value) ? value : null
  return null
}

/** Atributos de una etiqueta de apertura: `nombre`, `nombre=valor`, `nombre="valor"` o `nombre='valor'`. */
function readAttributes(source: string): Array<[string, string]> {
  const attributes: Array<[string, string]> = []
  const pattern = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(source))) attributes.push([match[1]!.toLowerCase(), match[2] ?? match[3] ?? match[4] ?? ''])
  return attributes
}

export function sanitizeMailHtml(html: string): string {
  const tagPattern = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/y
  const lowerHtml = html.toLowerCase()
  const output: string[] = []
  const openTags: string[] = []
  let position = 0
  while (position < html.length) {
    const next = html.indexOf('<', position)
    if (next < 0) { output.push(escapeText(html.slice(position))); break }
    if (next > position) output.push(escapeText(html.slice(position, next)))
    if (html.startsWith('<!--', next)) { const end = html.indexOf('-->', next + 4); position = end < 0 ? html.length : end + 3; continue }
    if (html[next + 1] === '!' || html[next + 1] === '?') { const end = html.indexOf('>', next); position = end < 0 ? html.length : end + 1; continue }
    // Anclada en `next` (bandera `y`): no se copia el resto del texto en cada etiqueta.
    tagPattern.lastIndex = next
    const tagMatch = tagPattern.exec(html)
    if (!tagMatch) { output.push('&lt;'); position = next + 1; continue }
    position = next + tagMatch[0].length
    const isClosing = tagMatch[1] === '/', tag = tagMatch[2]!.toLowerCase()
    if (!isClosing && droppedWithContent.has(tag)) {
      const close = lowerHtml.indexOf('</' + tag, position)
      const end = close < 0 ? -1 : html.indexOf('>', close)
      position = end < 0 ? html.length : end + 1
      continue
    }
    if (!allowedTags.has(tag)) continue
    if (isClosing) {
      // Sólo se cierra lo que está abierto (y lo que quedó abierto dentro); un cierre suelto se ignora.
      const index = openTags.lastIndexOf(tag)
      if (index < 0) continue
      while (openTags.length > index) output.push('</' + openTags.pop() + '>')
      continue
    }
    const attributes = readAttributes(tagMatch[3] ?? '').flatMap(([name, value]) => {
      const clean = sanitizeAttribute(tag, name, value)
      return clean === null ? [] : [' ' + name + '="' + escapeAttribute(clean) + '"']
    })
    output.push('<' + tag + attributes.join('') + '>')
    if (!voidTags.has(tag) && !/\/\s*$/.test(tagMatch[3] ?? '')) openTags.push(tag)
  }
  while (openTags.length) output.push('</' + openTags.pop() + '>')
  return output.join('').trim()
}

/** Texto plano del HTML con estilo (parte `text/plain`): saltos en bloques y celdas, sin etiquetas, entidades decodificadas. */
export function mailHtmlToText(html: string): string {
  // Igual que un navegador: el espacio del código (saltos y sangría) se colapsa; los saltos salen de los bloques.
  const sameTarget = (label: string, href: string) => { const plain = (value: string) => decodeEntities(value.replace(/<[^>]*>/g, '')).replace(/[^a-z0-9@.]/gi, '').toLowerCase(); return plain(label) === plain(href) }
  const text = html
    .replace(/\s+/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr|table|blockquote)>/gi, '\n')
    .replace(/<\/t[dh]>/gi, ' ')
    .replace(/<a [^>]*href="(mailto:|tel:)?([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_match, _scheme, href: string, label: string) => sameTarget(label, href) ? label : label + ' (' + href + ')')
    .replace(/<[^>]*>/g, '')
  return decodeEntities(text).split('\n').map(line => line.replace(/[ \t\u00a0]+/g, ' ').trim()).filter(Boolean).join('\n')
}
