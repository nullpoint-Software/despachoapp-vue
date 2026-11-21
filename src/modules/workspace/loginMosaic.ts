/**
 * Mosaico geométrico del acceso (ADR-039 y adenda 2026-10-13, estilo shapes.gallery). Todo se dibuja en la app, sin imágenes.
 * - **Procedural:** cada baldosa se compone de una primitiva (`MosaicPrimitive`) con un parámetro propio (radio interior,
 *   número de franjas, densidad de puntos, niveles de cuadros…), un giro de 0/90/180/270° que elige la esquina, el lado o la
 *   orientación, y un par de tonos. Todo sale del generador con semilla: la misma semilla da el mismo mosaico.
 * - **De borde a borde:** cada figura toca los bordes de su baldosa de 100×100 (cuartos de círculo anclados en una esquina,
 *   rombos completos, medios círculos que abarcan el lado, puntos que se tocan…). Nada de iconos chicos centrados.
 * - Cada figura es UN trazado con `fill-rule: evenodd` (los huecos de anillos, rombos huecos y cuadros anidados salen de ahí).
 * - **Llena el panel** (2026-10-13): `computeMosaicGrid` decide columnas y filas según el tamaño medido del panel.
 * La pantalla usa `launchMosaicSeed`, que cambia en cada arranque y se mantiene mientras la app está abierta.
 */
export const tileSize = 100
export const mosaicPrimitives = ['cornerArc', 'halfDisc', 'disc', 'diamond', 'diagonalSplit', 'stripes', 'dotGrid', 'ring', 'nestedSquares', 'leaf'] as const
export type MosaicPrimitive = typeof mosaicPrimitives[number]
export const mosaicTones = ['ink', 'paper', 'gray', 'accent'] as const
export type MosaicTone = typeof mosaicTones[number]
export interface MosaicTile {
  tileId: number; column: number; row: number
  primitive: MosaicPrimitive
  /** Parámetro de la primitiva, ya resuelto (p. ej. franjas = 3, radio interior = 28); 0 cuando no aplica. */
  parameter: number
  path: string
  rotationDegrees: 0 | 90 | 180 | 270
  backgroundTone: MosaicTone
  shapeTone: MosaicTone
}

/** Círculo como dos arcos (para combinarlo en un mismo trazado). */
function circlePath(centerX: number, centerY: number, radius: number): string {
  return `M${centerX - radius} ${centerY}A${radius} ${radius} 0 1 0 ${centerX + radius} ${centerY}A${radius} ${radius} 0 1 0 ${centerX - radius} ${centerY}Z`
}
function rectanglePath(left: number, top: number, size: number): string { return `M${left} ${top}H${left + size}V${top + size}H${left}Z` }
const round = (value: number): number => Math.round(value * 100) / 100

/**
 * Trazado de una primitiva en la caja de 100×100, en su orientación base (el giro se aplica al dibujar).
 * El parámetro es el que eligió el generador; fuera de rango se acota para que la figura siga tocando los bordes.
 */
export function buildPrimitivePath(primitive: MosaicPrimitive, parameter: number): string {
  switch (primitive) {
    // Cuarto de círculo de radio completo anclado en la esquina superior izquierda; con parámetro > 0, cuarto de anillo.
    case 'cornerArc': return parameter > 0 ? `M100 0A100 100 0 0 1 0 100V${parameter}A${parameter} ${parameter} 0 0 0 ${parameter} 0Z` : 'M0 0H100A100 100 0 0 1 0 100Z'
    // Uno o dos medios círculos apoyados en el lado inferior, que juntos abarcan todo el lado.
    case 'halfDisc': {
      const count = Math.min(2, Math.max(1, parameter)), radius = tileSize / count / 2
      return Array.from({ length: count }, (_, index) => `M${index * radius * 2} 100A${radius} ${radius} 0 0 1 ${(index + 1) * radius * 2} 100Z`).join('')
    }
    case 'disc': return circlePath(50, 50, 50)
    // Rombo con vértices en los puntos medios de los lados; con parámetro > 0, hueco (marco de ese grosor).
    case 'diamond': return 'M50 0L100 50L50 100L0 50Z' + (parameter > 0 ? `M50 ${parameter}L${100 - parameter} 50L50 ${100 - parameter}L${parameter} 50Z` : '')
    case 'diagonalSplit': return 'M0 0H100V100Z'
    // 2n − 1 franjas iguales; se rellenan las impares, así la primera y la última tocan los bordes.
    case 'stripes': {
      const count = Math.min(5, Math.max(2, parameter)), width = tileSize / (2 * count - 1)
      return Array.from({ length: count }, (_, index) => `M${round(index * 2 * width)} 0H${round((index * 2 + 1) * width)}V100H${round(index * 2 * width)}Z`).join('')
    }
    // Retícula de n×n puntos que se tocan entre sí y con los bordes.
    case 'dotGrid': {
      const density = Math.min(4, Math.max(2, parameter)), radius = tileSize / density / 2
      return Array.from({ length: density * density }, (_, index) => circlePath(round((index % density) * 2 * radius + radius), round(Math.floor(index / density) * 2 * radius + radius), round(radius))).join('')
    }
    case 'ring': return circlePath(50, 50, 50) + circlePath(50, 50, Math.min(40, Math.max(10, parameter)))
    // Cuadros anidados desde el borde: `parameter` niveles alternos (evenodd).
    case 'nestedSquares': {
      const levels = Math.min(4, Math.max(2, parameter)), inset = 50 / levels
      return Array.from({ length: levels }, (_, index) => rectanglePath(round(index * inset), round(index * inset), round(tileSize - 2 * index * inset))).join('')
    }
    // Hoja (lente) de esquina a esquina.
    case 'leaf': return 'M0 100A100 100 0 0 1 100 0A100 100 0 0 1 0 100Z'
  }
}

