import type { BackgroundStyle } from '../../../shared/contracts/localPreferences'

/**
 * Patrones del fondo de la mesa dibujados con Canvas 2D (ADR-039). Adaptan la idea de Vue Bits "Dot Grid", "Squares",
 * "Waves" y "Threads" y, desde la adenda del 2026-10-13, "Hyperspeed", "Grid Distortion", "Ribbons" e "Iridescence"
 * (MIT + Commons Clause, ver ADR-025) sin Tailwind, sin GSAP/WebGL y sin dependencias:
 * - Tinta (`--textColor`) con poca opacidad, así sirven igual en Light y Dark y nunca tapan texto. Sólo Iridescence usa el
 *   color principal (`--accentColor`, ya ajustado al tema), en bandas tenues.
 * - Sin estado entre cuadros: cada cuadro sale sólo del tiempo, así pausar y reanudar no acumula nada.
 * - Brutalistas: puntos cuadrados, líneas de 1 px y cuadros rectos.
 * - Sin interacción con el puntero (2026-10-13): el ratón provocaba las caídas de fps; el dibujo sólo depende del tiempo.
 * `dither` aquí es una aproximación fija para las vistas previas de Configuración: el fondo real es WebGL (AnimatedBackground).
 * Presupuesto por cuadro (2026-10-13, caídas de fps): cada patrón agrupa sus figuras en pocos trazados y hace como máximo
 * `maximumDrawCallsPerFrame` rellenos o trazos por cuadro, sin sombras ni filtros. Los que variaban la opacidad figura por
 * figura (puntos, hiperespacio, tramado) la cuantizan en `opacityLevelCount` niveles: un trazado por nivel. La prueba
 * unitaria de apariencia cuenta las llamadas con un contexto falso a 1920×1080.
 */
export type PatternStyle = Exclude<BackgroundStyle, 'none'>
export type CanvasPatternStyle = Exclude<PatternStyle, 'dither'>
/** `opacityScale`: 1 en la mesa; las vistas previas de Configuración lo suben para que el patrón se lea en miniatura. */
/** `lineWidth`: grosor de línea en unidades del dibujo (1 por omisión). */
export interface PatternFrame { width: number; height: number; timeSeconds: number; inkColor: string; accentColor: string; opacityScale: number; lineWidth?: number }
/** Tope de rellenos/trazos por cuadro de cualquier patrón (Iridescence, con 9 bandas, es el más alto). */
export const maximumDrawCallsPerFrame = 12
const opacityLevelCount = 4
/**
 * Agrupa figuras por opacidad cuantizada: `pathFor` devuelve el trazado del nivel (1..opacityLevelCount, nunca 0 para que
 * ninguna figura desaparezca) y `flush` rellena o traza cada nivel una sola vez.
 */
function createOpacityBatches(context: CanvasRenderingContext2D, maximumOpacity: number) {
  const paths = Array.from({ length: opacityLevelCount }, () => new Path2D())
  return {
    pathFor: (opacity: number): Path2D => paths[Math.min(opacityLevelCount, Math.max(1, Math.round(opacity / maximumOpacity * opacityLevelCount))) - 1]!,
    flush(mode: 'fill' | 'stroke'): void {
      paths.forEach((path, index) => {
        context.globalAlpha = maximumOpacity * (index + 1) / opacityLevelCount
        if (mode === 'fill') context.fill(path); else context.stroke(path)
      })
    }
  }
}


