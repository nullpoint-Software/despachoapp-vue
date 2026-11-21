<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, useId, watch } from 'vue'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Download, FileText, Printer, Search, X, ZoomIn, ZoomOut } from '@lucide/vue'
import { TextLayer, type PDFDocumentLoadingTask, type PDFDocumentProxy, type PDFPageProxy, type RenderTask } from 'pdfjs-dist'
import ActionButton from './ActionButton.vue'
import { useDialogMotion } from '../motion/dialogMotion'
import { closePdf, openedPdf } from '../pdf/pdfViewerState'
import { loadPdfDocument } from '../pdf/pdfDocument'
import { readIpcErrorMessage } from '../ipcErrorMessage'
import { useNotifications } from '../notifications/notificationStore'

/**
 * Visor de PDF de Fiscenix (2026-10-06), hecho con pdf.js en lugar de vue-pdf-viewer, que es de licencia comercial con
 * marca de agua. Hay uno solo, montado en App.vue, y muestra `openedPdf`.
 *
 * - **Páginas:** todas en una columna que se desplaza. Cada hoja se dibuja (canvas a la densidad de la pantalla +
 *   capa de texto para seleccionar y copiar) sólo cuando se acerca a la vista (IntersectionObserver). Al cambiar el
 *   zoom se vuelven a dibujar las visibles.
 * - **Barra:** página anterior/siguiente y número de página; alejar, zoom (ajustar al ancho, página completa o
 *   porcentaje), campo de porcentaje libre y acercar; buscar con anterior/siguiente y conteo; Imprimir, Guardar y Cerrar.
 *   Ctrl + rueda acerca y aleja (ver «Zoom» abajo).
 * - **Buscar:** compara sin mayúsculas ni acentos dentro de cada fragmento de texto de pdf.js (una coincidencia
 *   partida entre dos fragmentos no se encuentra). Resalta las coincidencias de la hoja y lleva a la actual.
 * - **Imprimir y Guardar** van a Main sólo con el `viewId`: Main imprime el HTML del documento en blanco y negro o
 *   escribe el mismo PDF donde la persona elija.
 * - **PDF del expediente** (`kind: 'stored'`, 2026-10-11): no tienen HTML. Para imprimir, la vista dibuja cada hoja
 *   con pdf.js como imagen (≈150 ppp) en `.pdf-print-pages`, un contenedor en `body` que sólo se ve al imprimir y
 *   que oculta el resto de la app en impresión; después pide `pdf:print` y Main abre el diálogo del sistema para la
 *   ventana principal. Al cerrarse el diálogo el contenedor se vacía. Guardar escribe los bytes originales del Host.
 * - **Teclado:** Ctrl+F busca, Ctrl+P imprime, Ctrl+S guarda, Ctrl + / Ctrl − cambian el zoom, Re Pág / Av Pág cambian
 *   de página y Escape cierra.
 * - **Al cerrar** se destruye el documento de pdf.js y Main libera su copia.
 */
/**
 * Zoom (2026-10-19, pedido del usuario: "zoom con la ruedita del ratón y que no sea fijo, que haya intermedios como
 * 21, 22, 23"): ajustar al ancho, página completa o un porcentaje libre de `minimumZoomPercent` a `maximumZoomPercent`.
 * - Ctrl + rueda (y el pellizco del touchpad, que llega como Ctrl + rueda) cambia el porcentaje: una muesca de ratón
 *   ≈ 5 %, el touchpad de 1 en 1; el punto bajo el puntero se queda en su lugar.
 * - El campo de porcentaje acepta cualquier entero; los botones y Ctrl + / Ctrl − avanzan de 10 en 10.
 * - Mientras cambia, las hojas se estiran por CSS al instante y se vuelven a dibujar nítidas 150 ms después.
 */
type ZoomMode = 'page-width' | 'page-fit' | 'percent'
interface PageSize { width: number; height: number }
interface SearchMatch { pageIndex: number; itemIndex: number; occurrence: number }

const minimumZoomPercent = 10, maximumZoomPercent = 400, zoomButtonStepPercent = 10
const presetZoomPercents = [50, 75, 100, 125, 150, 200]
const pagesGapPixels = 24, pagesPaddingPixels = 48

