/**
 * Geometría del boleto desprendible (Tear Ticket de Vue Bits, MIT + Commons Clause; ver ADR-025).
 * Calcula, en pixeles del boleto, los trazados del cuerpo y del talón separados por la perforación:
 * - Una muesca semicircular (`notch`) en cada extremo de la perforación y `holeCount` agujeros (`holeSize`) entre puentes.
 * - Cada puente de papel entre agujeros puede tener borde irregular (`roughness`); el generador con semilla da siempre el
 *   mismo borde para el mismo número de agujeros y tamaño.
 * - `bodyOutline` y `stubOutline` son los contornos sin el lado perforado (el borde se dibuja encima del relleno).
 * - Con `isVertical` el talón queda abajo: se calcula en coordenadas (a lo largo, a lo ancho) y se transponen.
 * Los trazados sirven como `clip-path: path()` del relleno y como `d` del contorno SVG.
 */
export interface TicketPoint { x: number; y: number }
/** Puente de papel de la perforación: tramo [start, end] a lo ancho, su centro y los puntos del borde irregular. */
export interface TicketBridge extends TicketPoint { start: number; end: number; middle: number; edgePoints: Array<[number, number]> }
/** Extremo de la perforación (bisagra posible del talón) y su posición a lo ancho. */
export interface TicketEnd extends TicketPoint { across: number }
export interface TicketGeometry {
  isVertical: boolean
  crossLength: number
  bodyPath: string
  stubPath: string
  bridges: TicketBridge[]
  ends: TicketEnd[]
  bodyOutline: string
  stubOutline: string
}

/** mulberry32 con semilla: sólo decide el borde irregular, no es criptográfico. */
function createSeededNoise(seed: number): () => number {
  let state = seed | 0
  return () => {
    state = (state + 0x6D2B79F5) | 0
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}
const formatNumber = (value: number): string => value.toFixed(2)

export interface TicketGeometryOptions {
  width: number; height: number; stubSize: number; radius: number
  holeCount: number; holeSize: number; notch: number; roughness: number; isVertical: boolean
}

export function buildTicketGeometry(options: TicketGeometryOptions): TicketGeometry {
  const { width, height, stubSize, radius, holeSize, notch, roughness, isVertical } = options
  const mainLength = isVertical ? height : width
  const crossLength = isVertical ? width : height
  const perforation = mainLength - stubSize
  const holeRadius = holeSize / 2
  const holeCount = Math.max(1, Math.round(options.holeCount))
  const usableSpan = crossLength - 2 * notch
  const bridgeLength = Math.max(2, (usableSpan - holeCount * holeSize) / (holeCount + 1))
  const random = createSeededNoise(holeCount * 7919 + Math.round(crossLength))
  // (along, across) → (x, y): horizontal usa along = x; vertical los intercambia.
  const toPoint = (along: number, across: number): TicketPoint => (isVertical ? { x: across, y: along } : { x: along, y: across })
  const point = (along: number, across: number): string => (isVertical ? `${formatNumber(across)},${formatNumber(along)}` : `${formatNumber(along)},${formatNumber(across)}`)
  // Al transponer se invierte el sentido de giro del arco.
  const arc = (arcRadius: number, sweep: number, along: number, across: number): string =>
    `A${formatNumber(arcRadius)},${formatNumber(arcRadius)} 0 0 ${isVertical ? 1 - sweep : sweep} ${point(along, across)}`

  const bridges: TicketBridge[] = []
  for (let index = 0; index <= holeCount; index += 1) {
    const start = notch + index * (bridgeLength + holeSize)
    const end = start + bridgeLength
    const stepCount = Math.max(2, Math.round(bridgeLength / 2.2))
    const edgePoints: Array<[number, number]> = []
    for (let step = 1; step < stepCount; step += 1) edgePoints.push([perforation + (random() - 0.5) * 2 * roughness, start + (bridgeLength * step) / stepCount])
    bridges.push({ start, end, middle: (start + end) / 2, edgePoints, ...toPoint(perforation, (start + end) / 2) })
  }

  let bodyPath = `M${point(radius, 0)}L${point(perforation - notch, 0)}${arc(notch, 0, perforation, notch)}`
  bridges.forEach((bridge, index) => {
    for (const [along, across] of bridge.edgePoints) bodyPath += `L${point(along, across)}`
    bodyPath += `L${point(perforation, bridge.end)}`
    if (index < holeCount) bodyPath += arc(holeRadius, 0, perforation, bridge.end + holeSize)
  })
  bodyPath += `${arc(notch, 0, perforation - notch, crossLength)}L${point(radius, crossLength)}${arc(radius, 1, 0, crossLength - radius)}L${point(0, radius)}${arc(radius, 1, radius, 0)}Z`

  let stubPath = `M${point(perforation + notch, 0)}L${point(mainLength - radius, 0)}${arc(radius, 1, mainLength, radius)}L${point(mainLength, crossLength - radius)}${arc(radius, 1, mainLength - radius, crossLength)}L${point(perforation + notch, crossLength)}${arc(notch, 0, perforation, crossLength - notch)}`
  for (let index = holeCount; index >= 0; index -= 1) {
    const bridge = bridges[index]!
    for (let pointIndex = bridge.edgePoints.length - 1; pointIndex >= 0; pointIndex -= 1) stubPath += `L${point(bridge.edgePoints[pointIndex]![0], bridge.edgePoints[pointIndex]![1])}`
    stubPath += `L${point(perforation, bridge.start)}`
    if (index > 0) stubPath += arc(holeRadius, 0, perforation, bridge.start - holeSize)
  }
  stubPath += `${arc(notch, 0, perforation + notch, 0)}Z`

  const ends: TicketEnd[] = [{ ...toPoint(perforation, notch), across: notch }, { ...toPoint(perforation, crossLength - notch), across: crossLength - notch }]
  const bodyOutline = `M${point(perforation, crossLength - notch)}${arc(notch, 0, perforation - notch, crossLength)}L${point(radius, crossLength)}${arc(radius, 1, 0, crossLength - radius)}L${point(0, radius)}${arc(radius, 1, radius, 0)}L${point(perforation - notch, 0)}${arc(notch, 0, perforation, notch)}`
  const stubOutline = `M${point(perforation, notch)}${arc(notch, 0, perforation + notch, 0)}L${point(mainLength - radius, 0)}${arc(radius, 1, mainLength, radius)}L${point(mainLength, crossLength - radius)}${arc(radius, 1, mainLength - radius, crossLength)}L${point(perforation + notch, crossLength)}${arc(notch, 0, perforation, crossLength - notch)}`
  return { isVertical, crossLength, bodyPath, stubPath, bridges, ends, bodyOutline, stubOutline }
}