/** Dot Grid: puntos cuadrados que laten en una onda diagonal. */
function drawDotGrid(context: CanvasRenderingContext2D, frame: PatternFrame): void {
  const spacing = 26
  context.fillStyle = frame.inkColor
  const batches = createOpacityBatches(context, Math.min(1, 0.24 * frame.opacityScale))
  for (let y = spacing / 2; y < frame.height; y += spacing) {
    for (let x = spacing / 2; x < frame.width; x += spacing) {
      const pulse = 0.5 + 0.5 * Math.sin(x * 0.02 + y * 0.015 - frame.timeSeconds * 1.2)
      const size = 2 + pulse * 1.2
      batches.pathFor(Math.min(1, (0.16 + pulse * 0.08) * frame.opacityScale)).rect(x - size / 2, y - size / 2, size, size)
    }
  }
  batches.flush('fill')
}
/** Squares: retícula que se desplaza en diagonal. */
function drawSquares(context: CanvasRenderingContext2D, frame: PatternFrame): void {
  const size = 44
  const offset = (frame.timeSeconds * 12) % size
  context.strokeStyle = frame.inkColor
  context.globalAlpha = Math.min(1, 0.14 * frame.opacityScale)
  context.beginPath()
  for (let x = -offset; x < frame.width; x += size) { context.moveTo(Math.round(x) + 0.5, 0); context.lineTo(Math.round(x) + 0.5, frame.height) }
  for (let y = -offset; y < frame.height; y += size) { context.moveTo(0, Math.round(y) + 0.5); context.lineTo(frame.width, Math.round(y) + 0.5) }
  context.stroke()
}
/** Waves: renglones horizontales ondulados por dos senos. */
function drawWaves(context: CanvasRenderingContext2D, frame: PatternFrame): void {
  const rowSpacing = 22, pointSpacing = 20
  context.strokeStyle = frame.inkColor
  context.globalAlpha = Math.min(1, 0.18 * frame.opacityScale)
  context.beginPath()
  for (let row = 0, baseY = rowSpacing / 2; baseY < frame.height + rowSpacing; row++, baseY += rowSpacing) {
    for (let x = 0; x <= frame.width + pointSpacing; x += pointSpacing) {
      const y = baseY + 6 * Math.sin(x * 0.008 + frame.timeSeconds * 0.6 + row * 0.35) + 4 * Math.sin(x * 0.021 - frame.timeSeconds * 0.9 + row * 0.2)
      if (x === 0) context.moveTo(x, y); else context.lineTo(x, y)
    }
  }
  context.stroke()
}
/** Threads: un haz de hilos que nace junto a la izquierda y se abre y ondula hacia la derecha. */
function drawThreads(context: CanvasRenderingContext2D, frame: PatternFrame): void {
  const threadCount = 18, pointSpacing = 16
  context.strokeStyle = frame.inkColor
  context.globalAlpha = Math.min(1, 0.22 * frame.opacityScale)
  context.beginPath()
  for (let thread = 0; thread < threadCount; thread++) {
    const spread = (thread - (threadCount - 1) / 2) * frame.height * 0.022
    for (let x = 0; x <= frame.width + pointSpacing; x += pointSpacing) {
      const progress = x / Math.max(1, frame.width)
      const wave = Math.sin(progress * 6 + frame.timeSeconds * 0.5 + thread * 0.32) * frame.height * 0.07 * progress
      const y = frame.height * 0.55 + spread * (0.25 + 0.75 * progress) + wave
      if (x === 0) context.moveTo(x, y); else context.lineTo(x, y)
    }
  }
  context.stroke()
}
/** Pseudoaleatorio fijo por índice (0..1): posiciones y velocidades estables sin guardar estado. */
function hashUnit(index: number, salt: number): number { const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453; return value - Math.floor(value) }
/** Dirección y velocidad fijas de cada trazo del hiperespacio, precalculadas una vez (antes: seno y coseno por trazo y cuadro). */
const hyperspeedLines = Array.from({ length: 160 }, (_, line) => { const angle = hashUnit(line, 1) * Math.PI * 2; return { cosine: Math.cos(angle), sine: Math.sin(angle), speed: 0.04 + hashUnit(line, 2) * 0.1, offset: hashUnit(line, 3) } })
/** Hyperspeed: trazos que salen del centro y se alargan al acercarse al borde. */
function drawHyperspeed(context: CanvasRenderingContext2D, frame: PatternFrame): void {
  const centerX = frame.width / 2, centerY = frame.height / 2
  const maximumRadius = Math.hypot(frame.width, frame.height) / 2
  context.strokeStyle = frame.inkColor
  const batches = createOpacityBatches(context, Math.min(1, 0.4 * frame.opacityScale))
  for (const { cosine, sine, speed, offset } of hyperspeedLines) {
    const progress = (offset + frame.timeSeconds * speed) % 1
    const radius = progress * progress * maximumRadius, length = 4 + progress * 48
    const path = batches.pathFor(Math.min(1, progress * 0.4 * frame.opacityScale))
    path.moveTo(centerX + cosine * radius, centerY + sine * radius)
    path.lineTo(centerX + cosine * (radius + length), centerY + sine * (radius + length))
  }
  batches.flush('stroke')
}
/** Grid Distortion: retícula cuyas líneas ondulan despacio. */
function drawGridDistortion(context: CanvasRenderingContext2D, frame: PatternFrame): void {
  const spacing = 48, step = 16
  const displace = (x: number, y: number): [number, number] => {
    return [x + 7 * Math.sin(y * 0.012 + frame.timeSeconds * 0.7), y + 7 * Math.sin(x * 0.012 - frame.timeSeconds * 0.5)]
  }
  context.strokeStyle = frame.inkColor
  context.globalAlpha = Math.min(1, 0.14 * frame.opacityScale)
  context.beginPath()
  for (let x = 0; x <= frame.width + spacing; x += spacing) {
    for (let y = -step; y <= frame.height + step; y += step) { const [pointX, pointY] = displace(x, y); if (y === -step) context.moveTo(pointX, pointY); else context.lineTo(pointX, pointY) }
  }
  for (let y = 0; y <= frame.height + spacing; y += spacing) {
    for (let x = -step; x <= frame.width + step; x += step) { const [pointX, pointY] = displace(x, y); if (x === -step) context.moveTo(pointX, pointY); else context.lineTo(pointX, pointY) }
  }
  context.stroke()
}
/** Ribbons: tres listones anchos que serpentean y cambian de grosor; relleno tenue y bordes de 1 px. */
function drawRibbons(context: CanvasRenderingContext2D, frame: PatternFrame): void {
  const step = 24
  context.fillStyle = frame.inkColor
  context.strokeStyle = frame.inkColor
  for (let ribbon = 0; ribbon < 3; ribbon++) {
    const top: Array<[number, number]> = [], bottom: Array<[number, number]> = []
    for (let x = -step; x <= frame.width + step; x += step) {
      const center = frame.height * (0.3 + 0.2 * ribbon) + frame.height * 0.08 * Math.sin(x * 0.004 + frame.timeSeconds * 0.35 + ribbon * 2)
      const halfThickness = 18 + 12 * Math.sin(x * 0.006 - frame.timeSeconds * 0.5 + ribbon)
      top.push([x, center - halfThickness]); bottom.push([x, center + halfThickness])
    }
    context.beginPath()
    top.forEach(([x, y], index) => { if (index === 0) context.moveTo(x, y); else context.lineTo(x, y) })
    for (const [x, y] of bottom.reverse()) context.lineTo(x, y)
    context.closePath()
    context.globalAlpha = Math.min(1, 0.05 * frame.opacityScale)
    context.fill()
    context.globalAlpha = Math.min(1, 0.16 * frame.opacityScale)
    context.stroke()
  }
}
/** Iridescence: bandas diagonales del color principal que se desplazan y laten; degradado suave, nunca más de ~10 %. */
function drawIridescence(context: CanvasRenderingContext2D, frame: PatternFrame): void {
  const diagonal = Math.hypot(frame.width, frame.height), bandCount = 7, bandWidth = diagonal / bandCount
  context.translate(frame.width / 2, frame.height / 2)
  context.rotate(-0.5)
  for (let band = -1; band <= bandCount; band++) {
    const start = -diagonal / 2 + band * bandWidth + ((frame.timeSeconds * 18) % bandWidth)
    const gradient = context.createLinearGradient(start, 0, start + bandWidth, 0)
    gradient.addColorStop(0, 'transparent'); gradient.addColorStop(0.5, frame.accentColor); gradient.addColorStop(1, 'transparent')
    context.fillStyle = gradient
    context.globalAlpha = Math.min(1, (0.05 + 0.07 * (0.5 + 0.5 * Math.sin(frame.timeSeconds * 0.6 + band * 0.9))) * frame.opacityScale)
    context.fillRect(start, -diagonal / 2, bandWidth, diagonal)
  }
}
/** Bayer 4×4: tramado fijo de la vista previa de Dither (bloques de 3 px). */
const bayerMatrix = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
function drawDitherPreview(context: CanvasRenderingContext2D, frame: PatternFrame): void {
  const block = 3
  const strongBlocks = new Path2D(), softBlocks = new Path2D()
  context.fillStyle = frame.inkColor
  for (let y = 0; y < frame.height; y += block) {
    for (let x = 0; x < frame.width; x += block) {
      const intensity = 0.5 + 0.25 * Math.sin(x * 0.05 + y * 0.03) + 0.25 * Math.sin(y * 0.08 - x * 0.02)
      const threshold = bayerMatrix[(Math.floor(y / block) % 4) * 4 + (Math.floor(x / block) % 4)]! / 16
      if (intensity * 0.8 > threshold + 0.25) (intensity > 0.75 ? strongBlocks : softBlocks).rect(x, y, block, block)
    }
  }
  context.globalAlpha = Math.min(1, 0.3 * frame.opacityScale); context.fill(strongBlocks)
  context.globalAlpha = Math.min(1, 0.12 * frame.opacityScale); context.fill(softBlocks)
}

const painters: Record<PatternStyle, (context: CanvasRenderingContext2D, frame: PatternFrame) => void> = { dither: drawDitherPreview, dotGrid: drawDotGrid, squares: drawSquares, waves: drawWaves, threads: drawThreads, hyperspeed: drawHyperspeed, gridDistortion: drawGridDistortion, ribbons: drawRibbons, iridescence: drawIridescence }

/** Limpia y dibuja un cuadro en coordenadas CSS (quien llama ya aplicó la escala del devicePixelRatio). */
export function drawBackgroundPattern(context: CanvasRenderingContext2D, pattern: PatternStyle, frame: PatternFrame): void {
  context.save()
  context.clearRect(0, 0, frame.width, frame.height)
  context.lineWidth = frame.lineWidth ?? 1
  painters[pattern](context, frame)
  context.restore()
}