const { notify } = useNotifications()
const dialog = ref<HTMLDialogElement | null>(null), scroller = ref<HTMLElement | null>(null), searchInput = ref<HTMLInputElement | null>(null)
const titleId = useId()
const motion = useDialogMotion(dialog)
const pdf = shallowRef<PDFDocumentProxy | null>(null)
const pageSizes = ref<PageSize[]>([])
const currentPage = ref(1), pageInput = ref('1')
const zoom = ref<ZoomMode>('page-width'), zoomPercent = ref(100), scale = ref(1)
const isLoading = ref(false), loadError = ref(''), isPrinting = ref(false), isSaving = ref(false)
/** Hojas listas para imprimir un PDF del expediente (imágenes `data:`, permitidas por la CSP); vacío fuera de la impresión. */
const printImages = shallowRef<string[]>([])
const printContainer = ref<HTMLElement | null>(null)
/** 150 ppp: el PDF mide en puntos (72 por pulgada). Buena nitidez de texto sin imágenes enormes. */
const printScale = 150 / 72
const searchText = ref(''), matches = ref<SearchMatch[]>([]), matchIndex = ref(-1)
const pageElements = new Map<number, HTMLElement>()
const renderedScales = new Map<number, number>()
const renderTasks = new Map<number, RenderTask>()
const textLayers = new Map<number, TextLayer>()
const pageTexts = new Map<number, string[]>()
let observer: IntersectionObserver | null = null, resizeObserver: ResizeObserver | null = null, loadGeneration = 0, scrollFrame = 0
let loadingTask: PDFDocumentLoadingTask | null = null

const pageCount = computed(() => pageSizes.value.length)
/**
 * Opciones del selector: los ajustes y los porcentajes de siempre. Un porcentaje distinto (rueda o escrito) se muestra
 * como «Personalizado»; su número va en el campo de porcentaje.
 */
const isCustomZoom = computed(() => zoom.value === 'percent' && !presetZoomPercents.includes(zoomPercent.value))
const zoomOptions = computed(() => [
  { value: 'page-width', label: 'Ajustar al ancho' }, { value: 'page-fit', label: 'Página completa' },
  ...presetZoomPercents.map(percent => ({ value: String(percent), label: percent + ' %' })),
  ...(isCustomZoom.value ? [{ value: 'custom', label: 'Personalizado' }] : [])
])
const zoomSelection = computed({
  get: () => zoom.value !== 'percent' ? zoom.value : isCustomZoom.value ? 'custom' : String(zoomPercent.value),
  set: value => { if (value === 'page-width' || value === 'page-fit') zoom.value = value; else if (value !== 'custom') setZoomPercent(Number(value)) }
})
/** Lo que muestra el campo de porcentaje: el porcentaje elegido o el que resulta de un ajuste. */
const zoomPercentInput = ref('100')
watch(scale, value => { zoomPercentInput.value = String(Math.round(value * 100)) })
const matchLabel = computed(() => !searchText.value.trim() ? '' : matches.value.length ? (matchIndex.value + 1) + ' de ' + matches.value.length : 'Sin coincidencias')

/** Texto comparable: sin mayúsculas ni acentos. */
const normalize = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

watch(openedPdf, async view => {
  await nextTick()
  if (!dialog.value) return
  if (view) { motion.open(); await load(view.content) }
  else { motion.close(); destroyDocument() }
})

async function load(content: Uint8Array): Promise<void> {
  const generation = ++loadGeneration
  destroyDocument()
  isLoading.value = true; loadError.value = ''; currentPage.value = 1; pageInput.value = '1'; searchText.value = ''; matches.value = []; matchIndex.value = -1
  try {
    const task = loadPdfDocument(content)
    loadingTask = task
    const document = await task.promise
    if (generation !== loadGeneration) return
    const sizes: PageSize[] = []
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const viewport = (await document.getPage(pageNumber)).getViewport({ scale: 1 })
      sizes.push({ width: viewport.width, height: viewport.height })
    }
    pdf.value = document; pageSizes.value = sizes
    applyZoom()
    await nextTick()
    observePages()
    scroller.value?.scrollTo({ top: 0 })
    scroller.value?.focus({ preventScroll: true })
  } catch (caught) {
    // Una carga reemplazada por otra (se abrió otro PDF) termina con error al destruirse: no es un fallo que mostrar.
    if (generation !== loadGeneration) return
    loadError.value = caught instanceof Error && caught.name === 'PasswordException' ? 'El PDF está protegido con contraseña.' : 'No se pudo abrir el PDF: el archivo está dañado o no es compatible.'
  } finally { if (generation === loadGeneration) isLoading.value = false }
}

function destroyDocument(): void {
  clearTimeout(wheelRedrawTimer)
  observer?.disconnect(); observer = null
  for (const task of renderTasks.values()) task.cancel()
  for (const layer of textLayers.values()) layer.cancel()
  renderTasks.clear(); textLayers.clear(); renderedScales.clear(); pageTexts.clear(); pageElements.clear()
  pdf.value = null; pageSizes.value = []
  // Destruir la tarea de carga libera el documento y su worker.
  const task = loadingTask
  loadingTask = null
  if (task) void task.destroy()
}

