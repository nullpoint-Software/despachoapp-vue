import JsBarcode from 'jsbarcode'
import { ticketProfile } from './ticketLayout'

/** One source for preview and printing: 8 dots/mm, solid black pixels, no barcode resampling. */
export async function rasterTicket(
  ticket: { title: string; text: string; logo: string; barcode: string },
  paperWidth: 58 | 80
): Promise<string[]> {
  if (!ticket.barcode)
    throw new Error('El pago no tiene ID. No se puede generar su código de barras.')
  const { columns, printableWidth, fontSize, lineHeight } = ticketProfile(paperWidth)
  const width = paperWidth * 8,
    padding = (width - printableWidth) / 2,
    verticalPadding = 24
  const logo = new Image()
  logo.src = ticket.logo
  await logo.decode()
  const barcode = document.createElement('canvas')
  JsBarcode(barcode, ticket.barcode, {
    format: 'CODE128',
    width: 2,
    height: 96,
    margin: 20,
    displayValue: false,
    background: '#ffffff',
    lineColor: '#000000'
  })
  const rotated = barcode.width > printableWidth
  const symbolWidth = rotated ? barcode.height : barcode.width,
    symbolHeight = rotated ? barcode.width : barcode.height
  if (
    symbolWidth > printableWidth ||
    symbolHeight + Math.ceil(Array.from(ticket.barcode).length / columns) * lineHeight + 48 > 1500
  )
    throw new Error('La ID es demasiado larga para un código de barras legible en este papel.')
  const pages: string[] = [],
    canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = 1500
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo preparar el ticket.')
  let y = verticalPadding
  function clear() {
    ctx!.fillStyle = '#fff'
    ctx!.fillRect(0, 0, width, canvas.height)
    ctx!.fillStyle = '#000'
    ctx!.font = 'bold ' + fontSize + 'px "Courier New", monospace'
    ctx!.textBaseline = 'top'
    ctx!.imageSmoothingEnabled = false
    y = verticalPadding
  }
  function flush() {
    const page = document.createElement('canvas')
    page.width = width
    page.height = Math.ceil(y + verticalPadding)
    const out = page.getContext('2d')
    if (!out) throw new Error('No se pudo preparar el ticket.')
    out.drawImage(canvas, 0, 0)
    const pixels = out.getImageData(0, 0, page.width, page.height)
    for (let i = 0; i < pixels.data.length; i += 4) {
      const v =
        (pixels.data[i] * 299 + pixels.data[i + 1] * 587 + pixels.data[i + 2] * 114) / 1000 < 200
          ? 0
          : 255
      pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = v
      pixels.data[i + 3] = 255
    }
    out.putImageData(pixels, 0, 0)
    pages.push(page.toDataURL('image/png').split(',')[1])
    if (pages.length > 40)
      throw new Error('El ticket es demasiado largo. Reduce el periodo del corte.')
    clear()
  }
  function text(value: string, centered = false) {
    const chars = Array.from(value)
    for (let i = 0; i < Math.max(1, chars.length); i += columns) {
      if (y + lineHeight + verticalPadding > canvas.height) flush()
      const line = chars.slice(i, i + columns).join('')
      const x = centered ? Math.round((width - ctx!.measureText(line).width) / 2) : padding
      ctx!.fillText(line, x, y)
      y += lineHeight
    }
  }
  clear()
  const scale = Math.min(160 / logo.naturalWidth, 96 / logo.naturalHeight),
    lw = Math.round(logo.naturalWidth * scale),
    lh = Math.round(logo.naturalHeight * scale)
  ctx.drawImage(logo, Math.floor((width - lw) / 2), y, lw, lh)
  y += lh + lineHeight
  for (const row of ticket.text.replace(/\r/g, '').trimEnd().split('\n')) {
    if (/^[-=]{3,}$/.test(row)) {
      if (y + lineHeight + verticalPadding > canvas.height) flush()
      ctx.fillRect(padding, y + Math.floor(lineHeight / 2), printableWidth, row[0] === '=' ? 3 : 1)
      y += lineHeight
    } else text(row)
  }
  y += 8
  const idLines = Math.ceil(Array.from(ticket.barcode).length / columns)
  if (y + symbolHeight + idLines * lineHeight + verticalPadding > canvas.height) flush()
  ctx.save()
  if (rotated) {
    ctx.translate(Math.floor((width + symbolWidth) / 2), y)
    ctx.rotate(Math.PI / 2)
    ctx.drawImage(barcode, 0, 0)
  } else ctx.drawImage(barcode, Math.floor((width - symbolWidth) / 2), y)
  ctx.restore()
  y += symbolHeight
  text(ticket.barcode, true)
  flush()
  return pages
}
