import { describe, expect, it } from 'vitest'
import { helpTipGapPixels, helpTipViewportMarginPixels, placeHelpTip } from '../../src/shared/components/helpTipPlacement'

/** Globo de ayuda "?" (2026-10-10): siempre dentro de la ventana, debajo del botón si cabe y si no arriba. */
const viewport = { width: 1000, height: 700 }
const popover = { width: 320, height: 120 }

describe('placeHelpTip', () => {
  it('opens below the button, aligned to its left edge', () => {
    const placement = placeHelpTip({ top: 100, left: 200, width: 24, height: 24 }, popover, viewport)
    expect(placement).toEqual({ top: 100 + 24 + helpTipGapPixels, left: 200, side: 'bottom' })
  })

  it('moves left when the button is near the right edge', () => {
    const placement = placeHelpTip({ top: 100, left: 960, width: 24, height: 24 }, popover, viewport)
    expect(placement.left).toBe(viewport.width - helpTipViewportMarginPixels - popover.width)
  })

  it('opens above when there is no room below', () => {
    const placement = placeHelpTip({ top: 640, left: 200, width: 24, height: 24 }, popover, viewport)
    expect(placement.side).toBe('top')
    expect(placement.top).toBe(640 - helpTipGapPixels - popover.height)
  })

  it('stays inside a viewport smaller than the popover', () => {
    const placement = placeHelpTip({ top: 50, left: 4, width: 24, height: 24 }, { width: 320, height: 400 }, { width: 300, height: 200 })
    expect(placement.left).toBe(helpTipViewportMarginPixels)
    expect(placement.top).toBe(helpTipViewportMarginPixels)
  })
})