/** Escala según la opción: ajustar al ancho o a la hoja completa usa el tamaño del área visible. */
function applyZoom(): void {
  const area = scroller.value
  const widest = Math.max(1, ...pageSizes.value.map(size => size.width)), tallest = Math.max(1, ...pageSizes.value.map(size => size.height))
  const availableWidth = Math.max(200, (area?.clientWidth ?? 900) - pagesPaddingPixels), availableHeight = Math.max(200, (area?.clientHeight ?? 700) - pagesPaddingPixels)
  const next = zoom.value === 'page-width' ? availableWidth / widest : zoom.value === 'page-fit' ? Math.min(availableWidth / widest, availableHeight / tallest) : zoomPercent.value / 100
  scale.value = Math.min(maximumZoomPercent / 100, Math.max(minimumZoomPercent / 100, Math.round(next * 1000) / 1000))
}
watch([zoom, zoomPercent], async () => {
  // El zoom con la rueda conserva su propio punto de anclaje (el watcher corre antes de que termine `onWheel`); los
  // demás cambios vuelven al inicio de la página actual.
  if (isWheelZooming) return
  const page = currentPage.value
  applyZoom(); await nextTick(); rerenderVisible(); scrollToPage(page, 'instant')
})
/** Porcentaje libre, entero y dentro de los límites. */
function setZoomPercent(percent: number): void {
  if (!Number.isFinite(percent)) return
  zoomPercent.value = Math.min(maximumZoomPercent, Math.max(minimumZoomPercent, Math.round(percent)))
  zoom.value = 'percent'
}
function stepZoom(direction: 1 | -1): void { setZoomPercent(Math.round(scale.value * 100) + direction * zoomButtonStepPercent) }
function commitZoomPercentInput(): void {
  const percent = Number(zoomPercentInput.value.replace('%', '').trim())
  if (Number.isFinite(percent) && percent > 0) setZoomPercent(percent)
  zoomPercentInput.value = String(Math.round(scale.value * 100))
}

/**
 * Ctrl + rueda: cambia el porcentaje y deja quieto el punto bajo el puntero. Las hojas se estiran por CSS de inmediato
 * y se redibujan nítidas cuando la rueda se detiene. Sin Ctrl, la rueda sigue desplazando las páginas.
 */
let isWheelZooming = false, wheelRedrawTimer: ReturnType<typeof setTimeout> | undefined
async function onWheel(event: WheelEvent): Promise<void> {
  if (!event.ctrlKey && !event.metaKey) return
  event.preventDefault()
  const area = scroller.value
  if (!area || !pageCount.value) return
  // Muesca de ratón (≈100) → 5 %; el touchpad manda deltas pequeños → 1 %.
  const stepPercent = Math.min(10, Math.max(1, Math.round(Math.abs(event.deltaY) / 20)))
  const before = scale.value
  const next = Math.min(maximumZoomPercent, Math.max(minimumZoomPercent, Math.round(before * 100) + (event.deltaY < 0 ? stepPercent : -stepPercent)))
  if (next === Math.round(before * 100)) return
  const bounds = area.getBoundingClientRect()
  const pointerX = event.clientX - bounds.left, pointerY = event.clientY - bounds.top
  const contentX = area.scrollLeft + pointerX, contentY = area.scrollTop + pointerY
  isWheelZooming = true
  setZoomPercent(next); applyZoom()
  await nextTick()
  isWheelZooming = false
  const ratio = scale.value / before
  area.scrollLeft = contentX * ratio - pointerX; area.scrollTop = contentY * ratio - pointerY
  clearTimeout(wheelRedrawTimer)
  wheelRedrawTimer = setTimeout(rerenderVisible, 150)
}

function setPageElement(pageNumber: number, element: unknown): void {
  if (element instanceof HTMLElement) pageElements.set(pageNumber, element)
  else pageElements.delete(pageNumber)
}
function observePages(): void {
  observer?.disconnect()
  observer = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) void renderPage(Number((entry.target as HTMLElement).dataset.pageNumber))
  }, { root: scroller.value, rootMargin: '600px 0px' })
  for (const element of pageElements.values()) observer.observe(element)
  resizeObserver?.disconnect()
  resizeObserver = new ResizeObserver(() => { if (zoom.value === 'page-width' || zoom.value === 'page-fit') { const before = scale.value; applyZoom(); if (before !== scale.value) void nextTick(rerenderVisible) } })
  if (scroller.value) resizeObserver.observe(scroller.value)
}
/** Tras cambiar la escala: las hojas visibles se vuelven a dibujar; las demás, cuando se acerquen. */
function rerenderVisible(): void {
  renderedScales.clear()
  if (!observer) return
  for (const element of pageElements.values()) { observer.unobserve(element); observer.observe(element) }
}

