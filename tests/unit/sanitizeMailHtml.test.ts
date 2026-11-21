import { describe, expect, it } from 'vitest'
import { mailHtmlToText, sanitizeMailHtml } from '../../shared/mail/sanitizeMailHtml'
import { styledSignature } from '../support/styledSignature'

describe('sanitizeMailHtml', () => {
  it('keeps the styled signature: table, inline styles, colors and mailto/tel links', () => {
    const html = sanitizeMailHtml(styledSignature)
    expect(html).not.toContain('<!--')
    expect(html).toContain('<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,sans-serif;color:#111a35">')
    expect(html).toContain('<td style="border-left:4px solid #1769ff;padding:2px 0 2px 12px">')
    expect(html).toContain('FISCE<span style="color:#1769ff">NIX</span>')
    expect(html).toContain('<a href="mailto:correo@fiscenix.com" style="color:#1769ff;text-decoration:none">correo@fiscenix.com</a>')
    expect(html).toContain('<a href="tel:+525512345678" style="color:#111a35;text-decoration:none">+52 55 1234 5678</a>')
    // Volver a sanear lo ya saneado no cambia nada (lo guarda el Host y lo vuelve a validar Main).
    expect(sanitizeMailHtml(html)).toBe(html)
    expect(mailHtmlToText(html)).toBe('FISCENIX\nSOLUCIONES CONTABLES\nNombre Apellido\ncorreo@fiscenix.com | +52 55 1234 5678')
  })

  it('removes scripts, event handlers, dangerous links, remote images and unsafe styles', () => {
    const attacks = [
      ['<script>alert(1)</script><p>ok</p>', '<p>ok</p>'],
      ['<img src=x onerror=alert(1)>', '<img>'],
      ['<a href="javascript:alert(1)">x</a>', '<a>x</a>'],
      ['<a href="java&#115;cript&#58;alert(1)">x</a>', '<a>x</a>'],
      ['<a href=" JAVASCRIPT:alert(1)">x</a>', '<a>x</a>'],
      ['<div style="background:url(https://rastreo.mx/p.gif);color:red">x</div>', '<div style="color:red">x</div>'],
      ['<div style="width:expression(alert(1))">x</div>', '<div>x</div>'],
      ['<p onclick="x()" class="a" id="b">x</p>', '<p>x</p>'],
      ['<img src="https://rastreo.mx/pixel.gif">', '<img>'],
      ['<iframe src="https://x.mx"></iframe><style>p{}</style><svg><script>x</script></svg>fin', 'fin'],
      ['<p>a <b>b</p> c', '<p>a <b>b</b></p> c'],
      ['1 < 2 & 3 > 2 &amp; <', '1 &lt; 2 &amp; 3 &gt; 2 &amp; &lt;'],
      ['<p title="x&quot; onmouseover=&quot;alert(1)">t</p>', '<p title="x&quot; onmouseover=&quot;alert(1)">t</p>'],
      // El `<script>` interior se descarta con su contenido; lo que sobra queda como texto inofensivo.
      ['<<script>script>alert(1)<</script>/script>', '&lt;/script&gt;']
    ]
    for (const [input, expected] of attacks) expect(sanitizeMailHtml(input!)).toBe(expected)
  })
})

describe('styled HTML block in mail documents', () => {
  it('sanitizes the block in every layer, fills placeholders escaped and sends it with its inline styles', async () => {
    const { parseMailDocument, fillMailPlaceholders, renderMailHtml, renderMailText, renderMailDocumentHtml } = await import('../../shared/mail/mailDocument')
    const { fitsSimpleEditor } = await import('../../src/modules/mail/mailHtmlView')
    const document = parseMailDocument({ type: 'doc', content: [{ type: 'html', attrs: { html: '<div style="color:#1769ff" onclick="x()">Hola {cliente}<script>alert(1)</script></div>' } }] })
    expect(document).toEqual({ type: 'doc', content: [{ type: 'html', attrs: { html: '<div style="color:#1769ff">Hola {cliente}</div>' } }] })
    const filled = fillMailPlaceholders(document, { cliente: 'Ana <Ruiz>' })
    expect(renderMailHtml(filled, parseMailDocument({ type: 'doc', content: [{ type: 'html', attrs: { html: styledSignature } }] }), { officeLogoSource: null }))
      .toContain('<div style="color:#1769ff">Hola Ana &lt;Ruiz&gt;</div>')
    expect(renderMailText(filled, null)).toBe('Hola Ana <Ruiz>\n')
    expect(renderMailDocumentHtml(filled, { officeLogoSource: null, hasInlineStyles: false })).toBe('<div data-mail-style="color:#1769ff">Hola Ana &lt;Ruiz&gt;</div>')
    expect(() => parseMailDocument({ type: 'doc', content: [{ type: 'html', attrs: { html: '<script>x</script>' } }] })).toThrow()
    // El código que el editor sencillo representa sigue yendo al editor; tablas o estilos van al bloque con estilo.
    expect(fitsSimpleEditor('<p>Hola <strong>Ana</strong> <a href="https://x.mx/?a=b">sitio</a> <span data-mail-placeholder="cliente">Cliente</span></p>')).toBe(true)
    expect(fitsSimpleEditor(styledSignature)).toBe(false)
    expect(fitsSimpleEditor('<p style="color:red">x</p>')).toBe(false)
  })
})

