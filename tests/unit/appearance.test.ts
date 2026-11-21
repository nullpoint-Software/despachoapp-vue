import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { backgroundStyles, defaultPreferences, parseLocalPreferences, parsePreferencesPatch, previousAccentColors } from '../../shared/contracts/localPreferences'
import { contrastRatio, deriveAccentPalette, minimumAccentContrast, themeSurfaces } from '../../src/shared/styles/accentPalette'
import { buildPrimitivePath, computeMosaicGrid, createLoginMosaic, createSeededRandom, mosaicPrimitives, mosaicTones, tileSize } from '../../src/modules/workspace/loginMosaic'
import { drawBackgroundPattern, maximumDrawCallsPerFrame, type PatternStyle } from '../../src/shared/components/backgroundPatterns'

/** Apariencia del equipo (ADR-039 y adenda 2026-10-13): fondo, color principal libre y mosaico del acceso. */
describe('appearance preferences', () => {
  it('accepts known background styles and any #RRGGBB accent, and defaults older files', () => {
    expect(parsePreferencesPatch({ backgroundStyle: 'ribbons', accentColor: '#13703a' })).toEqual({ backgroundStyle: 'ribbons', accentColor: '#13703A' })
    expect(backgroundStyles).toHaveLength(10)
    for (const backgroundStyle of backgroundStyles) expect(parsePreferencesPatch({ backgroundStyle })).toEqual({ backgroundStyle })
    for (const value of [{ backgroundStyle: 'aurora' }, { backgroundStyle: null }, { accentColor: '#FF00' }, { accentColor: 'FF0000' }, { accentColor: '#GG0000' }, { accentColor: 'red' }, { accentColor: 3 }, { accentColor: '#FF0000 ' }])
      expect(() => parsePreferencesPatch(value)).toThrow()
    expect(defaultPreferences).toMatchObject({ backgroundStyle: 'dither', accentColor: '#1F3BD6' })
    // Un archivo guardado antes de ADR-039 no trae las claves nuevas: se completan sin descartar el resto.
    const previous = { theme: 'dark', isSidebarCollapsed: true, isBackgroundPaused: true, lastPage: 'fiscal', printer: { printerName: null, ticketWidthMillimeters: 58 }, shouldRunHostInBackground: false }
    expect(parseLocalPreferences(previous)).toEqual({ ...previous, backgroundStyle: 'dither', accentColor: '#1F3BD6', pageSizes: defaultPreferences.pageSizes })
    expect(parseLocalPreferences({ ...previous, backgroundStyle: 'none', accentColor: '#abcdef' })).toMatchObject({ backgroundStyle: 'none', accentColor: '#ABCDEF' })
  })
  it('migrates the presets saved by the first version to their hexadecimal value', () => {
    const previous = { ...defaultPreferences, accentColor: 'red' }
    expect(parseLocalPreferences(previous).accentColor).toBe('#B3132B')
    for (const [key, hex] of Object.entries(previousAccentColors)) expect(parseLocalPreferences({ ...defaultPreferences, accentColor: key }).accentColor).toBe(hex)
    expect(() => parseLocalPreferences({ ...defaultPreferences, accentColor: 'constructor' })).toThrow()
    // La migración es sólo al leer el archivo: el parche del Renderer exige hexadecimal.
    expect(() => parsePreferencesPatch({ accentColor: 'green' })).toThrow()
  })
})

