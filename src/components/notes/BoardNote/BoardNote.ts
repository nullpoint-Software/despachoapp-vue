import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useNotesStore, type Note } from '@/composables/useNotesStore'
import { useBrutalMotion } from '@/composables/useBrutalMotion'
import { useAppDialog } from '@/composables/useAppDialog'
import { markdownToVisualHtml, visualHtmlToMarkdown } from '@/utils/documentEditor'
const { notes, storageNotes, isLoading, error, fetchNotes, addNote, updateNote, deleteNote } =
  useNotesStore()
const { prompt: promptDialog, confirm: confirmDialog } = useAppDialog()
const pageRef = ref<HTMLElement | null>(null)
useBrutalMotion(pageRef, ['.directory-header', '.tree-panel', '.directory-content'])
const FOLDERS_KEY = 'notesDirectoryFolders'
const folders = ref<string[]>(loadFolders())
const currentPath = ref('General'),
  query = ref(''),
  editorOpen = ref(false),
  editing = ref<Note | null>(null),
  saving = ref(false)
const rootExpanded = ref(true)
const expandedFolders = ref<Set<string>>(new Set())
const draggedNoteId = ref<number | null>(null)
const dropTarget = ref('')
const moveMessage = ref('')
let moveMessageTimer: number | undefined
const draft = ref({ titulo: '', descripcion: '', folderPath: 'General' })
const editorMode = ref<'write' | 'split' | 'preview'>('preview')
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const visualEditorRef = ref<HTMLElement | null>(null)
const previewZoom = ref(100)
const previewZoomStyle = computed(() => ({
  '--range-progress': `${((previewZoom.value - 70) / 90) * 100}%`
}))
let syncingVisual = false
type MarkdownCommand =
  | 'paragraph'
  | 'heading1'
  | 'heading'
  | 'heading3'
  | 'bold'
  | 'italic'
  | 'underline'
  | 'removeUnderline'
  | 'strikethrough'
  | 'bullets'
  | 'ordered'
  | 'checklist'
  | 'quote'
  | 'link'
  | 'image'
  | 'table'
  | 'code'
  | 'horizontalRule'
  | 'formula'
type EditorSelection = { start: number; end: number; selected: string }
type EditorSnapshot = { value: string; start: number; end: number }
const HISTORY_LIMIT = 150
const undoHistory: EditorSnapshot[] = []
const redoHistory: EditorSnapshot[] = []

