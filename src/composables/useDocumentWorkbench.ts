import { computed, nextTick, onMounted, onUnmounted, ref, watch, type Ref } from 'vue'

export function useDocumentWorkbench(options: {
  editor: Ref<HTMLElement | null>
  open: Ref<boolean>
  mode: Ref<'write' | 'split' | 'preview'>
  beforeChange: () => void
  commit: () => void
}) {
  const viewport = ref<HTMLElement | null>(null)
  const zoom = ref(100)
  const zoomMode = ref<'manual' | 'width' | 'page'>('width')
  const ribbonTab = ref<'home' | 'insert' | 'view' | 'markdown'>('home')
  const fontFamily = ref('Arial')
  const fontSize = ref('12')
  const lineHeight = ref('1.5')
  const fonts = ['Arial', 'Calibri', 'Georgia', 'Times New Roman', 'Courier New']
  const sizes = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48, 72]
  const activeFormats = ref<Record<string, boolean>>({})
  const inTable = ref(false)
  const findOpen = ref(false)
  const searchText = ref('')
  const replacement = ref('')
  const feedback = ref('')
  const wordCount = ref(0)
  const characters = ref(0)
  let savedRange: Range | null = null
  let observer: ResizeObserver | undefined
  let zoomRevision = 0
  const zoomStyle = computed(() => ({ '--range-progress': ((zoom.value - 25) / 175) * 100 + '%' }))

  function readSelection() {
    const editor = options.editor.value
    if (!editor || !options.open.value) return
    const selection = window.getSelection()
    if (!selection?.rangeCount || !editor.contains(selection.getRangeAt(0).commonAncestorContainer))
      return
    savedRange = selection.getRangeAt(0).cloneRange()
    activeFormats.value = Object.fromEntries(
      [
        'bold',
        'italic',
        'underline',
        'strikeThrough',
        'insertUnorderedList',
        'insertOrderedList',
        'justifyLeft',
        'justifyCenter',
        'justifyRight',
        'justifyFull'
      ].map((command) => [command, document.queryCommandState(command)])
    )
    const node = selection.anchorNode
    const element = node instanceof HTMLElement ? node : node?.parentElement
    inTable.value = Boolean(element?.closest('table'))
    if (element) {
      const style = getComputedStyle(element)
      const family = style.fontFamily.split(',')[0].replace(/["']/g, '').trim()
      if (fonts.includes(family)) fontFamily.value = family
      fontSize.value = String(Math.round(parseFloat(style.fontSize) * 0.75))
      const spacing = parseFloat(style.lineHeight) / parseFloat(style.fontSize)
      if (Number.isFinite(spacing)) lineHeight.value = String(Math.round(spacing * 100) / 100)
    }
  }
  function restoreSelection(preferSaved = false) {
    const editor = options.editor.value
    if (!editor || options.mode.value === 'write') return false
    const current = window.getSelection()
    if (
      !preferSaved &&
      current?.rangeCount &&
      editor.contains(current.getRangeAt(0).commonAncestorContainer)
    )
      savedRange = current.getRangeAt(0).cloneRange()
    editor.focus({ preventScroll: true })
    const selection = window.getSelection()
    const range =
      savedRange && editor.contains(savedRange.commonAncestorContainer)
        ? savedRange
        : document.createRange()
    if (range !== savedRange) {
      range.selectNodeContents(editor)
      range.collapse(false)
    }
    selection?.removeAllRanges()
    selection?.addRange(range)
    return true
  }
  function refreshStats() {
    const text = options.editor.value?.innerText || ''
    wordCount.value = text.trim() ? text.trim().split(/\s+/u).length : 0
    characters.value = text.length
    readSelection()
  }
  function commit() {
    options.commit()
    refreshStats()
  }
  function command(name: string) {
    if (!restoreSelection()) return
    options.beforeChange()
    document.execCommand('styleWithCSS', false, name.startsWith('justify') ? 'true' : 'false')
    document.execCommand(name)
    document.execCommand('styleWithCSS', false, 'false')
    if (name.startsWith('justify')) markFormatting()
    commit()
  }
  function markFormatting() {
    options.editor.value?.querySelectorAll<HTMLElement>('[style]').forEach((el) => {
      if (el.closest('.katex')) return
      el.dataset.docFormat = 'true'
    })
  }
  function applyFont(property: 'fontName' | 'fontSize', value: string) {
    if (!restoreSelection()) return
    if (property === 'fontName' && !fonts.includes(value)) return
    const points = Math.min(72, Math.max(8, Number(value) || 12))
    options.beforeChange()
    document.execCommand('styleWithCSS', false, 'true')
    // The native size command marks the selection; convert its legacy unit to points.
    document.execCommand(property, false, property === 'fontSize' ? '7' : value)
    if (property === 'fontSize')
      options.editor.value
        ?.querySelectorAll<HTMLElement>('font[size="7"], span[style]')
        .forEach((el) => {
          if (el.getAttribute('size') === '7' || el.style.fontSize === 'xxx-large') {
            el.removeAttribute('size')
            el.style.fontSize = points + 'pt'
          }
        })
    document.execCommand('styleWithCSS', false, 'false')
    markFormatting()
    commit()
  }
  function paragraphSpacing(value: string) {
    if (!['1', '1.15', '1.5', '2'].includes(value) || !restoreSelection()) return
    const selection = window.getSelection()
    const range = selection?.getRangeAt(0)
    if (!range) return
    options.beforeChange()
    options.editor.value
      ?.querySelectorAll<HTMLElement>('p,h1,h2,h3,h4,li,blockquote,div')
      .forEach((el) => {
        if (el.closest('.katex') || el.querySelector('p,div,li')) return
        if (range.intersectsNode(el)) {
          el.style.lineHeight = value
          el.dataset.docFormat = 'true'
        }
      })
    lineHeight.value = value
    commit()
  }
  function editTable(action: 'row' | 'column' | 'removeRow' | 'removeColumn') {
    if (!restoreSelection()) return
    const node = window.getSelection()?.anchorNode
    const origin = node instanceof Element ? node : node?.parentElement
    const cell = origin?.closest('td,th') as HTMLTableCellElement | null
    const row = cell?.parentElement as HTMLTableRowElement | null
    const table = cell?.closest('table')
    if (!cell || !row || !table) return
    options.beforeChange()
    const index = cell.cellIndex
    if (action === 'row') {
      const added = document.createElement('tr')
      for (let i = 0; i < row.cells.length; i++)
        added.appendChild(document.createElement('td')).innerHTML = '<br>'
      row.after(added)
    } else if (action === 'column') {
      Array.from(table.rows).forEach((tr) => {
        const added = document.createElement(tr.cells[index]?.tagName === 'TH' ? 'th' : 'td')
        added.innerHTML = '<br>'
        tr.cells[index]?.after(added)
      })
    } else if (action === 'removeRow') {
      if (table.rows.length === 1) table.remove()
      else row.remove()
    } else {
      if (row.cells.length === 1) table.remove()
      else Array.from(table.rows).forEach((tr) => tr.cells[index]?.remove())
    }
    savedRange = null
    commit()
    feedback.value = 'Tabla actualizada'
  }
  function findNext() {
    const editor = options.editor.value
    if (!editor || !searchText.value) return
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT)
    const nodes: Text[] = []
    let node: Node | null
    while ((node = walker.nextNode()))
      if (!node.parentElement?.closest('.katex,[contenteditable="false"]')) nodes.push(node as Text)
    const text = nodes.map((n) => n.data).join('')
    const query = searchText.value.toLocaleLowerCase('es')
    let from = 0
    if (savedRange && editor.contains(savedRange.endContainer)) {
      const prefix = document.createRange()
      prefix.selectNodeContents(editor)
      prefix.setEnd(savedRange.endContainer, savedRange.endOffset)
      from = prefix.toString().length
    }
    const found = text.toLocaleLowerCase('es').indexOf(query, from)
    const start = found < 0 ? text.toLocaleLowerCase('es').indexOf(query) : found
    if (start < 0) {
      feedback.value = 'Sin coincidencias'
      return
    }
    const range = document.createRange()
    let offset = 0
    let started = false
    for (const current of nodes) {
      if (!started && start < offset + current.length) {
        range.setStart(current, start - offset)
        started = true
      }
      if (started && start + query.length <= offset + current.length) {
        range.setEnd(current, start + query.length - offset)
        break
      }
      offset += current.length
    }
    savedRange = range
    restoreSelection(true)
    range.startContainer.parentElement?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    feedback.value = 'Coincidencia seleccionada'
  }
  function replaceMatch() {
    if (
      !searchText.value ||
      savedRange?.toString().toLocaleLowerCase('es') !== searchText.value.toLocaleLowerCase('es')
    ) {
      findNext()
      return
    }
    if (!restoreSelection(true)) return
    options.beforeChange()
    document.execCommand('insertText', false, replacement.value)
    commit()
    feedback.value = 'Texto reemplazado'
    findNext()
  }
  async function setZoom(value: number, manual = true, anchor?: { x: number; y: number }) {
    if (!Number.isFinite(value)) return
    const pane = viewport.value
    const old = zoom.value
    const next = Math.min(200, Math.max(25, Math.round(value)))
    if (manual) zoomMode.value = 'manual'
    const x = anchor?.x ?? (pane?.clientWidth || 0) / 2
    const y = anchor?.y ?? (pane?.clientHeight || 0) / 2
    const left = pane?.scrollLeft || 0,
      top = pane?.scrollTop || 0
    zoom.value = next
    const revision = ++zoomRevision
    await nextTick()
    if (pane && revision === zoomRevision) {
      pane.scrollLeft = ((left + x) * next) / old - x
      pane.scrollTop = ((top + y) * next) / old - y
    }
  }
  function fitZoom(mode: 'width' | 'page' = 'width') {
    const pane = viewport.value
    if (!pane || !pane.clientWidth) return
    zoomMode.value = mode
    const width = Math.min(1, (pane.clientWidth - 48) / 794)
    const scale =
      mode === 'page'
        ? Math.min(
            width,
            (pane.clientHeight - 48) / Math.max(options.editor.value?.offsetHeight || 1123, 1123)
          )
        : width
    void setZoom(Math.floor(scale * 100), false)
    nextTick(() => {
      pane.scrollTop = 0
      pane.scrollLeft = 0
    })
  }
  function wheelZoom(event: WheelEvent) {
    if (!event.ctrlKey && !event.metaKey) return
    event.preventDefault()
    const bounds = viewport.value?.getBoundingClientRect()
    void setZoom(
      zoom.value + (event.deltaY < 0 ? 5 : -5),
      true,
      bounds ? { x: event.clientX - bounds.left, y: event.clientY - bounds.top } : undefined
    )
  }
  watch(
    viewport,
    (pane) => {
      observer?.disconnect()
      if (!pane) return
      observer = new ResizeObserver(() => {
        if (zoomMode.value !== 'manual') fitZoom(zoomMode.value)
      })
      observer.observe(pane)
    },
    { flush: 'post' }
  )
  watch(options.mode, () =>
    nextTick(() => {
      if (zoomMode.value !== 'manual') fitZoom(zoomMode.value)
    })
  )
  watch(options.open, (open) => {
    savedRange = null
    feedback.value = ''
    findOpen.value = false
    activeFormats.value = {}
    inTable.value = false
    if (open) {
      ribbonTab.value = 'home'
      zoomMode.value = 'width'
      nextTick(() => {
        fitZoom()
        refreshStats()
      })
    }
  })
  onMounted(() => document.addEventListener('selectionchange', readSelection))
  onUnmounted(() => {
    document.removeEventListener('selectionchange', readSelection)
    observer?.disconnect()
  })
  return {
    viewport,
    zoom,
    zoomStyle,
    zoomMode,
    setZoom,
    fitZoom,
    wheelZoom,
    ribbonTab,
    fontFamily,
    fontSize,
    lineHeight,
    fonts,
    sizes,
    activeFormats,
    inTable,
    refreshStats,
    command,
    applyFont,
    paragraphSpacing,
    editTable,
    findOpen,
    searchText,
    replacement,
    findNext,
    replaceMatch,
    feedback,
    wordCount,
    characters
  }
}
