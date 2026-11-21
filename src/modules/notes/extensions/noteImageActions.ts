import type { Component } from 'vue'
import { AlignCenterVertical, AlignEndVertical, AlignStartVertical, Image, PanelLeft, PanelRight } from '@lucide/vue'
import {
  computeAlignmentChange, computePresetWidth, computeWrapChange, findWidthPreset, imageWidthPresetPercents,
  type NoteImageAlignment, type NoteImageLayout, type NoteImageWrap
} from './noteImageLayout'

/**
 * Catálogo de acciones de imagen (2026-10-10) que comparten la barra flotante de la imagen (`NoteImageView`) y el menú
 * contextual del editor (`NoteEditor`): mismos nombres accesibles y mismos cambios de atributos en ambos lugares.
 * Cada acción sólo calcula los atributos; quien la usa los aplica (`updateAttributes` en la vista del nodo o
 * `updateAttributes('image', …)` sobre la selección en el editor).
 */
export type NoteImageActionGroup = 'size' | 'position' | 'wrap'
export interface NoteImageAction {
  actionId: string
  group: NoteImageActionGroup
  /** Nombre accesible y texto del menú contextual. */
  label: string
  /** Texto corto visible en la barra (los tamaños); las demás acciones muestran sólo su icono. */
  shortLabel?: string
  icon?: Component
  isActive: (layout: NoteImageLayout) => boolean
  change: (layout: NoteImageLayout) => Record<string, unknown>
}
export const noteImageGroupLabels: Record<NoteImageActionGroup, string> = { size: 'Tamaño de imagen', position: 'Posición de imagen', wrap: 'Ajuste del texto' }

const sizeActions: NoteImageAction[] = imageWidthPresetPercents.map(percent => ({
  actionId: 'size-' + percent,
  group: 'size',
  label: 'Ancho ' + percent + ' %',
  shortLabel: percent + ' %',
  isActive: layout => findWidthPreset(layout.width) === percent,
  // La altura se recalcula con la proporción de la imagen: se limpia la que pudiera venir guardada.
  change: () => ({ width: computePresetWidth(percent), height: null })
}))
const alignmentEntries: Array<{ alignment: NoteImageAlignment; label: string; icon: Component }> = [
  { alignment: 'left', label: 'Imagen a la izquierda', icon: AlignStartVertical },
  { alignment: 'center', label: 'Imagen centrada', icon: AlignCenterVertical },
  { alignment: 'right', label: 'Imagen a la derecha', icon: AlignEndVertical }
]
const positionActions: NoteImageAction[] = alignmentEntries.map(entry => ({
  actionId: 'align-' + entry.alignment,
  group: 'position',
  label: entry.label,
  icon: entry.icon,
  isActive: layout => layout.wrap === 'block' && layout.alignment === entry.alignment,
  change: () => computeAlignmentChange(entry.alignment)
}))
const wrapEntries: Array<{ wrap: NoteImageWrap; label: string; icon: Component }> = [
  { wrap: 'block', label: 'En línea con el texto', icon: Image },
  { wrap: 'wrapLeft', label: 'Texto alrededor, imagen a la izquierda', icon: PanelLeft },
  { wrap: 'wrapRight', label: 'Texto alrededor, imagen a la derecha', icon: PanelRight }
]
const wrapActions: NoteImageAction[] = wrapEntries.map(entry => ({
  actionId: 'wrap-' + entry.wrap,
  group: 'wrap',
  label: entry.label,
  icon: entry.icon,
  isActive: layout => layout.wrap === entry.wrap,
  change: layout => computeWrapChange(layout, entry.wrap)
}))
export const noteImageActions: readonly NoteImageAction[] = [...sizeActions, ...positionActions, ...wrapActions]
