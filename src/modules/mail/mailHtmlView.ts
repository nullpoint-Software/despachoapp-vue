/**
 * Ayudas de la vista para el «HTML con estilo» del correo ([[MAIL]], 2026-10-18).
 *
 * La ventana de Fiscenix bloquea los atributos `style` en el HTML (CSP `style-src 'self'`). Para mostrar los estilos
 * del correo, el HTML de vista previa trae `data-mail-style` (ver `renderMailDocumentHtml` con `hasInlineStyles: false`)
 * y aquí se aplican por CSSOM (`element.style.cssText`), que la política sí permite. El HTML ya viene saneado.
 */
export function applyMailStyles(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>('[data-mail-style]').forEach(element => { element.style.cssText = element.getAttribute('data-mail-style') ?? '' })
}

/**
 * Dibuja HTML de correo (ya saneado, con `data-mail-style`) dentro de un shadow root de `host` (2026-10-19). Así las
 * hojas de la app no lo alcanzan: antes `tbody tr:hover` y los bordes y rellenos de tablas de base.css se aplicaban al
 * correo (en Dark, el pie se ponía negro al pasar el mouse). Dentro sólo valen el navegador y los estilos del correo,
 * como en un cliente de correo; la tipografía del contenedor se hereda.
 */
export function renderMailPreview(host: HTMLElement, html: string): void {
  const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' })
  root.innerHTML = html
  applyMailStyles(root)
}

/** Lo que el editor sencillo representa: si el código usa algo más, se guarda como bloque «HTML con estilo». */
const editorTags = new Set(['p', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'hr', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'a', 'span', 'img'])
const editorAttributes = new Set(['href', 'data-mail-placeholder', 'data-office-logo', 'alt', 'src', 'target', 'rel'])
/** Un `span` con sólo color y tamaño de letra es la marca de estilo del editor (2026-10-19). */
const editorSpanStyle = /^\s*((color|font-size)\s*:[^;]*;?\s*)+$/i

/**
 * ¿El código cabe en el editor sencillo sin perder nada? Sólo decide el camino (editor o bloque con estilo); la
 * seguridad no depende de esto: ambos caminos terminan en `parseMailDocument`, que valida o sanea.
 */
export function fitsSimpleEditor(html: string): boolean {
  for (const match of html.matchAll(/<([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>/g)) {
    const tag = match[1]!.toLowerCase()
    if (!editorTags.has(tag)) return false
    const source = match[2]!
    if (tag === 'span') {
      const style = /\sstyle\s*=\s*("([^"]*)"|'([^']*)')/i.exec(source)
      if (style && !editorSpanStyle.test(style[2] ?? style[3] ?? '')) return false
    }
    // Los valores entre comillas se quitan antes: un `=` dentro de una URL no es un atributo.
    for (const attribute of source.replace(/"[^"]*"|'[^']*'/g, '""').matchAll(/([^\s"'<>/=]+)\s*=/g)) {
      const name = attribute[1]!.toLowerCase()
      if (!editorAttributes.has(name) && !(tag === 'span' && name === 'style')) return false
    }
  }
  return true
}
