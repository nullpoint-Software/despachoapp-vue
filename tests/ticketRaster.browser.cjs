const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core')
;(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
  })
  try {
    const page = await browser.newPage()
    const url = process.env.TICKET_TEST_URL || 'http://127.0.0.1:5189/__thermal_test__'
    await page.route(url, (route) =>
      route.fulfill({ contentType: 'text/html', body: '<html><div id="app"></div></html>' })
    )
    await page.goto(url)
    const result = await page.evaluate(async () => {
      const { rasterTicket } = await import('/src/utils/ticketRaster.ts')
      const { ticketProfile, ticketTextLayout, paymentBarcodeId } =
        await import('/src/utils/ticketLayout.ts')
      const { default: JsBarcode } = await import('/node_modules/.vite/deps/jsbarcode.js')
      const logo = '/src/assets/img/logsymbolblack.png',
        outputs = []
      for (const paper of [58, 80])
        for (const id of ['12345678', '7af03d50-1b28-4fa2-b369-cf07d5fbdc91']) {
          const profile = ticketProfile(paper),
            layout = ticketTextLayout(paper),
            text =
              layout.dashLine +
              '\n' +
              layout.centerText('TICKET DE PAGO') +
              '\n' +
              layout.row('Cliente', 'Empresa de prueba con nombre largo') +
              '\n' +
              layout.row('Cobramos', '$1250.00')
          if (text.split('\n').some((row) => Array.from(row).length > profile.columns))
            throw Error('Invalid column width')
          const pages = await rasterTicket({ title: 'Ticket', text, logo, barcode: id }, paper)
          const expected = document.createElement('canvas')
          JsBarcode(expected, id, {
            format: 'CODE128',
            width: 2,
            height: 96,
            margin: 20,
            displayValue: false
          })
          const eb = expected
            .getContext('2d')
            .getImageData(0, Math.floor(expected.height / 2), expected.width, 1).data
          const pattern = Array.from({ length: expected.width }, (_, i) =>
            eb[i * 4] === 0 ? '1' : '0'
          ).join('')
          let found = false
          for (const encoded of pages) {
            const img = new Image()
            img.src = 'data:image/png;base64,' + encoded
            await img.decode()
            if (img.width !== paper * 8 || img.height > 1600)
              throw Error('Invalid image dimensions')
            const c = document.createElement('canvas')
            c.width = img.width
            c.height = img.height
            const ctx = c.getContext('2d')
            ctx.drawImage(img, 0, 0)
            const pixels = ctx.getImageData(0, 0, c.width, c.height).data
            for (let i = 0; i < pixels.length; i += 4)
              if (
                (pixels[i] !== 0 && pixels[i] !== 255) ||
                pixels[i] !== pixels[i + 1] ||
                pixels[i] !== pixels[i + 2] ||
                pixels[i + 3] !== 255
              )
                throw Error('Gray or transparent printing pixel')
            if (expected.width > profile.printableWidth) {
              const x = Math.floor(c.width / 2)
              const scan = Array.from({ length: c.height }, (_, y) =>
                pixels[(y * c.width + x) * 4] === 0 ? '1' : '0'
              ).join('')
              found ||= scan.includes(pattern)
            } else {
              for (let y = 0; y < c.height; y++) {
                const scan = Array.from({ length: c.width }, (_, x) =>
                  pixels[(y * c.width + x) * 4] === 0 ? '1' : '0'
                ).join('')
                if (scan.includes(pattern)) {
                  found = true
                  break
                }
              }
            }
          }
          if (!found) throw Error('Full ID barcode was rescaled or corrupted')
          outputs.push({ paper, id, pages: pages.length })
        }
      let missing = false
      try {
        await rasterTicket({ title: '', text: '', logo, barcode: '' }, 58)
      } catch {
        missing = true
      }
      if (!missing) throw Error('Missing ID allowed')
      if (paymentBarcodeId({ id: 0 }) !== '0' || paymentBarcodeId({ folio: 'wrong' }) !== '')
        throw Error('Wrong payment identifier')
      const long = await rasterTicket(
        { title: '', text: 'Pago\n'.repeat(170), logo, barcode: '12345678' },
        58
      )
      if (long.length < 2) throw Error('Pagination failed')
      const { createApp, h } = await import('/node_modules/.vite/deps/vue.js')
      const { default: Preview } =
        await import('/src/components/adminApp/Print/ThermalTicketPreview.vue')
      window.expected = await rasterTicket(
        { title: '', text: 'Ticket de pago\nTotal $1250.00', logo, barcode: '12345678' },
        58
      )
      createApp({
        render: () =>
          h(Preview, {
            text: 'Ticket de pago\nTotal $1250.00',
            logo,
            barcode: '12345678',
            paperWidth: 58
          })
      }).mount('#app')
      return outputs
    })
    await page.locator('.thermal-proof-scroll img').first().waitFor()
    assert.equal(
      await page.locator('.thermal-proof-scroll img').first().getAttribute('src'),
      await page.evaluate(() => 'data:image/png;base64,' + window.expected[0])
    )
    console.log(
      'PASS binary pixels, 32/48 columns, full ID bars without resizing, paper sizes, pagination, missing-ID guard and identical preview',
      result
    )
    if (process.env.TICKET_SCREENSHOT)
      await page.screenshot({ path: process.env.TICKET_SCREENSHOT, fullPage: true })
  } finally {
    await browser.close()
  }
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