/** mulberry32: PRNG pequeño y determinista (no criptográfico; sólo decide figuras). */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6D2B79F5) >>> 0
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}
/** Pares fondo/figura con contraste visible: nunca el mismo tono en ambos. */
const tonePairs: ReadonlyArray<readonly [MosaicTone, MosaicTone]> = [['paper', 'ink'], ['ink', 'paper'], ['gray', 'ink'], ['paper', 'gray'], ['ink', 'gray'], ['gray', 'paper']]
const rotations = [0, 90, 180, 270] as const

/** Parámetro aleatorio de cada primitiva (0 = sin variante). */
function pickParameter(primitive: MosaicPrimitive, random: () => number): number {
  const between = (minimum: number, maximum: number): number => minimum + Math.floor(random() * (maximum - minimum + 1))
  switch (primitive) {
    case 'cornerArc': return random() < 0.4 ? between(40, 70) : 0
    case 'halfDisc': return between(1, 2)
    case 'diamond': return random() < 0.35 ? between(18, 30) : 0
    case 'stripes': return between(2, 5)
    case 'dotGrid': return between(2, 4)
    case 'ring': return between(12, 38)
    case 'nestedSquares': return between(2, 4)
    default: return 0
  }
}

/**
 * Genera `columns × rows` baldosas en orden de lectura; una o dos (según la semilla) llevan el color principal.
 * Prefijo estable (2026-10-13): la baldosa i sale siempre igual para una semilla, sin importar cuántas haya; agrandar la
 * cuadrícula sólo agrega baldosas nuevas al final (cambian su columna y fila, no su figura). El acento usa otro flujo de
 * la misma semilla porque depende del total.
 */
export function createLoginMosaic(seed: number, columns = 7, rows = 8): MosaicTile[] {
  const random = createSeededRandom(seed)
  const pick = <Item>(items: readonly Item[]): Item => items[Math.floor(random() * items.length)]!
  const tiles: MosaicTile[] = []
  for (let tileId = 0; tileId < columns * rows; tileId++) {
    const [backgroundTone, shapeTone] = pick(tonePairs)
    const primitive = pick(mosaicPrimitives), parameter = pickParameter(primitive, random)
    tiles.push({ tileId, column: tileId % columns, row: Math.floor(tileId / columns), primitive, parameter, path: buildPrimitivePath(primitive, parameter), rotationDegrees: pick(rotations), backgroundTone, shapeTone })
  }
  const accentRandom = createSeededRandom(seed ^ 0x9E3779B9)
  // Baldosas distintas: la segunda se elige entre las restantes, así nunca hay acento sobre acento.
  const firstIndex = Math.floor(accentRandom() * tiles.length)
  const accentIndexes = tiles.length > 1 && accentRandom() < 0.5 ? [firstIndex, (firstIndex + 1 + Math.floor(accentRandom() * (tiles.length - 1))) % tiles.length] : [firstIndex]
  for (const index of accentIndexes) {
    const tile = tiles[index]
    if (!tile) continue
    if (accentRandom() < 0.5) tile.shapeTone = 'accent'; else { tile.backgroundTone = 'accent'; tile.shapeTone = 'paper' }
  }
  return tiles
}

export interface MosaicGrid { columnCount: number; rowCount: number; tileWidth: number; tileHeight: number }
/** Lado buscado de cada baldosa en pixeles CSS y tolerancia del ajuste (2026-10-13). */
const targetTilePixels = 108, minimumTilePixels = 88, maximumTilePixels = 132
/**
 * Columnas y filas para llenar EXACTAMENTE un panel de `width × height` sin baldosas cortadas: el ancho de baldosa es
 * width / columnas y el alto height / filas. Entre las combinaciones con lados de 88–132 px se elige la más cuadrada (y,
 * a igualdad, la más cercana a 108 px); la diferencia restante se absorbe estirando la baldosa unos pocos puntos.
 * Paneles diminutos (sin combinación en el rango) usan la cuenta redondeada, mínimo 1×1.
 */
export function computeMosaicGrid(width: number, height: number): MosaicGrid {
  const candidateCounts = (length: number): number[] => {
    const counts: number[] = []
    for (let count = Math.max(1, Math.ceil(length / maximumTilePixels)); count <= Math.floor(length / minimumTilePixels); count++) counts.push(count)
    return counts.length ? counts : [Math.max(1, Math.round(length / targetTilePixels))]
  }
  let best: MosaicGrid | null = null, bestScore = Infinity
  for (const columnCount of candidateCounts(width)) {
    for (const rowCount of candidateCounts(height)) {
      const tileWidth = width / columnCount, tileHeight = height / rowCount
      const score = Math.abs(tileWidth / tileHeight - 1) + Math.abs((tileWidth + tileHeight) / 2 - targetTilePixels) / 10000
      if (score < bestScore) { bestScore = score; best = { columnCount, rowCount, tileWidth, tileHeight } }
    }
  }
  return best!
}

/** Semilla de este arranque: el mosaico varía entre aperturas pero no al cerrar sesión y volver al acceso. */
export const launchMosaicSeed = Math.floor(Math.random() * 4294967296)