async function renderPage(pageNumber: number): Promise<void> {
  const document = pdf.value, element = pageElements.get(pageNumber)
  const targetScale = scale.value
  if (!document || !element || renderedScales.get(pageNumber) === targetScale) return
  renderedScales.set(pageNumber, targetScale)
  renderTasks.get(pageNumber)?.cancel(); textLayers.get(pageNumber)?.cancel()
  const page: PDFPageProxy = await document.getPage(pageNumber)
  if (pdf.value !== document) return
  const viewport = page.getViewport({ scale: targetScale })
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
  const canvas = globalThis.document.createElement('canvas')
  canvas.width = Math.floor(viewport.width * pixelRatio); canvas.height = Math.floor(viewport.height * pixelRatio)
  canvas.className = 'pdf-canvas'
  canvas.setAttribute('aria-hidden', 'true')
  const task = page.render({ canvas, viewport, transform: pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0] })
  renderTasks.set(pageNumber, task)
  try { await task.promise } catch { return } finally { if (renderTasks.get(pageNumber) === task) renderTasks.delete(pageNumber) }
  if (renderedScales.get(pageNumber) !== targetScale) return
  // Capa de texto de pdf.js: permite seleccionar, copiar y resaltar lo buscado.
  const textContainer = globalThis.document.createElement('div')
  textContainer.className = 'textLayer'
  const layer = new TextLayer({ textContentSource: await page.getTextContent(), container: textContainer, viewport })
  textLayers.set(pageNumber, layer)
  try { await layer.render() } catch { return }
  element.querySelector('.pdf-canvas')?.remove(); element.querySelector('.textLayer')?.remove()
  element.append(canvas, textContainer)
  highlightPage(pageNumber)
}

/** Página actual: la primera cuya mitad inferior sigue a la vista. */
function onScroll(): void {
  cancelAnimationFrame(scrollFrame)
  scrollFrame = requestAnimationFrame(() => {
    const area = scroller.value
    if (!area) return
    const top = area.scrollTop + area.clientHeight * .3
    let page = 1
    for (const [pageNumber, element] of pageElements) if (element.offsetTop <= top) page = Math.max(page, pageNumber)
    currentPage.value = page
    if (globalThis.document.activeElement?.id !== 'pdf-page-number') pageInput.value = String(page)
  })
}
function scrollToPage(pageNumber: number, behavior: ScrollBehavior = 'smooth'): void {
  const target = Math.min(Math.max(1, pageNumber), pageCount.value)
  const element = pageElements.get(target)
  if (!element || !scroller.value) return
  scroller.value.scrollTo({ top: element.offsetTop - pagesGapPixels, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : behavior })
  currentPage.value = target; pageInput.value = String(target)
}
function goToTypedPage(): void {
  const typed = Number.parseInt(pageInput.value, 10)
  if (Number.isFinite(typed)) scrollToPage(typed); else pageInput.value = String(currentPage.value)
}

/** Textos de cada fragmento de la hoja (se piden una vez por documento). */
async function readPageTexts(pageNumber: number): Promise<string[]> {
  const cached = pageTexts.get(pageNumber)
  if (cached) return cached
  const page = await pdf.value!.getPage(pageNumber)
  const texts = (await page.getTextContent()).items.map(item => ('str' in item ? item.str : ''))
  pageTexts.set(pageNumber, texts)
  return texts
}
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(searchText, () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { void runSearch() }, 250) })
async function runSearch(): Promise<void> {
  const query = normalize(searchText.value.trim())
  const found: SearchMatch[] = []
  if (query && pdf.value) {
    for (let pageNumber = 1; pageNumber <= pageCount.value; pageNumber++) {
      const texts = await readPageTexts(pageNumber)
      texts.forEach((text, itemIndex) => {
        const normalized = normalize(text)
        let occurrence = 0, position = normalized.indexOf(query)
        while (position !== -1) { found.push({ pageIndex: pageNumber, itemIndex, occurrence: occurrence++ }); position = normalized.indexOf(query, position + query.length) }
      })
    }
  }
  matches.value = found
  matchIndex.value = found.length ? 0 : -1
  for (const pageNumber of textLayers.keys()) highlightPage(pageNumber)
  if (found.length) scrollToPage(found[0]!.pageIndex)
}
function stepMatch(direction: 1 | -1): void {
  if (!matches.value.length) return
  matchIndex.value = (matchIndex.value + direction + matches.value.length) % matches.value.length
  const match = matches.value[matchIndex.value]!
  for (const pageNumber of textLayers.keys()) highlightPage(pageNumber)
  scrollToPage(match.pageIndex)
}
/**
 * Resalta en la capa de texto de la hoja: cada coincidencia va en un `<mark>` (la actual con `.is-current`). Se arma con
 * nodos de texto, nunca con HTML, para no interpretar el contenido del PDF.
 */
