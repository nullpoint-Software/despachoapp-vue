import { describe, expect, it } from 'vitest'
import {
  clampImageWidth, computeAlignmentChange, computePresetWidth, computeResizedWidth, computeWrapChange, findWidthPreset,
  maximumImageWidthPixels, minimumImageWidthPixels, parseImageAlignment, parseImageWidth, parseImageWrap, readImageLayout
} from '../../src/modules/notes/extensions/noteImageLayout'
import { noteImageActions } from '../../src/modules/notes/extensions/noteImageActions'

/** Tamaño y acomodo de imágenes en notas (2026-10-10): validación de atributos, límites y compatibilidad. */
describe('note image layout', () => {
  it('reads notes saved before this change as centered, block and natural size', () => {
    expect(readImageLayout({ src: 'data:image/png;base64,AAAA', alt: '' })).toEqual({ width: null, alignment: 'center', wrap: 'block' })
    expect(readImageLayout({ width: null, height: 300, align: null, wrap: null })).toEqual({ width: null, alignment: 'center', wrap: 'block' })
  })

  it('ignores unknown alignment and wrap values instead of rejecting the note', () => {
    expect(parseImageAlignment('diagonal')).toBe('center')
    expect(parseImageAlignment(42)).toBe('center')
    expect(parseImageWrap('around')).toBe('block')
    expect(parseImageAlignment('right')).toBe('right')
    expect(parseImageWrap('wrapLeft')).toBe('wrapLeft')
  })

  it('parses widths from numbers or HTML attributes and clamps them to the page', () => {
    expect(maximumImageWidthPixels).toBe(628)
    expect(parseImageWidth(300)).toBe(300)
    expect(parseImageWidth('250.4')).toBe(250)
    expect(parseImageWidth('5000')).toBe(maximumImageWidthPixels)
    expect(parseImageWidth(10)).toBe(minimumImageWidthPixels)
    expect(parseImageWidth('')).toBeNull()
    expect(parseImageWidth('auto')).toBeNull()
    expect(parseImageWidth(0)).toBeNull()
    expect(parseImageWidth(-20)).toBeNull()
    expect(parseImageWidth(undefined)).toBeNull()
  })

  it('clamps between the minimum and the available width', () => {
    expect(clampImageWidth(40)).toBe(80)
    expect(clampImageWidth(1000)).toBe(628)
    expect(clampImageWidth(1000, 400)).toBe(400)
    expect(clampImageWidth(Number.NaN)).toBe(628)
  })

  it('maps size presets to page widths and recognizes the active one', () => {
    expect([25, 50, 75, 100].map(computePresetWidth)).toEqual([157, 314, 471, 628])
    expect(findWidthPreset(314)).toBe(50)
    expect(findWidthPreset(315)).toBe(50)
    expect(findWidthPreset(320)).toBeNull()
    expect(findWidthPreset(null)).toBeNull()
  })

  it('converts a corner drag to page pixels independently of the zoom', () => {
    // A 50 % de zoom la imagen de 400 px se ve de 200 px: 50 px en pantalla son 100 px de la hoja.
    expect(computeResizedWidth({ startWidth: 400, startVisualWidth: 200, deltaPixels: 50, direction: 1, isCentered: false })).toBe(500)
    // La esquina izquierda agranda al arrastrar a la izquierda.
    expect(computeResizedWidth({ startWidth: 400, startVisualWidth: 400, deltaPixels: -60, direction: -1, isCentered: false })).toBe(460)
    // Centrada: la esquina avanza la mitad del crecimiento, así que el cambio se duplica.
    expect(computeResizedWidth({ startWidth: 300, startVisualWidth: 300, deltaPixels: 20, direction: 1, isCentered: true })).toBe(340)
    expect(computeResizedWidth({ startWidth: 300, startVisualWidth: 300, deltaPixels: -500, direction: 1, isCentered: false })).toBe(80)
    expect(computeResizedWidth({ startWidth: 300, startVisualWidth: 300, deltaPixels: 900, direction: 1, isCentered: false })).toBe(628)
    expect(computeResizedWidth({ startWidth: 300, startVisualWidth: 0, deltaPixels: 50, direction: 1, isCentered: false })).toBe(300)
  })

  it('shrinks a wide image when text should flow around it', () => {
    expect(computeWrapChange({ width: null, alignment: 'center', wrap: 'block' }, 'wrapLeft')).toEqual({ wrap: 'wrapLeft', width: 314, height: null })
    expect(computeWrapChange({ width: 600, alignment: 'center', wrap: 'block' }, 'wrapRight')).toEqual({ wrap: 'wrapRight', width: 314, height: null })
    expect(computeWrapChange({ width: 200, alignment: 'center', wrap: 'block' }, 'wrapRight')).toEqual({ wrap: 'wrapRight' })
    expect(computeWrapChange({ width: 200, alignment: 'left', wrap: 'wrapLeft' }, 'block')).toEqual({ wrap: 'block' })
    expect(computeAlignmentChange('right')).toEqual({ align: 'right', wrap: 'block' })
  })

  it('shares one action catalog with unique accessible names for the toolbar and the context menu', () => {
    const labels = noteImageActions.map(action => action.label)
    expect(new Set(labels).size).toBe(labels.length)
    expect(labels).toEqual([
      'Ancho 25 %', 'Ancho 50 %', 'Ancho 75 %', 'Ancho 100 %',
      'Imagen a la izquierda', 'Imagen centrada', 'Imagen a la derecha',
      'En línea con el texto', 'Texto alrededor, imagen a la izquierda', 'Texto alrededor, imagen a la derecha'
    ])
    const legacyLayout = readImageLayout({})
    expect(noteImageActions.filter(action => action.isActive(legacyLayout)).map(action => action.label)).toEqual(['Imagen centrada', 'En línea con el texto'])
    const half = noteImageActions.find(action => action.actionId === 'size-50')!
    expect(half.change(legacyLayout)).toEqual({ width: 314, height: null })
  })
})