const css = readFileSync('src/shared/styles/base.css', 'utf8').replace(/\r\n/g, '\n')
/** Tokens hexadecimales del primer bloque cuyo selector es exactamente `selector`. */
function readTokens(selector: string): Record<string, string> {
  const start = css.indexOf('\n' + selector + ' {')
  if (start < 0) throw new Error('Missing block ' + selector)
  const block = css.slice(start, css.indexOf('}', start))
  return Object.fromEntries([...block.matchAll(/(--[a-zA-Z]+):\s*(#[0-9A-Fa-f]{6})/g)].map(match => [match[1]!, match[2]!]))
}

describe('accent palette', () => {
  it('uses the same surfaces as base.css', () => {
    for (const [theme, selector] of [['light', ':root'], ['dark', ':root[data-theme="dark"]']] as const) {
      const tokens = readTokens(selector)
      expect([tokens['--canvasColor'], tokens['--surfaceColor'], tokens['--subtleColor']]).toEqual([...themeSurfaces[theme]])
    }
  })
  it('keeps any picked color readable in Light and Dark, with readable button text', () => {
    const random = createSeededRandom(20261013)
    const samples = ['#000000', '#FFFFFF', '#FFFF00', '#00FFFF', '#0000FF', '#FF0000', '#808080', '#1F3BD6', '#F2F2EF', '#0B0B0B',
      ...Array.from({ length: 2000 }, () => '#' + Math.floor(random() * 16777216).toString(16).padStart(6, '0').toUpperCase())]
    for (const picked of samples) {
      const palette = deriveAccentPalette(picked)
      for (const theme of ['light', 'dark'] as const) {
        const tokens = palette[theme]
        expect(tokens.accentColor).toMatch(/^#[0-9A-F]{6}$/)
        for (const surface of themeSurfaces[theme]) expect(contrastRatio(tokens.accentColor, surface), `${picked} ${theme} ${surface}`).toBeGreaterThanOrEqual(minimumAccentContrast)
        expect(contrastRatio(tokens.primaryTextColor, tokens.primaryBackgroundColor), `${picked} ${theme} button`).toBeGreaterThanOrEqual(minimumAccentContrast)
        expect([tokens.primaryBackgroundColor, tokens.focusColor]).toEqual([tokens.accentColor, tokens.accentColor])
      }
    }
  })
  it('keeps a color that already reads well and only adjusts the theme that needs it', () => {
    const palette = deriveAccentPalette('#1F3BD6')
    expect(palette.light).toEqual({ accentColor: '#1F3BD6', primaryBackgroundColor: '#1F3BD6', primaryTextColor: '#FFFFFF', focusColor: '#1F3BD6' })
    expect(palette.dark.accentColor).not.toBe('#1F3BD6')
    expect(palette.dark.primaryTextColor).toBe('#0B0B0B')
    expect(deriveAccentPalette('#FFE600').light.accentColor).not.toBe('#FFE600')
    expect(deriveAccentPalette('#FFE600').dark.accentColor).toBe('#FFE600')
    expect(deriveAccentPalette('not a color')).toEqual(deriveAccentPalette('#1F3BD6'))
  })
})

/** Números de un trazado (coordenadas, radios y banderas de arco): todos deben caer dentro de la baldosa. */
function pathNumbers(path: string): number[] { return (path.match(/-?\d+(\.\d+)?/g) ?? []).map(Number) }

describe('login mosaic', () => {
  it('is deterministic for a seed and covers every tile with known primitives', () => {
    expect(createLoginMosaic(42)).toEqual(createLoginMosaic(42))
    expect(createLoginMosaic(42)).not.toEqual(createLoginMosaic(43))
    const seenPrimitives = new Set<string>()
    for (let seed = 0; seed < 40; seed++) {
      const tiles = createLoginMosaic(seed * 104729)
      expect(tiles).toHaveLength(56)
      expect(new Set(tiles.map(tile => `${tile.column},${tile.row}`)).size).toBe(56)
      for (const tile of tiles) {
        seenPrimitives.add(tile.primitive)
        expect(mosaicPrimitives).toContain(tile.primitive)
        expect(mosaicTones).toContain(tile.backgroundTone)
        expect(mosaicTones).toContain(tile.shapeTone)
        expect(tile.backgroundTone).not.toBe(tile.shapeTone)
        expect([0, 90, 180, 270]).toContain(tile.rotationDegrees)
        expect(tile.path).toBe(buildPrimitivePath(tile.primitive, tile.parameter))
        // Cubierta: el fondo ocupa la baldosa y la figura queda dentro de 0..tileSize.
        for (const value of pathNumbers(tile.path)) { expect(value).toBeGreaterThanOrEqual(0); expect(value).toBeLessThanOrEqual(tileSize) }
      }
      const accentTiles = tiles.filter(tile => tile.backgroundTone === 'accent' || tile.shapeTone === 'accent')
      expect(accentTiles.length).toBeGreaterThanOrEqual(1)
      expect(accentTiles.length).toBeLessThanOrEqual(2)
    }
    expect([...seenPrimitives].sort()).toEqual([...mosaicPrimitives].sort())
    expect(createLoginMosaic(5, 3, 2)).toHaveLength(6)
  })
  it('keeps a stable tile prefix when the grid grows', () => {
    const figure = ({ primitive, parameter, rotationDegrees }: { primitive: string; parameter: number; rotationDegrees: number }) => ({ primitive, parameter, rotationDegrees })
    const small = createLoginMosaic(77, 4, 5), large = createLoginMosaic(77, 6, 7)
    expect(large.slice(0, small.length).map(figure)).toEqual(small.map(figure))
  })
  it('fills the whole panel with whole, almost square tiles', () => {
    // Paneles del acceso a 1280×800, 1366×768, 1360×900 y 1920×1080 (columna 5/11), más un panel angosto y uno diminuto.
    for (const [width, height] of [[580, 800], [621, 768], [618, 900], [873, 1080], [391, 600], [60, 40]] as const) {
      const grid = computeMosaicGrid(width, height)
      expect(grid.columnCount * grid.tileWidth).toBeCloseTo(width, 6)
      expect(grid.rowCount * grid.tileHeight).toBeCloseTo(height, 6)
      expect(Number.isInteger(grid.columnCount) && Number.isInteger(grid.rowCount)).toBe(true)
      if (width > 300) {
        expect(Math.abs(grid.tileWidth / grid.tileHeight - 1), `${width}×${height}`).toBeLessThan(0.06)
        expect(grid.tileWidth).toBeGreaterThanOrEqual(88); expect(grid.tileWidth).toBeLessThanOrEqual(132)
      }
    }
    expect(computeMosaicGrid(60, 40)).toMatchObject({ columnCount: 1, rowCount: 1 })
  })
  it('draws every primitive edge to edge, never as a small centered icon', () => {
    // Puntos de contacto con los bordes (en la orientación base) de cada primitiva con cada parámetro posible.
    const parameters: Record<string, number[]> = { cornerArc: [0, 40, 70], halfDisc: [1, 2], disc: [0], diamond: [0, 18, 30], diagonalSplit: [0], stripes: [2, 3, 4, 5], dotGrid: [2, 3, 4], ring: [12, 38], nestedSquares: [2, 3, 4], leaf: [0] }
    for (const primitive of mosaicPrimitives) {
      for (const parameter of parameters[primitive]!) {
        const numbers = pathNumbers(buildPrimitivePath(primitive, parameter))
        expect(Math.min(...numbers), primitive).toBe(0)
        expect(Math.max(...numbers), primitive).toBe(tileSize)
      }
    }
    // Cada figura arranca en un borde (o en un punto medio de un lado, rombo y círculos).
    expect(buildPrimitivePath('disc', 0)).toMatch(/^M0 50A50 50/)
    expect(buildPrimitivePath('dotGrid', 2)).toMatch(/^M0 25A25 25/)
    expect(buildPrimitivePath('stripes', 3)).toMatch(/^M0 0H20V100H0Z/)
  })
})

/** Contexto 2D falso: cuenta rellenos/trazos (llamadas de dibujo) y segmentos de trazado, también los de Path2D. */
function createCountingContext() {
  const counts = { drawCalls: 0, pathOperations: 0 }
  class CountingPath { moveTo(): void { counts.pathOperations++ } lineTo(): void { counts.pathOperations++ } rect(): void { counts.pathOperations++ } closePath(): void { /* sin costo */ } }
  vi.stubGlobal('Path2D', CountingPath)
  const context = new Proxy({} as Record<string | symbol, unknown>, {
    get(target, property) {
      if (property in target) return target[property]
      if (['fill', 'stroke', 'fillRect', 'strokeRect'].includes(String(property))) return () => { counts.drawCalls++ }
      if (['moveTo', 'lineTo', 'rect'].includes(String(property))) return () => { counts.pathOperations++ }
      if (property === 'createLinearGradient') return () => ({ addColorStop: () => undefined })
      return () => undefined
    },
    set(target, property, value) { target[property] = value; return true }
  }) as unknown as CanvasRenderingContext2D
  return { context, counts }
}

describe('background pattern frame budget', () => {
  afterEach(() => { vi.unstubAllGlobals() })
  it('keeps every pattern within the per-frame draw-call and path budget at full window size', () => {
    for (const pattern of backgroundStyles.filter((style): style is PatternStyle => style !== 'none')) {
      const { context, counts } = createCountingContext()
      // El tramado Canvas sólo se usa en las miniaturas de Configuración: se mide a ese tamaño.
      const [width, height] = pattern === 'dither' ? [240, 144] : [1920, 1080]
      drawBackgroundPattern(context, pattern, { width, height, timeSeconds: 7.3, inkColor: '#0B0B0B', accentColor: '#1F3BD6', opacityScale: 1 })
      expect(counts.drawCalls, pattern).toBeGreaterThan(0)
      expect(counts.drawCalls, pattern).toBeLessThanOrEqual(maximumDrawCallsPerFrame)
      expect(counts.pathOperations, pattern).toBeLessThanOrEqual(8000)
    }
  })
})