function captureSelection(): EditorSelection {
  const value = draft.value.descripcion
  const start = textareaRef.value?.selectionStart ?? value.length
  const end = textareaRef.value?.selectionEnd ?? start
  return { start, end, selected: value.slice(start, end) }
}
function captureEditorSnapshot(): EditorSnapshot {
  const value = draft.value.descripcion
  const start = textareaRef.value?.selectionStart ?? value.length
  const end = textareaRef.value?.selectionEnd ?? start
  return { value, start, end }
}
function pushHistory(stack: EditorSnapshot[], snapshot: EditorSnapshot) {
  stack.push(snapshot)
  if (stack.length > HISTORY_LIMIT) stack.shift()
}
function rememberEditorState() {
  const snapshot = captureEditorSnapshot()
  const previous = undoHistory[undoHistory.length - 1]
  if (previous?.value === snapshot.value) undoHistory[undoHistory.length - 1] = snapshot
  else pushHistory(undoHistory, snapshot)
  redoHistory.length = 0
}
function restoreEditorSnapshot(snapshot: EditorSnapshot) {
  draft.value.descripcion = snapshot.value
  editorMode.value = 'split'
  syncVisualFromMarkdown()
  nextTick(() => {
    const textarea = textareaRef.value
    if (!textarea) return
    const start = Math.min(snapshot.start, snapshot.value.length)
    const end = Math.min(snapshot.end, snapshot.value.length)
    textarea.focus()
    textarea.setSelectionRange(start, end)
  })
}
function undoEditorChange() {
  const snapshot = undoHistory.pop()
  if (!snapshot) return
  pushHistory(redoHistory, captureEditorSnapshot())
  restoreEditorSnapshot(snapshot)
}
function redoEditorChange() {
  const snapshot = redoHistory.pop()
  if (!snapshot) return
  pushHistory(undoHistory, captureEditorSnapshot())
  restoreEditorSnapshot(snapshot)
}
function resetEditorHistory() {
  undoHistory.length = 0
  redoHistory.length = 0
}
function changePreviewZoom(delta: number) {
  previewZoom.value = Math.min(160, Math.max(70, previewZoom.value + delta))
}
function syncVisualFromMarkdown(focus = false) {
  nextTick(() => {
    const editor = visualEditorRef.value
    if (!editor) return
    syncingVisual = true
    editor.innerHTML = markdownToVisualHtml(draft.value.descripcion)
    syncingVisual = false
    if (focus) {
      editor.focus()
      const selection = window.getSelection()
      const range = document.createRange()
      range.selectNodeContents(editor)
      range.collapse(false)
      selection?.removeAllRanges()
      selection?.addRange(range)
    }
  })
}
function syncMarkdownFromVisual() {
  if (syncingVisual || !visualEditorRef.value) return
  draft.value.descripcion = visualHtmlToMarkdown(visualEditorRef.value)
}
function visualSelectionIsActive() {
  const editor = visualEditorRef.value
  if (!editor) return false
  const selection = window.getSelection()
  return (
    document.activeElement === editor ||
    Boolean(selection?.anchorNode && editor.contains(selection.anchorNode))
  )
}
function captureVisualRange() {
  const editor = visualEditorRef.value
  const selection = window.getSelection()
  if (!editor || !selection?.rangeCount) return null
  const range = selection.getRangeAt(0)
  return editor.contains(range.commonAncestorContainer) ? range.cloneRange() : null
}
function restoreVisualRange(range: Range | null) {
  const editor = visualEditorRef.value
  if (!editor) return
  editor.focus()
  const selection = window.getSelection()
  selection?.removeAllRanges()
  if (range) selection?.addRange(range)
  else {
    const fallback = document.createRange()
    fallback.selectNodeContents(editor)
    fallback.collapse(false)
    selection?.addRange(fallback)
  }
}
function escapeVisualHtml(value: string) {
  const element = document.createElement('div')
  element.textContent = value
  return element.innerHTML
}
function insertVisualHtml(html: string) {
  document.execCommand('insertHTML', false, html)
  syncMarkdownFromVisual()
}
function runVisualCommand(command: string, value?: string) {
  visualEditorRef.value?.focus()
  document.execCommand('styleWithCSS', false, 'false')
  document.execCommand(command, false, value)
  syncMarkdownFromVisual()
}
function removeVisualHighlight() {
  const editor = visualEditorRef.value
  const selection = window.getSelection()
  const range = captureVisualRange()
  if (!editor || !range) return

  const highlights = new Set<HTMLElement>()
  const anchor = selection?.anchorNode
  const origin = anchor instanceof Element ? anchor : anchor?.parentElement
  const current = origin?.closest('u,.pinned-highlight') as HTMLElement | null
  if (current && editor.contains(current)) highlights.add(current)

  editor.querySelectorAll<HTMLElement>('u,.pinned-highlight').forEach((element) => {
    if (range.intersectsNode(element)) highlights.add(element)
  })

  highlights.forEach((element) => {
    const parent = element.parentNode
    if (!parent) return
    while (element.firstChild) parent.insertBefore(element.firstChild, element)
    parent.removeChild(element)
  })
  editor.focus()
  syncMarkdownFromVisual()
}
async function applyVisualMarkdown(command: MarkdownCommand) {
  const editor = visualEditorRef.value
  if (!editor) return
  editor.focus()
  const selectedText = window.getSelection()?.toString().trim() || ''
  const savedRange = captureVisualRange()
  switch (command) {
    case 'paragraph':
      runVisualCommand('formatBlock', 'p')
      break
    case 'heading1':
      runVisualCommand('formatBlock', 'h1')
      break
    case 'heading':
      runVisualCommand('formatBlock', 'h2')
      break
    case 'heading3':
      runVisualCommand('formatBlock', 'h3')
      break
    case 'bold':
      runVisualCommand('bold')
      break
    case 'italic':
      runVisualCommand('italic')
      break
    case 'underline':
      runVisualCommand('underline')
      break
    case 'removeUnderline':
      removeVisualHighlight()
      break
    case 'strikethrough':
      runVisualCommand('strikeThrough')
      break
    case 'bullets':
      runVisualCommand('insertUnorderedList')
      break
    case 'ordered':
      runVisualCommand('insertOrderedList')
      break
    case 'checklist':
      insertVisualHtml(
        '<ul class="task-list"><li><input type="checkbox"> Pendiente</li><li><input type="checkbox" checked> Completado</li></ul><p><br></p>'
      )
      break
    case 'quote':
      runVisualCommand('formatBlock', 'blockquote')
      break
    case 'link': {
      const url = await promptDialog({
        title: 'Insertar enlace',
        message: 'Pega la direcci\u00f3n a la que debe llevar el texto seleccionado.',
        inputLabel: 'URL del enlace',
        placeholder: 'https://ejemplo.com',
        confirmLabel: 'Insertar enlace'
      })
      if (!url?.trim()) return
      restoreVisualRange(savedRange)
      runVisualCommand('createLink', url.trim())
      break
    }
    case 'image': {
      const url = await promptDialog({
        title: 'Insertar imagen',
        message:
          'Pega la URL. La descripci\u00f3n aparecer\u00e1 junto a la imagen y podr\u00e1s editarla.',
        inputLabel: 'URL de la imagen',
        placeholder: 'https://sitio.com/imagen.jpg',
        confirmLabel: 'Insertar imagen'
      })
      if (!url?.trim()) return
      restoreVisualRange(savedRange)
      const description = escapeVisualHtml(selectedText || 'Descripci\u00f3n de la imagen')
      const safeUrl = escapeVisualHtml(url.trim())
      insertVisualHtml(
        '<figure class="document-image"><img src="' +
          safeUrl +
          '" alt="' +
          description +
          '" contenteditable="false"><figcaption data-placeholder="Descripci\u00f3n de la imagen">' +
          description +
          '</figcaption></figure><p><br></p>'
      )
      break
    }
    case 'table':
      insertVisualHtml(
        '<table><thead><tr><th>Columna 1</th><th>Columna 2</th></tr></thead><tbody><tr><td>Dato 1</td><td>Dato 2</td></tr><tr><td>Dato 3</td><td>Dato 4</td></tr></tbody></table><p><br></p>'
      )
      break
    case 'code': {
      const code = escapeVisualHtml(selectedText || 'Escribe el c\u00f3digo aqu\u00ed')
      insertVisualHtml('<pre><code>' + code + '</code></pre><p><br></p>')
      break
    }
    case 'horizontalRule':
      insertVisualHtml('<hr><p><br></p>')
      break
    case 'formula': {
      const formula = await promptDialog({
        title: 'Insertar f\u00f3rmula',
        message: 'Escribe la f\u00f3rmula con sintaxis LaTeX.',
        inputLabel: 'F\u00f3rmula',
        placeholder: 'E = mc^2',
        confirmLabel: 'Insertar f\u00f3rmula'
      })
      if (!formula?.trim()) return
      restoreVisualRange(savedRange)
      insertVisualHtml(markdownToVisualHtml('$$\n' + formula.trim() + '\n$$'))
      break
    }
  }
  visualEditorRef.value?.focus()
}
function handleVisualInput() {
  syncMarkdownFromVisual()
}
function leaveImageCaption() {
  const editor = visualEditorRef.value
  const selection = window.getSelection()
  const anchor = selection?.anchorNode
  const origin = anchor instanceof Element ? anchor : anchor?.parentElement
  const caption = origin?.closest('figcaption')
  const figure = caption?.closest('figure.document-image')
  if (!editor || !caption || !figure || !editor.contains(figure)) return false

  const nextElement = figure.nextElementSibling as HTMLElement | null
  let paragraph: HTMLElement
  if (nextElement?.tagName === 'P' && !nextElement.textContent?.trim()) {
    paragraph = nextElement
  } else {
    paragraph = document.createElement('p')
    paragraph.append(document.createElement('br'))
    figure.insertAdjacentElement('afterend', paragraph)
  }

  const range = document.createRange()
  range.selectNodeContents(paragraph)
  range.collapse(true)
  selection?.removeAllRanges()
  selection?.addRange(range)
  syncMarkdownFromVisual()
  return true
}
function handleVisualKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && leaveImageCaption()) {
    event.preventDefault()
    return
  }
  if (!(event.ctrlKey || event.metaKey)) return
  const command = event.key.toLocaleLowerCase()
  if (['b', 'i', 'u', 'k'].includes(command)) {
    event.preventDefault()
    const mapped: MarkdownCommand =
      command === 'b'
        ? 'bold'
        : command === 'i'
          ? 'italic'
          : command === 'u'
            ? event.shiftKey
              ? 'removeUnderline'
              : 'underline'
            : 'link'
    void applyVisualMarkdown(mapped)
  }
}
function handleSourceInput(event: Event) {
  draft.value.descripcion = (event.target as HTMLTextAreaElement).value
  syncVisualFromMarkdown()
}
function handleEditorBeforeInput(event: InputEvent) {
  if (event.inputType === 'historyUndo') {
    event.preventDefault()
    undoEditorChange()
    return
  }
  if (event.inputType === 'historyRedo') {
    event.preventDefault()
    redoEditorChange()
    return
  }
  rememberEditorState()
}
function setEditorMode(mode: 'write' | 'split' | 'preview') {
  editorMode.value = mode
  if (mode === 'write') nextTick(() => textareaRef.value?.focus())
  else syncVisualFromMarkdown(true)
}
function replaceEditorSelection(selection: EditorSelection, replacement: string, highlight = '') {
  const value = draft.value.descripcion
  draft.value.descripcion =
    value.slice(0, selection.start) + replacement + value.slice(selection.end)
  const marker = highlight ? replacement.indexOf(highlight) : -1
  const cursorStart = selection.start + (marker >= 0 ? marker : replacement.length)
  const cursorEnd = marker >= 0 ? cursorStart + highlight.length : cursorStart
  setEditorMode('split')
  nextTick(() => {
    textareaRef.value?.focus()
    textareaRef.value?.setSelectionRange(cursorStart, cursorEnd)
  })
}
function blockSpacing(selection: EditorSelection, block: string) {
  const value = draft.value.descripcion
  const before = value.slice(0, selection.start)
  const after = value.slice(selection.end)
  const lead = before && !before.endsWith('\n\n') ? (before.endsWith('\n') ? '\n' : '\n\n') : ''
  const tail = after && !after.startsWith('\n\n') ? (after.startsWith('\n') ? '\n' : '\n\n') : ''
  return lead + block + tail
}
function removeSourceHighlight(selection: EditorSelection) {
  const value = draft.value.descripcion
  const selected = value.slice(selection.start, selection.end)
  const withoutTags = selected.replace(/<\/?u\b[^>]*>/gi, '')
  if (selected && withoutTags !== selected) {
    replaceEditorSelection(selection, withoutTags, withoutTags)
    return true
  }

  const before = value.slice(0, selection.start)
  const openingTags = [...before.matchAll(/<u\b[^>]*>/gi)]
  const opening = openingTags[openingTags.length - 1]
  const lastClose = before.toLocaleLowerCase().lastIndexOf('</u>')
  if (!opening || opening.index === undefined || opening.index < lastClose) return false

  const closingOffset = value.slice(selection.end).toLocaleLowerCase().indexOf('</u>')
  if (closingOffset < 0) return false
  const closeStart = selection.end + closingOffset
  const innerStart = opening.index + opening[0].length
  const inner = value.slice(innerStart, closeStart)
  replaceEditorSelection(
    { start: opening.index, end: closeStart + 4, selected: inner },
    inner,
    inner
  )
  return true
}
function applyMarkdown(command: MarkdownCommand) {
  if (editorMode.value === 'preview' || visualSelectionIsActive()) {
    void applyVisualMarkdown(command)
    return
  }
  rememberEditorState()
  const selection = captureSelection()
  const chosen = selection.selected
  switch (command) {
    case 'paragraph': {
      const text =
        chosen ||
        'Escribe un p\u00e1rrafo. Deja una l\u00ednea vac\u00eda para comenzar el siguiente.'
      replaceEditorSelection(selection, blockSpacing(selection, text), text)
      break
    }
    case 'heading1':
    case 'heading':
    case 'heading3': {
      const text = chosen || 'T\u00edtulo de secci\u00f3n'
      const prefix = command === 'heading1' ? '# ' : command === 'heading3' ? '### ' : '## '
      replaceEditorSelection(selection, blockSpacing(selection, prefix + text), text)
      break
    }
    case 'bold': {
      const text = chosen || 'texto importante'
      replaceEditorSelection(selection, '**' + text + '**', text)
      break
    }
    case 'italic': {
      const text = chosen || '\u00e9nfasis'
      replaceEditorSelection(selection, '*' + text + '*', text)
      break
    }
    case 'underline': {
      if (removeSourceHighlight(selection)) break
      const text = chosen || 'texto para la nota anclada'
      replaceEditorSelection(selection, '<u>' + text + '</u>', text)
      break
    }
    case 'removeUnderline':
      removeSourceHighlight(selection)
      break
    case 'strikethrough': {
      const text = chosen || 'texto eliminado'
      replaceEditorSelection(selection, '~~' + text + '~~', text)
      break
    }
    case 'bullets': {
      const text = chosen || 'Primer elemento\nSegundo elemento'
      const list = text
        .split('\n')
        .map((line) => '- ' + line)
        .join('\n')
      replaceEditorSelection(
        selection,
        blockSpacing(selection, list),
        chosen ? '' : 'Primer elemento'
      )
      break
    }
    case 'ordered': {
      const text = chosen || 'Primer paso\nSegundo paso'
      const list = text
        .split('\n')
        .map((line, index) => index + 1 + '. ' + line)
        .join('\n')
      replaceEditorSelection(selection, blockSpacing(selection, list), chosen ? '' : 'Primer paso')
      break
    }
    case 'checklist': {
      const text = chosen || 'Pendiente\nCompletado'
      const list = text
        .split('\n')
        .map((line, index) => '- [' + (index ? 'x' : ' ') + '] ' + line)
        .join('\n')
      replaceEditorSelection(selection, blockSpacing(selection, list), chosen ? '' : 'Pendiente')
      break
    }
    case 'quote': {
      const text = chosen || 'Texto de la cita'
      const quote = text
        .split('\n')
        .map((line) => '> ' + line)
        .join('\n')
      replaceEditorSelection(selection, blockSpacing(selection, quote), text)
      break
    }
    case 'link': {
      const text = chosen || 'texto del enlace'
      replaceEditorSelection(
        selection,
        '[' + text + '](https://ejemplo.com)',
        'https://ejemplo.com'
      )
      break
    }
    case 'image':
      void insertImage(selection)
      break
    case 'table':
      replaceEditorSelection(
        selection,
        blockSpacing(
          selection,
          '| Columna 1 | Columna 2 |\n' +
            '| --- | --- |\n' +
            '| Dato 1 | Dato 2 |\n' +
            '| Dato 3 | Dato 4 |'
        ),
        'Columna 1'
      )
      break
    case 'code': {
      const text = chosen || 'Escribe el c\u00f3digo aqu\u00ed'
      replaceEditorSelection(selection, blockSpacing(selection, '```\n' + text + '\n```'), text)
      break
    }
    case 'horizontalRule':
      replaceEditorSelection(selection, blockSpacing(selection, '---'))
      break
    case 'formula': {
      const text = chosen || 'E = mc^2'
      replaceEditorSelection(selection, blockSpacing(selection, '$$\n' + text + '\n$$'), text)
      break
    }
  }
}
async function insertImage(selection: EditorSelection = captureSelection()) {
  const url = await promptDialog({
    title: 'Insertar imagen',
    message:
      'Pega la URL p\u00fablica de la imagen. El texto seleccionado se usar\u00e1 como descripci\u00f3n accesible.',
    inputLabel: 'URL de la imagen',
    placeholder: 'https://sitio.com/imagen.jpg',
    confirmLabel: 'Insertar imagen'
  })
  if (!url?.trim()) return
  const description = selection.selected || 'Descripci\u00f3n de la imagen'
  replaceEditorSelection(selection, '![' + description + '](' + url.trim() + ')')
}
function handleEditorKeydown(event: KeyboardEvent) {
  if (!(event.ctrlKey || event.metaKey)) return
  const command = event.key.toLocaleLowerCase()
  if (command === 'z') {
    event.preventDefault()
    if (event.shiftKey) redoEditorChange()
    else undoEditorChange()
  } else if (command === 'y') {
    event.preventDefault()
    redoEditorChange()
  } else if (command === 'b') {
    event.preventDefault()
    applyMarkdown('bold')
  } else if (command === 'i') {
    event.preventDefault()
    applyMarkdown('italic')
  } else if (command === 'u') {
    event.preventDefault()
    applyMarkdown(event.shiftKey ? 'removeUnderline' : 'underline')
  } else if (command === 'k') {
    event.preventDefault()
    applyMarkdown('link')
  }
}
function normalizePath(path: string) {
  const clean = String(path || '')
    .split('/')
    .map((part) => part.trim().replace(/[\\/]+/g, '-'))
    .filter(Boolean)
  if (!clean.length) return 'General'
  if (clean[0].toLocaleLowerCase('es') !== 'general') clean.unshift('General')
  return clean.join('/')
}
function folderAncestors(path: string) {
  const normalized = normalizePath(path)
  const parts = normalized.split('/')
  return parts.slice(1).map((_, index) => parts.slice(0, index + 2).join('/'))
}
function loadFolders() {
  try {
    return JSON.parse(localStorage.getItem(FOLDERS_KEY) || '[]')
      .map(normalizePath)
      .filter((path: string) => path !== 'General')
  } catch {
    return []
  }
}
function saveFolders() {
  folders.value = [
    ...new Set(folders.value.map(normalizePath).filter((path) => path && path !== 'General'))
  ].sort((a, b) => a.localeCompare(b, 'es'))
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders.value))
}
const allDirectoryFolders = computed(() => {
  const fromNotes = notes.value.flatMap((note) =>
    note.folderPath && note.folderPath !== 'General' ? folderAncestors(note.folderPath) : []
  )
  return [
    ...new Set(
      [...folders.value, ...fromNotes].map(normalizePath).filter((path) => path !== 'General')
    )
  ].sort((a, b) => a.localeCompare(b, 'es'))
})
const directoryFolders = computed(() =>
  rootExpanded.value
    ? allDirectoryFolders.value.filter((folder) =>
        folderAncestors(folder)
          .slice(0, -1)
          .every((parent) => expandedFolders.value.has(parent))
      )
    : []
)
const folderOptions = computed(() => ['General', ...allDirectoryFolders.value])
function hasChildren(folder: string) {
  const target = normalizePath(folder)
  return allDirectoryFolders.value.some((candidate) => candidate.startsWith(`${target}/`))
}
function isExpanded(folder: string) {
  return expandedFolders.value.has(normalizePath(folder))
}
function toggleFolder(folder: string) {
  const target = normalizePath(folder)
  const next = new Set(expandedFolders.value)
  if (next.has(target)) next.delete(target)
  else next.add(target)
  expandedFolders.value = next
}
function expandPath(path: string) {
  rootExpanded.value = true
  const next = new Set(expandedFolders.value)
  folderAncestors(path)
    .slice(0, -1)
    .forEach((parent) => next.add(parent))
  expandedFolders.value = next
}
function selectRoot() {
  currentPath.value = 'General'
  rootExpanded.value = !rootExpanded.value
}
function selectFolder(folder: string) {
  currentPath.value = normalizePath(folder)
  if (hasChildren(folder)) toggleFolder(folder)
}
const breadcrumbs = computed(() =>
  currentPath.value.startsWith('__')
    ? [currentPath.value === '__storage' ? 'Archivadas' : 'General']
    : normalizePath(currentPath.value).split('/')
)
const currentLabel = computed(() => breadcrumbs.value.join(' / '))
const visibleNotes = computed(() => {
  const q = query.value.trim().toLocaleLowerCase('es')
  return notes.value.filter((note) => {
    const notePath = normalizePath(note.folderPath || 'General')
    const activePath = currentPath.value.startsWith('__')
      ? currentPath.value
      : normalizePath(currentPath.value)
    const inPath =
      activePath === '__storage'
        ? note.status === 'storage'
        : note.status !== 'storage' && notePath === activePath
    const matches =
      !q || `${note.titulo} ${note.descripcion} ${notePath}`.toLocaleLowerCase('es').includes(q)
    return inPath && matches
  })
})
function countFolder(folder: string) {
  const target = normalizePath(folder)
  return notes.value.filter((note) => {
    const path = normalizePath(note.folderPath || 'General')
    return note.status !== 'storage' && (path === target || path.startsWith(`${target}/`))
  }).length
}
function plain(value: string) {
  return (
    String(value || '')
      .replace(/<[^>]+>/g, '')
      .replace(/[#*_>`\[\]]/g, '')
      .slice(0, 95) || 'Documento sin contenido'
  )
}
function folderName(folder: string) {
  const parts = normalizePath(folder).split('/')
  return parts[parts.length - 1]
}
function folderDepth(folder: string) {
  return Math.max(1, normalizePath(folder).split('/').length - 1)
}
function treeIndent(folder: string) {
  return { '--depth': String(folderDepth(folder)) }
}
function branchMark(folder: string) {
  return hasChildren(folder) ? (isExpanded(folder) ? '−' : '+') : '·'
}
function showMoveMessage(message: string) {
  moveMessage.value = message
  if (moveMessageTimer) window.clearTimeout(moveMessageTimer)
  moveMessageTimer = window.setTimeout(() => {
    moveMessage.value = ''
  }, 3200)
}
function setDropTarget(folder: string) {
  if (draggedNoteId.value !== null) dropTarget.value = normalizePath(folder)
}
function clearDropTarget(folder: string) {
  if (dropTarget.value === normalizePath(folder)) dropTarget.value = ''
}
function startNoteDrag(event: DragEvent, note: Note) {
  draggedNoteId.value = note.id
  event.dataTransfer?.setData('text/plain', String(note.id))
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}
function finishNoteDrag() {
  draggedNoteId.value = null
  dropTarget.value = ''
}
async function moveDraggedNote(folder: string) {
  const note = notes.value.find((item) => item.id === draggedNoteId.value)
  const target = normalizePath(folder)
  if (!note) {
    finishNoteDrag()
    return
  }
  const current = normalizePath(note.folderPath || 'General')
  if (current !== target) {
    await updateNote(
      note.id,
      note.status === 'storage'
        ? { folderPath: target, archivedFromPath: target }
        : { folderPath: target }
    )
    if (target !== 'General') {
      folders.value.push(...folderAncestors(target))
      saveFolders()
    }
    expandPath(target)
    showMoveMessage(`“${note.titulo || 'Sin título'}” se movió a ${target}.`)
  }
  finishNoteDrag()
}

async function createFolder() {
  const name = await promptDialog({
    title: 'Nueva subcarpeta',
    message: 'Escribe el nombre de la carpeta que deseas crear.',
    inputLabel: 'Nombre',
    placeholder: 'Ej. Declaraciones',
    confirmLabel: 'Crear carpeta'
  })
  if (!name?.trim()) return
  const base = currentPath.value.startsWith('__') ? 'General' : normalizePath(currentPath.value)
  const path = normalizePath(`${base}/${name}`)
  folders.value.push(...folderAncestors(path))
  saveFolders()
  expandPath(path)
  currentPath.value = path
}
function createNote() {
  const target = currentPath.value.startsWith('__') ? 'General' : normalizePath(currentPath.value)
  editing.value = null
  draft.value = { titulo: '', descripcion: '', folderPath: target }
  resetEditorHistory()
  previewZoom.value = 100
  editorMode.value = 'preview'
  editorOpen.value = true
  syncVisualFromMarkdown()
}
function openNote(note: Note) {
  editing.value = note
  draft.value = {
    titulo: note.titulo,
    descripcion: note.descripcion,
    folderPath: normalizePath(note.folderPath || 'General')
  }
  resetEditorHistory()
  previewZoom.value = 100
  editorMode.value = 'preview'
  editorOpen.value = true
  syncVisualFromMarkdown()
}
function closeEditor() {
  if (!saving.value) editorOpen.value = false
}
async function saveEditor() {
  if (editorMode.value !== 'write') syncMarkdownFromVisual()
  if (!draft.value.titulo.trim()) return
  saving.value = true
  const path = normalizePath(draft.value.folderPath)
  if (path !== 'General') {
    folders.value.push(...folderAncestors(path))
    saveFolders()
  }
  try {
    if (editing.value) await updateNote(editing.value.id, { ...draft.value, folderPath: path })
    else
      await addNote({
        ...draft.value,
        folderPath: path,
        pinned: false,
        color: 'white',
        status: 'canvas'
      })
    expandPath(path)
    currentPath.value = path
    editorOpen.value = false
  } finally {
    saving.value = false
  }
}
async function deleteFolder(folder: string) {
  const target = normalizePath(folder)
  const affected = notes.value.filter((note) => {
    const path = normalizePath(note.folderPath || 'General')
    return path === target || path.startsWith(`${target}/`)
  })
  const message = affected.length
    ? `${affected.length} nota(s) pasarán a General al eliminar “${folderName(target)}”.`
    : `Se eliminará la carpeta “${folderName(target)}”.`
  if (
    !(await confirmDialog({
      title: 'Eliminar carpeta',
      message,
      tone: 'danger',
      confirmLabel: 'Eliminar carpeta'
    }))
  )
    return
  folders.value = folders.value.filter((path) => {
    const normalized = normalizePath(path)
    return normalized !== target && !normalized.startsWith(`${target}/`)
  })
  saveFolders()
  for (const note of affected) await updateNote(note.id, { folderPath: 'General' })
  if (currentPath.value === target || normalizePath(currentPath.value).startsWith(`${target}/`))
    currentPath.value = 'General'
}
function togglePin(note: Note) {
  updateNote(note.id, { pinned: !Boolean(note.pinned) })
}
async function toggleArchive(note: Note) {
  if (note.status === 'storage') {
    const restorePath = normalizePath(note.archivedFromPath || note.folderPath || 'General')
    if (restorePath !== 'General') {
      folders.value.push(...folderAncestors(restorePath))
      saveFolders()
    }
    await updateNote(note.id, {
      status: 'canvas',
      folderPath: restorePath,
      archivedFromPath: restorePath
    })
    expandPath(restorePath)
    currentPath.value = restorePath
    showMoveMessage(`“${note.titulo || 'Sin título'}” regresó a ${restorePath}.`)
    return
  }
  const originPath = normalizePath(note.folderPath || 'General')
  await updateNote(note.id, {
    status: 'storage',
    folderPath: originPath,
    archivedFromPath: originPath
  })
  showMoveMessage(`“${note.titulo || 'Sin título'}” se archivó desde ${originPath}.`)
}
async function removeNote(note: Note) {
  if (
    await confirmDialog({
      title: 'Eliminar nota',
      message: `Se eliminará “${note.titulo}”.`,
      tone: 'danger',
      confirmLabel: 'Eliminar nota'
    })
  )
    await deleteNote(note.id)
}
onMounted(fetchNotes)
onUnmounted(() => {
  if (moveMessageTimer) window.clearTimeout(moveMessageTimer)
})
