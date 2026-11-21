/**
 * Color principal libre (ADR-039, adenda 2026-10-13): el usuario elige cualquier RGB y aquí se derivan los valores que
 * realmente se pintan en Light y en Dark, siempre legibles.
 * - Se conserva el tono y el croma en OKLCH y sólo se mueve la luminosidad: hacia oscuro en Light y hacia claro en Dark,
 *   en pasos de 0.01, hasta lograr ≥ 4.5:1 contra mesa, papel y sutil del tema (la regla que mide ui.spec.ts).
 * - Si el color queda fuera de sRGB se reduce el croma (bisección) en lugar de recortar canales: así la luminosidad avanza
 *   de forma monótona y el ciclo siempre termina (en el extremo quedan negro o blanco, que cumplen).
 * - El texto del botón principal es blanco o tinta, el que más contraste dé. Siempre llega a 4.5:1: el acento de Light
 *   cumple contra el papel blanco y el de Dark contra la mesa tinta.
 * Las superficies repiten las de `base.css`; `appearance.test.ts` comprueba que coincidan.
 */
export interface AccentTokens { accentColor: string; primaryBackgroundColor: string; primaryTextColor: string; focusColor: string }
export interface AccentPalette { light: AccentTokens; dark: AccentTokens }

export const minimumAccentContrast = 4.5
export const themeSurfaces = { light: ['#EDEDEA', '#FFFFFF', '#F4F4F1'], dark: ['#0B0B0B', '#161616', '#1C1C1C'] } as const
const paperTextColor = '#FFFFFF', inkTextColor = '#0B0B0B'
const hexPattern = /^#[0-9A-F]{6}$/

export function isHexColor(value: string): boolean { return hexPattern.test(value) }

function toLinear(channel: number): number { return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4 }
function fromLinear(channel: number): number { return channel <= .0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - .055 }
function hexToRgb(hex: string): [number, number, number] { return [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255) as [number, number, number] }
function rgbToHex(channels: readonly number[]): string {
  return '#' + channels.map(channel => Math.round(Math.min(1, Math.max(0, channel)) * 255).toString(16).padStart(2, '0')).join('').toUpperCase()
}
function relativeLuminance(hex: string): number {
  const [red, green, blue] = hexToRgb(hex).map(toLinear) as [number, number, number]
  return red * .2126 + green * .7152 + blue * .0722
}
/** Contraste WCAG 2 entre dos colores `#RRGGBB`. */
export function contrastRatio(first: string, second: string): number {
  const [lighter, darker] = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a) as [number, number]
  return (lighter + .05) / (darker + .05)
}

interface Oklch { lightness: number; chroma: number; hue: number }
function hexToOklch(hex: string): Oklch {
  const [red, green, blue] = hexToRgb(hex).map(toLinear) as [number, number, number]
  const long = Math.cbrt(.4122214708 * red + .5363325363 * green + .0514459929 * blue)
  const medium = Math.cbrt(.2119034982 * red + .6806995451 * green + .1073969566 * blue)
  const short = Math.cbrt(.0883024619 * red + .2817188376 * green + .6299787005 * blue)
  const lightness = .2104542553 * long + .7936177850 * medium - .0040720468 * short
  const axisA = 1.9779984951 * long - 2.4285922050 * medium + .4505937099 * short
  const axisB = .0259040371 * long + .7827717662 * medium - .8086757660 * short
  return { lightness, chroma: Math.hypot(axisA, axisB), hue: Math.atan2(axisB, axisA) }
}
/** RGB lineal (puede salir de 0..1 si el color no cabe en sRGB). */
function oklchToLinearRgb({ lightness, chroma, hue }: Oklch): [number, number, number] {
  const axisA = chroma * Math.cos(hue), axisB = chroma * Math.sin(hue)
  const long = (lightness + .3963377774 * axisA + .2158037573 * axisB) ** 3
  const medium = (lightness - .1055613458 * axisA - .0638541728 * axisB) ** 3
  const short = (lightness - .0894841775 * axisA - 1.2914855480 * axisB) ** 3
  return [4.0767416621 * long - 3.3077115913 * medium + .2309699292 * short, -1.2684380046 * long + 2.6097574011 * medium - .3413193965 * short, -.0041960863 * long - .7034186147 * medium + 1.7076147010 * short]
}
function isInGamut(color: Oklch): boolean { return oklchToLinearRgb(color).every(channel => channel >= -1e-6 && channel <= 1 + 1e-6) }
/** Mismo tono y luminosidad con el mayor croma (≤ el pedido) que cabe en sRGB. */
function toGamutHex(color: Oklch): string {
  let fitted = color
  if (!isInGamut(color)) {
    let low = 0, high = color.chroma
    for (let iteration = 0; iteration < 24; iteration++) { const middle = (low + high) / 2; if (isInGamut({ ...color, chroma: middle })) low = middle; else high = middle }
    fitted = { ...color, chroma: low }
  }
  return rgbToHex(oklchToLinearRgb(fitted).map(fromLinear))
}
function isReadableOn(color: string, surfaces: readonly string[]): boolean { return surfaces.every(surface => contrastRatio(color, surface) >= minimumAccentContrast) }

/** Acento legible para un tema: el elegido si ya cumple; si no, el primero que cumpla moviendo la luminosidad. */
function readableAccent(picked: string, theme: 'light' | 'dark'): string {
  const surfaces = themeSurfaces[theme]
  if (isReadableOn(picked, surfaces)) return picked
  const start = hexToOklch(picked), step = theme === 'light' ? -.01 : .01
  for (let lightness = start.lightness + step; lightness > 0 && lightness < 1; lightness += step) {
    const candidate = toGamutHex({ ...start, lightness })
    if (isReadableOn(candidate, surfaces)) return candidate
  }
  return theme === 'light' ? '#000000' : '#FFFFFF'
}
function tokensFor(accent: string): AccentTokens {
  const primaryTextColor = contrastRatio(paperTextColor, accent) >= contrastRatio(inkTextColor, accent) ? paperTextColor : inkTextColor
  return { accentColor: accent, primaryBackgroundColor: accent, primaryTextColor, focusColor: accent }
}
/** Tokens de Light y Dark para el color elegido (`#RRGGBB`); un valor inválido usa el azul sello. */
export function deriveAccentPalette(picked: string): AccentPalette {
  const color = isHexColor(picked) ? picked : '#1F3BD6'
  return { light: tokensFor(readableAccent(color, 'light')), dark: tokensFor(readableAccent(color, 'dark')) }
}
/** Escribe los tokens como propiedades en línea de <html>: ganan a los valores base de `base.css`. */
export function applyAccentTokens(style: CSSStyleDeclaration, tokens: AccentTokens): void {
  for (const [name, value] of Object.entries(tokens)) style.setProperty('--' + name, value)
}
