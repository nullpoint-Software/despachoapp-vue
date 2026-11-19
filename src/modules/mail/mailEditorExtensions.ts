import { Mark, Node, mergeAttributes, nodeInputRule } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import TextAlign from '@tiptap/extension-text-align'
import { isMailPlaceholder, mailPlaceholders, mailTextStyleCss, readMailTextStyle, type MailPlaceholder } from '../../../shared/mail/mailDocument'
import { sanitizeMailHtml } from '../../../shared/mail/sanitizeMailHtml'
import { renderMailPreview } from './mailHtmlView'

/**
 * Bloque «HTML con estilo» (2026-10-18): tablas, colores y estilos en línea que el editor sencillo no representa. Es
 * atómico: se ve con sus estilos dentro de la hoja (los `style` pasan a `data-mail-style` y se aplican por CSSOM, que
 * la política de seguridad de la ventana permite) y se edita en «HTML y vista previa». El HTML llega saneado y se vuelve
 * a sanear antes de dibujarlo. Se dibuja en un shadow root (`renderMailPreview`) para que los estilos de la app no lo
 * toquen, y se puede arrastrar a otro lugar de la hoja (2026-10-19, "mover componentes a voluntad").
 */
export const MailHtmlBlock = Node.create({
  name: 'html',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() { return { html: { default: '' } } },
  parseHTML() { return [{ tag: 'div[data-mail-html]', getAttrs: element => ({ html: sanitizeMailHtml(element.getAttribute('data-mail-html') ?? '') }) }] },
  renderHTML({ node }) { return ['div', { 'data-mail-html': String(node.attrs.html) }] },
  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('div')
      dom.className = 'mail-html-block'
      const content = document.createElement('div')
      renderMailPreview(content, sanitizeMailHtml(String(node.attrs.html)).replace(/ style="/g, ' data-mail-style="'))
      const caption = document.createElement('p')
      caption.className = 'mail-html-caption'
      caption.textContent = 'HTML con estilo · edítalo en «HTML y vista previa»'
      dom.append(content, caption)
      return { dom }
    }
  }
})

/**
 * Marcador como chip (2026-10-18, pedido del usuario: "lo de {}, que sean arrastrables"): nodo en línea atómico
 * (`placeholder`, el mismo tipo que valida `parseMailDocument`). Se arrastra dentro del texto como una sola pieza y
 * llega desde la paleta del editor por arrastre (HTML con `data-mail-placeholder`) o con clic. Escribir `{cliente}`
 * también lo convierte en chip. Al redactar, `fillMailPlaceholders` lo reemplaza por el dato.
 */
export const MailPlaceholderNode = Node.create({
  name: 'placeholder',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return { name: { default: 'cliente', parseHTML: element => element.getAttribute('data-mail-placeholder'), renderHTML: attributes => ({ 'data-mail-placeholder': attributes.name as string }) } }
  },
  parseHTML() { return [{ tag: 'span[data-mail-placeholder]', getAttrs: element => isMailPlaceholder(element.getAttribute('data-mail-placeholder')) ? null : false }] },
  renderHTML({ node, HTMLAttributes }) { return ['span', mergeAttributes(HTMLAttributes, { class: 'mail-placeholder-chip' }), mailPlaceholders[node.attrs.name as MailPlaceholder]] },
  renderText({ node }) { return '{' + String(node.attrs.name) + '}' },
  addInputRules() {
    return [nodeInputRule({ find: /\{(cliente|documento|despacho|usuario|logo)\}$/, type: this.type, getAttributes: match => ({ name: match[1] }) })]
  }
})

/**
 * Color y tamaño de letra (2026-10-19): marca `textStyle` con `color` y `fontSize`, la que valida `parseMailDocument`.
 * `renderHTML` produce el `style` real (código HTML y portapapeles); en la hoja se dibuja con una vista de marca que
 * aplica el estilo por CSSOM, porque la ventana bloquea el atributo `style`. Al pegar, `span` con color o tamaño
 * permitidos se convierte en esta marca; lo demás del `style` se descarta.
 */
export const MailTextStyleMark = Mark.create({
  name: 'textStyle',
  addAttributes() {
    return {
      color: { default: null, parseHTML: element => readMailTextStyle(element.getAttribute('style') ?? '').color ?? null, renderHTML: () => ({}) },
      fontSize: { default: null, parseHTML: element => readMailTextStyle(element.getAttribute('style') ?? '').fontSize ?? null, renderHTML: () => ({}) }
    }
  },
  parseHTML() {
    return [{ tag: 'span[style]', getAttrs: element => { const style = readMailTextStyle(element.getAttribute('style') ?? ''); return style.color || style.fontSize ? null : false } }]
  },
  renderHTML({ mark }) { const style = mailTextStyleCss(mark.attrs); return ['span', style ? { style } : {}, 0] },
  addMarkView() {
    return ({ mark }) => {
      const dom = document.createElement('span')
      dom.style.cssText = mailTextStyleCss(mark.attrs)
      return { dom, contentDOM: dom }
    }
  }
})

/** HTML que lleva un marcador al soltarlo en el editor (la paleta lo pone en el `dataTransfer`). */
export function placeholderDragHtml(name: MailPlaceholder): string { return '<span data-mail-placeholder="' + name + '">' + mailPlaceholders[name] + '</span>' }

/**
 * Logo del despacho dentro del cuerpo o la firma ([[MAIL]]). Es un bloque atómico sin atributos: el documento sólo dice
 * "aquí va el logo". El editor lo dibuja con el logo GLOBAL vigente (`logoDataUrl`) y, al enviar, Main lo incrusta como
 * imagen `cid:`. Si el despacho no tiene logo, se ve un recuadro que lo explica y el correo lo omite.
 */
export const OfficeLogo = Node.create<{ readLogoDataUrl: () => string | null }>({
  name: 'officeLogo',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addOptions() { return { readLogoDataUrl: () => null } },
  parseHTML() { return [{ tag: 'img[data-office-logo]' }, { tag: 'div[data-office-logo]' }] },
  renderHTML() {
    const logoDataUrl = this.options.readLogoDataUrl()
    return logoDataUrl
      ? ['img', { 'data-office-logo': 'true', src: logoDataUrl, alt: 'Logo del despacho', class: 'mail-office-logo' }]
      : ['div', { 'data-office-logo': 'true', class: 'mail-office-logo is-missing' }, 'Logo del despacho (aún no hay logo en Configuración → Despacho)']
  }
})

/**
 * Extensiones del editor de correo, tomadas del editor de Notas pero reducidas a lo que los clientes de correo muestran
 * bien y a lo que `parseMailDocument` acepta: párrafos, títulos 1–3, negrita, cursiva, subrayado, tachado, listas, cita,
 * línea, salto de línea, alineación, enlaces https/mailto, color y tamaño de letra, el logo, los marcadores y el bloque
 * «HTML con estilo». Sin código, tablas ni imágenes libres: lo que no está en el esquema se descarta al pegar.
 */
export function createMailEditorExtensions(readLogoDataUrl: () => string | null) {
  return [
    StarterKit.configure({ heading: { levels: [1, 2, 3] }, code: false, codeBlock: false, link: { openOnClick: false, autolink: true, protocols: ['https', 'mailto'], defaultProtocol: 'https' } }),
    TextAlign.configure({ types: ['heading', 'paragraph'], alignments: ['left', 'center', 'right', 'justify'] }),
    OfficeLogo.configure({ readLogoDataUrl }),
    MailPlaceholderNode,
    MailTextStyleMark,
    MailHtmlBlock
  ]
}
