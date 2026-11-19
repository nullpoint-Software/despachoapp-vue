import { mailHtmlToText, sanitizeMailHtml } from './sanitizeMailHtml'
/**
 * Documento de correo (2026-10-17, pedido del usuario: "crea un creador de cuerpo de mail y firma"; módulo [[MAIL]]).
 *
 * El cuerpo y la firma se editan con TipTap en la vista, pero NUNCA viaja HTML entre capas: viaja el JSON del editor
 * reducido a un subconjunto fijo de nodos y marcas (`MailDocument`). Así:
 * - `parseMailDocument` es la frontera de confianza: rechaza tipos desconocidos, recorta atributos a los conocidos y
 *   acota tamaño y profundidad. Corre en Preload, Main y Host.
 * - `renderMailHtml` arma el HTML del correo SÓLO a partir de ese subconjunto, escapando todo texto y atributo: el HTML
 *   queda saneado por construcción (no hay etiqueta, atributo, estilo ni URL que no salga de aquí). Los estilos van en
 *   línea porque Gmail, Outlook y Yahoo ignoran hojas de estilo externas y la mayoría de `<style>`.
 * - El logo del despacho es un nodo propio (`officeLogo`) sin atributos: la plantilla guardada en el Host no carga la
 *   imagen; al enviar, Main la adjunta como imagen incrustada (`cid:`), que los clientes de correo muestran sin
 *   bloquearla como imagen remota.
 */
export type MailTextAlign = 'center' | 'right' | 'justify'
/**
 * Color y tamaño de letra (2026-10-19, pedido del usuario: "poder modificar colores, tamaño de letra"): marca
 * `textStyle` con `#rrggbb` y uno de `mailFontSizes`. Se emite como `<span style="color:…;font-size:…">`.
 */