function highlightPage(pageNumber: number): void {
  const layer = textLayers.get(pageNumber)
  if (!layer) return
  const query = normalize(searchText.value.trim())
  const current = matches.value[matchIndex.value]
  layer.textDivs.forEach((division, itemIndex) => {
    const text = layer.textContentItemsStr[itemIndex] ?? ''
    const normalized = normalize(text)
    if (!query || !normalized.includes(query)) { if (division.querySelector('mark')) division.textContent = text; return }
    const fragment = globalThis.document.createDocumentFragment()
    let cursor = 0, occurrence = 0, position = normalized.indexOf(query)
    while (position !== -1) {
      fragment.append(text.slice(cursor, position))
      const mark = globalThis.document.createElement('mark')
      mark.textContent = text.slice(position, position + query.length)
      if (current && current.pageIndex === pageNumber && current.itemIndex === itemIndex && current.occurrence === occurrence) mark.className = 'is-current'
      fragment.append(mark)
      cursor = position + query.length; occurrence++
      position = normalized.indexOf(query, cursor)
    }
    fragment.append(text.slice(cursor))
    division.replaceChildren(fragment)
  })
  dialog.value?.querySelector('mark.is-current')?.scrollIntoView({ block: 'center', behavior: 'instant' })
}

/**
 * Dibuja todas las hojas del PDF abierto como imágenes para imprimir (sólo PDFs del expediente). Una hoja a la vez, con
 * `intent: 'print'` de pdf.js; cada canvas se suelta en cuanto se convierte en imagen. Espera a que las imágenes estén
 * decodificadas para que el diálogo de impresión nunca vea hojas en blanco.
 */
async function preparePrintImages(document: PDFDocumentProxy): Promise<void> {
  const images: string[] = []
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
    const page = await document.getPage(pageNumber)
    const viewport = page.getViewport({ scale: printScale })
    const canvas = globalThis.document.createElement('canvas')
    canvas.width = Math.floor(viewport.width); canvas.height = Math.floor(viewport.height)
    await page.render({ canvas, viewport, intent: 'print' }).promise
    images.push(canvas.toDataURL('image/png'))
    canvas.width = 0; canvas.height = 0
    if (pdf.value !== document) throw new Error('PDF closed while preparing print')
  }
  printImages.value = images
  await nextTick()
  await Promise.all(Array.from(printContainer.value?.querySelectorAll('img') ?? [], image => image.decode()))
}

async function printDocument(): Promise<void> {
  const view = openedPdf.value, document = pdf.value
  if (!view || !document || isPrinting.value) return
  isPrinting.value = true
  try {
    // Sin HTML (expediente o CSF capturada del SAT): se imprimen las hojas dibujadas con pdf.js.
    if (view.kind !== 'generated') await preparePrintImages(document)
    await window.contapp.printPdfView(view.viewId)
  }
  catch (caught) { notify('No se imprimió', readIpcErrorMessage(caught, 'No se pudo imprimir el PDF.'), 'error') }
  finally { printImages.value = []; isPrinting.value = false }
}
async function saveDocument(): Promise<void> {
  const view = openedPdf.value
  if (!view || isSaving.value) return
  isSaving.value = true
  try { if (await window.contapp.savePdfView(view.viewId) === 'saved') notify('PDF guardado', view.fileName + ' se guardó donde elegiste.', 'success') }
  catch (caught) { notify('No se guardó', readIpcErrorMessage(caught, 'No se pudo guardar el PDF.'), 'error') }
  finally { isSaving.value = false }
}

