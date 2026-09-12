export function ticketProfile(paperWidth: 58 | 80) {
  return {
    columns: paperWidth === 58 ? 32 : 48,
    printableWidth: paperWidth === 58 ? 384 : 576,
    fontSize: 20,
    lineHeight: 28
  }
}
export function ticketTextLayout(paperWidth: 58 | 80) {
  const width = ticketProfile(paperWidth).columns,
    left = paperWidth === 58 ? 10 : 14,
    right = width - left - 3
  const wrap = (value: unknown, size: number) => {
    const rows: string[] = []
    for (const paragraph of String(value ?? '')
      .replace(/\r/g, '')
      .split('\n')) {
      let chars = Array.from(paragraph.trim())
      while (chars.length > size) {
        const space = chars.slice(0, size + 1).lastIndexOf(' ')
        const split = space > 0 ? space : size
        rows.push(chars.slice(0, split).join(''))
        chars = chars.slice(split)
        while (chars[0] === ' ') chars.shift()
      }
      rows.push(chars.join(''))
    }
    return rows
  }
  return {
    width,
    dashLine: '-'.repeat(width),
    eqLine: '='.repeat(width),
    centerText: (value: unknown) =>
      wrap(value, width)
        .map(
          (line) =>
            ' '.repeat(Math.max(0, Math.floor((width - Array.from(line).length) / 2))) + line
        )
        .join('\n'),
    row: (label: unknown, value: unknown, align: 'left' | 'right' = 'left') => {
      const labels = wrap(label, left)
      const values = wrap(value, right)
      return Array.from({ length: Math.max(labels.length, values.length) }, (_, i) => {
        const labelLine = labels[i] ?? ''
        const valueLine = values[i] ?? ''
        const valuePadding =
          align === 'right' ? ' '.repeat(right - Array.from(valueLine).length) : ''
        return (
          labelLine +
          ' '.repeat(left - Array.from(labelLine).length) +
          ' | ' +
          valuePadding +
          valueLine
        )
      }).join('\n')
    }
  }
}
export function paymentBarcodeId(payment: {
  id?: string | number
  pago_id?: string | number
}): string {
  const id = payment.id ?? payment.pago_id
  if (id === undefined || id === null || String(id) === '') return ''
  return String(id)
}
