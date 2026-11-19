/**
 * Partes puras del dithering procedural de `DitherFocusRing` (2026-10-17).
 * - `bayerThreshold`: umbral (0–1) de la matriz de Bayer 4×4 para una celda; repetida, da el patrón ordenado.
 * - `waveFor`: densidad en un punto del contorno (0–1 de la vuelta): base del 40 % y una onda de tres crestas que gira.
 * - `isCellLit`: una celda se enciende si su umbral queda bajo la densidad.
 */
const bayerMatrix = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]] as const

export function bayerThreshold(row: number, column: number): number {
  return bayerMatrix[((row % 4) + 4) % 4]![((column % 4) + 4) % 4]! / 16
}
export function waveFor(perimeterPosition: number, seconds: number): number {
  return 0.4 + 0.4 * (0.5 + 0.5 * Math.sin(2 * Math.PI * (perimeterPosition * 3 - seconds * 0.7)))
}
export function isCellLit(row: number, column: number, density: number): boolean {
  return bayerThreshold(row, column) < density
}
