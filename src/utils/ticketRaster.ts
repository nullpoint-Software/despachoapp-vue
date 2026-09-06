import JsBarcode from 'jsbarcode'

/** Raster pages at 203.2 dpi (8 pixels/mm), independent of a browser print dialog. */
export async function rasterTicket(
  ticket: { title: string; text: string; logo: string; barcode: string },
  paperWidth: 58 | 80
): Promise<string[]> {
  const width = paperWidth * 8
  const padding = 24
  const fontSize = Math.floor((width - padding * 2) / 48 / 0.61)
  const lineHeight = Math.ceil(fontSize * 1.3)
  const logo = new Image()
  logo.src = ticket.logo
  await logo.decode()
  const barcode = document.createElement('canvas')
  JsBarcode(barcode, ticket.barcode, {
    format: 'CODE128',
    width: 2,
    height: 70,
    fontSize: 18,
    margin: 16
  })
  const pages: string[] = []
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = 1500
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo preparar el ticket para imprimir.')
  let y = padding
  function clear() {
    ctx!.fillStyle = '#fff'
    ctx!.fillRect(0, 0, width, canvas.height)
    ctx!.fillStyle = '#000'
    ctx!.font = `${fontSize}px "Courier New", monospace`
    ctx!.textBaseline = 'top'
    y = padding
  }
  function flush() {
    const page = document.createElement('canvas')
    page.width = width
    page.height = Math.min(canvas.height, y + padding)
    const output = page.getContext('2d')
    if (!output) throw new Error('No se pudo preparar el ticket.')
    output.drawImage(canvas, 0, 0)
    pages.push(page.toDataURL('image/png').split(',')[1])
    if (pages.length > 40)
      throw new Error('El ticket es demasiado largo. Reduce el periodo del corte.')
    clear()
  }
  clear()
  const scale = Math.min(240 / logo.naturalWidth, 110 / logo.naturalHeight)
  const logoWidth = logo.naturalWidth * scale,
    logoHeight = logo.naturalHeight * scale
  ctx.drawImage(logo, (width - logoWidth) / 2, y, logoWidth, logoHeight)
  y += logoHeight + lineHeight
  const rows = [ticket.title, '', ...ticket.text.replace(/\r/g, '').split('\n')]
  for (const row of rows) {
    // Break unusually long input as well as preformatted 48-column ticket rows.
    const parts = row.match(/.{1,48}/gu) || ['']
    for (const part of parts) {
      if (y + lineHeight + padding > canvas.height) flush()
      ctx.fillText(part, padding, y)
      y += lineHeight
    }
  }
  const barcodeScale = Math.min(1, (width - padding * 2) / barcode.width)
  const barcodeHeight = barcode.height * barcodeScale
  if (y + barcodeHeight + padding > canvas.height) flush()
  ctx.drawImage(
    barcode,
    (width - barcode.width * barcodeScale) / 2,
    y,
    barcode.width * barcodeScale,
    barcodeHeight
  )
  y += barcodeHeight
  flush()
  return pages
}
