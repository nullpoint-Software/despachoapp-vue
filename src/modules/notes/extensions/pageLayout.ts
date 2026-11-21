import { Extension } from '@tiptap/core'
import { Plugin, PluginKey, type Transaction } from '@tiptap/pm/state'
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view'

/**
 * Hojas tamaño Carta, como el Diseño de impresión de Word (pulido 2026-10-03, decisión del usuario).
 *
 * La hoja (`.note-paper`) mide 21.59 × 27.94 cm con márgenes de 2.5 cm. Este plugin mide los bloques de primer
 * nivel después de cada cambio y, si uno no cabe en lo que queda de la hoja, inserta antes de él un espaciador
 * (decoración `widget`, fuera del documento) que dibuja el final de la hoja, la separación gris y el margen
 * superior de la siguiente. Así el bloque empieza en la hoja nueva.
 * - Un bloque más alto que una hoja (una tabla muy larga) no se parte: sigue en la hoja siguiente.
 * - El salto de página (`pageBreak`) manda el siguiente bloque a una hoja nueva.
 * - El contenido guardado no cambia: las hojas son sólo presentación.
 */
export const letterPage = { widthPixels: 816, heightPixels: 1056, marginPixels: 94, gapPixels: 24 } as const
const contentHeight = letterPage.heightPixels - 2 * letterPage.marginPixels
const pageStride = letterPage.heightPixels + letterPage.gapPixels
export interface PageGap { position: number; heightPixels: number }
const pageLayoutKey = new PluginKey<DecorationSet>('notePageLayout')

/**
 * Indica si la transacción sólo redibuja las hojas. Al despacharla, otros plugins pueden normalizar el documento
 * (el párrafo final de TrailingNode tras una lista o tabla); ese cambio no lo hizo la persona y no debe marcar la
 * nota como modificada al abrirla.
 */
export function isPageLayoutTransaction(transaction: Transaction): boolean {
  return transaction.getMeta(pageLayoutKey) !== undefined
}

/**
 * Cálculo puro de los espaciadores: recibe cada bloque con su posición, su altura natural y si es un salto de página.
 * Las posiciones verticales se cuentan desde el inicio del área de texto de la primera hoja.
 */
export function computePageGaps(blocks: Array<{ position: number; naturalTop: number; heightPixels: number; isPageBreak: boolean }>): { gaps: PageGap[]; pageCount: number } {
  const gaps: PageGap[] = []
  let pushed = 0, isForced = false, bottom = 0
  for (const block of blocks) {
    const top = block.naturalTop + pushed
    const pageIndex = Math.floor(top / pageStride)
    const pageStart = pageIndex * pageStride, pageEnd = pageStart + contentHeight
    const doesNotFit = top + block.heightPixels > pageEnd && block.heightPixels <= contentHeight && top > pageStart
    if ((isForced || doesNotFit || top > pageEnd) && !block.isPageBreak) {
      const push = (pageIndex + 1) * pageStride - top
      gaps.push({ position: block.position, heightPixels: Math.round(push) })
      pushed += push
    }
    isForced = block.isPageBreak
    bottom = Math.max(bottom, block.naturalTop + pushed + block.heightPixels)
  }
  return { gaps, pageCount: Math.max(1, Math.floor(bottom / pageStride) + 1) }
}

function createGapElement(heightPixels: number): HTMLElement {
  const element = document.createElement('div')
  element.className = 'note-page-gap'
  element.setAttribute('contenteditable', 'false')
  element.setAttribute('aria-hidden', 'true')
  element.style.height = heightPixels + 'px'
  return element
}

function measure(view: EditorView): { gaps: PageGap[]; pageCount: number } {
  const blocks: Array<{ position: number; naturalTop: number; heightPixels: number; isPageBreak: boolean }> = []
  let spacerHeights = 0, spacerIndex = 0
  const spacers = Array.from(view.dom.querySelectorAll<HTMLElement>(':scope > .note-page-gap'))
  view.state.doc.forEach((node, offset) => {
    const element = view.nodeDOM(offset)
    if (!(element instanceof HTMLElement)) return
    // Altura natural: se descuentan los espaciadores que ya están antes de este bloque.
    while (spacerIndex < spacers.length && spacers[spacerIndex]!.offsetTop <= element.offsetTop) spacerHeights += spacers[spacerIndex++]!.offsetHeight
    blocks.push({ position: offset, naturalTop: element.offsetTop - spacerHeights, heightPixels: element.offsetHeight, isPageBreak: node.type.name === 'pageBreak' })
  })
  return computePageGaps(blocks)
}

export const PageLayout = Extension.create({
  name: 'notePageLayout',
  addProseMirrorPlugins() {
    let frame = 0
    let current = ''
    // Protección contra oscilaciones: como máximo 3 ajustes de hojas por cada cambio del documento.
    let measuredDocument: unknown = null, adjustments = 0
    const maximumAdjustments = 3
    return [new Plugin<DecorationSet>({
      key: pageLayoutKey,
      state: {
        init: () => DecorationSet.empty,
        apply: (transaction, decorations) => {
          const gaps = transaction.getMeta(pageLayoutKey) as PageGap[] | undefined
          if (gaps) return DecorationSet.create(transaction.doc, gaps.map(gap => Decoration.widget(gap.position, () => createGapElement(gap.heightPixels), { side: -1, key: 'gap-' + gap.position + '-' + gap.heightPixels, ignoreSelection: true })))
          return decorations.map(transaction.mapping, transaction.doc)
        }
      },
      props: { decorations: state => pageLayoutKey.getState(state) },
      view: editorView => {
        const schedule = (view: EditorView) => {
          cancelAnimationFrame(frame)
          frame = requestAnimationFrame(() => {
            if (!view.dom.isConnected) return
            const { gaps, pageCount } = measure(view)
            view.dom.style.minHeight = (pageCount * pageStride - letterPage.gapPixels - 2 * letterPage.marginPixels) + 'px'
            if (view.state.doc !== measuredDocument) { measuredDocument = view.state.doc; adjustments = 0 }
            const signature = JSON.stringify(gaps)
            // Sólo se despacha si cambió algo: evita un ciclo de medir y redibujar.
            if (signature !== current && adjustments < maximumAdjustments) { current = signature; adjustments++; view.dispatch(view.state.tr.setMeta(pageLayoutKey, gaps).setMeta('addToHistory', false)) }
          })
        }
        schedule(editorView)
        const onResize = () => schedule(editorView)
        window.addEventListener('resize', onResize)
        return { update: view => schedule(view), destroy: () => { cancelAnimationFrame(frame); window.removeEventListener('resize', onResize) } }
      }
    })]
  }
})