function onKeydown(event: KeyboardEvent): void {
  const isCommand = event.ctrlKey || event.metaKey
  const key = event.key.toLowerCase()
  if (isCommand && key === 'f') { event.preventDefault(); searchInput.value?.focus(); searchInput.value?.select() }
  else if (isCommand && key === 'p') { event.preventDefault(); void printDocument() }
  else if (isCommand && key === 's') { event.preventDefault(); void saveDocument() }
  else if (isCommand && (key === '+' || key === '=')) { event.preventDefault(); stepZoom(1) }
  else if (isCommand && key === '-') { event.preventDefault(); stepZoom(-1) }
  else if (event.key === 'PageDown' && event.target === scroller.value) { event.preventDefault(); scrollToPage(currentPage.value + 1) }
  else if (event.key === 'PageUp' && event.target === scroller.value) { event.preventDefault(); scrollToPage(currentPage.value - 1) }
}
function onSearchKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter') { event.preventDefault(); stepMatch(event.shiftKey ? -1 : 1) }
}

onBeforeUnmount(() => { clearTimeout(searchTimer); cancelAnimationFrame(scrollFrame); resizeObserver?.disconnect(); destroyDocument() })
</script>
<template>
  <dialog
    ref="dialog"
    class="pdf-viewer motion-dialog"
    :aria-labelledby="titleId"
    data-testid="pdf-viewer"
    @cancel.prevent="closePdf"
    @keydown="onKeydown"
  >
    <template v-if="openedPdf || motion.isRendered.value">
      <header class="pdf-header">
        <div class="pdf-title">
          <FileText
            :size="22"
            aria-hidden="true"
          />
          <div>
            <h2 :id="titleId">
              {{ openedPdf?.title ?? 'PDF' }}
            </h2>
            <span>{{ openedPdf?.fileName }}{{ pageCount ? ' · ' + pageCount + ' página(s)' : '' }}</span>
          </div>
        </div>
        <div class="pdf-actions">
          <ActionButton
            :is-loading="isPrinting"
            :disabled="!pageCount"
            @click="printDocument"
          >
            <Printer
              :size="16"
              aria-hidden="true"
            /> Imprimir
          </ActionButton>
          <ActionButton
            variant="primary"
            :is-loading="isSaving"
            :disabled="!pageCount"
            @click="saveDocument"
          >
            <Download
              :size="16"
              aria-hidden="true"
            /> Guardar
          </ActionButton>
          <button
            type="button"
            class="pdf-icon-button"
            aria-label="Cerrar el visor de PDF"
            @click="closePdf"
          >
            <X
              :size="22"
              aria-hidden="true"
            />
          </button>
        </div>
      </header>
      <div
        class="pdf-toolbar"
        role="toolbar"
        aria-label="Controles del PDF"
      >
        <div class="pdf-group">
          <button
            type="button"
            class="pdf-icon-button"
            aria-label="Página anterior"
            :disabled="currentPage <= 1"
            @click="scrollToPage(currentPage - 1)"
          >
            <ChevronLeft
              :size="18"
              aria-hidden="true"
            />
          </button>
          <label
            class="pdf-page-field"
            for="pdf-page-number"
          >
            <span class="sr-only">Página</span>
            <input
              id="pdf-page-number"
              v-model="pageInput"
              inputmode="numeric"
              autocomplete="off"
              aria-label="Página"
              @keydown.enter.prevent="goToTypedPage"
              @blur="goToTypedPage"
            >
            <span aria-hidden="true">/ {{ pageCount || '—' }}</span>
          </label>
          <button
            type="button"
            class="pdf-icon-button"
            aria-label="Página siguiente"
            :disabled="currentPage >= pageCount"
            @click="scrollToPage(currentPage + 1)"
          >
            <ChevronRight
              :size="18"
              aria-hidden="true"
            />
          </button>
        </div>
        <div class="pdf-group">
          <button
            type="button"
            class="pdf-icon-button"
            aria-label="Alejar"
            @click="stepZoom(-1)"
          >
            <ZoomOut
              :size="18"
              aria-hidden="true"
            />
          </button>
          <select
            v-model="zoomSelection"
            class="pdf-zoom"
            aria-label="Zoom del PDF"
          >
            <option
              v-for="option in zoomOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
          <label class="pdf-zoom-percent">
            <input
              v-model="zoomPercentInput"
              type="text"
              inputmode="numeric"
              aria-label="Porcentaje de zoom"
              title="Escribe un porcentaje y presiona Enter (Ctrl + rueda también acerca y aleja)"
              @keydown.enter.prevent="commitZoomPercentInput"
              @blur="commitZoomPercentInput"
            >
            <span aria-hidden="true">%</span>
          </label>
          <button
            type="button"
            class="pdf-icon-button"
            aria-label="Acercar"
            @click="stepZoom(1)"
          >
            <ZoomIn
              :size="18"
              aria-hidden="true"
            />
          </button>
        </div>
        <div class="pdf-group pdf-search">
          <Search
            :size="16"
            aria-hidden="true"
          />
          <input
            ref="searchInput"
            v-model="searchText"
            type="search"
            aria-label="Buscar en el PDF"
            placeholder="Buscar en el PDF"
            @keydown="onSearchKeydown"
          >
          <span
            class="pdf-match-count"
            aria-live="polite"
          >{{ matchLabel }}</span>
          <button
            type="button"
            class="pdf-icon-button"
            aria-label="Coincidencia anterior"
            :disabled="!matches.length"
            @click="stepMatch(-1)"
          >
            <ChevronUp
              :size="18"
              aria-hidden="true"
            />
          </button>
          <button
            type="button"
            class="pdf-icon-button"
            aria-label="Coincidencia siguiente"
            :disabled="!matches.length"
            @click="stepMatch(1)"
          >
            <ChevronDown
              :size="18"
              aria-hidden="true"
            />
          </button>
        </div>
      </div>
      <div
        ref="scroller"
        class="pdf-pages"
        tabindex="0"
        aria-label="Páginas del PDF"
        @scroll.passive="onScroll"
        @wheel="onWheel"
      >
        <p
          v-if="isLoading"
          class="pdf-status"
        >
          Abriendo el PDF…
        </p>
        <p
          v-else-if="loadError"
          class="pdf-status is-error"
          role="alert"
        >
          {{ loadError }}
        </p>
        <section
          v-for="(size, index) in pageSizes"
          :key="index"
          :ref="element => setPageElement(index + 1, element)"
          class="pdf-page"
          :data-page-number="index + 1"
          :aria-label="'Página ' + (index + 1) + ' de ' + pageCount"
          :style="{ width: Math.floor(size.width * scale) + 'px', height: Math.floor(size.height * scale) + 'px', '--total-scale-factor': String(scale), '--scale-round-x': '1px', '--scale-round-y': '1px' }"
        />
      </div>
    </template>
  </dialog>
  <!-- Hojas para imprimir un PDF del expediente: fuera del diálogo, invisibles en pantalla (ver estilos globales). -->
  <Teleport to="body">
    <div
      v-if="printImages.length"
      ref="printContainer"
      class="pdf-print-pages"
      aria-hidden="true"
    >
      <img
        v-for="(image, index) in printImages"
        :key="index"
        :src="image"
        alt=""
      >
    </div>
  </Teleport>
