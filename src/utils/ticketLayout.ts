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
    right = width - left - 7
  const wrap = (value: unknown, size: number) => {
    const chars = Array.from(String(value ?? ''))
    const rows: string[] = []
    for (let i = 0; i < chars.length; i += size) rows.push(chars.slice(i, i + size).join(''))
    return rows.length ? rows : ['']
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
    row: (label: unknown, value: unknown) =>
      wrap(value, right)
        .map(
          (line, i) =>
            '| ' +
            (i ? '' : String(label)).slice(0, left).padEnd(left) +
            ' | ' +
            line.padEnd(right) +
            ' |'
        )
        .join('\n')
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
