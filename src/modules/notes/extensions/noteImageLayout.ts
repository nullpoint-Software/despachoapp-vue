import { letterPage } from './pageLayout'

/**
 * Tamaño y acomodo de las imágenes de una nota (2026-10-10, pedido del usuario: "poder redimensionar y acomodar
 * imágenes y la dirección de su texto"). Funciones puras compartidas por el nodo (`NoteImage`), su vista
 * (`NoteImageView`), el menú contextual del editor y las pruebas unitarias.
 *
 * Atributos del nodo `image` (JSON de TipTap, dato LOCAL):
 * - `width`: ancho en píxeles de la hoja (sin zoom), entre 80 px y el ancho útil de la hoja Carta (628 px). La altura
 *   se calcula sola para conservar la proporción; `height` ya no se usa y se limpia al redimensionar.
 * - `align`: `left`, `center` o `right` para la imagen en su propio renglón.
 * - `wrap`: `block` (en línea con el texto: la imagen ocupa su renglón), `wrapLeft` o `wrapRight` (texto alrededor:
 *   la imagen flota a ese lado y el texto siguiente fluye junto a ella).
 *
 * Compatibilidad: las notas guardadas antes no traen `align` ni `wrap` (o los traen nulos) y `width` vacío. Un valor
 * ausente o desconocido se interpreta como el comportamiento anterior: centrada, en su renglón y a su tamaño natural
 * (limitado al ancho de la hoja). Así nunca se rechaza ni se pierde una nota por estos atributos.
 */
export const noteImageAlignments = ['left', 'center', 'right'] as const
export type NoteImageAlignment = typeof noteImageAlignments[number]
export const noteImageWraps = ['block', 'wrapLeft', 'wrapRight'] as const
export type NoteImageWrap = typeof noteImageWraps[number]
export interface NoteImageLayout { width: number | null; alignment: NoteImageAlignment; wrap: NoteImageWrap }

export const minimumImageWidthPixels = 80
/** Ancho útil de la hoja Carta: 816 px menos los dos márgenes de 94 px. */
export const maximumImageWidthPixels = letterPage.widthPixels - 2 * letterPage.marginPixels
/** Atajos de tamaño de la barra de imagen, en porcentaje del ancho útil de la hoja. */
export const imageWidthPresetPercents = [25, 50, 75, 100] as const
/** Ancho que se asigna al pasar a "texto alrededor" una imagen que ocupa casi toda la hoja, para dejar sitio al texto. */
const wrapDefaultPercent = 50

export function parseImageAlignment(value: unknown): NoteImageAlignment {
  return noteImageAlignments.includes(value as NoteImageAlignment) ? value as NoteImageAlignment : 'center'
}
export function parseImageWrap(value: unknown): NoteImageWrap {
  return noteImageWraps.includes(value as NoteImageWrap) ? value as NoteImageWrap : 'block'
}
/** Redondea y limita un ancho al rango permitido. */
export function clampImageWidth(width: number, maximumWidth: number = maximumImageWidthPixels): number {
  const upperLimit = Math.max(minimumImageWidthPixels, maximumWidth)
  if (!Number.isFinite(width)) return upperLimit
  return Math.round(Math.min(upperLimit, Math.max(minimumImageWidthPixels, width)))
}
/**
 * Ancho guardado: número o texto numérico (el atributo HTML `width`). Vacío, cero, negativo o no numérico es `null`
 * (tamaño natural, como antes); un valor fuera de rango se limita.
 */
export function parseImageWidth(value: unknown): number | null {
  const width = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN
  return Number.isFinite(width) && width > 0 ? clampImageWidth(width) : null
}
export function readImageLayout(attributes: Record<string, unknown>): NoteImageLayout {
  return { width: parseImageWidth(attributes.width), alignment: parseImageAlignment(attributes.align), wrap: parseImageWrap(attributes.wrap) }
}
export function computePresetWidth(percent: number): number {
  return clampImageWidth(maximumImageWidthPixels * percent / 100)
}
/** Atajo que coincide con el ancho actual (para marcarlo como activo), o null. */
export function findWidthPreset(width: number | null): number | null {
  if (width === null) return null
  return imageWidthPresetPercents.find(percent => Math.abs(computePresetWidth(percent) - width) <= 1) ?? null
}
/**
 * Ancho nuevo al arrastrar una esquina. Todo se mide en la pantalla y se convierte a píxeles de la hoja con la razón
 * entre el ancho guardado y el visible, así el zoom de la hoja no altera el resultado.
 * - `direction`: 1 para la esquina derecha (arrastrar a la derecha agranda), -1 para la izquierda.
 * - Una imagen centrada crece hacia ambos lados: la esquina sólo avanza la mitad, así que el cambio se duplica para que
 *   siga al puntero.
 */
export function computeResizedWidth(options: { startWidth: number; startVisualWidth: number; deltaPixels: number; direction: 1 | -1; isCentered: boolean }): number {
  const { startWidth, startVisualWidth, deltaPixels, direction, isCentered } = options
  if (!(startVisualWidth > 0)) return clampImageWidth(startWidth)
  const visualWidth = startVisualWidth + deltaPixels * direction * (isCentered ? 2 : 1)
  return clampImageWidth(startWidth * visualWidth / startVisualWidth)
}
/**
 * Atributos a aplicar al cambiar el ajuste del texto. Si la imagen pasa a "texto alrededor" sin ancho propio o con
 * más del 75 % de la hoja, se reduce a la mitad para que el texto quepa a su lado.
 */
export function computeWrapChange(layout: NoteImageLayout, wrap: NoteImageWrap): { wrap: NoteImageWrap; width?: number; height?: null } {
  if (wrap === 'block') return { wrap }
  const isTooWide = layout.width === null || layout.width > computePresetWidth(75)
  return isTooWide ? { wrap, width: computePresetWidth(wrapDefaultPercent), height: null } : { wrap }
}
/** Atributos a aplicar al alinear: alinear devuelve la imagen a su propio renglón. */
export function computeAlignmentChange(alignment: NoteImageAlignment): { align: NoteImageAlignment; wrap: NoteImageWrap } {
  return { align: alignment, wrap: 'block' }
}
