import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../src/assets/main.css', import.meta.url), 'utf8')
const contractStart = css.lastIndexOf('Contrato visual v6')

if (contractStart === -1) {
  throw new Error('No se encontró el contrato cromático activo en src/assets/main.css')
}

const contract = css.slice(contractStart)
const rootBlock = contract.match(/:root\s*\{([^}]*)\}/)?.[1]

if (!rootBlock) {
  throw new Error('No se encontraron los tokens de referencia de :root')
}

const readVariables = (block) =>
  Object.fromEntries(
    [...block.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()])
  )

const palettes = new Map()
const palettePattern = /html\[data-br-palette='([^']+)'\]\s*\{([^}]*)\}/g

for (const match of contract.matchAll(palettePattern)) {
  palettes.set(match[1], { ...readVariables(rootBlock), ...readVariables(match[2]) })
}

const expectedPalettes = [
  'phantom',
  'darkhour',
  'golden',
  'tachyon',
  'ledger',
  'indigo',
  'oled',
  'ember',
  'sakura',
  'steel'
]

const requiredTokens = [
  'palette-bg',
  'palette-surface-1',
  'palette-surface-2',
  'palette-control',
  'palette-control-text',
  'palette-control-muted',
  'palette-text',
  'palette-muted',
  'palette-line-strong',
  'palette-accent',
  'palette-accent-text'
]

function parseOklch(value, palette, token) {
  const match = value?.match(
    /^oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)(?:deg)?(?:\s*\/\s*[\d.]+%?)?\s*\)$/i
  )

  if (!match) {
    throw new Error(`${palette}: ${token} debe ser un color OKLCH opaco; se recibió "${value}"`)
  }

  return {
    l: Number(match[1]) / 100,
    c: Number(match[2]),
    h: (Number(match[3]) * Math.PI) / 180
  }
}

function toLinearSrgb(color) {
  const a = color.c * Math.cos(color.h)
  const b = color.c * Math.sin(color.h)
  const lPrime = color.l + 0.3963377774 * a + 0.2158037573 * b
  const mPrime = color.l - 0.1055613458 * a - 0.0638541728 * b
  const sPrime = color.l - 0.0894841775 * a - 1.291485548 * b
  const l = lPrime ** 3
  const m = mPrime ** 3
  const s = sPrime ** 3

  return {
    r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
  }
}

function luminance(value, palette, token) {
  const rgb = toLinearSrgb(parseOklch(value, palette, token))
  const epsilon = 0.0001

  if (Object.values(rgb).some((channel) => channel < -epsilon || channel > 1 + epsilon)) {
    throw new Error(`${palette}: ${token} (${value}) queda fuera del gamut sRGB`)
  }

  const clamp = (channel) => Math.min(1, Math.max(0, channel))
  return 0.2126 * clamp(rgb.r) + 0.7152 * clamp(rgb.g) + 0.0722 * clamp(rgb.b)
}

function contrast(first, second) {
  const light = Math.max(first, second)
  const dark = Math.min(first, second)
  return (light + 0.05) / (dark + 0.05)
}

const tests = [
  ['Texto principal / fondo', 'palette-text', 'palette-bg', 7],
  ['Texto principal / superficie 1', 'palette-text', 'palette-surface-1', 7],
  ['Texto principal / superficie 2', 'palette-text', 'palette-surface-2', 7],
  ['Texto secundario / fondo', 'palette-muted', 'palette-bg', 4.5],
  ['Texto secundario / superficie 1', 'palette-muted', 'palette-surface-1', 4.5],
  ['Texto secundario / superficie 2', 'palette-muted', 'palette-surface-2', 4.5],
  ['Acento como texto / fondo', 'palette-accent', 'palette-bg', 4.5],
  ['Acento como texto / superficie 1', 'palette-accent', 'palette-surface-1', 4.5],
  ['Acento como texto / superficie 2', 'palette-accent', 'palette-surface-2', 4.5],
  ['Texto / acento', 'palette-accent-text', 'palette-accent', 7],
  ['Texto de control / control', 'palette-control-text', 'palette-control', 7],
  ['Texto secundario de control / control', 'palette-control-muted', 'palette-control', 4.5],
  ['Borde fuerte / fondo', 'palette-line-strong', 'palette-bg', 3],
  ['Borde fuerte / superficie 1', 'palette-line-strong', 'palette-surface-1', 3],
  ['Borde fuerte / superficie 2', 'palette-line-strong', 'palette-surface-2', 3]
]

const failures = []
const report = []

for (const palette of expectedPalettes) {
  const tokens = palettes.get(palette)

  if (!tokens) {
    failures.push(`${palette}: falta la definición de la paleta`)
    continue
  }

  for (const token of requiredTokens) {
    if (!tokens[token]) failures.push(`${palette}: falta --${token}`)
  }

  const luminances = Object.fromEntries(
    requiredTokens
      .filter((token) => tokens[token])
      .map((token) => [token, luminance(tokens[token], palette, token)])
  )
  const ratios = tests.map(([label, foreground, background, minimum]) => {
    const ratio = contrast(luminances[foreground], luminances[background])

    if (ratio + Number.EPSILON < minimum) {
      failures.push(`${palette}: ${label} = ${ratio.toFixed(2)}:1; mínimo ${minimum}:1`)
    }

    return { label, ratio }
  })
  const minimumFor = (prefix) =>
    Math.min(...ratios.filter(({ label }) => label.startsWith(prefix)).map(({ ratio }) => ratio))

  report.push({
    Paleta: palette,
    'Texto principal': `${minimumFor('Texto principal').toFixed(2)}:1`,
    'Texto secundario': `${minimumFor('Texto secundario /').toFixed(2)}:1`,
    'Acento en oscuro': `${minimumFor('Acento como texto').toFixed(2)}:1`,
    'Texto en acento': `${minimumFor('Texto / acento').toFixed(2)}:1`,
    'Texto de control': `${minimumFor('Texto de control').toFixed(2)}:1`,
    'Secundario control': `${minimumFor('Texto secundario de control').toFixed(2)}:1`,
    'Borde fuerte': `${minimumFor('Borde fuerte').toFixed(2)}:1`
  })
}

console.table(report)

if (failures.length) {
  console.error('\nFalló la auditoría de contraste:\n- ' + failures.join('\n- '))
  process.exitCode = 1
} else {
  console.log(
    '\nTodas las paletas cumplen WCAG AAA para texto principal y AA para texto secundario.'
  )
}