export interface MailTextStyle { color?: string; fontSize?: string }
export type MailMark = { type: 'bold' } | { type: 'italic' } | { type: 'underline' } | { type: 'strike' } | { type: 'link'; attrs: { href: string } } | { type: 'textStyle'; attrs: MailTextStyle }
export const mailFontSizes = ['10px', '12px', '13px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '40px'] as const

/** `#abc`, `#aabbcc` o `rgb(r, g, b)` a `#aabbcc`; otro valor (nombres, transparencias) es `undefined`. */
export function normalizeMailColor(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const color = value.trim().toLowerCase()
  if (/^#[0-9a-f]{6}$/.test(color)) return color
  if (/^#[0-9a-f]{3}$/.test(color)) return '#' + [...color.slice(1)].map(digit => digit + digit).join('')
  const rgb = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/.exec(color)
  if (!rgb || rgb.slice(1).some(part => Number(part) > 255)) return undefined
  return '#' + rgb.slice(1).map(part => Number(part).toString(16).padStart(2, '0')).join('')
}
/** Lee color y tamaño de un atributo `style` (al pegar HTML en el editor); lo que no está permitido se ignora. */
export function readMailTextStyle(style: string): MailTextStyle {
  const result: MailTextStyle = {}
  for (const declaration of style.split(';')) {
    const separator = declaration.indexOf(':')
    if (separator < 0) continue
    const property = declaration.slice(0, separator).trim().toLowerCase(), value = declaration.slice(separator + 1).trim().toLowerCase()
    if (property === 'color') { const color = normalizeMailColor(value); if (color) result.color = color }
    if (property === 'font-size' && (mailFontSizes as readonly string[]).includes(value)) result.fontSize = value
  }
  return result
}
/** CSS en línea de la marca; vacío si no trae nada. */
export function mailTextStyleCss(style: { color?: string | null; fontSize?: string | null }): string {
  return [style.color ? 'color:' + style.color : '', style.fontSize ? 'font-size:' + style.fontSize : ''].filter(Boolean).join(';')
}
/**
 * Marcadores (2026-10-18, pedido del usuario: "lo de {}, que sean arrastrables"): nodos propios que el editor dibuja como
 * chips y se arrastran a su lugar; al redactar se reemplazan por el dato (`fillMailPlaceholders`).
 */
/** `usuario` (2026-10-18, pedido del usuario): el nombre de quien envía, el usuario de la sesión de Fiscenix. */
/**
 * `logo` (2026-10-18, pedido del usuario: "el logo de la empresa también como chip"): no se llena con texto; al armar el
 * correo se dibuja como la imagen del logo del despacho (`officeLogoSource`), o se omite si el despacho no tiene logo.
 */
export const mailPlaceholders = { cliente: 'Cliente', documento: 'Documento', despacho: 'Despacho', usuario: 'Usuario', logo: 'Logo' } as const
export type MailPlaceholder = keyof typeof mailPlaceholders
export function isMailPlaceholder(value: unknown): value is MailPlaceholder { return typeof value === 'string' && Object.hasOwn(mailPlaceholders, value) }
export type MailInlineNode = { type: 'text'; text: string; marks?: MailMark[] } | { type: 'placeholder'; attrs: { name: MailPlaceholder }; marks?: MailMark[] } | { type: 'hardBreak' }
/**
 * Bloque «HTML con estilo» (2026-10-18, pedido del usuario: firmas y cuerpos con tablas, colores y estilos en línea).
 * Guarda HTML ya saneado por `sanitizeMailHtml` (lista permitida de etiquetas, atributos y estilos); `parseMailDocument`
 * lo vuelve a sanear en cada capa. Va al correo tal cual, con sus estilos en línea.
 */
export type MailBlockNode =
  { type: 'html'; attrs: { html: string } } |
  { type: 'paragraph'; attrs?: { textAlign: MailTextAlign }; content?: MailInlineNode[] } |
  { type: 'heading'; attrs: { level: 1 | 2 | 3; textAlign?: MailTextAlign }; content?: MailInlineNode[] } |
  { type: 'bulletList'; content: MailListItem[] } |
  { type: 'orderedList'; content: MailListItem[] } |
  { type: 'blockquote'; content: MailBlockNode[] } |
  { type: 'horizontalRule' } |
  { type: 'officeLogo' }
export interface MailListItem { type: 'listItem'; content: MailBlockNode[] }
export interface MailDocument { type: 'doc'; content: MailBlockNode[] }

/** Límites del recorrido: evitan documentos enormes o anidados sin fin antes de guardarlos o enviarlos. */
const maximumNodeCount = 4000
const maximumDepth = 12
const maximumTextLength = 20000
const maximumHrefLength = 2048
/**
 * Tamaño máximo del JSON normalizado de un cuerpo, una firma o una plantilla: holgado, pero acotado. Desde el 2026-10-18
 * las plantillas tienen el mismo tope que un correo (antes 5000 por el límite de `/session`); viajan por `/mail`.
 */
export const maximumMessageDocumentLength = 400000

const textAligns: readonly MailTextAlign[] = ['center', 'right', 'justify']
/** Sólo enlaces web y de correo; nada de `javascript:`, `data:` ni rutas del equipo. */
const hrefPattern = /^(https?:\/\/[^\s<>"]+|mailto:[^\s<>"]+)$/i

class MailDocumentError extends Error { constructor() { super('Invalid mail document') } }
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new MailDocumentError()
  return value as Record<string, unknown>
}
function list(value: unknown): unknown[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new MailDocumentError()
  return value
}
function readAlign(attrs: Record<string, unknown>): MailTextAlign | undefined {
  // TipTap guarda `null` o `left` cuando no hay alineación: ambos son el valor por defecto y no se conservan.
  const value = attrs.textAlign
  if (value === undefined || value === null || value === 'left') return undefined
  if (!textAligns.includes(value as MailTextAlign)) throw new MailDocumentError()
  return value as MailTextAlign
}

/**
 * Valida y normaliza un documento del editor. Devuelve una copia que sólo contiene nodos, marcas y atributos del
 * subconjunto; atributos extra que TipTap agrega (`target`, `rel`, `class`, `start`…) se descartan. Lanza si hay un
 * tipo desconocido, un enlace no permitido, texto con caracteres de control o si se superan los límites.
 */
export function parseMailDocument(value: unknown, maximumLength = maximumMessageDocumentLength): MailDocument {
  let nodeCount = 0
  const count = (depth: number) => { if (++nodeCount > maximumNodeCount || depth > maximumDepth) throw new MailDocumentError() }
  function parseMarks(value: unknown): MailMark[] {
    const marks = list(value).flatMap((item): MailMark[] => {
      const data = record(item)
      if (data.type === 'bold' || data.type === 'italic' || data.type === 'underline' || data.type === 'strike') return [{ type: data.type }]
      if (data.type === 'textStyle') {
        // TipTap guarda `null` en lo que no se eligió; una marca sin color ni tamaño se descarta.
        const attrs = data.attrs === undefined || data.attrs === null ? {} : record(data.attrs)
        const color = attrs.color === undefined || attrs.color === null ? undefined : normalizeMailColor(attrs.color)
        const fontSize = attrs.fontSize === undefined || attrs.fontSize === null ? undefined : attrs.fontSize
        if ((attrs.color != null && !color) || (fontSize !== undefined && !(mailFontSizes as readonly unknown[]).includes(fontSize))) throw new MailDocumentError()
        return color || fontSize ? [{ type: 'textStyle', attrs: { ...(color ? { color } : {}), ...(fontSize ? { fontSize: fontSize as string } : {}) } }] : []
      }
      if (data.type !== 'link') throw new MailDocumentError()
      const href = record(data.attrs).href
      if (typeof href !== 'string' || href.length > maximumHrefLength || !hrefPattern.test(href)) throw new MailDocumentError()
      return [{ type: 'link', attrs: { href } }]
    })
    if (new Set(marks.map(mark => mark.type)).size !== marks.length) throw new MailDocumentError()
    return marks
  }
  function parseInline(value: unknown, depth: number): MailInlineNode {
    count(depth)
    const data = record(value)
    if (data.type === 'hardBreak') return { type: 'hardBreak' }
    if (data.type === 'placeholder') {
      const name = record(data.attrs).name
      if (!isMailPlaceholder(name)) throw new MailDocumentError()
      const marks = parseMarks(data.marks)
      return marks.length ? { type: 'placeholder', attrs: { name }, marks } : { type: 'placeholder', attrs: { name } }
    }
    if (data.type !== 'text' || typeof data.text !== 'string' || !data.text || data.text.length > maximumTextLength) throw new MailDocumentError()
    // Tabulador y saltos se aceptan dentro del texto; los demás caracteres de control no.
    if ([...data.text].some(character => { const code = character.charCodeAt(0); return (code < 32 && code !== 9 && code !== 10) || code === 127 })) throw new MailDocumentError()
    const marks = parseMarks(data.marks)
    return marks.length ? { type: 'text', text: data.text, marks } : { type: 'text', text: data.text }
  }
  function parseInlineContent(value: unknown, depth: number): MailInlineNode[] | undefined {
    const content = list(value).map(item => parseInline(item, depth + 1))
    return content.length ? content : undefined
  }
  function parseListItem(value: unknown, depth: number): MailListItem {
    count(depth)
    const data = record(value)
    if (data.type !== 'listItem') throw new MailDocumentError()
    return { type: 'listItem', content: list(data.content).map(item => parseBlock(item, depth + 1)) }
  }
  function parseBlock(value: unknown, depth: number): MailBlockNode {
    count(depth)
    const data = record(value)
    const attrs = data.attrs === undefined || data.attrs === null ? {} : record(data.attrs)
    if (data.type === 'paragraph') {
      const textAlign = readAlign(attrs), content = parseInlineContent(data.content, depth)
      return { type: 'paragraph', ...(textAlign ? { attrs: { textAlign } } : {}), ...(content ? { content } : {}) }
    }
    if (data.type === 'heading') {
      if (attrs.level !== 1 && attrs.level !== 2 && attrs.level !== 3) throw new MailDocumentError()
      const textAlign = readAlign(attrs), content = parseInlineContent(data.content, depth)
      return { type: 'heading', attrs: { level: attrs.level, ...(textAlign ? { textAlign } : {}) }, ...(content ? { content } : {}) }
    }
    if (data.type === 'bulletList' || data.type === 'orderedList') return { type: data.type, content: list(data.content).map(item => parseListItem(item, depth + 1)) }
    if (data.type === 'blockquote') return { type: 'blockquote', content: list(data.content).map(item => parseBlock(item, depth + 1)) }
    if (data.type === 'horizontalRule' || data.type === 'officeLogo') return { type: data.type }
    if (data.type === 'html') {
      if (typeof attrs.html !== 'string' || attrs.html.length > maximumMessageDocumentLength) throw new MailDocumentError()
      const html = sanitizeMailHtml(attrs.html)
      if (!html) throw new MailDocumentError()
      return { type: 'html', attrs: { html } }
    }
    throw new MailDocumentError()
  }
  const data = record(value)
  if (data.type !== 'doc') throw new MailDocumentError()
  const document: MailDocument = { type: 'doc', content: list(data.content).map(item => parseBlock(item, 1)) }
  if (JSON.stringify(document).length > maximumLength) throw new MailDocumentError()
  return document
}

/** Un documento sin texto ni logo (sólo párrafos vacíos) se considera vacío: no se envía un cuerpo en blanco. */
export function isMailDocumentEmpty(document: MailDocument): boolean {
  return !JSON.stringify(document.content).match(/"type":"(text|placeholder|officeLogo|horizontalRule|html)"/)
}

export function mailParagraphs(...lines: string[]): MailDocument {
  return { type: 'doc', content: lines.map(line => line ? { type: 'paragraph', content: [{ type: 'text', text: line }] } : { type: 'paragraph' }) }
}

const placeholder = (name: MailPlaceholder, marks?: MailMark[]): MailInlineNode => ({ type: 'placeholder', attrs: { name }, ...(marks ? { marks } : {}) })
const text = (value: string): MailInlineNode => ({ type: 'text', text: value })

/** Plantilla de cuerpo por defecto (mientras el despacho no guarde una propia); sus marcadores se llenan al redactar. */
export const defaultMailBodyTemplate: MailDocument = { type: 'doc', content: [
  { type: 'paragraph', content: [text('Estimado(a) '), placeholder('cliente'), text(':')] },
  { type: 'paragraph', content: [text('Le compartimos en los archivos adjuntos el documento: '), placeholder('documento'), text('.')] },
  { type: 'paragraph', content: [text('Quedamos atentos a cualquier duda.')] },
  { type: 'paragraph', content: [text('Saludos cordiales.')] }] }
export const defaultMailSignatureTemplate: MailDocument = { type: 'doc', content: [{ type: 'paragraph', content: [placeholder('usuario', [{ type: 'bold' }])] }, { type: 'paragraph', content: [placeholder('despacho')] }] }

/**
 * Reemplaza cada marcador por su dato y conserva sus marcas (negrita, enlace…). Un valor vacío deja el marcador para
 * que la persona lo note. También reemplaza `{cliente}` escrito como texto (plantillas guardadas antes de los chips).
 */
export function fillMailPlaceholders(document: MailDocument, values: Partial<Record<MailPlaceholder, string>>): MailDocument {
  const fill = (value: string) => value.replace(/\{(cliente|documento|despacho|usuario|logo)\}/g, (marker, key: MailPlaceholder) => values[key]?.trim() || marker)
  const visit = <T>(node: T): T => {
    if (Array.isArray(node)) return node.map(visit) as T
    if (!node || typeof node !== 'object') return node
    const copy: Record<string, unknown> = { ...node as Record<string, unknown> }
    if (copy.type === 'placeholder') {
      const value = values[(copy.attrs as { name: MailPlaceholder }).name]?.trim()
      return (value ? { type: 'text', text: value, ...(copy.marks ? { marks: copy.marks } : {}) } : copy) as T
    }
    if (copy.type === 'text' && typeof copy.text === 'string') copy.text = fill(copy.text)
    // En el HTML con estilo: `{cliente}` y los chips (`<span data-mail-placeholder>`) pasan a texto escapado.
    if (copy.type === 'html' && copy.attrs && typeof (copy.attrs as { html?: unknown }).html === 'string') {
      const escapeValue = (key: MailPlaceholder, marker: string) => { const value = values[key]?.trim(); return value ? escapeHtml(value) : marker }
      copy.attrs = { html: (copy.attrs as { html: string }).html
        .replace(/<span data-mail-placeholder="(cliente|documento|despacho|usuario|logo)"[^>]*>[\s\S]*?<\/span>/g, (marker, key: MailPlaceholder) => escapeValue(key, marker))
        .replace(/\{(cliente|documento|despacho|usuario|logo)\}/g, (marker, key: MailPlaceholder) => escapeValue(key, marker)) }
    }
    if (Array.isArray(copy.content)) copy.content = copy.content.map(visit)
    return copy as T
  }
  return visit(document)
}

/**
 * Asunto del correo (pedido del usuario: "(documento) de (nombre cliente) (para cliente del cliente de ser necesario)").
 * Ej.: "Factura de Comercial Ruiz para Grupo Norte". Se colapsan espacios y se acota a 200 caracteres; nunca lleva
 * saltos de línea (evita inyectar cabeceras).
 */
export function buildMailSubject(parts: { documentLabel: string; clientName: string; recipientName?: string }): string {
  const clean = (value: string | undefined) => [...(value ?? '')].map(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127 ? ' ' : character).join('').replace(/\s+/g, ' ').trim()
  const documentLabel = clean(parts.documentLabel), clientName = clean(parts.clientName), recipientName = clean(parts.recipientName)
  const subject = [documentLabel || 'Documento', 'de', clientName, ...(recipientName ? ['para', recipientName] : [])].filter(Boolean).join(' ')
  return subject.slice(0, 200)
}

/** El logo dentro del HTML con estilo: `{logo}` o el chip `<span data-mail-placeholder="logo">…</span>`. */
const logoMarkerPattern = /<span data-mail-placeholder="logo"[^>]*>[\s\S]*?<\/span>|\{logo\}/g

/** ¿El documento usa el logo del despacho (bloque, chip o `{logo}` en el HTML con estilo)? Main sólo adjunta el logo si sí. */
export function usesOfficeLogo(document: MailDocument | null): boolean {
  if (!document) return false
  const serialized = JSON.stringify(document)
  return serialized.includes('"type":"officeLogo"') || serialized.includes('"name":"logo"') || serialized.includes('{logo}') || serialized.includes('data-mail-placeholder=\\"logo\\"')
}

const escapeMap: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
function escapeHtml(value: string): string { return value.replace(/[&<>"']/g, character => escapeMap[character]!) }

/** Estilos en línea compartidos; tinta del despacho y el azul de sello para enlaces (DESIGN.md). */
const styles = {
  wrapper: 'font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1a1a1a',
  paragraph: 'margin:0 0 12px',
  headings: { 1: 'margin:0 0 12px;font-size:22px;line-height:1.3;font-weight:bold', 2: 'margin:0 0 10px;font-size:18px;line-height:1.3;font-weight:bold', 3: 'margin:0 0 8px;font-size:16px;line-height:1.3;font-weight:bold' },
  list: 'margin:0 0 12px;padding-left:24px',
  listItem: 'margin:0 0 4px',
  blockquote: 'margin:0 0 12px;padding:0 0 0 12px;border-left:3px solid #cfcfcf;color:#4a4a4a',
  rule: 'border:0;border-top:1px solid #d4d4d4;margin:16px 0',
  link: 'color:#1f3bd6;text-decoration:underline',
  logo: 'display:block;max-width:180px;height:auto;border:0;margin:0 0 8px',
  inlineLogo: 'max-width:180px;height:auto;border:0;vertical-align:middle',
  signature: 'margin-top:24px;padding-top:12px;border-top:1px solid #e5e5e5;font-size:13px;color:#3a3a3a'
}

export interface MailRenderOptions {
  /** `src` de la imagen del logo (en el correo, `cid:…`); `null` omite el nodo. */
  officeLogoSource: string | null
  /**
   * `false` sólo para la vista previa dentro de Fiscenix: la política de seguridad de la ventana bloquea `style` en línea
   * y la vista previa aplica las mismas reglas por CSS. El correo siempre lleva los estilos en línea.
   */
  hasInlineStyles?: boolean
  /** `true` al reconstruir el código del editor: el logo queda como `{logo}` en lugar de la imagen. */
  keepsLogoMarker?: boolean
}

/** HTML de un documento del subconjunto, con estilos en línea. Todo texto y atributo sale escapado. */
export function renderMailDocumentHtml(document: MailDocument, options: MailRenderOptions): string {
  const html = renderStyledMailDocumentHtml(document, options)
  // Sin estilos en línea (vista previa), cada `style` pasa a `data-mail-style` y la vista lo aplica por CSSOM, que la
  // política de seguridad de la ventana sí permite. El texto va escapado, así que ` style="` sólo aparece en etiquetas.
  return options.hasInlineStyles === false ? html.replace(/ style="/g, ' data-mail-style="') : html
}

function renderStyledMailDocumentHtml(document: MailDocument, options: MailRenderOptions): string {
  const align = (textAlign: MailTextAlign | undefined) => textAlign ? ';text-align:' + textAlign : ''
  // Chip o `{logo}`: la imagen del logo del despacho en línea; sin logo, nada.
  const logoImage = options.keepsLogoMarker ? '{logo}' : options.officeLogoSource ? '<img src="' + escapeHtml(options.officeLogoSource) + '" alt="Logo" style="' + styles.inlineLogo + '">' : ''
  const renderInline = (nodes: MailInlineNode[] | undefined): string => (nodes ?? []).map(node => {
    if (node.type === 'hardBreak') return '<br>'
    if (node.type === 'placeholder' && node.attrs.name === 'logo') return logoImage
    // Un marcador sin llenar se muestra como texto `{cliente}` para que se note en la vista previa.
    let html = escapeHtml(node.type === 'placeholder' ? '{' + node.attrs.name + '}' : node.text).replace(/\n/g, '<br>')
    for (const mark of node.marks ?? []) {
      if (mark.type === 'bold') html = '<strong>' + html + '</strong>'
      else if (mark.type === 'italic') html = '<em>' + html + '</em>'
      else if (mark.type === 'underline') html = '<u>' + html + '</u>'
      else if (mark.type === 'strike') html = '<s>' + html + '</s>'
      // Valores ya validados por `parseMailDocument` (color hexadecimal y tamaño de la lista).
      else if (mark.type === 'textStyle') html = '<span style="' + mailTextStyleCss(mark.attrs) + '">' + html + '</span>'
      else html = '<a href="' + escapeHtml(mark.attrs.href) + '" style="' + styles.link + '" target="_blank" rel="noopener">' + html + '</a>'
    }
    return html
  }).join('')
  // Un párrafo vacío conserva su altura con &nbsp; (los clientes de correo colapsan <p></p>).
  const renderBlock = (node: MailBlockNode, isInListItem: boolean): string => {
    if (node.type === 'paragraph') return '<p style="' + (isInListItem ? 'margin:0' : styles.paragraph) + align(node.attrs?.textAlign) + '">' + (renderInline(node.content) || '&nbsp;') + '</p>'
    if (node.type === 'heading') return '<h' + node.attrs.level + ' style="' + styles.headings[node.attrs.level] + align(node.attrs.textAlign) + '">' + (renderInline(node.content) || '&nbsp;') + '</h' + node.attrs.level + '>'
    if (node.type === 'bulletList' || node.type === 'orderedList') {
      const tag = node.type === 'bulletList' ? 'ul' : 'ol'
      return '<' + tag + ' style="' + styles.list + '">' + node.content.map(item => '<li style="' + styles.listItem + '">' + item.content.map(child => renderBlock(child, true)).join('') + '</li>').join('') + '</' + tag + '>'
    }
    if (node.type === 'blockquote') return '<blockquote style="' + styles.blockquote + '">' + node.content.map(child => renderBlock(child, isInListItem)).join('') + '</blockquote>'
    if (node.type === 'horizontalRule') return '<hr style="' + styles.rule + '">'
    if (node.type === 'html') return options.keepsLogoMarker ? node.attrs.html : node.attrs.html.replace(logoMarkerPattern, logoImage)
    return options.officeLogoSource ? '<img src="' + escapeHtml(options.officeLogoSource) + '" alt="Logo" style="' + styles.logo + '">' : ''
  }
  // Los párrafos vacíos del final no se emiten: el editor siempre deja uno después de un bloque (logo, HTML con estilo)
  // y, si se emitiera, el código se alargaría con cada acomodo y el correo llevaría un renglón en blanco de más.
  let end = document.content.length
  while (end > 0 && document.content[end - 1]!.type === 'paragraph' && !(document.content[end - 1] as { content?: unknown[] }).content?.length) end--
  return document.content.slice(0, end).map(node => renderBlock(node, false)).join('')
}

/** Mensaje completo: cuerpo y, debajo de una línea fina, la firma. Documento HTML autocontenido. */
export function renderMailHtml(body: MailDocument, signature: MailDocument | null, options: MailRenderOptions): string {
  const signatureHtml = signature && !isMailDocumentEmpty(signature) ? '<div style="' + styles.signature + '">' + renderMailDocumentHtml(signature, options) + '</div>' : ''
  return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head><body style="margin:0;padding:16px;background:#ffffff">'
    + '<div style="' + styles.wrapper + '">' + renderMailDocumentHtml(body, options) + signatureHtml + '</div></body></html>'
}

/** Versión en texto plano (parte `text/plain`): la usan clientes sin HTML y mejora la entrega frente a filtros de spam. */
export function renderMailText(body: MailDocument, signature: MailDocument | null): string {
  const renderInline = (nodes: MailInlineNode[] | undefined) => (nodes ?? []).map(node => node.type === 'hardBreak' ? '\n' : node.type === 'placeholder' ? (node.attrs.name === 'logo' ? '' : '{' + node.attrs.name + '}') : node.marks?.find(mark => mark.type === 'link') ? node.text + ' (' + (node.marks.find(mark => mark.type === 'link') as Extract<MailMark, { type: 'link' }>).attrs.href.replace(/^mailto:/i, '') + ')' : node.text).join('')
  const renderBlocks = (nodes: MailBlockNode[], prefix = ''): string[] => nodes.flatMap((node): string[] => {
    if (node.type === 'paragraph' || node.type === 'heading') return [prefix + renderInline(node.content)]
    if (node.type === 'bulletList' || node.type === 'orderedList') return node.content.flatMap((item, index) => renderBlocks(item.content).map((line, lineIndex) => (lineIndex ? '   ' : node.type === 'bulletList' ? ' - ' : ' ' + (index + 1) + '. ') + line))
    if (node.type === 'blockquote') return renderBlocks(node.content, '> ')
    if (node.type === 'horizontalRule') return ['----']
    if (node.type === 'html') return mailHtmlToText(node.attrs.html.replace(logoMarkerPattern, '')).split('\n')
    return []
  })
  const lines = renderBlocks(body.content)
  if (signature && !isMailDocumentEmpty(signature)) lines.push('', '--', ...renderBlocks(signature.content).filter(line => line.trim()))
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'
}