describe('styled HTML round trip in the editor source', () => {
  it('does not grow trailing empty paragraphs when the source is tidied again', async () => {
    const { parseMailDocument, renderMailDocumentHtml } = await import('../../shared/mail/mailDocument')
    const withTrailing = parseMailDocument({ type: 'doc', content: [{ type: 'html', attrs: { html: '<div style="color:red">Firma</div>' } }, { type: 'paragraph' }, { type: 'paragraph' }] })
    expect(renderMailDocumentHtml(withTrailing, { officeLogoSource: null })).toBe('<div style="color:red">Firma</div>')
  })
})

describe('formatMailHtml with styled HTML', () => {
  it('indents tables and divs, and keeps embedded images while dropping only the office logo source', async () => {
    const { formatMailHtml } = await import('../../src/modules/mail/formatMailHtml')
    expect(formatMailHtml('<table style="color:red"><tr><td>Hola <b>Ana</b></td></tr></table>'))
      .toBe('<table style="color:red">\n  <tr>\n    <td>Hola <b>Ana</b>\n    </td>\n  </tr>\n</table>')
    expect(formatMailHtml('<img src="data:image/png;base64,AAAA"><img data-office-logo="true" src="data:image/png;base64,BBBB">'))
      .toBe('<img src="data:image/png;base64,AAAA">\n<img data-office-logo="true">')
  })
})

describe('office logo chip and AI prompt', () => {
  it('draws the logo chip and {logo} as the inline office logo, and keeps the marker when rebuilding the source', async () => {
    const { parseMailDocument, renderMailDocumentHtml, renderMailText, usesOfficeLogo, defaultMailBodyTemplate } = await import('../../shared/mail/mailDocument')
    const withChip = parseMailDocument({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'placeholder', attrs: { name: 'logo' } }, { type: 'text', text: ' Despacho' }] }] })
    expect(renderMailDocumentHtml(withChip, { officeLogoSource: 'cid:office-logo@contapp' })).toContain('<img src="cid:office-logo@contapp" alt="Logo" style="max-width:180px;height:auto;border:0;vertical-align:middle"> Despacho')
    expect(renderMailDocumentHtml(withChip, { officeLogoSource: null })).toBe('<p style="margin:0 0 12px">' + ' Despacho</p>')
    expect(renderMailText(withChip, null)).toBe('Despacho\n')
    const styled = parseMailDocument({ type: 'doc', content: [{ type: 'html', attrs: { html: '<td>{logo}</td>' } }] })
    expect(renderMailDocumentHtml(styled, { officeLogoSource: 'cid:x' })).toContain('<img src="cid:x" alt="Logo"')
    expect(renderMailDocumentHtml(styled, { officeLogoSource: 'cid:x', keepsLogoMarker: true })).toBe(styled.content[0]!.type === 'html' ? styled.content[0]!.attrs.html : '')
    expect([usesOfficeLogo(withChip), usesOfficeLogo(styled), usesOfficeLogo(defaultMailBodyTemplate)]).toEqual([true, true, false])
  })

  it('builds a prompt with the HTML rules, the placeholders of its purpose and asking for missing data first', async () => {
    const { buildMailAiPrompt } = await import('../../src/modules/mail/buildMailAiPrompt')
    const signature = buildMailAiPrompt({ purpose: 'signature', request: 'Firma azul con mi teléfono', officeName: 'Despacho Ruiz' })
    expect(signature).toContain('Crea una firma de correo electrónico en HTML para el despacho contable "Despacho Ruiz"')
    expect(signature).toContain('Firma azul con mi teléfono')
    expect(signature).toContain('pregúntame en una sola lista los datos que te falten')
    expect(signature).toContain('{usuario}')
    expect(signature).toContain('{logo}')
    expect(signature).not.toContain('{cliente}')
    expect(buildMailAiPrompt({ purpose: 'body', request: '', officeName: '' })).toContain('{cliente} — nombre del cliente')
  })
})