</template>
<style scoped>
/* Visor a casi toda la ventana, con el lenguaje brutalista: marco de 3 px, sombra dura y barras con filete grueso. */
.pdf-viewer { width: calc(100vw - 32px); max-width: none; height: calc(100dvh - 32px); max-height: none; margin: auto; padding: 0; border: 3px solid var(--borderColor); border-radius: 0; box-shadow: 8px 8px 0 var(--borderColor); background: var(--surfaceColor); color: var(--textColor); overflow: hidden; }
.pdf-viewer[open] { display: flex; flex-direction: column; }
.pdf-viewer::backdrop { background: rgb(11 11 11 / 60%); }
.pdf-header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px 16px; padding: 12px 16px; border-bottom: 2px solid var(--borderColor); }
.pdf-title { display: flex; align-items: center; gap: 12px; min-width: 0; }
.pdf-title h2 { margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -.02em; overflow-wrap: anywhere; }
.pdf-title span { font-family: var(--monoFontFamily); font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: var(--mutedTextColor); }
.pdf-actions, .pdf-group { display: flex; align-items: center; gap: 6px; }
.pdf-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 20px; padding: 8px 16px; border-bottom: 2px solid var(--borderColor); background: var(--subtleColor); }
.pdf-icon-button:disabled { opacity: .45; cursor: not-allowed; }
.pdf-icon-button { display: grid; place-items: center; width: 36px; height: 36px; border: 2px solid transparent; background: transparent; color: var(--textColor); cursor: pointer; }
.pdf-icon-button:hover:not(:disabled) { border-color: var(--borderColor); background: var(--hoverColor); }
.pdf-icon-button:focus-visible, .pdf-pages:focus-visible { outline: 2px solid var(--focusColor); outline-offset: 2px; }
.pdf-page-field { display: inline-flex; align-items: center; gap: 6px; font-family: var(--monoFontFamily); font-size: 13px; }
.pdf-page-field input { width: 52px; height: 34px; padding: 0 6px; border: 2px solid var(--borderColor); background: var(--inputColor); color: var(--textColor); font: inherit; text-align: center; }
.pdf-zoom { height: 34px; }
.pdf-match-count { min-width: 5.5rem; font-family: var(--monoFontFamily); font-size: 12px; color: var(--mutedTextColor); }
.pdf-zoom-percent { display: inline-flex; align-items: center; gap: 6px; font-family: var(--monoFontFamily); font-size: 12px; color: var(--mutedTextColor); }
.pdf-zoom-percent input { width: 3.4rem; height: 34px; padding: 0 6px; border: 2px solid var(--borderColor); background: var(--inputColor); color: var(--textColor); font: inherit; text-align: right; }
.pdf-zoom-percent input:focus-visible { outline: 3px solid var(--focusColor); outline-offset: 1px; }
.pdf-search input { width: min(16rem, 40vw); height: 34px; padding: 0 8px; border: 2px solid var(--borderColor); background: var(--inputColor); color: var(--textColor); font: inherit; }
/* Mesa de trabajo: las hojas van en blanco (como impresas) con marco y sombra dura en los dos temas. */
.pdf-pages { flex: 1; min-height: 0; display: flex; flex-direction: column; align-items: center; gap: 24px; padding: 24px; overflow: auto; overscroll-behavior: contain; background: var(--deskColor, var(--subtleColor)); }
.pdf-page { position: relative; flex-shrink: 0; background: #fff; border: 2px solid #0b0b0b; box-shadow: 5px 5px 0 var(--borderColor); }
.pdf-page :deep(.pdf-canvas) { position: absolute; inset: 0; width: 100%; height: 100%; }
.pdf-status { margin: 48px auto; font-weight: 700; }
.pdf-status.is-error { color: var(--errorText); }
/* Capa de texto de pdf.js (reglas mínimas de pdf_viewer.css): texto transparente y seleccionable sobre el canvas. */
.pdf-page :deep(.textLayer) { position: absolute; inset: 0; overflow: clip; opacity: 1; line-height: 1; text-align: initial; transform-origin: 0 0; z-index: 1; forced-color-adjust: none; --min-font-size: 1; --text-scale-factor: calc(var(--total-scale-factor) * var(--min-font-size)); --min-font-size-inv: calc(1 / var(--min-font-size)); }
.pdf-page :deep(.textLayer :is(span, br)) { color: transparent; position: absolute; white-space: pre; cursor: text; transform-origin: 0% 0%; user-select: text; }
.pdf-page :deep(.textLayer > :not(.markedContent)), .pdf-page :deep(.textLayer .markedContent span:not(.markedContent)) { z-index: 1; --font-height: 0; font-size: calc(var(--text-scale-factor) * var(--font-height)); --scale-x: 1; --rotate: 0deg; transform: rotate(var(--rotate)) scaleX(var(--scale-x)) scale(var(--min-font-size-inv)); }
.pdf-page :deep(.textLayer .markedContent) { display: contents; }
.pdf-page :deep(.textLayer ::selection) { background: rgb(29 78 216 / 30%); color: transparent; }
.pdf-page :deep(.textLayer mark) { margin: -1px; padding: 1px; color: transparent; background: rgb(250 204 21 / 55%); }
.pdf-page :deep(.textLayer mark.is-current) { background: rgb(29 78 216 / 45%); outline: 2px solid #0b0b0b; }
@media (max-width: 760px) {
  .pdf-viewer { width: 100vw; height: 100dvh; border: 0; box-shadow: none; }
  .pdf-pages { padding: 12px; }
  .pdf-search input { width: 100%; }
  .pdf-search { flex: 1 1 100%; }
}
</style>
<style>
/*
 * Impresión de PDFs del expediente (globales porque afectan a body). Sólo actúan mientras existe .pdf-print-pages:
 * en pantalla el contenedor no se ve; al imprimir se oculta todo lo demás (también los diálogos de la capa superior)
 * y cada imagen ocupa una hoja, centrada y sin deformarse.
 */
.pdf-print-pages { display: none; }
@media print {
  @page { size: auto; margin: 8mm; }
  html:has(body > .pdf-print-pages), body:has(> .pdf-print-pages) { height: auto !important; overflow: visible !important; background: #fff !important; }
  body:has(> .pdf-print-pages) > :not(.pdf-print-pages), body:has(> .pdf-print-pages) dialog { display: none !important; }
  .pdf-print-pages { display: block; }
  .pdf-print-pages img { display: block; width: 100%; height: auto; max-height: calc(100vh - 1px); object-fit: contain; margin: 0 auto; break-inside: avoid; break-after: page; }
  .pdf-print-pages img:last-child { break-after: auto; }
}
</style>
