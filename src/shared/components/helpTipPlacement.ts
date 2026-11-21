/**
 * Colocación del globo de ayuda (`HelpTip`) dentro de la ventana.
 *
 * Regla: el globo va debajo del botón "?" y alineado a su borde izquierdo. Si no cabe abajo y arriba hay más
 * espacio, sube. En horizontal se recorre para no salirse de la ventana (con un margen fijo), así un "?" pegado
 * al borde derecho abre su globo hacia la izquierda. Es una función pura para poder probarla sin navegador.
 */
export interface HelpTipRectangle { top: number; left: number; width: number; height: number }
export interface HelpTipViewport { width: number; height: number }
export interface HelpTipPlacement { top: number; left: number; side: 'top' | 'bottom' }

/** Separación entre el botón y el globo, y margen mínimo contra los bordes de la ventana (px). */
export const helpTipGapPixels = 8
export const helpTipViewportMarginPixels = 8

export function placeHelpTip(anchor: HelpTipRectangle, popover: Pick<HelpTipRectangle, 'width' | 'height'>, viewport: HelpTipViewport): HelpTipPlacement {
  const margin = helpTipViewportMarginPixels
  const spaceBelow = viewport.height - (anchor.top + anchor.height) - helpTipGapPixels - margin
  const spaceAbove = anchor.top - helpTipGapPixels - margin
  const side: HelpTipPlacement['side'] = popover.height <= spaceBelow || spaceBelow >= spaceAbove ? 'bottom' : 'top'
  const preferredTop = side === 'bottom' ? anchor.top + anchor.height + helpTipGapPixels : anchor.top - helpTipGapPixels - popover.height
  // Si ni así cabe (ventana muy baja), se pega al margen superior: el globo tiene scroll propio.
  const top = Math.max(margin, Math.min(preferredTop, viewport.height - margin - popover.height))
  const maximumLeft = Math.max(margin, viewport.width - margin - popover.width)
  const left = Math.min(Math.max(anchor.left, margin), maximumLeft)
  return { top: Math.round(top), left: Math.round(left), side }
}
